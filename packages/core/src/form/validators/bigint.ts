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
export function greaterThanBigInt(min: bigint, message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.greaterThanBigInt(min));
  return fromSchema(schema, message ?? `Must be greater than ${String(min)}`);
}

/** Greater than or equal to value. */
export function greaterThanOrEqualToBigInt(min: bigint, message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.greaterThanOrEqualToBigInt(min));
  return fromSchema(schema, message ?? `Must be at least ${String(min)}`);
}

/** Less than value. */
export function lessThanBigInt(max: bigint, message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.lessThanBigInt(max));
  return fromSchema(schema, message ?? `Must be less than ${String(max)}`);
}

/** Less than or equal to value. */
export function lessThanOrEqualToBigInt(max: bigint, message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.lessThanOrEqualToBigInt(max));
  return fromSchema(schema, message ?? `Must be at most ${String(max)}`);
}

/** Value between min and max inclusive. */
export function betweenBigInt(min: bigint, max: bigint, message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.betweenBigInt(min, max));
  return fromSchema(schema, message ?? `Must be between ${String(min)} and ${String(max)}`);
}

/** Positive bigint (> 0n). */
export function positiveBigInt(message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.positiveBigInt());
  return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_POSITIVE);
}

/** Non negative bigint (>= 0n). */
export function nonNegativeBigInt(message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.nonNegativeBigInt());
  return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_NON_NEGATIVE);
}

/** Negative bigint (< 0n). */
export function negativeBigInt(message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.negativeBigInt());
  return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_NEGATIVE);
}

/** Non positive bigint (<= 0n). */
export function nonPositiveBigInt(message?: string): FieldValidator<bigint> {
  const schema = Schema.BigIntFromSelf.pipe(Schema.nonPositiveBigInt());
  return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_NON_POSITIVE);
}
