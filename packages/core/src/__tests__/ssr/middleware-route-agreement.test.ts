/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	compileRoutePattern,
	matchRoutePattern,
	parseRoutePattern,
} from '../../routing/route-pattern.js';
import { createRouteTrie, matchRouteTrie } from '../../routing/route-trie.js';

/**
 * Route resolution and middleware selection are separate code paths over the
 * same request: `server-routing.ts` resolves through the trie when every route
 * is trie-routable, while `middleware-graph.ts` selects through
 * `matchRoutePattern`.
 *
 * They agree today only because both normalise the pathname the same way. When
 * they did not, a trailing slash resolved the route and selected none of its
 * middleware, so a guarded handler ran unguarded. Nothing else asserts that
 * they stay in step.
 */
const routeResolves = (patterns: readonly string[], pathname: string): boolean => {
	const trie = createRouteTrie(
		patterns.map((pattern) => ({
			pattern: parseRoutePattern(pattern),
			value: pattern,
		}))
	);
	return matchRouteTrie(trie, pathname) !== null;
};

const middlewareSelects = (pattern: string, pathname: string): boolean =>
	matchRoutePattern(compileRoutePattern(pattern), pathname) !== null;

const GUARDED: readonly string[] = [
	'/admin',
	'/admin/users',
	'/api/:version/private',
	'/team/:id',
];

const PROBES: readonly string[] = [
	'/admin',
	'/admin/',
	'/admin/users',
	'/admin/users/',
	'/api/v1/private',
	'/api/v1/private/',
	'/team/42',
	'/team/42/',
];

describe('middleware selection agrees with route resolution', () => {
	for (const guarded of GUARDED) {
		it(`never resolves ${guarded} without selecting its middleware`, () => {
			for (const pathname of PROBES) {
				const resolved = routeResolves([guarded], pathname);
				const selected = middlewareSelects(guarded, pathname);

				// The unsafe direction: a handler running with no guard.
				expect(
					{ pathname, resolved, selected },
					`${pathname} resolved to ${guarded} without selecting its middleware`
				).toEqual({ pathname, resolved, selected: resolved || selected });

				expect(selected).toBe(resolved);
			}
		});
	}

	it('agrees on a trailing slash for a guarded static path', () => {
		expect(routeResolves(['/admin'], '/admin/')).toBe(true);
		expect(middlewareSelects('/admin', '/admin/')).toBe(true);
	});

	it('agrees on a trailing slash for a guarded parameter path', () => {
		expect(routeResolves(['/team/:id'], '/team/42/')).toBe(true);
		expect(middlewareSelects('/team/:id', '/team/42/')).toBe(true);
	});

	it('agrees that an unrelated path is neither routed nor guarded', () => {
		expect(routeResolves(['/admin'], '/public')).toBe(false);
		expect(middlewareSelects('/admin', '/public')).toBe(false);
		expect(routeResolves(['/admin'], '/administrator')).toBe(false);
		expect(middlewareSelects('/admin', '/administrator')).toBe(false);
	});

	it('does not let a deeper path inherit a shallower guard', () => {
		// `/admin/secrets` must not be treated as `/admin` by either side.
		expect(routeResolves(['/admin'], '/admin/secrets')).toBe(false);
		expect(middlewareSelects('/admin', '/admin/secrets')).toBe(false);
	});
});
