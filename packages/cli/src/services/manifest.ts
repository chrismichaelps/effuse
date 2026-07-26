import { dirname, join, resolve } from 'node:path';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import {
	generateLayerServerClientModule,
	type GenerateLayerServerClientModuleOptions,
} from '@effuse/core';
import type {
	LayerServerManifest,
	LayerServerManifestAction,
	LayerServerManifestLayer,
	LayerServerManifestRoute,
	ServerCacheMetadata,
	ServerCorsMetadata,
	ServerMetadataDiagnostic,
	ServerRouteMetadata,
} from '@effuse/core';
import { DEFAULT_CONFIG } from '../constants.js';

export interface ManifestChunk {
	readonly file: string;
	readonly src?: string;
	readonly isEntry?: boolean;
	readonly isDynamicEntry?: boolean;
	readonly imports?: readonly string[];
	readonly css?: readonly string[];
	readonly assets?: readonly string[];
}

export type AssetManifest = Record<string, ManifestChunk>;

export type LayerServerClientGenerationOptions =
	GenerateLayerServerClientModuleOptions;

export const DEFAULT_SERVER_MANIFEST_PATH = join(
	DEFAULT_CONFIG.outDirServer,
	'effuse-server-manifest.json'
);

const formatStringList = (value: string | readonly string[]): string =>
	typeof value === 'string' ? value : value.join(',');

const formatCacheMetadata = (cache: ServerCacheMetadata): readonly string[] => [
	...(cache.cacheControl ? [`cache=${cache.cacheControl}`] : []),
	...(cache.revalidate !== undefined
		? [`revalidate=${String(cache.revalidate)}`]
		: []),
	...(cache.tags && cache.tags.length > 0
		? [`tags=${cache.tags.join(',')}`]
		: []),
];

const formatCorsOrigin = (
	origin: ServerCorsMetadata['origin']
): string | undefined => {
	if (origin === undefined) return undefined;
	if (origin === true) return '*';
	if (origin === false) return 'false';
	return formatStringList(origin);
};

const formatCorsMetadata = (cors: ServerCorsMetadata): readonly string[] => {
	const origin = formatCorsOrigin(cors.origin);
	return [
		...(origin ? [`cors=${origin}`] : []),
		...(cors.credentials !== undefined
			? [`credentials=${String(cors.credentials)}`]
			: []),
		...(cors.methods && cors.methods.length > 0
			? [`cors-methods=${cors.methods.join(',')}`]
			: []),
		...(cors.headers && cors.headers.length > 0
			? [`cors-headers=${cors.headers.join(',')}`]
			: []),
		...(cors.maxAge !== undefined
			? [`cors-max-age=${String(cors.maxAge)}`]
			: []),
	];
};

const formatRouteMetadata = (
	metadata: ServerRouteMetadata | undefined
): string => {
	if (!metadata) return '';

	const parts = [
		...(metadata.runtime ? [`runtime=${metadata.runtime}`] : []),
		...(metadata.region ? [`region=${formatStringList(metadata.region)}`] : []),
		...(metadata.maxDuration !== undefined
			? [`max-duration=${String(metadata.maxDuration)}`]
			: []),
		...(metadata.cache ? formatCacheMetadata(metadata.cache) : []),
		...(metadata.cors ? formatCorsMetadata(metadata.cors) : []),
	];

	return parts.length > 0 ? ` ${parts.join(' ')}` : '';
};

const formatDiagnosticsBadge = (
	diagnostics: readonly ServerMetadataDiagnostic[] | undefined
): string => diagnostics && diagnostics.length > 0 ? ' conflicts' : '';

const formatRouteLine = (route: LayerServerManifestRoute): string =>
	`    ${route.methods.join(',')} ${route.path} [${route.source}]${formatRouteMetadata(route.metadata)}${formatDiagnosticsBadge(route.diagnostics)}`;

const formatActionLine = (action: LayerServerManifestAction): string =>
	`    ${action.method} ${action.path} (${action.name})${formatRouteMetadata(action.metadata)}${formatDiagnosticsBadge(action.diagnostics)}`;

const hasServerEntries = (layer: LayerServerManifestLayer): boolean =>
	layer.routes.length > 0 || layer.actions.length > 0;

const appendLayerRoutes = (
	lines: string[],
	layer: LayerServerManifestLayer
): void => {
	if (layer.routes.length === 0) return;
	lines.push(`  ${layer.name}`);
	for (const route of layer.routes) {
		lines.push(formatRouteLine(route));
	}
};

const appendLayerActions = (
	lines: string[],
	layer: LayerServerManifestLayer
): void => {
	if (layer.actions.length === 0) return;
	lines.push(`  ${layer.name}`);
	for (const action of layer.actions) {
		lines.push(formatActionLine(action));
	}
};

const appendDiagnostics = (
	lines: string[],
	diagnostics: readonly ServerMetadataDiagnostic[] | undefined
): void => {
	if (!diagnostics || diagnostics.length === 0) return;

	lines.push('', 'Diagnostics');
	for (const diagnostic of diagnostics) {
		const layer = diagnostic.layer ?? 'unbound';
		lines.push(
			`  ${diagnostic.code} ${layer} ${diagnostic.target} ${diagnostic.key}`
		);
		lines.push(`    ${diagnostic.message}`);
	}
};

export class ManifestResolver {
	/**
	 * Read and parse the Vite client manifest.json.
	 * Returns `null` if the file does not exist or is invalid.
	 */
	resolve(cwd: string): AssetManifest | null {
		const manifestPath = resolve(cwd, DEFAULT_CONFIG.outDirClient, 'manifest.json');
		if (!existsSync(manifestPath)) {
			return null;
		}

		try {
			const content = readFileSync(manifestPath, 'utf-8');
			const parsed = JSON.parse(content) as unknown;

			if (!this.isValidManifest(parsed)) {
				return null;
			}

			return parsed;
		} catch {
			return null;
		}
	}

	resolveLayerServerManifestFile(
		cwd: string,
		filePath: string = DEFAULT_SERVER_MANIFEST_PATH
	): LayerServerManifest | null {
		const manifestPath = resolve(cwd, filePath);
		if (!existsSync(manifestPath)) {
			return null;
		}

		try {
			const parsed = JSON.parse(readFileSync(manifestPath, 'utf-8')) as unknown;
			if (!this.isValidLayerServerManifest(parsed)) {
				return null;
			}
			return parsed;
		} catch {
			return null;
		}
	}

	/**
	 * Serialize manifest to a JSON string for embedding or writing.
	 */
	serialize(manifest: AssetManifest): string {
		return JSON.stringify(manifest, null, 2);
	}

	formatLayerServerManifest(manifest: LayerServerManifest): string {
		const activeLayers = manifest.layers.filter(hasServerEntries);
		const lines = [
			'Effuse server manifest',
			`Layers: ${String(manifest.layers.length)}`,
			`Routes: ${String(manifest.routes.length)}`,
			`Actions: ${String(manifest.actions.length)}`,
		];

		lines.push('', 'Routes');
		if (manifest.routes.length === 0) {
			lines.push('  none');
		} else {
			for (const layer of activeLayers) {
				appendLayerRoutes(lines, layer);
			}
		}

		lines.push('', 'Actions');
		if (manifest.actions.length === 0) {
			lines.push('  none');
		} else {
			for (const layer of activeLayers) {
				appendLayerActions(lines, layer);
			}
		}

		appendDiagnostics(lines, manifest.diagnostics);

		return lines.join('\n');
	}

	generateLayerServerClientModule(
		manifest: LayerServerManifest,
		options?: LayerServerClientGenerationOptions
	): string {
		return generateLayerServerClientModule(manifest, options);
	}

	writeLayerServerClientModule(
		cwd: string,
		outputPath: string,
		manifest: LayerServerManifest,
		options?: LayerServerClientGenerationOptions
	): string {
		const resolvedOutputPath = resolve(cwd, outputPath);
		mkdirSync(dirname(resolvedOutputPath), { recursive: true });
		writeFileSync(
			resolvedOutputPath,
			this.generateLayerServerClientModule(manifest, options),
			'utf-8'
		);
		return resolvedOutputPath;
	}

	private isValidManifest(value: unknown): value is AssetManifest {
		if (typeof value !== 'object' || value === null) {
			return false;
		}
		// Basic structural check — Vite manifest is a flat record of chunks
		for (const chunk of Object.values(value)) {
			if (typeof chunk !== 'object' || chunk === null) {
				return false;
			}
			if (typeof (chunk as Record<string, unknown>).file !== 'string') {
				return false;
			}
		}
		return true;
	}

	private isValidLayerServerManifest(value: unknown): value is LayerServerManifest {
		if (typeof value !== 'object' || value === null) {
			return false;
		}
		const record = value as Record<string, unknown>;
		return (
			Array.isArray(record.layers) &&
			Array.isArray(record.routes) &&
			Array.isArray(record.actions)
		);
	}
}
