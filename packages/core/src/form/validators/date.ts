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

/** Date is before target date. */
export function before(target: Date, message?: string): FieldValidator<Date> {
	return (value: Date): ValidationResult => {
		if (!(value instanceof Date) || value.getTime() >= target.getTime()) {
			return message ?? `Must be before ${target.toISOString()}`;
		}
		return undefined;
	};
}

/** Date is after target date. */
export function after(target: Date, message?: string): FieldValidator<Date> {
	return (value: Date): ValidationResult => {
		if (!(value instanceof Date) || value.getTime() <= target.getTime()) {
			return message ?? `Must be after ${target.toISOString()}`;
		}
		return undefined;
	};
}

/** Date is between two dates. */
export function dateBetween(
	start: Date,
	end: Date,
	message?: string
): FieldValidator<Date> {
	return (value: Date): ValidationResult => {
		if (!(value instanceof Date)) {
			return message ?? ERROR_MESSAGES.MUST_BE_VALID_DATE;
		}
		const time = value.getTime();
		if (time < start.getTime() || time > end.getTime()) {
			return (
				message ??
				`Must be between ${start.toISOString()} and ${end.toISOString()}`
			);
		}
		return undefined;
	};
}

/** Date is in the past. */
export function past(message?: string): FieldValidator<Date> {
	return (value: Date): ValidationResult => {
		if (!(value instanceof Date) || value.getTime() >= Date.now()) {
			return message ?? ERROR_MESSAGES.MUST_BE_IN_PAST;
		}
		return undefined;
	};
}

/** Date is in the future. */
export function future(message?: string): FieldValidator<Date> {
	return (value: Date): ValidationResult => {
		if (!(value instanceof Date) || value.getTime() <= Date.now()) {
			return message ?? ERROR_MESSAGES.MUST_BE_IN_FUTURE;
		}
		return undefined;
	};
}

/** Valid Date object (not Invalid Date). */
export function validDate(message?: string): FieldValidator<Date> {
	return (value: Date): ValidationResult => {
		if (!(value instanceof Date) || isNaN(value.getTime())) {
			return message ?? ERROR_MESSAGES.MUST_BE_VALID_DATE;
		}
		return undefined;
	};
}
