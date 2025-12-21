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

/** Compose multiple validators into one. */
export function compose<T>(
	...validators: FieldValidator<T>[]
): FieldValidator<T> {
	return (value: T): ValidationResult => {
		for (const validator of validators) {
			const result = validator(value);
			if (result !== undefined) {
				return result;
			}
		}
		return undefined;
	};
}

/** Required field (not null, undefined, or empty string). */
export function required(message = 'Required'): FieldValidator<unknown> {
	return (value: unknown): ValidationResult => {
		if (value === undefined || value === null || value === '') {
			return message;
		}
		return undefined;
	};
}

/** Custom validation with predicate function. */
export function custom<T>(
	predicate: (value: T) => boolean,
	message = 'Invalid value'
): FieldValidator<T> {
	return (value: T): ValidationResult => {
		if (!predicate(value)) {
			return message;
		}
		return undefined;
	};
}

/** Validate if value equals expected. */
export function equals<T>(expected: T, message?: string): FieldValidator<T> {
	return (value: T): ValidationResult => {
		if (!Object.is(value, expected)) {
			return message ?? `Must equal ${String(expected)}`;
		}
		return undefined;
	};
}

/** Validate if value is one of allowed values. */
export function oneOf<T>(
	allowed: readonly T[],
	message?: string
): FieldValidator<T> {
	return (value: T): ValidationResult => {
		if (!allowed.includes(value)) {
			return message ?? `Must be one of: ${allowed.map(String).join(', ')}`;
		}
		return undefined;
	};
}

/** Validate if value is not one of forbidden values. */
export function notOneOf<T>(
	forbidden: readonly T[],
	message?: string
): FieldValidator<T> {
	return (value: T): ValidationResult => {
		if (forbidden.includes(value)) {
			return (
				message ?? `Must not be one of: ${forbidden.map(String).join(', ')}`
			);
		}
		return undefined;
	};
}

/** Conditional validation. */
export function when<T>(
	condition: (value: T) => boolean,
	validator: FieldValidator<T>
): FieldValidator<T> {
	return (value: T): ValidationResult => {
		if (condition(value)) {
			return validator(value);
		}
		return undefined;
	};
}
