import { describe, it, expect, vi } from 'vitest';
import { Schema } from 'effect';
import {
	validateState,
	validateStateAsync,
	createValidatedSetter,
	createFieldValidator,
	createSafeFieldSetter,
} from '../../validation/schema.js';

describe('validation / schema', () => {
	const TestSchema = Schema.Struct({
		name: Schema.String,
		age: Schema.Number,
	});

	describe('validateState', () => {
		it('should validate valid state', () => {
			const result = validateState(TestSchema, { name: 'Alice', age: 30 });
			expect(result.success).toBe(true);
			expect(result.data).toEqual({ name: 'Alice', age: 30 });
			expect(result.errors).toEqual([]);
		});

		it('should reject invalid state', () => {
			const result = validateState(TestSchema, { name: 'Alice', age: 'thirty' });
			expect(result.success).toBe(false);
			expect(result.data).toBeNull();
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe('validateStateAsync', () => {
		it('should resolve valid state', async () => {
			const result = await validateStateAsync(TestSchema, { name: 'Bob', age: 25 });
			expect(result.success).toBe(true);
			expect(result.data).toEqual({ name: 'Bob', age: 25 });
		});

		it('should reject invalid state', async () => {
			const result = await validateStateAsync(TestSchema, { name: 123, age: 25 });
			expect(result.success).toBe(false);
			expect(result.errors.length).toBeGreaterThan(0);
		});
	});

	describe('createValidatedSetter', () => {
		it('should call onValid for valid state', () => {
			const onValid = vi.fn();
			const setter = createValidatedSetter(TestSchema, onValid);
			const result = setter({ name: 'Alice', age: 30 });
			expect(result).toBe(true);
			expect(onValid).toHaveBeenCalledWith({ name: 'Alice', age: 30 });
		});

		it('should call onInvalid for invalid state', () => {
			const onValid = vi.fn();
			const onInvalid = vi.fn();
			const setter = createValidatedSetter(TestSchema, onValid, onInvalid);
			const result = setter({ name: 'Alice', age: 'bad' });
			expect(result).toBe(false);
			expect(onValid).not.toHaveBeenCalled();
			expect(onInvalid).toHaveBeenCalled();
		});
	});

	describe('createFieldValidator', () => {
		it('should decode valid value', () => {
			const validator = createFieldValidator(Schema.Number);
			expect(validator(42)).toBe(42);
		});

		it('should throw for invalid value', () => {
			const validator = createFieldValidator(Schema.Number);
			expect(() => validator('not-a-number')).toThrow();
		});
	});

	describe('createSafeFieldSetter', () => {
		it('should set valid value', () => {
			const setter = vi.fn();
			const safeSetter = createSafeFieldSetter(Schema.Number, setter);
			expect(safeSetter(42)).toBe(true);
			expect(setter).toHaveBeenCalledWith(42);
		});

		it('should return false for invalid value', () => {
			const setter = vi.fn();
			const safeSetter = createSafeFieldSetter(Schema.Number, setter);
			expect(safeSetter('bad')).toBe(false);
			expect(setter).not.toHaveBeenCalled();
		});
	});
});
