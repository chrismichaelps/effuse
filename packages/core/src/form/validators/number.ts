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

import type { FieldValidator } from '../types.js';
import { Schema } from 'effect';
import { fromSchema } from './schema.js';
import { ERROR_MESSAGES } from '../config.js';

/** Greater than value. */
export function greaterThan(
	min: number,
	message?: string
): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.greaterThan(min));
	return fromSchema(schema, message ?? `Must be greater than ${String(min)}`);
}

/** Greater than or equal to value. */
export function greaterThanOrEqualTo(
	min: number,
	message?: string
): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.greaterThanOrEqualTo(min));
	return fromSchema(schema, message ?? `Must be at least ${String(min)}`);
}

/** Less than value. */
export function lessThan(
	max: number,
	message?: string
): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.lessThan(max));
	return fromSchema(schema, message ?? `Must be less than ${String(max)}`);
}

/** Less than or equal to value. */
export function lessThanOrEqualTo(
	max: number,
	message?: string
): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.lessThanOrEqualTo(max));
	return fromSchema(schema, message ?? `Must be at most ${String(max)}`);
}

/** Value between min and max inclusive. */
export function between(
	min: number,
	max: number,
	message?: string
): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.between(min, max));
	return fromSchema(
		schema,
		message ?? `Must be between ${String(min)} and ${String(max)}`
	);
}

/** Integer value. */
export function integer(message?: string): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.int());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_INTEGER);
}

/** Finite number (excludes NaN, Infinity). */
export function finite(message?: string): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.finite());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_FINITE);
}

/** Positive number (> 0). */
export function positive(message?: string): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.positive());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_POSITIVE);
}

/** Non negative number (>= 0). */
export function nonNegative(message?: string): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.nonNegative());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_NON_NEGATIVE);
}

/** Negative number (< 0). */
export function negative(message?: string): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.negative());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_NEGATIVE);
}

/** Non positive number (<= 0). */
export function nonPositive(message?: string): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.nonPositive());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_NON_POSITIVE);
}

/** Multiple of divisor. */
export function multipleOf(
	divisor: number,
	message?: string
): FieldValidator<number> {
	const schema = Schema.Number.pipe(Schema.multipleOf(divisor));
	return fromSchema(
		schema,
		message ?? `Must be a multiple of ${String(divisor)}`
	);
}
