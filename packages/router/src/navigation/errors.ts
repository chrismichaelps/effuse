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
	NavigationRedirect: NavigationFailureBase & {
		readonly redirectTo: RouteLocation;
	};
	NavigationDuplicated: NavigationFailureBase;
}>;

const {
	NavigationAborted,
	NavigationGuardCancelled,
	NavigationRedirect,
	NavigationDuplicated,
	$is,
	$match,
} = Data.taggedEnum<NavigationFailure>();

export {
	NavigationAborted,
	NavigationGuardCancelled,
	NavigationRedirect,
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

	redirect: (
		to: ResolvedRoute,
		from: ResolvedRoute,
		redirectTo: RouteLocation
	): NavigationFailure => NavigationRedirect({ to, from, redirectTo }),

	duplicated: (to: ResolvedRoute, from: ResolvedRoute): NavigationFailure =>
		NavigationDuplicated({ to, from }),

	isNavigationFailure: (value: unknown): value is NavigationFailure =>
		Predicate.isObject(value) &&
		Predicate.hasProperty(value, '_tag') &&
		Predicate.isString(value._tag) &&
		[
			'NavigationAborted',
			'NavigationGuardCancelled',
			'NavigationRedirect',
			'NavigationDuplicated',
		].includes(value._tag),

	isAborted: $is('NavigationAborted'),
	isCancelled: $is('NavigationGuardCancelled'),
	isRedirect: $is('NavigationRedirect'),
	isDuplicated: $is('NavigationDuplicated'),

	match: $match,
};
