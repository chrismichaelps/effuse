/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import {
	registerComponent,
	acceptComponentUpdate,
	getHMRInstances,
	hasHMRInstances,
} from '../../hmr/index.js';
import { registerHMRInstance } from '../../hmr/instance.js';

describe('HMR', () => {
	let mockDocument: typeof document;

	beforeAll(() => {
		mockDocument = {
			createElement: () => ({ insertBefore: () => {} }),
			createComment: () => ({ nextSibling: null }),
		} as unknown as typeof document;
	});

	describe('registerComponent', () => {
		it('should return no-op when hmrId is undefined', () => {
			const unregister = registerComponent(
				undefined,
				{ _tag: 'Blueprint' } as any,
				{},
				[],
				() => {},
				mockDocument.createElement('div'),
				mockDocument.createComment('')
			);
			expect(typeof unregister).toBe('function');
			expect(() => unregister()).not.toThrow();
		});

		it('should return no-op when not in Vite HMR environment', () => {
			const unregister = registerComponent(
				'some-id',
				{ _tag: 'Blueprint' } as any,
				{},
				[],
				() => {},
				mockDocument.createElement('div'),
				mockDocument.createComment('')
			);
			expect(typeof unregister).toBe('function');
			expect(() => unregister()).not.toThrow();
		});
	});

	describe('getHMRInstances / hasHMRInstances', () => {
		it('should return undefined for unknown hmrId', () => {
			expect(getHMRInstances('unknown-id')).toBeUndefined();
			expect(hasHMRInstances('unknown-id')).toBe(false);
		});
	});

	describe('acceptComponentUpdate', () => {
		it('should silently skip when no instances exist for hmrId', () => {
			expect(() =>
				acceptComponentUpdate('non-existent-id', { Foo: {} })
			).not.toThrow();
		});

		it('should warn when no Blueprint found in module', () => {
			const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

			// Manually register a dummy instance so acceptComponentUpdate
			// proceeds past the early-return check
			const anchor = mockDocument.createComment('') as unknown as Comment;
			registerHMRInstance('some-id', {
				blueprint: { _tag: 'Blueprint' } as any,
				props: {},
				nodes: [],
				cleanup: () => {},
				parent: mockDocument.createElement('div') as unknown as Element,
				anchor,
			});

			acceptComponentUpdate('some-id', { notABlueprint: {} });
			expect(warnSpy).toHaveBeenCalledWith(
				expect.stringContaining('No Blueprint found')
			);

			warnSpy.mockRestore();
		});
	});
});
