/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Effect, Predicate } from 'effect';
import type { Route, ResolvedRoute, RouteLocation } from '../core/route.js';

export interface NavigationAllowed {
	readonly _tag: 'NavigationAllowed';
}

export interface NavigationCancelled {
	readonly _tag: 'NavigationCancelled';
	readonly reason: string | undefined;
}

export interface NavigationRedirected {
	readonly _tag: 'NavigationRedirected';
	readonly to: RouteLocation;
}

export interface NavigationFailed {
	readonly _tag: 'NavigationFailed';
	readonly error: Error;
}

export type NavigationResult =
	| NavigationAllowed
	| NavigationCancelled
	| NavigationRedirected
	| NavigationFailed;

export const NavigationResult = {
	allowed: (): NavigationResult => ({ _tag: 'NavigationAllowed' }),
	cancelled: (reason?: string): NavigationResult => ({
		_tag: 'NavigationCancelled',
		reason,
	}),
	redirected: (to: RouteLocation): NavigationResult => ({
		_tag: 'NavigationRedirected',
		to,
	}),
	failed: (error: Error): NavigationResult => ({
		_tag: 'NavigationFailed',
		error,
	}),

	isAllowed: (result: NavigationResult): result is NavigationAllowed =>
		result._tag === 'NavigationAllowed',

	fromLegacy: (value: unknown): NavigationResult => {
		if (value === undefined || value === true)
			return NavigationResult.allowed();
		if (value === false) return NavigationResult.cancelled();
		if (typeof value === 'string') return NavigationResult.redirected(value);
		if (value instanceof Error) return NavigationResult.failed(value);
		if (Predicate.isObject(value)) {
			return NavigationResult.redirected(value as RouteLocation);
		}
		return NavigationResult.allowed();
	},
};

export type NavigationGuard = (
	to: ResolvedRoute,
	from: Route
) => NavigationResult | Promise<NavigationResult>;

export type AfterEachHook = (to: Route, from: Route) => void;

export interface GuardRegistry {
	readonly beforeEach: NavigationGuard[];
	readonly beforeResolve: NavigationGuard[];
	readonly afterEach: AfterEachHook[];
}

export const createGuardRegistry = (): GuardRegistry => ({
	beforeEach: [],
	beforeResolve: [],
	afterEach: [],
});

export const runGuards = (
	guards: readonly NavigationGuard[],
	to: ResolvedRoute,
	from: Route
): Effect.Effect<NavigationResult> =>
	Effect.gen(function* () {
		for (const guard of guards) {
			const result = yield* Effect.promise(async () => {
				const res = guard(to, from);
				return res instanceof Promise ? res : res;
			});
			if (!NavigationResult.isAllowed(result)) {
				return result;
			}
		}
		return NavigationResult.allowed();
	});

export const runAfterHooks = (
	hooks: ReadonlyArray<AfterEachHook>,
	to: Route,
	from: Route
): Effect.Effect<void> =>
	Effect.sync(() => {
		for (const hook of hooks) {
			hook(to, from);
		}
	});

export const combineGuards =
	(...guards: NavigationGuard[]): NavigationGuard =>
	async (to, from) => {
		for (const guard of guards) {
			const result = await Promise.resolve(guard(to, from));
			if (!NavigationResult.isAllowed(result)) {
				return result;
			}
		}
		return NavigationResult.allowed();
	};

export const guardWhen =
	(
		condition: (to: ResolvedRoute, from: Route) => boolean,
		guard: NavigationGuard
	): NavigationGuard =>
	(to, from) =>
		condition(to, from) ? guard(to, from) : NavigationResult.allowed();

export const guardMeta =
	(
		key: string,
		handler: (
			value: unknown,
			to: ResolvedRoute,
			from: Route
		) => NavigationResult | Promise<NavigationResult>
	): NavigationGuard =>
	(to, from) => {
		const value = to.meta[key];
		if (value !== undefined) {
			return handler(value, to, from);
		}
		return NavigationResult.allowed();
	};

export const createAuthGuard = (
	isAuthenticated: () => boolean | Promise<boolean>,
	loginPath: string = '/login'
): NavigationGuard =>
	guardMeta('requiresAuth', async (value: unknown, _to, _from) => {
		const requiresAuth = Boolean(value);
		if (!requiresAuth) return NavigationResult.allowed();
		const authed = await Promise.resolve(isAuthenticated());
		return authed
			? NavigationResult.allowed()
			: NavigationResult.redirected(loginPath);
	});

export const createUnsavedChangesGuard =
	(
		hasUnsavedChanges: () => boolean,
		confirmMessage: string = 'You have unsaved changes. Leave anyway?'
	): NavigationGuard =>
	(_to, _from) => {
		if (hasUnsavedChanges()) {
			const confirmed = window.confirm(confirmMessage);
			return confirmed
				? NavigationResult.allowed()
				: NavigationResult.cancelled('User cancelled due to unsaved changes');
		}
		return NavigationResult.allowed();
	};
