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

/** Minimum string length. */
export function minLength(
	min: number,
	message?: string
): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.minLength(min));
	return fromSchema(
		schema,
		message ?? `Must be at least ${String(min)} characters`
	);
}

/** Maximum string length. */
export function maxLength(
	max: number,
	message?: string
): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.maxLength(max));
	return fromSchema(
		schema,
		message ?? `Must be at most ${String(max)} characters`
	);
}

/** Exact string length. */
export function length(len: number, message?: string): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.length(len));
	return fromSchema(
		schema,
		message ?? `Must be exactly ${String(len)} characters`
	);
}

/** String length range. */
export function lengthBetween(
	min: number,
	max: number,
	message?: string
): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.length({ min, max }));
	return fromSchema(
		schema,
		message ?? `Must be between ${String(min)} and ${String(max)} characters`
	);
}

/** Non empty string. */
export function nonEmpty(message?: string): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.nonEmptyString());
	return fromSchema(schema, message ?? ERROR_MESSAGES.REQUIRED);
}

/** Regex pattern match. */
export function pattern(
	regex: RegExp,
	message?: string
): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.pattern(regex));
	return fromSchema(schema, message ?? ERROR_MESSAGES.INVALID_FORMAT);
}

/** String starts with prefix. */
export function startsWith(
	prefix: string,
	message?: string
): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.startsWith(prefix));
	return fromSchema(schema, message ?? `Must start with "${prefix}"`);
}

/** String ends with suffix. */
export function endsWith(
	suffix: string,
	message?: string
): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.endsWith(suffix));
	return fromSchema(schema, message ?? `Must end with "${suffix}"`);
}

/** String includes substring. */
export function includes(
	substring: string,
	message?: string
): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.includes(substring));
	return fromSchema(schema, message ?? `Must contain "${substring}"`);
}

/** Trimmed string (no leading/trailing whitespace). */
export function trimmed(message?: string): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.trimmed());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_TRIMMED);
}

/** Lowercase string. */
export function lowercased(message?: string): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.lowercased());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_LOWERCASE);
}

/** Uppercase string. */
export function uppercased(message?: string): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.uppercased());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_UPPERCASE);
}

/** Capitalized string. */
export function capitalized(message?: string): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.capitalized());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_CAPITALIZED);
}

/** Uncapitalized string. */
export function uncapitalized(message?: string): FieldValidator<string> {
	const schema = Schema.String.pipe(Schema.uncapitalized());
	return fromSchema(schema, message ?? ERROR_MESSAGES.MUST_BE_UNCAPITALIZED);
}
