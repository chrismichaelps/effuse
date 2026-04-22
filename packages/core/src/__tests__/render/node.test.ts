/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import { isSignalChild, isEffuseNode, CreateElementNode } from '../../render/node.js';
import { signal } from '../../reactivity/signal.js';

describe('isSignalChild', () => {
	it('should return true for a signal', () => {
		const s = signal('hello');
		expect(isSignalChild(s)).toBe(true);
	});

	it('should return false for a plain object', () => {
		expect(isSignalChild({ value: 'hello' })).toBe(false);
	});

	it('should return false for null', () => {
		expect(isSignalChild(null)).toBe(false);
	});

	it('should return false for a string', () => {
		expect(isSignalChild('hello')).toBe(false);
	});
});

describe('isEffuseNode', () => {
	it('should return false for a plain object', () => {
		expect(isEffuseNode({})).toBe(false);
	});
});
