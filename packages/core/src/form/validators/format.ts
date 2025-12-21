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
import { ERROR_MESSAGES, PATTERNS } from '../config.js';

/** Email format validation. */
export function email(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		if (typeof value !== 'string' || !PATTERNS.EMAIL.test(value)) {
			return message ?? ERROR_MESSAGES.INVALID_EMAIL;
		}
		return undefined;
	};
}

/** URL format validation. */
export function url(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		try {
			new URL(value);
			return undefined;
		} catch {
			return message ?? ERROR_MESSAGES.INVALID_URL;
		}
	};
}

/** UUID format validation. */
export function uuid(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		if (typeof value !== 'string' || !PATTERNS.UUID.test(value)) {
			return message ?? ERROR_MESSAGES.INVALID_UUID;
		}
		return undefined;
	};
}

/** ULID format validation. */
export function ulid(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		if (typeof value !== 'string' || !PATTERNS.ULID.test(value)) {
			return message ?? ERROR_MESSAGES.INVALID_ULID;
		}
		return undefined;
	};
}

/** JSON parseable string validation. */
export function json(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		try {
			JSON.parse(value);
			return undefined;
		} catch {
			return message ?? ERROR_MESSAGES.INVALID_JSON;
		}
	};
}

/** Base64 encoded string validation. */
export function base64(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		try {
			if (typeof value !== 'string' || value.length === 0) {
				return message ?? ERROR_MESSAGES.INVALID_BASE64;
			}
			atob(value);
			return undefined;
		} catch {
			return message ?? ERROR_MESSAGES.INVALID_BASE64;
		}
	};
}

/** Hex string validation. */
export function hex(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		if (typeof value !== 'string' || !PATTERNS.HEX.test(value)) {
			return message ?? ERROR_MESSAGES.INVALID_HEX;
		}
		return undefined;
	};
}

/** Numeric string validation (string containing only digits). */
export function numeric(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		if (typeof value !== 'string' || !PATTERNS.NUMERIC.test(value)) {
			return message ?? ERROR_MESSAGES.MUST_BE_NUMERIC;
		}
		return undefined;
	};
}

/** Alphanumeric string validation. */
export function alphanumeric(message?: string): FieldValidator<string> {
	return (value: string): ValidationResult => {
		if (typeof value !== 'string' || !PATTERNS.ALPHANUMERIC.test(value)) {
			return message ?? ERROR_MESSAGES.MUST_BE_ALPHANUMERIC;
		}
		return undefined;
	};
}
