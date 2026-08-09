import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	readdirSync,
	rmSync,
	symlinkSync,
	writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import {
	discoverServerRegistry,
	generateServerRegistryModule,
	ServerRegistryCompilationError,
	writeServerRegistryModule,
} from '../services/server-registry.js';

const touch = (root: string, path: string): void => {
	const target = resolve(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, 'export const GET = () => ({ ok: true });\n');
};

const touchAction = (root: string, path: string): void => {
	const target = resolve(root, path);
	mkdirSync(dirname(target), { recursive: true });
	writeFileSync(target, 'export default () => ({ ok: true });\n');
};

const typecheckGeneratedRegistry = (root: string): readonly string[] => {
	const outputPath = writeServerRegistryModule(discoverServerRegistry(root));
	const program = ts.createProgram([outputPath], {
		allowImportingTsExtensions: true,
		baseUrl: root,
		module: ts.ModuleKind.ESNext,
		moduleResolution: ts.ModuleResolutionKind.Bundler,
		noEmit: true,
		paths: {
			'@effuse/core/server': [
				resolve(import.meta.dirname, '../../../core/src/server.ts'),
			],
		},
		skipLibCheck: true,
		strict: true,
		target: ts.ScriptTarget.ES2022,
	});
	return ts
		.getPreEmitDiagnostics(program)
		.map((diagnostic) =>
			ts.flattenDiagnosticMessageText(diagnostic.messageText, '\n')
		);
};

describe('server registry compiler', () => {
	let root: string;

	beforeEach(() => {
		root = mkdtempSync(resolve(tmpdir(), 'effuse-server-registry-'));
	});

	afterEach(() => rmSync(root, { recursive: true, force: true }));

	it('discovers routes and actions in deterministic source order', () => {
		touch(root, 'src/server/api/zeta.ts');
		touch(root, 'src/server/api/(admin)/users/[id]/route.ts');
		touch(root, 'src/server/actions/users/refresh.ts');

		const registry = discoverServerRegistry(root);

		expect(registry.entries).toEqual([
			{
				kind: 'action',
				filePath: './src/server/actions/users/refresh.ts',
				name: 'users/refresh',
			},
			{
				kind: 'api',
				filePath: './src/server/api/(admin)/users/[id]/route.ts',
				path: '/api/users/[id]',
				signature: 'api/users/[]',
			},
			{
				kind: 'api',
				filePath: './src/server/api/zeta.ts',
				path: '/api/zeta',
				signature: 'api/zeta',
			},
		]);
		expect(Object.isFrozen(registry.entries)).toBe(true);
		expect(registry.entries.every(Object.isFrozen)).toBe(true);
	});

	it('returns an empty immutable registry when source directories are absent', () => {
		const registry = discoverServerRegistry(root);
		expect(registry.entries).toEqual([]);
		expect(Object.isFrozen(registry)).toBe(true);
	});

	it('excludes tests, declarations, hidden files, fixtures, and symlinks', () => {
		touch(root, 'outside.ts');
		touch(root, 'src/server/api/health.ts');
		touch(root, 'src/server/api/health.test.ts');
		touch(root, 'src/server/api/types.d.ts');
		touch(root, 'src/server/api/.hidden.ts');
		touch(root, 'src/server/api/__tests__/unit.ts');
		touch(root, 'src/server/api/fixtures/example.ts');
		symlinkSync(
			resolve(root, 'outside.ts'),
			resolve(root, 'src/server/api/link.ts')
		);

		expect(
			discoverServerRegistry(root).entries.map(({ filePath }) => filePath)
		).toEqual(['./src/server/api/health.ts']);
	});

	it('discovers supported module extensions case-insensitively', () => {
		touch(root, 'src/server/api/Health.MTS');

		expect(discoverServerRegistry(root).entries).toEqual([
			expect.objectContaining({
				kind: 'api',
				filePath: './src/server/api/Health.MTS',
				path: '/api/Health',
			}),
		]);
	});

	it('rejects a server source root that is a file', () => {
		touch(root, 'src/server/api');

		expect(() => discoverServerRegistry(root)).toThrow(
			'Server source root is not a directory'
		);
	});

	it('does not discover modules inside nested dependency directories', () => {
		touch(root, 'src/server/api/health.ts');
		touch(root, 'src/server/api/node_modules/vendor/route.ts');

		expect(
			discoverServerRegistry(root).entries.map(({ filePath }) => filePath)
		).toEqual(['./src/server/api/health.ts']);
	});

	it('rejects canonical route collisions with both owners', () => {
		touch(root, 'src/server/api/(one)/users/[id]/route.ts');
		touch(root, 'src/server/api/(two)/users/[userId]/route.ts');

		expect(() => discoverServerRegistry(root)).toThrowError(
			ServerRegistryCompilationError
		);
		try {
			discoverServerRegistry(root);
		} catch (error) {
			expect((error as ServerRegistryCompilationError).diagnostics).toEqual([
				expect.objectContaining({
					code: 'server_route_collision',
					target: 'api/users/[]',
					files: [
						'./src/server/api/(one)/users/[id]/route.ts',
						'./src/server/api/(two)/users/[userId]/route.ts',
					],
				}),
			]);
		}
	});

	it('rejects action-name collisions after route groups are removed', () => {
		touch(root, 'src/server/actions/(admin)/users/refresh.ts');
		touch(root, 'src/server/actions/users/refresh.ts');
		expect(() => discoverServerRegistry(root)).toThrowError(
			expect.objectContaining({
				diagnostics: [
					expect.objectContaining({ code: 'server_action_collision' }),
				],
			})
		);
	});

	it('rejects source and output paths outside the project root', () => {
		expect(() =>
			discoverServerRegistry(root, { apiDir: '../escaped' })
		).toThrow('must stay within the project root');
		expect(() =>
			generateServerRegistryModule(discoverServerRegistry(root), {
				outputPath: '../registry.ts',
			})
		).toThrow('must stay within the project root');
	});

	it('generates stable literal lazy imports and an eager compatibility loader', () => {
		touch(root, 'src/server/api/users/[id]/route.mts');
		touch(root, 'src/server/actions/users/refresh.mjs');
		const registry = discoverServerRegistry(root);

		const first = generateServerRegistryModule(registry);
		const second = generateServerRegistryModule(discoverServerRegistry(root));

		expect(first).toBe(second);
		expect(first).toContain('import("../src/server/api/users/[id]/route.mts")');
		expect(first).toContain(
			'import("../src/server/actions/users/refresh.mjs")'
		);
		expect(first).toContain('export const serverRegistry = Object.freeze([');
		expect(first).toContain('Object.freeze({ ...{"kind":"api"');
		expect(first).toContain('export async function loadServerFiles()');
		expect(first).toContain(
			'export const compiledServerRegistry = compileServerFileRegistry(serverRegistry)'
		);
		expect(first).toContain('export function matchServerFile(request: Request');
		expect(first).toContain('signature":"api/users/[]');
		expect(first).not.toContain('node:fs');
	});

	it.each([
		['API-only', ['api']],
		['action-only', ['action']],
		['empty', []],
		['mixed', ['api', 'action']],
	] as const)('generates a TypeScript-valid %s registry', (_name, kinds) => {
		const includedKinds = new Set<string>(kinds);
		if (includedKinds.has('api')) touch(root, 'src/server/api/health.ts');
		if (includedKinds.has('action')) {
			touchAction(root, 'src/server/actions/cache/clear.ts');
		}

		expect(typecheckGeneratedRegistry(root)).toEqual([]);
	});

	it('normalizes custom source directories to portable registry paths', () => {
		touch(root, 'server/api/health.cts');
		touch(root, 'server/actions/cache/clear.cjs');
		const registry = discoverServerRegistry(root, {
			apiDir: 'server/api',
			actionsDir: 'server/actions',
			apiBasePath: '/internal',
		});

		expect(registry.entries.map(({ filePath }) => filePath)).toEqual([
			'./server/actions/cache/clear.cjs',
			'./server/api/health.cts',
		]);
		expect(registry.entries[1]).toEqual(
			expect.objectContaining({ path: '/internal/health' })
		);
		expect(generateServerRegistryModule(registry)).toContain(
			'import("../server/api/health.cts")'
		);
	});

	it('writes generated source to a nested project-owned output', () => {
		touch(root, 'src/server/api/health.ts');
		const registry = discoverServerRegistry(root);
		const outputPath = writeServerRegistryModule(registry, {
			outputPath: '.effuse/generated/server.ts',
		});

		expect(outputPath).toBe(
			resolve(registry.rootDir, '.effuse/generated/server.ts')
		);
		expect(readFileSync(outputPath, 'utf-8')).toBe(
			generateServerRegistryModule(registry, {
				outputPath: '.effuse/generated/server.ts',
			})
		);
		expect(
			readdirSync(dirname(outputPath)).filter((name) => name.includes('.tmp-'))
		).toEqual([]);
	});
});
