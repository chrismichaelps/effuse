import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';

const readProjectFile = (path: string): string =>
	readFileSync(new URL(`../../../${path}`, import.meta.url), 'utf8');

describe('@effuse/core entrypoints', () => {
	it('publishes explicit browser, client, and server entrypoints', () => {
		const manifest = JSON.parse(readProjectFile('package.json')) as {
			exports: Record<string, unknown>;
		};

		expect(manifest.exports['.']).toMatchObject({
			browser: {
				types: './dist/client.d.ts',
				default: './dist/client.js',
			},
		});
		expect(manifest.exports['./client']).toMatchObject({
			import: {
				types: './dist/client.d.ts',
				default: './dist/client.js',
			},
		});
		expect(manifest.exports['./server']).toMatchObject({
			import: {
				types: './dist/server.d.ts',
				default: './dist/server.js',
			},
		});
	});

	it('keeps the client entry focused on browser-safe runtime APIs', () => {
		const source = readProjectFile('src/client.ts');

		expect(source).toContain('createLayerServerManifestClient');
		expect(source).toContain('EFFUSE_ACTION_PREFIX');
		expect(source).toContain('defineServerRoute');
		expect(source).toContain('createTypedRouteClient');
		expect(source).toContain('isRouteError');
		expect(source).toContain('generateOpenApiDocument');
		expect(source).toContain('defineServerFileHandler');
		expect(source).not.toContain('handleLayerServerRequest');
		expect(source).not.toContain('matchLayerServerRequest');
		expect(source).not.toContain('normalizeServerResult');
		expect(source).not.toContain("from './ssr/server-routing.js'");
		expect(source).not.toContain('createServerApp');
		expect(source).not.toContain('createSSRRuntime');
		expect(source).not.toContain('createHandler');
		expect(source).not.toContain('createStreamingHandler');
		expect(source).not.toContain('renderToString');
		expect(source).not.toContain('fromServerFiles');
	});

	it('keeps client-facing context modules free of Node async hooks', () => {
		for (const path of [
			'src/blueprint/lifecycle.ts',
			'src/blueprint/provide-inject.ts',
			'src/context/registry.ts',
			'src/layers/context.ts',
		]) {
			expect(readProjectFile(path)).not.toContain('node:async_hooks');
		}
	});
});
