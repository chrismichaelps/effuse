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

export const RESOURCE_ID_PREFIX = 'resource-';
export const BOUNDARY_ID_PREFIX = 'suspense-boundary-';

export const DEFAULT_RETRY_TIMES = 3;
export const DEFAULT_RETRY_DELAY_MS = 1000;
export const DEFAULT_EXPONENTIAL_RETRY = false;

export interface ResourceDefaults {
	readonly retryTimes: number;
	readonly retryDelayMs: number;
	readonly exponentialRetry: boolean;
}

export const defaultResourceConfig: ResourceDefaults = {
	retryTimes: DEFAULT_RETRY_TIMES,
	retryDelayMs: DEFAULT_RETRY_DELAY_MS,
	exponentialRetry: DEFAULT_EXPONENTIAL_RETRY,
};

export const ResourceErrorMessages = {
	PENDING_NO_PROMISE: 'Resource pending but no promise available',
} as const;

export type ResourceErrorMessage =
	(typeof ResourceErrorMessages)[keyof typeof ResourceErrorMessages];
