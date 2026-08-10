import { EventEmitter } from 'node:events';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
	realpathSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Plugin, ViteDevServer } from 'vite';
import { effuseServerRegistryPlugin } from '../plugins/server-registry.js';

class Watcher extends EventEmitter {
	readonly add = vi.fn();
}

const touch = (root: string, path: string): void => {
	const target = resolve(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, 'export const GET = () => ({ ok: true });\n');
};

const callHook = <Result>(
	hook: unknown,
	context: unknown,
	...args: unknown[]
): Result => (hook as (...values: unknown[]) => Result).call(context, ...args);

describe('Effuse server registry Vite plugin', () => {
	let root: string;
	let watcher: Watcher;
	let sent: unknown[];
	let errors: string[];
	let invalidated: unknown[];
	let server: ViteDevServer;
	let plugin: Plugin;

	beforeEach(() => {
		vi.useFakeTimers();
		root = realpathSync.native(
			mkdtempSync(resolve(tmpdir(), 'effuse-registry-plugin-'))
		);
		watcher = new Watcher();
		sent = [];
		errors = [];
		invalidated = [];
		server = {
			watcher,
			config: { logger: { error: (message: string) => errors.push(message) } },
			ws: { send: (payload: unknown) => sent.push(payload) },
			moduleGraph: {
				getModuleById: () => ({ id: 'registry' }),
				invalidateModule: (module: unknown) => invalidated.push(module),
			},
		} as unknown as ViteDevServer;
		plugin = effuseServerRegistryPlugin({ debounceMs: 20 });
		callHook(plugin.configResolved, plugin, { root });
		callHook(plugin.configureServer, plugin, server);
	});

	afterEach(() => {
		callHook(plugin.closeBundle, plugin);
		vi.useRealTimers();
		rmSync(root, { recursive: true, force: true });
	});

	it('generates an empty initial registry before modules load', () => {
		const watched: string[] = [];
		callHook(plugin.buildStart, { addWatchFile: (path: string) => watched.push(path) });
		const outputPath = resolve(root, '.effuse/server-registry.ts');

		expect(existsSync(outputPath)).toBe(true);
		expect(readFileSync(outputPath, 'utf-8')).toContain(
			'export const serverRegistry = Object.freeze([\n\n] as const)'
		);
		expect(watched).toEqual([]);
		expect(watcher.add).toHaveBeenCalledWith([
			resolve(root, 'src/server/api'),
			resolve(root, 'src/server/actions'),
			resolve(root, 'src/server/middleware'),
		]);
	});

	it('resolves generated registry specifiers to their TypeScript sources', () => {
		const importer = resolve(root, 'src/layers/AppServerLayer.ts');
		const registry = resolve(root, '.effuse/server-registry.ts');
		const middleware = resolve(root, '.effuse/server-middleware-registry.ts');

		for (const source of [
			'../../.effuse/server-registry.js',
			'../../.effuse/server-registry.ts',
			registry,
		]) {
			expect(callHook(plugin.resolveId, plugin, source, importer)).toBe(registry);
		}
		expect(
			callHook(
				plugin.resolveId,
				plugin,
				'../../.effuse/server-middleware-registry.js',
				importer
			)
		).toBe(middleware);
	});

	it('generates a missing registry when a specifier resolves', () => {
		const importer = resolve(root, 'src/layers/AppServerLayer.ts');
		touch(root, 'src/server/api/health.ts');

		const resolved = callHook<string>(
			plugin.resolveId,
			plugin,
			'../../.effuse/server-registry.js',
			importer
		);

		expect(existsSync(resolved)).toBe(true);
		expect(readFileSync(resolved, 'utf-8')).toContain('./src/server/api/health.ts');
	});

	it('leaves unrelated specifiers to other resolvers', () => {
		const importer = resolve(root, 'src/layers/AppServerLayer.ts');

		for (const source of [
			'./unrelated.js',
			'@scope/server-registry.js',
			'../../.effuse/server-registry.mjs',
			'../../.effuse/other-registry.js',
		]) {
			expect(callHook(plugin.resolveId, plugin, source, importer)).toBeNull();
		}
		expect(
			callHook(plugin.resolveId, plugin, '../../.effuse/server-registry.js', undefined)
		).toBeNull();
	});

	it('coalesces route add and rename events into one valid reload', () => {
		callHook(plugin.buildStart, { addWatchFile: vi.fn() });
		touch(root, 'src/server/api/health.ts');
		watcher.emit('all', 'add', resolve(root, 'src/server/api/health.ts'));
		watcher.emit('all', 'unlink', resolve(root, 'src/server/api/old-health.ts'));
		watcher.emit('all', 'add', resolve(root, 'src/server/api/health.ts'));
		vi.advanceTimersByTime(20);

		const source = readFileSync(
			resolve(root, '.effuse/server-registry.ts'),
			'utf-8'
		);
		expect(source).toContain('/api/health');
		expect(sent).toEqual([{ type: 'full-reload', path: '*' }]);
		// The file registry and the middleware registry are both invalidated.
		expect(invalidated).toHaveLength(2);
	});

	it('preserves the previous graph during collisions and recovers', () => {
		touch(root, 'src/server/api/(one)/users/[id]/route.ts');
		callHook(plugin.buildStart, { addWatchFile: vi.fn() });
		const outputPath = resolve(root, '.effuse/server-registry.ts');
		const validSource = readFileSync(outputPath, 'utf-8');

		touch(root, 'src/server/api/(two)/users/[userId]/route.ts');
		watcher.emit(
			'all',
			'add',
			resolve(root, 'src/server/api/(two)/users/[userId]/route.ts')
		);
		vi.advanceTimersByTime(20);

		expect(readFileSync(outputPath, 'utf-8')).toBe(validSource);
		expect(errors[0]).toContain('Server api collision');
		expect(sent[0]).toEqual(
			expect.objectContaining({ type: 'error' })
		);

		rmSync(resolve(root, 'src/server/api/(two)'), { recursive: true });
		watcher.emit(
			'all',
			'unlink',
			resolve(root, 'src/server/api/(two)/users/[userId]/route.ts')
		);
		vi.advanceTimersByTime(20);

		expect(sent.at(-1)).toEqual({ type: 'full-reload', path: '*' });
		expect(readFileSync(outputPath, 'utf-8')).toBe(validSource);
	});

	it('ignores changes outside source roots and cancels pending work on cleanup', () => {
		callHook(plugin.buildStart, { addWatchFile: vi.fn() });
		watcher.emit('all', 'add', resolve(root, 'src/pages/home.ts'));
		watcher.emit('all', 'add', resolve(root, 'src/server/api/late.ts'));
		callHook(plugin.closeBundle, plugin);
		vi.advanceTimersByTime(20);

		expect(sent).toEqual([]);
	});

	it('rejects an escaped source root before subscribing the watcher', () => {
		const unsafe = effuseServerRegistryPlugin({ apiDir: '../private-api' });
		callHook(unsafe.configResolved, unsafe, { root });

		expect(() => callHook(unsafe.configureServer, unsafe, server)).toThrow(
			'must stay within the project root'
		);
		expect(watcher.add).not.toHaveBeenCalledWith(
			expect.arrayContaining([resolve(root, '../private-api')])
		);
	});

	it('generates an empty middleware registry and watches its directory', () => {
		callHook(plugin.buildStart, { addWatchFile: vi.fn() });
		const outputPath = resolve(
			root,
			'.effuse/server-middleware-registry.ts'
		);

		expect(existsSync(outputPath)).toBe(true);
		expect(readFileSync(outputPath, 'utf-8')).toContain(
			'export const serverMiddlewareRegistry = Object.freeze([\n\n] as const)'
		);
		expect(watcher.add).toHaveBeenCalledWith(
			expect.arrayContaining([resolve(root, 'src/server/middleware')])
		);
	});

	it('regenerates the middleware registry when a middleware file is added', () => {
		callHook(plugin.buildStart, { addWatchFile: vi.fn() });
		const mwPath = resolve(root, 'src/server/middleware/logging.ts');
		mkdirSync(dirname(mwPath), { recursive: true });
		writeFileSync(
			mwPath,
			'export default { phase: "request", handler: () => undefined };\n'
		);
		watcher.emit('all', 'add', mwPath);
		vi.advanceTimersByTime(20);

		const source = readFileSync(
			resolve(root, '.effuse/server-middleware-registry.ts'),
			'utf-8'
		);
		expect(source).toContain('logging');
		expect(sent.at(-1)).toEqual({ type: 'full-reload', path: '*' });
	});

	it('preserves the previous middleware registry during collisions', () => {
		callHook(plugin.buildStart, { addWatchFile: vi.fn() });
		const outputPath = resolve(
			root,
			'.effuse/server-middleware-registry.ts'
		);
		const valid = readFileSync(outputPath, 'utf-8');

		const dir = resolve(root, 'src/server/middleware');
		mkdirSync(dir, { recursive: true });
		writeFileSync(resolve(dir, 'auth.ts'), 'export default {};\n');
		writeFileSync(resolve(dir, 'auth.mts'), 'export default {};\n');
		watcher.emit('all', 'add', resolve(dir, 'auth.mts'));
		vi.advanceTimersByTime(20);

		expect(readFileSync(outputPath, 'utf-8')).toBe(valid);
		expect(errors.at(-1)).toContain('Server middleware collision');
	});
});
