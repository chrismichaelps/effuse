/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
	mkdtempSync,
	writeFileSync,
	rmSync,
	existsSync,
	mkdirSync,
	readFileSync,
} from 'node:fs';
import { resolve } from 'node:path';
import { tmpdir } from 'node:os';
import type {
	LayerServerManifest,
	LayerServerManifestAction,
	LayerServerManifestRoute,
	ServerMetadataDiagnostic,
} from '@effuse/core';
import { runCli } from '../cli.js';
import { ManifestResolver } from '../services/manifest.js';

const metadataConflict: ServerMetadataDiagnostic = {
	code: 'metadata_conflict',
	key: 'runtime',
	layer: 'admin',
	message: 'Server metadata "runtime" on /api/admin overrides layer metadata from admin.',
	target: '/api/admin',
};

const usersRoute: LayerServerManifestRoute = {
	layer: 'users',
	metadata: {
		cache: { revalidate: 60, tags: ['users'] },
		cors: { methods: ['GET'], origin: ['https://app.example.com'] },
		runtime: 'edge',
	},
	methods: ['GET', 'POST'],
	path: '/api/users',
	source: 'api',
};

const adminRoute: LayerServerManifestRoute = {
	diagnostics: [metadataConflict],
	layer: 'admin',
	metadata: { runtime: 'node' },
	methods: ['GET'],
	path: '/api/admin',
	source: 'routes',
};

const refreshAction: LayerServerManifestAction = {
	layer: 'users',
	legacyPath: '/_effuse/actions/refresh',
	metadata: { runtime: 'node' },
	method: 'POST',
	name: 'refresh',
	path: '/_effuse/actions/users/refresh',
};

const serverManifest: LayerServerManifest = {
	actions: [refreshAction],
	diagnostics: [metadataConflict],
	layers: [
		{ actions: [refreshAction], name: 'users', routes: [usersRoute] },
		{ actions: [], name: 'admin', routes: [adminRoute] },
	],
	routes: [usersRoute, adminRoute],
};

describe('ManifestResolver', () => {
	let tempDir: string;
	let resolver: ManifestResolver;

	beforeEach(() => {
		tempDir = mkdtempSync(resolve(tmpdir(), 'effuse-manifest-test-'));
		resolver = new ManifestResolver();
	});

	afterEach(() => {
		rmSync(tempDir, { recursive: true, force: true });
		vi.restoreAllMocks();
		process.exitCode = undefined;
	});

	it('should return null when manifest.json does not exist', () => {
		const result = resolver.resolve(tempDir);
		expect(result).toBeNull();
	});

	it('should parse and return a valid Vite manifest', () => {
		mkdirSync(resolve(tempDir, 'dist/client'), { recursive: true });
		const manifest = {
			'src/main.ts': {
				file: 'assets/main-abc123.js',
				isEntry: true,
				css: ['assets/main-abc123.css'],
			},
			'chunk-vendor': {
				file: 'assets/vendor-def456.js',
			},
		};
		writeFileSync(
			resolve(tempDir, 'dist/client/manifest.json'),
			JSON.stringify(manifest),
			'utf-8'
		);

		const result = resolver.resolve(tempDir);
		expect(result).not.toBeNull();
		expect(result).toHaveProperty('src/main.ts');
		expect(result!['src/main.ts'].file).toBe('assets/main-abc123.js');
		expect(result!['src/main.ts'].css).toEqual(['assets/main-abc123.css']);
	});

	it('should return null for invalid JSON', () => {
		mkdirSync(resolve(tempDir, 'dist/client'), { recursive: true });
		writeFileSync(resolve(tempDir, 'dist/client/manifest.json'), 'not json', 'utf-8');

		const result = resolver.resolve(tempDir);
		expect(result).toBeNull();
	});

	it('should return null for malformed manifest structure', () => {
		mkdirSync(resolve(tempDir, 'dist/client'), { recursive: true });
		writeFileSync(
			resolve(tempDir, 'dist/client/manifest.json'),
			JSON.stringify({ 'src/main.ts': { src: 'main.ts' } }),
			'utf-8'
		);

		const result = resolver.resolve(tempDir);
		expect(result).toBeNull();
	});

	it('should serialize manifest back to JSON', () => {
		const manifest = {
			entry: { file: 'entry.js', isEntry: true },
		};
		const serialized = resolver.serialize(manifest);
		expect(JSON.parse(serialized)).toEqual(manifest);
	});

	it('should parse an Effuse server manifest file', () => {
		const manifestPath = resolve(tempDir, 'server-manifest.json');
		writeFileSync(manifestPath, JSON.stringify(serverManifest), 'utf-8');

		const result = resolver.resolveLayerServerManifestFile(tempDir, manifestPath);

		expect(result).toEqual(serverManifest);
	});

	it('should format routes, actions, metadata, and diagnostics by layer', () => {
		const output = resolver.formatLayerServerManifest(serverManifest);

		expect(output).toContain('Effuse server manifest');
		expect(output).toContain('Layers: 2');
		expect(output).toContain('Routes: 2');
		expect(output).toContain('Actions: 1');
		expect(output).toContain('  users');
		expect(output).toContain(
			'GET,POST /api/users [api] runtime=edge revalidate=60 tags=users cors=https://app.example.com cors-methods=GET'
		);
		expect(output).toContain(
			'POST /_effuse/actions/users/refresh (refresh) runtime=node'
		);
		expect(output).toContain('GET /api/admin [routes] runtime=node conflicts');
		expect(output).toContain('Diagnostics');
		expect(output).toContain('metadata_conflict admin /api/admin runtime');
	});

	it('should generate a deterministic typed server client module', () => {
		const output = resolver.generateLayerServerClientModule(serverManifest, {
			factoryName: 'createServerClient',
			manifestName: 'serverManifest',
			clientTypeName: 'ServerClient',
			importSource: '@effuse/core',
		});

		expect(output).toContain(
			'import { createLayerServerManifestClient, type LayerActionCallOptions, type LayerServerManifest } from "@effuse/core";'
		);
		expect(output).toContain('export const serverManifest = {');
		expect(output).toContain('"path": "/api/users"');
		expect(output).toContain('export const createServerClient = (options?: LayerActionCallOptions) =>');
		expect(output).toContain('export type ServerClient = ReturnType<typeof createServerClient>;');
	});

	it('should write generated server clients to nested output paths', () => {
		const outputPath = resolver.writeLayerServerClientModule(
			tempDir,
			'src/generated/effuse-server-client.ts',
			serverManifest,
			{
				factoryName: 'createServerClient',
				manifestName: 'serverManifest',
				clientTypeName: 'ServerClient',
			}
		);

		expect(outputPath).toBe(resolve(tempDir, 'src/generated/effuse-server-client.ts'));
		expect(existsSync(outputPath)).toBe(true);
		expect(readFileSync(outputPath, 'utf-8')).toContain(
			'createLayerServerManifestClient(serverManifest, options)'
		);
	});

	it('should print a formatted server manifest from the CLI', async () => {
		const manifestPath = resolve(tempDir, 'server-manifest.json');
		writeFileSync(manifestPath, JSON.stringify(serverManifest), 'utf-8');
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		await runCli(['manifest', '--file', manifestPath]);

		expect(error).not.toHaveBeenCalled();
		expect(log).toHaveBeenCalledWith(expect.stringContaining('Effuse server manifest'));
		expect(log).toHaveBeenCalledWith(expect.stringContaining('/api/users'));
	});

	it('should generate a typed server client from the CLI', async () => {
		const manifestPath = resolve(tempDir, 'server-manifest.json');
		const clientPath = resolve(tempDir, 'src/generated/client.ts');
		writeFileSync(manifestPath, JSON.stringify(serverManifest), 'utf-8');
		const log = vi.spyOn(console, 'log').mockImplementation(() => undefined);
		const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);

		await runCli([
			'manifest',
			'--file',
			manifestPath,
			'--client-out',
			clientPath,
			'--client-factory',
			'createServerClient',
			'--client-manifest',
			'serverManifest',
			'--client-type',
			'ServerClient',
		]);

		expect(error).not.toHaveBeenCalled();
		expect(existsSync(clientPath)).toBe(true);
		expect(readFileSync(clientPath, 'utf-8')).toContain(
			'export const createServerClient = (options?: LayerActionCallOptions) =>'
		);
		expect(log).toHaveBeenCalledWith(
			expect.stringContaining('Generated server client:')
		);
	});
});
