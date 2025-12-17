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

import { Schema } from 'effect';

export const ResourceStatusSchema = Schema.Union(
	Schema.Literal('pending'),
	Schema.Literal('success'),
	Schema.Literal('error')
);

export type ResourceStatus = Schema.Schema.Type<typeof ResourceStatusSchema>;

export const RetryConfigSchema = Schema.Struct({
	times: Schema.optionalWith(Schema.Number, { default: () => 3 }),
	delay: Schema.optionalWith(Schema.Number, { default: () => 1000 }),
	exponential: Schema.optionalWith(Schema.Boolean, { default: () => false }),
});

export type RetryConfig = Schema.Schema.Type<typeof RetryConfigSchema>;

export const ResourceOptionsSchema = Schema.Struct({
	timeout: Schema.optional(Schema.Number),
	retry: Schema.optional(RetryConfigSchema),
	initialValue: Schema.optional(Schema.Unknown),
	ssrKey: Schema.optional(Schema.String),
});

export type ResourceOptions = Schema.Schema.Type<typeof ResourceOptionsSchema>;

export const ResourceStateSchema = <T>(dataSchema: Schema.Schema<T>) =>
	Schema.Struct({
		status: ResourceStatusSchema,
		data: Schema.optional(dataSchema),
		error: Schema.optional(Schema.Unknown),
	});

export interface ResourceState<T> {
	readonly status: ResourceStatus;
	readonly data?: T;
	readonly error?: unknown;
}

export const createPendingState = <T>(): ResourceState<T> => ({
	status: 'pending',
});

export const createSuccessState = <T>(data: T): ResourceState<T> => ({
	status: 'success',
	data,
});

export const createErrorState = <T>(error: unknown): ResourceState<T> => ({
	status: 'error',
	error,
});
