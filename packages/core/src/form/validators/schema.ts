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
import { Schema, Either } from 'effect';
import { ArrayFormatter } from 'effect/ParseResult';
import { ERROR_MESSAGES } from '../config.js';

/** Extract error message from Effect Schema validation result. */
export function extractSchemaError<T>(
	schema: Schema.Schema<T>,
	value: unknown
): ValidationResult {
	const result = Schema.decodeUnknownEither(schema)(value);
	if (Either.isRight(result)) {
		return undefined;
	}
	const formatted = ArrayFormatter.formatErrorSync(result.left);
	if (formatted.length > 0 && formatted[0] !== undefined) {
		return formatted[0].message;
	}
	return ERROR_MESSAGES.VALIDATION_FAILED;
}

/** Validates values. */
export function fromSchema<T>(
	schema: Schema.Schema<T>,
	message?: string
): FieldValidator<T> {
	return (value: T): ValidationResult => {
		const error = extractSchemaError(schema, value);
		if (error !== undefined && message !== undefined) {
			return message;
		}
		return error;
	};
}
