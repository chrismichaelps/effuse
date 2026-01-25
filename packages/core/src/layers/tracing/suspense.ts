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
import { getGlobalTracing } from './global.js';

export type ResourceStatus = Data.TaggedEnum<{
	Loading: object;
	Success: { readonly itemCount?: number };
	Error: { readonly error: string };
	Stale: object;
}>;

const { Loading, Success, Error, Stale, $match, $is } =
	Data.taggedEnum<ResourceStatus>();

export const ResourceStatus = { Loading, Success, Error, Stale, $match, $is };

export const isResourceLoading = $is('Loading');
export const isResourceSuccess = $is('Success');
export const isResourceError = $is('Error');
export const isResourceStale = $is('Stale');

export const matchResourceStatus = $match;

export interface ResourceTraceData {
	readonly key: string;
	readonly status: ResourceStatus;
}

export const traceResourceLoading = (key: string): void => {
	const tracing = getGlobalTracing();
	if (
		!Predicate.isNotNullable(tracing) ||
		!tracing.isCategoryEnabled('suspense')
	)
		return;

	tracing.log('suspense', 'resource', key, {
		status: Loading(),
	});
};

export const traceResourceSuccess = (
	key: string,
	duration: number,
	itemCount?: number
): void => {
	const tracing = getGlobalTracing();
	if (
		!Predicate.isNotNullable(tracing) ||
		!tracing.isCategoryEnabled('suspense')
	)
		return;

	const status = Predicate.isNotNullable(itemCount)
		? Success({ itemCount })
		: Success({});

	tracing.logWithDuration('suspense', 'resource', key, duration, {
		status,
	});
};

export const traceResourceError = (
	key: string,
	error: string,
	duration: number
): void => {
	const tracing = getGlobalTracing();
	if (
		!Predicate.isNotNullable(tracing) ||
		!tracing.isCategoryEnabled('suspense')
	)
		return;

	tracing.logWithDuration('suspense', 'resource', key, duration, {
		status: Error({ error }),
	});
};

export type SuspenseBoundaryAction = Data.TaggedEnum<{
	Suspend: object;
	Resolve: object;
}>;

const boundaryActionEnum = Data.taggedEnum<SuspenseBoundaryAction>();
export const SuspenseBoundaryAction = {
	Suspend: boundaryActionEnum.Suspend,
	Resolve: boundaryActionEnum.Resolve,
	$match: boundaryActionEnum.$match,
	$is: boundaryActionEnum.$is,
};

export const traceSuspenseBoundary = (
	name: string,
	action: SuspenseBoundaryAction
): void => {
	const tracing = getGlobalTracing();
	if (
		!Predicate.isNotNullable(tracing) ||
		!tracing.isCategoryEnabled('suspense')
	)
		return;

	tracing.log('suspense', 'boundary', name, {
		action,
	});
};
