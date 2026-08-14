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

/**
 * The session shape, declared once.
 *
 * This is the direct answer to the single worst piece of ergonomics in the
 * incumbent library, where adding one field to a session means implementing a
 * `jwt` callback, implementing a `session` callback, and module-augmenting
 * three interfaces in a separate declaration file — four edits, none of which
 * the compiler links to the others, so they drift.
 *
 * Here a claim declaration carries everything the system needs:
 *
 * - **The static type**, inferred by {@link InferClaims}, so every call site is
 *   checked against the same source.
 * - **A runtime decoder**, because a session arrives from a cookie the client
 *   controls. A type assertion is not validation.
 * - **Exposure**, so the SSR hydration path knows which claims may be written
 *   into HTML and which must never leave the server.
 */

/** Runtime kind of a claim. */
export type ClaimKind = 'string' | 'number' | 'boolean' | 'enum';

export interface ClaimOptions {
	/**
	 * Whether this claim may be serialised to the browser. Defaults to `true`.
	 *
	 * The default is exposure rather than concealment because the common case is
	 * a display field, and a default of `false` would train users to write
	 * `expose: true` reflexively — at which point the flag stops being read. An
	 * explicit `expose: false` on a sensitive claim is the reviewable artifact.
	 */
	readonly expose?: boolean;
}

export interface ClaimSchema<Value, Optional extends boolean = false> {
	readonly kind: ClaimKind;
	readonly expose: boolean;
	readonly isOptional: Optional;
	/** Permitted values, for `enum` claims only. */
	readonly values?: readonly string[];
	/** Narrows an unknown value, or explains why it could not be narrowed. */
	readonly check: (input: unknown) => input is Value;
	/** Returns a copy of this claim that may be absent from a payload. */
	optional(): ClaimSchema<Value, true>;
}

/** Any claim, for use in generic positions. */
export type AnyClaim = ClaimSchema<unknown, boolean>;

/** A declared session shape. */
export type ClaimsShape = Readonly<Record<string, AnyClaim>>;

type ClaimValue<C> =
	C extends ClaimSchema<infer Value, boolean> ? Value : never;

type OptionalKeys<Shape> = {
	[K in keyof Shape]-?: Shape[K] extends ClaimSchema<unknown, true> ? K : never;
}[keyof Shape];

type RequiredKeys<Shape> = Exclude<keyof Shape, OptionalKeys<Shape>>;

type Simplify<T> = { [K in keyof T]: T[K] } & {};

/**
 * The session type implied by a claims declaration.
 *
 * Optional claims become optional properties rather than `| undefined` ones, so
 * object literals stay ergonomic under `exactOptionalPropertyTypes`.
 */
export type InferClaims<Shape extends ClaimsShape> = Simplify<
	{
		[K in RequiredKeys<Shape>]: ClaimValue<Shape[K]>;
	} & {
		[K in OptionalKeys<Shape>]?: ClaimValue<Shape[K]>;
	}
>;

const makeClaim = <Value>(
	kind: ClaimKind,
	check: (input: unknown) => input is Value,
	expose: boolean,
	values?: readonly string[]
): ClaimSchema<Value> => {
	const base = {
		kind,
		expose,
		isOptional: false as const,
		check,
		optional: (): ClaimSchema<Value, true> => ({
			...base,
			isOptional: true as const,
			// Optionality is orthogonal to exposure. Resetting `expose` here would
			// quietly re-expose a claim the author had deliberately hidden.
			optional: (): ClaimSchema<Value, true> => base.optional(),
		}),
		...(values === undefined ? {} : { values }),
	} satisfies ClaimSchema<Value>;

	return base;
};

const isString = (input: unknown): input is string => typeof input === 'string';

// `Number.isFinite` rather than `typeof === 'number'`: NaN and Infinity survive
// JSON round-trips in some encoders and would otherwise pass as valid numbers.
const isFiniteNumber = (input: unknown): input is number =>
	typeof input === 'number' && Number.isFinite(input);

const isBoolean = (input: unknown): input is boolean =>
	typeof input === 'boolean';

/** Claim constructors. */
export const claim = {
	string: (options: ClaimOptions = {}): ClaimSchema<string> =>
		makeClaim('string', isString, options.expose ?? true),

	number: (options: ClaimOptions = {}): ClaimSchema<number> =>
		makeClaim('number', isFiniteNumber, options.expose ?? true),

	boolean: (options: ClaimOptions = {}): ClaimSchema<boolean> =>
		makeClaim('boolean', isBoolean, options.expose ?? true),

	/**
	 * A claim restricted to a fixed set of strings.
	 *
	 * Inferred as a literal union, so a policy that checks `role === 'admin'`
	 * against a typo fails to compile instead of always being false at runtime.
	 */
	enum: <const Values extends readonly [string, ...string[]]>(
		values: Values,
		options: ClaimOptions = {}
	): ClaimSchema<Values[number]> => {
		const permitted = new Set<string>(values);
		return makeClaim(
			'enum',
			(input): input is Values[number] =>
				typeof input === 'string' && permitted.has(input),
			options.expose ?? true,
			values
		);
	},
} as const;

/** The result of decoding an untrusted payload against a claims shape. */
export type DecodeResult<Shape extends ClaimsShape> =
	| { readonly ok: true; readonly value: InferClaims<Shape> }
	| { readonly ok: false; readonly reason: string };

// Keys that must never be copied out of an untrusted payload. A decoded token
// is attacker-influenced input, and assigning `__proto__` from it would alter
// Object.prototype for the entire process.
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
	'__proto__',
	'constructor',
	'prototype',
]);

const isPlainObject = (input: unknown): input is Record<string, unknown> =>
	typeof input === 'object' && input !== null && !Array.isArray(input);

/**
 * Validates an untrusted payload against a declared shape.
 *
 * Unknown keys are dropped rather than passed through. Carrying them would let
 * anyone who can influence a payload smuggle properties into a value that later
 * code reads by index, and there is no legitimate use for a claim nobody
 * declared.
 */
export const decodeClaims = <Shape extends ClaimsShape>(
	shape: Shape,
	input: unknown
): DecodeResult<Shape> => {
	if (!isPlainObject(input)) {
		return { ok: false, reason: 'Session payload is not an object.' };
	}

	// Null-prototype, so even a forbidden key that slipped through could not
	// reach a prototype chain.
	const decoded = Object.create(null) as Record<string, unknown>;

	for (const [name, definition] of Object.entries(shape)) {
		if (FORBIDDEN_KEYS.has(name)) {
			return { ok: false, reason: `Claim "${name}" uses a forbidden key.` };
		}

		const raw = Object.prototype.hasOwnProperty.call(input, name)
			? input[name]
			: undefined;

		if (raw === undefined) {
			if (definition.isOptional) continue;
			return { ok: false, reason: `Missing required claim "${name}".` };
		}

		if (!definition.check(raw)) {
			return {
				ok: false,
				reason: `Claim "${name}" is not a valid ${definition.kind}.`,
			};
		}

		decoded[name] = raw;
	}

	return {
		ok: true,
		value: { ...decoded } as InferClaims<Shape>,
	};
};

/**
 * Projects a session down to the claims marked for exposure.
 *
 * The SSR hydration path uses this so that the payload written into HTML is a
 * deliberate subset rather than whatever the session happened to hold.
 */
export const exposedClaims = <Shape extends ClaimsShape>(
	shape: Shape,
	session: InferClaims<Shape>
): Partial<InferClaims<Shape>> => {
	const source = session as Record<string, unknown>;
	const result: Record<string, unknown> = {};

	for (const [name, definition] of Object.entries(shape)) {
		if (!definition.expose) continue;
		if (!Object.prototype.hasOwnProperty.call(source, name)) continue;
		result[name] = source[name];
	}

	return result as Partial<InferClaims<Shape>>;
};
