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

import { Data, Predicate } from 'effect';
import type { RouteLocation, ResolvedRoute } from '../core/route.js';

interface NavigationFailureBase {
	readonly to: ResolvedRoute;
	readonly from: ResolvedRoute;
}

export type NavigationFailure = Data.TaggedEnum<{
	NavigationAborted: NavigationFailureBase;
	NavigationGuardCancelled: NavigationFailureBase & {
		readonly reason: string | undefined;
	};
	NavigationGuardFailed: NavigationFailureBase & {
		readonly error: Error;
	};
	NavigationRedirect: NavigationFailureBase & {
		readonly redirectTo: RouteLocation;
	};
	NavigationRedirectLoop: NavigationFailureBase & {
		readonly paths: readonly string[];
	};
	NavigationDuplicated: NavigationFailureBase;
}>;

const {
	NavigationAborted,
	NavigationGuardCancelled,
	NavigationGuardFailed,
	NavigationRedirect,
	NavigationRedirectLoop,
	NavigationDuplicated,
	$is,
	$match,
} = Data.taggedEnum<NavigationFailure>();

export {
	NavigationAborted,
	NavigationGuardCancelled,
	NavigationGuardFailed,
	NavigationRedirect,
	NavigationRedirectLoop,
	NavigationDuplicated,
	$is as NavigationFailure$is,
	$match as NavigationFailure$match,
};

export const NavigationFailure = {
	aborted: (to: ResolvedRoute, from: ResolvedRoute): NavigationFailure =>
		NavigationAborted({ to, from }),

	guardCancelled: (
		to: ResolvedRoute,
		from: ResolvedRoute,
		reason?: string
	): NavigationFailure => NavigationGuardCancelled({ to, from, reason }),

	guardFailed: (
		to: ResolvedRoute,
		from: ResolvedRoute,
		error: Error
	): NavigationFailure => NavigationGuardFailed({ to, from, error }),

	redirect: (
		to: ResolvedRoute,
		from: ResolvedRoute,
		redirectTo: RouteLocation
	): NavigationFailure => NavigationRedirect({ to, from, redirectTo }),

	redirectLoop: (
		to: ResolvedRoute,
		from: ResolvedRoute,
		paths: readonly string[]
	): NavigationFailure => NavigationRedirectLoop({ to, from, paths }),

	duplicated: (to: ResolvedRoute, from: ResolvedRoute): NavigationFailure =>
		NavigationDuplicated({ to, from }),

	isNavigationFailure: (value: unknown): value is NavigationFailure =>
		Predicate.isObject(value) &&
		Predicate.hasProperty(value, '_tag') &&
		Predicate.isString(value._tag) &&
		[
			'NavigationAborted',
			'NavigationGuardCancelled',
			'NavigationGuardFailed',
			'NavigationRedirect',
			'NavigationRedirectLoop',
			'NavigationDuplicated',
		].includes(value._tag),

	isAborted: $is('NavigationAborted'),
	isCancelled: $is('NavigationGuardCancelled'),
	isFailed: $is('NavigationGuardFailed'),
	isRedirect: $is('NavigationRedirect'),
	isRedirectLoop: $is('NavigationRedirectLoop'),
	isDuplicated: $is('NavigationDuplicated'),

	match: $match,
};
