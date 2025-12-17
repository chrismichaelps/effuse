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

import type { RouteLocation, ResolvedRoute } from '../core/route.js';

export interface NavigationFailureBase {
	readonly _tag: string;
	readonly to: ResolvedRoute;
	readonly from: ResolvedRoute;
}

export interface NavigationAborted extends NavigationFailureBase {
	readonly _tag: 'NavigationAborted';
}

export interface NavigationGuardCancelled extends NavigationFailureBase {
	readonly _tag: 'NavigationGuardCancelled';
	readonly reason: string | undefined;
}

export interface NavigationRedirect extends NavigationFailureBase {
	readonly _tag: 'NavigationRedirect';
	readonly redirectTo: RouteLocation;
}

export interface NavigationDuplicated extends NavigationFailureBase {
	readonly _tag: 'NavigationDuplicated';
}

export type NavigationFailure =
	| NavigationAborted
	| NavigationGuardCancelled
	| NavigationRedirect
	| NavigationDuplicated;

export const NavigationFailure = {
	aborted: (to: ResolvedRoute, from: ResolvedRoute): NavigationAborted => ({
		_tag: 'NavigationAborted',
		to,
		from,
	}),

	guardCancelled: (
		to: ResolvedRoute,
		from: ResolvedRoute,
		reason?: string
	): NavigationGuardCancelled => ({
		_tag: 'NavigationGuardCancelled',
		to,
		from,
		reason,
	}),

	redirect: (
		to: ResolvedRoute,
		from: ResolvedRoute,
		redirectTo: RouteLocation
	): NavigationRedirect => ({
		_tag: 'NavigationRedirect',
		to,
		from,
		redirectTo,
	}),

	duplicated: (
		to: ResolvedRoute,
		from: ResolvedRoute
	): NavigationDuplicated => ({
		_tag: 'NavigationDuplicated',
		to,
		from,
	}),

	isNavigationFailure: (value: unknown): value is NavigationFailure =>
		typeof value === 'object' &&
		value !== null &&
		'_tag' in value &&
		typeof (value as NavigationFailure)._tag === 'string' &&
		[
			'NavigationAborted',
			'NavigationGuardCancelled',
			'NavigationRedirect',
			'NavigationDuplicated',
		].includes((value as NavigationFailure)._tag),

	isAborted: (failure: NavigationFailure): failure is NavigationAborted =>
		failure._tag === 'NavigationAborted',

	isCancelled: (
		failure: NavigationFailure
	): failure is NavigationGuardCancelled =>
		failure._tag === 'NavigationGuardCancelled',

	isRedirect: (failure: NavigationFailure): failure is NavigationRedirect =>
		failure._tag === 'NavigationRedirect',

	isDuplicated: (failure: NavigationFailure): failure is NavigationDuplicated =>
		failure._tag === 'NavigationDuplicated',
};
