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

import { Schema as S } from 'effect';

/** Form configuration defaults as Effect Schema. */
export const FormConfigSchema = S.Struct({
	debounceMs: S.optionalWith(S.Number, { default: () => 0 }),
	validateOn: S.optionalWith(S.Literal('change', 'blur', 'submit'), {
		default: () => 'change' as const,
	}),
});

/** Form configuration type. */
export type FormConfig = S.Schema.Type<typeof FormConfigSchema>;

/** Default form configuration. */
export const DEFAULT_FORM_CONFIG: FormConfig = {
	debounceMs: 0,
	validateOn: 'change',
};

/** Default error messages. */
export const ERROR_MESSAGES = {
	VALIDATION_FAILED: 'Validation failed',
	REQUIRED: 'Required',
	INVALID_FORMAT: 'Invalid format',
	INVALID_EMAIL: 'Invalid email',
	INVALID_URL: 'Invalid URL',
	INVALID_UUID: 'Invalid UUID',
	INVALID_ULID: 'Invalid ULID',
	INVALID_JSON: 'Invalid JSON',
	INVALID_BASE64: 'Invalid Base64',
	INVALID_HEX: 'Invalid hex string',
	MUST_BE_NUMERIC: 'Must contain only numbers',
	MUST_BE_ALPHANUMERIC: 'Must be alphanumeric',
	MUST_BE_LOWERCASE: 'Must be lowercase',
	MUST_BE_UPPERCASE: 'Must be uppercase',
	MUST_BE_CAPITALIZED: 'Must be capitalized',
	MUST_BE_UNCAPITALIZED: 'Must be uncapitalized',
	MUST_BE_TRIMMED: 'Must not have leading or trailing spaces',
	MUST_BE_INTEGER: 'Must be a whole number',
	MUST_BE_FINITE: 'Must be a finite number',
	MUST_BE_POSITIVE: 'Must be positive',
	MUST_BE_NEGATIVE: 'Must be negative',
	MUST_BE_NON_NEGATIVE: 'Must be zero or positive',
	MUST_BE_NON_POSITIVE: 'Must be zero or negative',
	MUST_BE_ARRAY: 'Must be an array',
	NO_DUPLICATES: 'Must not contain duplicates',
	AT_LEAST_ONE_VALID: 'At least one item must be valid',
	MUST_BE_VALID_DATE: 'Must be a valid date',
	MUST_BE_IN_PAST: 'Must be in the past',
	MUST_BE_IN_FUTURE: 'Must be in the future',
} as const;

/** Validation regex patterns. */
export const PATTERNS = {
	EMAIL: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
	UUID: /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i,
	ULID: /^[0-9A-HJKMNP-TV-Z]{26}$/i,
	HEX: /^[0-9a-fA-F]+$/,
	NUMERIC: /^\d+$/,
	ALPHANUMERIC: /^[a-zA-Z0-9]+$/,
} as const;
