import { EventEmitter } from 'node:events';
import {
	existsSync,
	mkdirSync,
	mkdtempSync,
	readFileSync,
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
		root = mkdtempSync(resolve(tmpdir(), 'effuse-registry-plugin-'));
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
			'export const serverRegistry = [\n\n] as const'
		);
		expect(watched).toEqual([]);
		expect(watcher.add).toHaveBeenCalledWith([
			resolve(root, 'src/server/api'),
			resolve(root, 'src/server/actions'),
		]);
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
		expect(invalidated).toHaveLength(1);
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
});
