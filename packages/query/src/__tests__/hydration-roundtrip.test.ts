/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import {
	dehydrate,
	hydrate,
	type DehydrateOptions,
} from '../core/hydration.js';

/** Push `data` through dehydrate and hydrate, as SSR does. */
const roundTrip = (data: unknown, options?: DehydrateOptions): unknown =>
	hydrate(
		dehydrate(
			[
				{
					queryHash: 'h',
					queryKey: ['k'],
					currentState: { data, error: null } as never,
				},
			],
			options
		),
		options
	)[0]?.state.data;

describe('data that merely looks like a serialized wrapper', () => {
	it('stays a plain object', () => {
		// `serializeValue` passed such an object through untouched, so
		// `deserializeValue` could not tell it from a wrapper and rebuilt it as
		// a Date.
		const data = { __type: 'Date', __value: '2020-01-01T00:00:00.000Z' };
		const back = roundTrip(data);

		expect(back).toBeInstanceOf(Object);
		expect(back).not.toBeInstanceOf(Date);
		expect(back).toEqual(data);
	});

	it('stays a plain object for an Error lookalike', () => {
		const data = { __type: 'Error', __value: { message: 'not really' } };
		const back = roundTrip(data);

		expect(back).not.toBeInstanceOf(Error);
		expect(back).toEqual(data);
	});

	it('stays a plain object when nested', () => {
		const data = {
			user: { __type: 'Date', __value: '2020-01-01T00:00:00.000Z' },
		};

		expect(roundTrip(data)).toEqual(data);
	});

	it('stays a plain object inside an array', () => {
		const data = [{ __type: 'Date', __value: '2020-01-01T00:00:00.000Z' }];

		expect(roundTrip(data)).toEqual(data);
	});

	it('keeps its other properties', () => {
		const data = { __type: 'Date', __value: 'x', keep: 1, nested: { a: 2 } };

		expect(roundTrip(data)).toEqual(data);
	});

	it('survives when it looks like the escape marker itself', () => {
		// The escape is applied to the object rather than its values, so an
		// object shaped like the marker escapes too instead of recursing.
		const data = { __type: '__effuse_raw', __value: { inner: 1 } };

		expect(roundTrip(data)).toEqual(data);
	});

	it('was already safe for an unregistered type name', () => {
		const data = { __type: 'Nope', __value: 1 };

		expect(roundTrip(data)).toEqual(data);
	});
});

describe('real values still round-trip', () => {
	it('restores a Date', () => {
		const back = roundTrip(new Date(0));

		expect(back).toBeInstanceOf(Date);
		expect((back as Date).toISOString()).toBe('1970-01-01T00:00:00.000Z');
	});

	it('restores a nested Date', () => {
		const back = roundTrip({ at: new Date(0) }) as { at: Date };

		expect(back.at).toBeInstanceOf(Date);
	});

	it('restores a Date inside an array', () => {
		const back = roundTrip([new Date(0)]) as Date[];

		expect(back[0]).toBeInstanceOf(Date);
	});

	it('leaves plain data alone', () => {
		const data = { a: 1, b: [2, 3], c: { d: 'e' }, f: null };

		expect(roundTrip(data)).toEqual(data);
	});

	it('leaves primitives alone', () => {
		expect(roundTrip(42)).toBe(42);
		expect(roundTrip('s')).toBe('s');
		expect(roundTrip(null)).toBeNull();
	});
});

describe('custom serializers keep working', () => {
	class Money {
		constructor(readonly cents: number) {}
	}

	const options: DehydrateOptions = {
		serializers: [
			{
				name: 'Money',
				serialize: (value) => (value as Money).cents,
				deserialize: (value) => new Money(value as number),
				isInstance: (value): value is Money => value instanceof Money,
			},
		],
	};

	it('restores a custom type', () => {
		const back = roundTrip(new Money(500), options);

		expect(back).toBeInstanceOf(Money);
		expect((back as Money).cents).toBe(500);
	});

	it('does not swallow a lookalike for a custom type', () => {
		const data = { __type: 'Money', __value: 500 };

		expect(roundTrip(data, options)).toEqual(data);
	});
});
