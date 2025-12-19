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

import type { Schema } from 'effect';
import { Context, Effect, Layer } from 'effect';
import {
	validateState,
	createFieldValidator,
	type StateSchema,
	type ValidationResult,
} from '../validation/schema.js';
import { createDeferred } from '../actions/cancellation.js';

export class ValidationError extends Error {
	readonly _tag = 'ValidationError';
	readonly errors: string[];
	constructor(errors: string[]) {
		super(`Validation failed: ${errors.join(', ')}`);
		this.errors = errors;
	}
}

export interface ValidationServiceApi {
	validate: <T>(
		schema: StateSchema<T>,
		state: unknown
	) => Effect.Effect<T, ValidationError>;
	validateSafe: <T>(
		schema: StateSchema<T>,
		state: unknown
	) => Effect.Effect<ValidationResult<T>>;
	createValidator: <T>(
		schema: Schema.Schema<T, T>
	) => (value: unknown) => Effect.Effect<T, ValidationError>;
	validateWithDeferred: <T>(
		schema: StateSchema<T>,
		state: unknown
	) => Effect.Effect<{
		result: Effect.Effect<T, ValidationError>;
		triggerValidation: () => Effect.Effect<boolean>;
	}>;
}

export class ValidationService extends Context.Tag(
	'effuse/store/ValidationService'
)<ValidationService, ValidationServiceApi>() {}

export const ValidationServiceLive: Layer.Layer<ValidationService> =
	Layer.succeed(ValidationService, {
		validate: <T>(schema: StateSchema<T>, state: unknown) =>
			Effect.gen(function* () {
				const result = validateState(schema, state);
				if (!result.success || !result.data) {
					return yield* Effect.fail(new ValidationError(result.errors));
				}
				return result.data;
			}),

		validateSafe: <T>(schema: StateSchema<T>, state: unknown) =>
			Effect.sync(() => validateState(schema, state)),

		createValidator:
			<T>(schema: Schema.Schema<T, T>) =>
			(value: unknown) =>
				Effect.try({
					try: () => createFieldValidator(schema)(value),
					catch: (e) => new ValidationError([String(e)]),
				}),

		validateWithDeferred: <T>(schema: StateSchema<T>, state: unknown) =>
			Effect.gen(function* () {
				const deferred = yield* createDeferred<T, ValidationError>();
				return {
					result: deferred.await,
					triggerValidation: () =>
						Effect.gen(function* () {
							const validationResult = validateState(schema, state);
							if (validationResult.success && validationResult.data) {
								return yield* deferred.succeed(validationResult.data);
							}
							return yield* deferred.fail(
								new ValidationError(validationResult.errors)
							);
						}),
				};
			}),
	});

export const useValidation = <A, E, R>(
	fn: (service: ValidationServiceApi) => Effect.Effect<A, E, R>
) =>
	Effect.gen(function* () {
		const service = yield* ValidationService;
		return yield* fn(service);
	});

export const runWithValidation = <A, E>(
	effect: Effect.Effect<A, E, ValidationService>
): Effect.Effect<A, E> => Effect.provide(effect, ValidationServiceLive);
