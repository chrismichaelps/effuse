import {
	mkdirSync,
	mkdtempSync,
	rmSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	discoverServerMiddleware,
	ServerRegistryCompilationError,
} from '../services/server-registry.js';

const touch = (root: string, path: string): void => {
	const target = resolve(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(
		target,
		'export default { phase: "request", handler: () => undefined };\n'
	);
};

describe('server middleware registry', () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(resolve(tmpdir(), 'effuse-mw-registry-'));
	});

	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it('discovers global middleware in deterministic source order', () => {
		touch(root, 'src/server/middleware/logging.ts');
		touch(root, 'src/server/middleware/cors.ts');

		const registry = discoverServerMiddleware(root);

		expect(registry.entries).toEqual([
			{
				filePath: './src/server/middleware/cors.ts',
				name: 'cors',
				scope: 'global',
				owner: undefined,
			},
			{
				filePath: './src/server/middleware/logging.ts',
				name: 'logging',
				scope: 'global',
				owner: undefined,
			},
		]);
	});

	it('assigns layer scope with an owner from layers/<owner>/', () => {
		touch(root, 'src/server/middleware/layers/auth/session.ts');

		const registry = discoverServerMiddleware(root);

		expect(registry.entries).toEqual([
			{
				filePath: './src/server/middleware/layers/auth/session.ts',
				name: 'layers/auth/session',
				scope: 'layer',
				owner: 'auth',
			},
		]);
	});

	it('assigns route scope for files under routes/', () => {
		touch(root, 'src/server/middleware/routes/admin-guard.ts');

		const registry = discoverServerMiddleware(root);

		expect(registry.entries[0]).toEqual({
			filePath: './src/server/middleware/routes/admin-guard.ts',
			name: 'routes/admin-guard',
			scope: 'route',
			owner: undefined,
		});
	});

	it('returns an empty registry when the middleware directory is absent', () => {
		const registry = discoverServerMiddleware(root);
		expect(registry.entries).toEqual([]);
	});

	it('rejects duplicate middleware names', () => {
		touch(root, 'src/server/middleware/auth.ts');
		touch(root, 'src/server/middleware/auth.mts');

		expect(() => discoverServerMiddleware(root)).toThrow(
			ServerRegistryCompilationError
		);
	});

	it('requires an owner segment after layers/', () => {
		touch(root, 'src/server/middleware/layers/session.ts');

		expect(() => discoverServerMiddleware(root)).toThrow(
			ServerRegistryCompilationError
		);
	});

	it('ignores test and declaration files', () => {
		touch(root, 'src/server/middleware/keep.ts');
		touch(root, 'src/server/middleware/skip.test.ts');
		touch(root, 'src/server/middleware/types.d.ts');

		const registry = discoverServerMiddleware(root);

		expect(registry.entries.map((entry) => entry.name)).toEqual(['keep']);
	});
});
