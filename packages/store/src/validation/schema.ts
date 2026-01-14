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

import { Effect, Schema, Duration, Predicate } from 'effect';
import { TimeoutError } from '../errors.js';
import { DEFAULT_TIMEOUT_MS } from '../config/constants.js';

export type StateSchema<T> = Schema.Schema<T, T>;

export interface ValidationResult<T> {
	success: boolean;
	data: T | null;
	errors: string[];
}

export const validateState = <T>(
	schema: StateSchema<T>,
	state: unknown
): ValidationResult<T> => {
	const result = Effect.runSync(
		Schema.decodeUnknown(schema)(state).pipe(
			Effect.map((data) => ({
				success: true as const,
				data,
				errors: [] as string[],
			})),
			Effect.catchAll((error) =>
				Effect.succeed({
					success: false as const,
					data: null,
					errors: [String(error)],
				})
			)
		)
	);
	return result;
};

export const validateStateAsync = <T>(
	schema: StateSchema<T>,
	state: unknown,
	timeoutMs = DEFAULT_TIMEOUT_MS
): Promise<ValidationResult<T>> => {
	return Effect.runPromise(
		Schema.decodeUnknown(schema)(state).pipe(
			Effect.map((data) => ({
				success: true as const,
				data,
				errors: [] as string[],
			})),
			Effect.timeoutFail({
				duration: Duration.millis(timeoutMs),
				onTimeout: () => new TimeoutError({ ms: timeoutMs }),
			}),
			Effect.catchAll((error) =>
				Effect.succeed({
					success: false as const,
					data: null,
					errors: [
						error instanceof TimeoutError
							? `Validation timed out after ${String(timeoutMs)}ms`
							: String(error),
					],
				})
			)
		)
	);
};

export const createValidatedSetter = <T extends Record<string, unknown>>(
	schema: StateSchema<T>,
	onValid: (state: T) => void,
	onInvalid?: (errors: string[]) => void
): ((state: unknown) => boolean) => {
	return (state: unknown): boolean => {
		const result = validateState(schema, state);
		if (result.success && result.data) {
			onValid(result.data);
			return true;
		}
		if (Predicate.isNotNullable(onInvalid)) {
			onInvalid(result.errors);
		}
		return false;
	};
};

export const createFieldValidator = <T>(
	schema: Schema.Schema<T, T>
): ((value: unknown) => T) => {
	return (value: unknown): T => {
		return Effect.runSync(Schema.decodeUnknown(schema)(value));
	};
};

export const createSafeFieldSetter = <T>(
	schema: Schema.Schema<T, T>,
	setter: (value: T) => void
): ((value: unknown) => boolean) => {
	return (value: unknown): boolean => {
		const result = Effect.runSync(
			Schema.decodeUnknown(schema)(value).pipe(
				Effect.map((decoded) => {
					setter(decoded);
					return true;
				}),
				Effect.catchAll(() => Effect.succeed(false))
			)
		);
		return result;
	};
};

export { Schema };
