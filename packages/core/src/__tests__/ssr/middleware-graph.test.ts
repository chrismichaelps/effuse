import { describe, it, expect } from 'vitest';
import { defineServerMiddleware } from '../../ssr/middleware-definition.js';
import {
	compileServerMiddlewareGraph,
	selectServerMiddlewareChain,
} from '../../ssr/middleware-graph.js';

const noop = () => undefined;

describe('compileServerMiddlewareGraph', () => {
	it('should order middleware by scope precedence, then order, then declaration', () => {
		const graph = compileServerMiddlewareGraph([
			{ scope: 'route', middleware: defineServerMiddleware({ name: 'r', handler: noop }) },
			{ scope: 'engine', middleware: defineServerMiddleware({ name: 'e', handler: noop }) },
			{ scope: 'global', middleware: defineServerMiddleware({ name: 'g', handler: noop }) },
			{
				scope: 'layer',
				owner: 'auth',
				middleware: defineServerMiddleware({ name: 'l', handler: noop }),
			},
		]);

		expect(graph.entries.map((entry) => entry.name)).toEqual([
			'e',
			'g',
			'l',
			'r',
		]);
	});

	it('should sort within a scope by ascending order then declaration index', () => {
		const graph = compileServerMiddlewareGraph([
			{ scope: 'global', middleware: defineServerMiddleware({ name: 'b', order: 10, handler: noop }) },
			{ scope: 'global', middleware: defineServerMiddleware({ name: 'a', order: -5, handler: noop }) },
			{ scope: 'global', middleware: defineServerMiddleware({ name: 'c', order: 10, handler: noop }) },
		]);

		expect(graph.entries.map((entry) => entry.name)).toEqual(['a', 'b', 'c']);
	});

	it('should reject duplicate names within the compiled graph', () => {
		expect(() =>
			compileServerMiddlewareGraph([
				{ scope: 'global', middleware: defineServerMiddleware({ name: 'dup', handler: noop }) },
				{ scope: 'route', middleware: defineServerMiddleware({ name: 'dup', handler: noop }) },
			])
		).toThrow(/duplicate/i);
	});

	it('should require an owner for layer-scoped middleware', () => {
		expect(() =>
			compileServerMiddlewareGraph([
				{ scope: 'layer', middleware: defineServerMiddleware({ name: 'x', handler: noop }) },
			])
		).toThrow(/owner/i);
	});

	it('should freeze the compiled graph and its entries', () => {
		const graph = compileServerMiddlewareGraph([
			{ scope: 'global', middleware: defineServerMiddleware({ name: 'g', handler: noop }) },
		]);

		expect(Object.isFrozen(graph)).toBe(true);
		expect(Object.isFrozen(graph.entries)).toBe(true);
		expect(Object.isFrozen(graph.entries[0])).toBe(true);
	});
});

describe('selectServerMiddlewareChain', () => {
	const build = () =>
		compileServerMiddlewareGraph([
			{
				scope: 'engine',
				middleware: defineServerMiddleware({ name: 'security', handler: noop }),
			},
			{
				scope: 'global',
				middleware: defineServerMiddleware({
					name: 'api-only',
					match: { targets: 'api' },
					handler: noop,
				}),
			},
			{
				scope: 'route',
				middleware: defineServerMiddleware({
					name: 'admin',
					match: { paths: '/admin/[...rest]', methods: 'POST' },
					handler: noop,
				}),
			},
		]);

	it('should include only middleware whose match covers the request', () => {
		const chain = selectServerMiddlewareChain(build(), {
			pathname: '/admin/settings',
			method: 'POST',
			target: 'api',
		});

		expect(chain.map((entry) => entry.name)).toEqual([
			'security',
			'api-only',
			'admin',
		]);
	});

	it('should drop path-mismatched route middleware but keep global matches', () => {
		const chain = selectServerMiddlewareChain(build(), {
			pathname: '/public/home',
			method: 'GET',
			target: 'api',
		});

		expect(chain.map((entry) => entry.name)).toEqual(['security', 'api-only']);
	});

	it('should drop target-mismatched middleware', () => {
		const chain = selectServerMiddlewareChain(build(), {
			pathname: '/admin/settings',
			method: 'POST',
			target: 'page',
		});

		expect(chain.map((entry) => entry.name)).toEqual(['security', 'admin']);
	});

	it('should drop method-mismatched route middleware', () => {
		const chain = selectServerMiddlewareChain(build(), {
			pathname: '/admin/settings',
			method: 'GET',
			target: 'api',
		});

		expect(chain.map((entry) => entry.name)).toEqual(['security', 'api-only']);
	});

	it('should preserve compiled order in the selected chain', () => {
		const chain = selectServerMiddlewareChain(build(), {
			pathname: '/admin/x',
			method: 'POST',
			target: 'api',
		});
		const names = chain.map((entry) => entry.name);
		expect(names.indexOf('security')).toBeLessThan(names.indexOf('api-only'));
		expect(names.indexOf('api-only')).toBeLessThan(names.indexOf('admin'));
	});
});
