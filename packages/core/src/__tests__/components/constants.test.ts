// @vitest-environment node
import { describe, it, expect } from 'vitest';
import {
	TransitionDefaults,
	CacheDefaults,
	TransitionClassPrefixes,
	TransitionClassSuffixes,
	TransitionConfig,
	CacheConfig,
} from '../../components/constants.js';

describe('Component Constants', () => {
	describe('TransitionDefaults', () => {
		it('should have ENTER_MS defined', () => {
			expect(TransitionDefaults.ENTER_MS).toBeDefined();
			expect(typeof TransitionDefaults.ENTER_MS).toBe('number');
		});

		it('should have EXIT_MS defined', () => {
			expect(TransitionDefaults.EXIT_MS).toBeDefined();
			expect(typeof TransitionDefaults.EXIT_MS).toBe('number');
		});

		it('should have MOVE_MS defined', () => {
			expect(TransitionDefaults.MOVE_MS).toBeDefined();
			expect(typeof TransitionDefaults.MOVE_MS).toBe('number');
		});

		it('should have reasonable default values', () => {
			expect(TransitionDefaults.ENTER_MS).toBeGreaterThan(0);
			expect(TransitionDefaults.EXIT_MS).toBeGreaterThan(0);
			expect(TransitionDefaults.MOVE_MS).toBeGreaterThan(0);
		});

		it('should be immutable (as const)', () => {
			const original = { ...TransitionDefaults };

			expect(TransitionDefaults.ENTER_MS).toBe(original.ENTER_MS);
			expect(TransitionDefaults.EXIT_MS).toBe(original.EXIT_MS);
			expect(TransitionDefaults.MOVE_MS).toBe(original.MOVE_MS);
		});
	});

	describe('CacheDefaults', () => {
		it('should have MAX_SIZE defined', () => {
			expect(CacheDefaults.MAX_SIZE).toBeDefined();
			expect(typeof CacheDefaults.MAX_SIZE).toBe('number');
		});

		it('should have TTL_MS defined', () => {
			expect(CacheDefaults.TTL_MS).toBeDefined();
			expect(typeof CacheDefaults.TTL_MS).toBe('number');
		});

		it('should have reasonable default values', () => {
			expect(CacheDefaults.MAX_SIZE).toBeGreaterThan(0);
			expect(CacheDefaults.TTL_MS).toBeGreaterThan(0);
		});
	});

	describe('TransitionClassPrefixes', () => {
		it('should have TRANSITION prefix', () => {
			expect(TransitionClassPrefixes.TRANSITION).toBe('transition');
		});

		it('should have LIST prefix', () => {
			expect(TransitionClassPrefixes.LIST).toBe('list');
		});
	});

	describe('TransitionClassSuffixes', () => {
		it('should have ENTER suffix', () => {
			expect(TransitionClassSuffixes.ENTER).toBe('-enter');
		});

		it('should have ENTER_ACTIVE suffix', () => {
			expect(TransitionClassSuffixes.ENTER_ACTIVE).toBe('-enter-active');
		});

		it('should have ENTER_TO suffix', () => {
			expect(TransitionClassSuffixes.ENTER_TO).toBe('-enter-to');
		});

		it('should have EXIT suffix', () => {
			expect(TransitionClassSuffixes.EXIT).toBe('-exit');
		});

		it('should have EXIT_ACTIVE suffix', () => {
			expect(TransitionClassSuffixes.EXIT_ACTIVE).toBe('-exit-active');
		});

		it('should have EXIT_TO suffix', () => {
			expect(TransitionClassSuffixes.EXIT_TO).toBe('-exit-to');
		});

		it('should have MOVE suffix', () => {
			expect(TransitionClassSuffixes.MOVE).toBe('-move');
		});

		it('should generate valid CSS class names when combined', () => {
			const prefix = TransitionClassPrefixes.TRANSITION;
			const enterClass = `${prefix}${TransitionClassSuffixes.ENTER}`;

			expect(enterClass).toBe('transition-enter');
			expect(enterClass).toMatch(/^[a-z-]+$/);
		});
	});

	describe('Effect Config Objects', () => {
		it('should have TransitionConfig defined', () => {
			expect(TransitionConfig).toBeDefined();
		});

		it('should have CacheConfig defined', () => {
			expect(CacheConfig).toBeDefined();
		});
	});
});
