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

export const RetryOptionsSchema = Schema.Struct({
	times: Schema.optional(Schema.Number),
	delay: Schema.optional(Schema.Number),
	strategy: Schema.optional(Schema.Literal('constant', 'exponential')),
});

export type RetryOptions = Schema.Schema.Type<typeof RetryOptionsSchema>;

export const DebounceOptionsSchema = Schema.Struct({
	wait: Schema.Number,
	leading: Schema.optional(Schema.Boolean),
	trailing: Schema.optional(Schema.Boolean),
});

export type DebounceOptions = Schema.Schema.Type<typeof DebounceOptionsSchema>;

export const EffectOptionsSchema = Schema.Struct({
	immediate: Schema.optional(Schema.Boolean),
	retry: Schema.optional(RetryOptionsSchema),
	timeout: Schema.optional(Schema.Number),
	debounce: Schema.optional(DebounceOptionsSchema),
	flush: Schema.optional(Schema.Literal('sync', 'post')),
});

export type EffectOptions = Schema.Schema.Type<typeof EffectOptionsSchema>;

export const WatchOptionsSchema = EffectOptionsSchema.pipe(
	Schema.extend(
		Schema.Struct({
			deep: Schema.optional(Schema.Boolean),
			once: Schema.optional(Schema.Boolean),
		})
	)
);

export type WatchOptions = Schema.Schema.Type<typeof WatchOptionsSchema>;
