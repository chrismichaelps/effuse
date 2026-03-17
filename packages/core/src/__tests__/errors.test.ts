import { describe, it, expect } from 'vitest';
import { Data, Effect } from 'effect';
import {
	mapEffuseErrors,
	StoreGetterNotConfiguredError,
	ScriptContextError,
} from '../errors.js';

const extractMappedError = (err: unknown): Error =>
	Effect.runSync(
		Effect.catchAll(mapEffuseErrors(Effect.fail(err)), (e) =>
			Effect.succeed(e)
		)
	);

describe('mapEffuseErrors', () => {
	it('should return standard Errors as-is', () => {
		const standardError = new Error('Standard failure');
		const result = extractMappedError(standardError);
		expect(result).toBe(standardError);
	});

	it('should unwrap and convert Data.TaggedError to standard Error', () => {
		class CustomTaggedError extends Data.TaggedError('CustomError')<{
			message: string;
		}> {}
		const taggedError = new CustomTaggedError({ message: 'Internal failure' });
		const result = extractMappedError(taggedError);

		expect(result).toBeInstanceOf(Error);
		expect(result.message).toBe('[Effuse] CustomError: Internal failure');
		expect(result.name).toBe('Error');
	});

	it('should convert unknown objects to Error objects', () => {
		const unknownObj = { reason: 'Something went wrong directly' };
		const result = extractMappedError(unknownObj);

		expect(result).toBeInstanceOf(Error);
		expect(result.message).toContain('Object');
	});

	it('should stringify non-object primitives into Error objects', () => {
		const primitiveString = 'Just a string error';
		const primitiveNumber = 404;

		const resultString = extractMappedError(primitiveString);
		const resultNumber = extractMappedError(primitiveNumber);

		expect(resultString).toBeInstanceOf(Error);
		expect(resultString.message).toBe('Just a string error');
		
		expect(resultNumber).toBeInstanceOf(Error);
		expect(resultNumber.message).toBe('404');
	});
});

describe('Framework Specific Errors', () => {
	it('should correctly format StoreGetterNotConfiguredError', () => {
		const error = new StoreGetterNotConfiguredError({});
		
		expect(error._tag).toBe('StoreGetterNotConfiguredError');
	});

	it('should correctly format ScriptContextError', () => {
		const error = new ScriptContextError({ message: 'Invalid hook call context' });
		
		expect(error._tag).toBe('ScriptContextError');
		expect(error.message).toBe('Invalid hook call context');
	});
});

describe('Massive Permutation Tests (500+ cases)', () => {
	describe('Primitive value wrapping', () => {
		const stringCases = Array.from({ length: 150 }, (_, i) => [
			`Random error message ${i}`,
		]);

		it.each(stringCases)('should wrap string %s into Error', (str) => {
			const res = extractMappedError(str);
			expect(res).toBeInstanceOf(Error);
			expect(res.message).toBe(str);
		});

		const numberCases = Array.from({ length: 150 }, (_, i) => [
			(i * 3.14).toString(),
			i * 3.14,
		]);

		it.each(numberCases)('should wrap number %d into Error', (expectedStr, num) => {
			const res = extractMappedError(num);
			expect(res).toBeInstanceOf(Error);
			expect(res.message).toBe(expectedStr);
		});
		
		const booleanCases: Array<[string, boolean]> = [
			['true', true],
			['false', false]
		];
		
		it.each(booleanCases)('should wrap boolean %s into Error', (expectedStr, val) => {
			const res = extractMappedError(val);
			expect(res).toBeInstanceOf(Error);
			expect(res.message).toBe(expectedStr);
		});
	});

	describe('Nested Object and Unknown Shape Wrapping', () => {
		const shapes = Array.from({ length: 200 }, (_, i) => [
			{
				id: i,
				deep: { nested: { field: i * 10 } },
				timestamp: Date.now() - i * 1000,
			},
		]);

		it.each(shapes)('should format unknown object structure #%# into Error', (obj) => {
			const res = extractMappedError(obj);
			expect(res).toBeInstanceOf(Error);
			expect(res.message).toContain('Object');
		});
	});

	describe('Effect TaggedError Exhaustive Wrapping', () => {
		class GeneratedTaggedError extends Data.TaggedError('GeneratedError')<{
			message: string;
			code: number;
		}> {}

		const taggedErrors = Array.from({ length: 100 }, (_, i) => {
			return [
				`GeneratedError`,
				`Dynamic Failure ${i}`,
				new GeneratedTaggedError({ message: `Dynamic Failure ${i}`, code: i }),
			] as const;
		});

		it.each(taggedErrors)(
			'should map %s tag with message %s correctly',
			(expectedName, expectedMessage, err) => {
				const res = extractMappedError(err);
				expect(res).toBeInstanceOf(Error);
				expect(res.message).toBe(`[Effuse] ${expectedName}: ${expectedMessage}`);
			}
		);
	});
});
