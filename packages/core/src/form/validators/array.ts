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

import type { FieldValidator, ValidationResult } from '../types.js';
import { ERROR_MESSAGES } from '../config.js';

/** Minimum array length. */
export function minItems<T>(min: number, message?: string): FieldValidator<readonly T[]> {
  return (value: readonly T[]): ValidationResult => {
    if (!Array.isArray(value) || value.length < min) {
      return message ?? `Must have at least ${String(min)} items`;
    }
    return undefined;
  };
}

/** Maximum array length. */
export function maxItems<T>(max: number, message?: string): FieldValidator<readonly T[]> {
  return (value: readonly T[]): ValidationResult => {
    if (!Array.isArray(value) || value.length > max) {
      return message ?? `Must have at most ${String(max)} items`;
    }
    return undefined;
  };
}

/** Exact array length. */
export function itemCount<T>(count: number, message?: string): FieldValidator<readonly T[]> {
  return (value: readonly T[]): ValidationResult => {
    if (!Array.isArray(value) || value.length !== count) {
      return message ?? `Must have exactly ${String(count)} items`;
    }
    return undefined;
  };
}

/** Non empty array. */
export function nonEmptyArray<T>(message?: string): FieldValidator<readonly T[]> {
  return minItems(1, message ?? 'Must have at least one item');
}

/** Unique items (no duplicates). */
export function uniqueItems<T>(message?: string): FieldValidator<readonly T[]> {
  return (value: readonly T[]): ValidationResult => {
    if (!Array.isArray(value)) {
      return message ?? ERROR_MESSAGES.MUST_BE_ARRAY;
    }
    const unique = new Set(value);
    if (unique.size !== value.length) {
      return message ?? ERROR_MESSAGES.NO_DUPLICATES;
    }
    return undefined;
  };
}

/** Validate each item in array. */
export function everyItem<T>(
  itemValidator: FieldValidator<T>,
  message?: string
): FieldValidator<readonly T[]> {
  return (value: readonly T[]): ValidationResult => {
    if (!Array.isArray(value)) {
      return message ?? ERROR_MESSAGES.MUST_BE_ARRAY;
    }
    const typedArray = value as readonly T[];
    for (let i = 0; i < typedArray.length; i++) {
      const error = itemValidator(typedArray[i] as T);
      if (error !== undefined) {
        return message ?? `Item ${String(i)}: ${error}`;
      }
    }
    return undefined;
  };
}

/** Validate at least one item in array passes. */
export function someItem<T>(
  itemValidator: FieldValidator<T>,
  message?: string
): FieldValidator<readonly T[]> {
  return (value: readonly T[]): ValidationResult => {
    if (!Array.isArray(value)) {
      return message ?? ERROR_MESSAGES.MUST_BE_ARRAY;
    }
    const typedArray = value as readonly T[];
    for (const item of typedArray) {
      const error = itemValidator(item);
      if (error === undefined) {
        return undefined;
      }
    }
    return message ?? ERROR_MESSAGES.AT_LEAST_ONE_VALID;
  };
}
