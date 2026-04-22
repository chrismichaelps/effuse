import { resolve } from 'node:path';
import { readFileSync, existsSync } from 'node:fs';
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

	/**
	 * Serialize manifest to a JSON string for embedding or writing.
	 */
	serialize(manifest: AssetManifest): string {
		return JSON.stringify(manifest, null, 2);
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
}
