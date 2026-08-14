import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createServer, type ViteDevServer } from 'vite';
import { effuseServerRegistryPlugin } from '../plugins/server-registry.js';

const write = (root: string, path: string, source: string): void => {
	const target = resolve(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, source);
};

describe('server registry in Vite development SSR', () => {
	let root: string;
	let server: ViteDevServer | undefined;

	const startServer = async (): Promise<ViteDevServer> => {
		const created = await createServer({
			appType: 'custom',
			logLevel: 'silent',
			plugins: [effuseServerRegistryPlugin()],
			resolve: {
				alias: {
					'@effuse/core/server': resolve(root, 'core-server.ts'),
				},
			},
			root,
			server: { hmr: false, middlewareMode: true },
		});
		server = created;
		await created.pluginContainer.buildStart({});
		return created;
	};

	beforeEach(() => {
		root = mkdtempSync(resolve(tmpdir(), 'effuse-registry-dev-ssr-'));
		write(
			root,
			'src/server/api/health.ts',
			'export const GET = () => ({ ok: true });\n'
		);
		write(
			root,
			'src/layers/AppServerLayer.ts',
			`export { loadServerFiles, serverRegistry } from '../../.effuse/server-registry.js';\n`
		);
		write(
			root,
			'core-server.ts',
			`export const compileServerFileRegistry = (source) => source;
export const matchServerFileRequest = () => null;
`
		);
	});

	afterEach(async () => {
		await server?.close();
		server = undefined;
		rmSync(root, { recursive: true, force: true });
	});

	it('loads the documented .js registry import through ssrLoadModule', async () => {
		const dev = await startServer();

		const loaded = await dev.ssrLoadModule('/src/layers/AppServerLayer.ts');
		const files = await loaded['loadServerFiles']();

		expect(loaded['serverRegistry']).toHaveLength(1);
		expect(Object.keys(files.api)).toEqual(['./src/server/api/health.ts']);
	});

	it('regenerates a removed registry when development SSR resolves it', async () => {
		const dev = await startServer();
		rmSync(resolve(root, '.effuse'), { recursive: true, force: true });

		const loaded = await dev.ssrLoadModule('/src/layers/AppServerLayer.ts');

		expect(loaded['serverRegistry']).toHaveLength(1);
	});

	it('resolves the generated TypeScript specifier to the same module', async () => {
		write(
			root,
			'src/layers/AppServerLayer.ts',
			`export { serverRegistry } from '../../.effuse/server-registry.ts';\n`
		);
		const dev = await startServer();
		rmSync(resolve(root, '.effuse'), { recursive: true, force: true });

		const loaded = await dev.ssrLoadModule('/src/layers/AppServerLayer.ts');

		expect(loaded['serverRegistry']).toHaveLength(1);
	});
});
