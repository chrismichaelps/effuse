import { describe, it, expect } from 'vitest';
import { foldServerPolicy } from '../../ssr/policy-merge.js';
import type { PolicySource } from '../../ssr/policy-merge.js';

const layer = (policy: PolicySource['policy']): PolicySource => ({
	kind: 'layer',
	name: 'base',
	policy,
});
const route = (policy: PolicySource['policy']): PolicySource => ({
	kind: 'route',
	name: '/api/x',
	policy,
});

describe('foldServerPolicy', () => {
	it('returns an empty policy with no diagnostics for empty sources', () => {
		const folded = foldServerPolicy('/api/x', [layer(undefined), route(undefined)]);
		expect(folded.policy).toEqual({});
		expect(folded.diagnostics).toEqual([]);
		expect(folded.provenance).toEqual([]);
	});

	describe('scalar override strategy', () => {
		it('lets the later source win and preserves earlier-only values', () => {
			const folded = foldServerPolicy('/api/x', [
				layer({ runtime: 'node', region: 'iad1' }),
				route({ runtime: 'edge' }),
			]);
			expect(folded.policy).toEqual({ runtime: 'edge', region: 'iad1' });
		});

		it('emits a conflict diagnostic with from/to provenance on override', () => {
			const folded = foldServerPolicy('/api/x', [
				layer({ runtime: 'node' }),
				route({ runtime: 'edge' }),
			]);
			expect(folded.diagnostics).toEqual([
				{
					code: 'metadata_conflict',
					key: 'runtime',
					layer: 'base',
					message:
						'Server metadata "runtime" on /api/x overrides layer metadata from base.',
					target: '/api/x',
					from: 'layer',
					to: 'route',
				},
			]);
		});

		it('does not flag a restated (equal) value as a conflict', () => {
			const folded = foldServerPolicy('/api/x', [
				layer({ runtime: 'edge' }),
				route({ runtime: 'edge' }),
			]);
			expect(folded.diagnostics).toEqual([]);
			expect(folded.policy).toEqual({ runtime: 'edge' });
		});
	});

	describe('set union strategy', () => {
		it('unions cache tags and cors headers/methods without conflict', () => {
			const folded = foldServerPolicy('/api/x', [
				layer({
					cache: { tags: ['a', 'b'] },
					cors: { headers: ['x-a'], methods: ['GET'] },
				}),
				route({
					cache: { tags: ['b', 'c'] },
					cors: { headers: ['x-b'], methods: ['GET', 'POST'] },
				}),
			]);
			expect(folded.diagnostics).toEqual([]);
			expect(folded.policy.cache?.tags).toEqual(['a', 'b', 'c']);
			expect(folded.policy.cors?.headers).toEqual(['x-a', 'x-b']);
			expect(folded.policy.cors?.methods).toEqual(['GET', 'POST']);
		});

		it('overrides scalar cache fields while unioning tags', () => {
			const folded = foldServerPolicy('/api/x', [
				layer({ cache: { revalidate: 60, tags: ['a'] } }),
				route({ cache: { revalidate: 30, tags: ['b'] } }),
			]);
			expect(folded.policy.cache).toEqual({ revalidate: 30, tags: ['a', 'b'] });
			expect(folded.diagnostics).toEqual([
				expect.objectContaining({ key: 'cache.revalidate', from: 'layer', to: 'route' }),
			]);
		});
	});

	describe('record merge strategy (headers)', () => {
		it('merges header keys, child wins, and flags only replaced keys', () => {
			const folded = foldServerPolicy('/api/x', [
				layer({ headers: { 'x-shared': '1', 'x-base': 'b' } }),
				route({ headers: { 'x-shared': '2', 'x-route': 'r' } }),
			]);
			expect(folded.policy.headers).toEqual({
				'x-shared': '2',
				'x-base': 'b',
				'x-route': 'r',
			});
			expect(folded.diagnostics).toEqual([
				expect.objectContaining({
					key: 'headers.x-shared',
					from: 'layer',
					to: 'route',
				}),
			]);
		});
	});

	describe('precedence across the hierarchy', () => {
		it('resolves each field to its most specific source', () => {
			const sources: PolicySource[] = [
				{ kind: 'parent', name: 'root', policy: { runtime: 'node', region: 'iad1' } },
				{ kind: 'dependency', name: 'auth', policy: { runtime: 'edge' } },
				{ kind: 'layer', name: 'api', policy: { region: 'sfo1' } },
				{ kind: 'route', name: '/api/x', policy: { status: 201 } },
			];
			const folded = foldServerPolicy('/api/x', sources);
			expect(folded.policy).toEqual({ runtime: 'edge', region: 'sfo1', status: 201 });
			expect(folded.provenance).toEqual(
				expect.arrayContaining([
					{ key: 'runtime', source: 'dependency', name: 'auth' },
					{ key: 'region', source: 'layer', name: 'api' },
					{ key: 'status', source: 'route', name: '/api/x' },
				])
			);
		});
	});
});
