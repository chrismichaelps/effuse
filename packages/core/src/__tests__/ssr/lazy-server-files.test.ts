import { describe, expect, it, vi } from 'vitest';
import {
	compileServerFileRegistry,
	matchServerFileRequest,
	type LazyServerApiFileEntry,
} from '../../ssr/lazy-server-files.js';
import type { ServerApiFileModule } from '../../ssr/server-files.js';

const api = (
	filePath: string,
	path: string,
	load: () => Promise<ServerApiFileModule> = vi.fn(async () => ({
		GET: () => ({ ok: true }),
	}))
): LazyServerApiFileEntry => ({ kind: 'api', filePath, path, load });

describe('compiled lazy server file registry', () => {
	it('is immutable and idempotent', () => {
		const route = api(
			'./src/server/api/users/[id]/route.ts',
			'/api/users/[id]'
		);
		const registry = compileServerFileRegistry([
			route,
			{
				kind: 'action',
				filePath: './src/server/actions/refresh.ts',
				name: 'refresh',
				load: async () => ({ action: () => ({ ok: true }) }),
			},
		]);

		expect(registry).toEqual({
			kind: 'effuse-server-file-registry',
			apiCount: 1,
			actionCount: 1,
		});
		expect(Object.isFrozen(registry)).toBe(true);
		expect(compileServerFileRegistry(registry)).toBe(registry);
		(route as { path: string }).path = '/api/mutated';
		const match = matchServerFileRequest(
			new Request('http://localhost/api/users/42'),
			registry
		);
		expect(Object.isFrozen(match)).toBe(true);
		expect(Object.isFrozen(match?.params)).toBe(true);
		expect(match?.target).toBe('/api/users/[id]');
	});

	it('uses canonical specificity, groups, params, and catch-all behavior', () => {
		const registry = compileServerFileRegistry([
			api('dynamic.ts', '/api/catalog/[id]'),
			api('static.ts', '/api/(shop)/catalog/new'),
			api('required.ts', '/api/docs/[...slug]'),
			api('optional.ts', '/api/shop/[[...slug]]'),
		]);

		expect(
			matchServerFileRequest(
				new Request('http://localhost/api/catalog/new'),
				registry
			)?.filePath
		).toBe('static.ts');
		expect(
			matchServerFileRequest(
				new Request('http://localhost/api/catalog/a%20b'),
				registry
			)?.params
		).toEqual({ id: 'a b' });
		expect(
			matchServerFileRequest(
				new Request('http://localhost/api/docs/guides/deploy'),
				registry
			)?.params
		).toEqual({ slug: 'guides/deploy' });
		expect(
			matchServerFileRequest(new Request('http://localhost/api/shop'), registry)
				?.params
		).toEqual({ slug: '' });
		expect(
			matchServerFileRequest(new Request('http://localhost/api/docs'), registry)
		).toBeNull();
	});

	it('matches nested actions with optional layer qualification', () => {
		const registry = compileServerFileRegistry([
			{
				kind: 'action',
				filePath: 'refresh.ts',
				name: 'users/refresh',
				load: async () => ({ action: () => ({ ok: true }) }),
			},
		]);
		const unqualified = matchServerFileRequest(
			new Request('http://localhost/_effuse/actions/users/refresh'),
			registry
		);
		const qualified = matchServerFileRequest(
			new Request('http://localhost/_effuse/actions/account/users%2Frefresh'),
			registry,
			{ actionLayer: 'account' }
		);

		expect(unqualified).toMatchObject({
			kind: 'action',
			target: 'users/refresh',
			allowedMethods: ['POST'],
		});
		expect(qualified).toMatchObject({
			layer: 'account',
			params: { layer: 'account', action: 'users/refresh' },
		});
	});

	it('imports only the match and deduplicates concurrent loads', async () => {
		const selected = vi.fn(async () => ({ GET: () => ({ id: 1 }) }));
		const unrelated = vi.fn(async () => ({ GET: () => ({ id: 2 }) }));
		const registry = compileServerFileRegistry([
			api('selected.ts', '/api/selected', selected),
			api('unrelated.ts', '/api/unrelated', unrelated),
		]);
		const match = matchServerFileRequest(
			new Request('http://localhost/api/selected'),
			registry
		);
		if (!match) throw new Error('Expected a lazy route match.');

		const [first, second] = await Promise.all([match.load(), match.load()]);
		expect(first).toBe(second);
		expect(selected).toHaveBeenCalledOnce();
		expect(unrelated).not.toHaveBeenCalled();
	});

	it('evicts rejected imports so a later request can recover', async () => {
		const load = vi
			.fn()
			.mockRejectedValueOnce(new Error('temporary'))
			.mockResolvedValue({ GET: () => ({ ok: true }) });
		const match = matchServerFileRequest(
			new Request('http://localhost/api/retry'),
			compileServerFileRegistry([api('retry.ts', '/api/retry', load)])
		);
		if (!match) throw new Error('Expected a lazy route match.');

		await expect(match.load()).rejects.toThrow('temporary');
		await expect(match.load()).resolves.toBeDefined();
		expect(load).toHaveBeenCalledTimes(2);
	});

	it('rejects stale signatures and ambiguous registry ownership', () => {
		expect(() =>
			compileServerFileRegistry([
				{
					...api('stale.ts', '/api/users/[id]'),
					signature: 'stale',
				},
			])
		).toThrow('Stale route signature');
		expect(() =>
			compileServerFileRegistry([
				api('first.ts', '/api/users/[id]'),
				api('second.ts', '/api/users/[name]'),
			])
		).toThrow('Duplicate lazy server route shape');
	});
});
