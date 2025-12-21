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

import type { FormValidators, FormErrors } from './types.js';

/** Single field validation. Returns error message or undefined. */
export function validateField<T>(
	validator: ((value: T) => string | undefined) | undefined,
	value: T
): string | undefined {
	if (!validator) {
		return undefined;
	}
	return validator(value);
}

/** Full form validation. Returns error map. */
export function validateForm<T extends Record<string, unknown>>(
	validators: FormValidators<T>,
	values: T
): FormErrors<T> {
	const errors: FormErrors<T> = {};

	for (const key of Object.keys(validators) as Array<keyof T>) {
		const validator = validators[key];
		const value = values[key];
		const error = validateField(validator, value);

		if (error !== undefined) {
			errors[key] = error;
		}
	}

	return errors;
}

/** Check if error map contains any errors. */
export function hasErrors<T extends Record<string, unknown>>(
	errors: FormErrors<T>
): boolean {
	return Object.keys(errors).some(
		(key) => errors[key as keyof T] !== undefined
	);
}
