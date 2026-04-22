/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import {
	containsSignalAccess,
	isEventHandler,
	isAlreadyWrapped,
	isAssignment,
	analyzeNode,
} from '../../utils/ast.js';
import { parse } from '@babel/parser';
import type * as t from '@babel/types';

const parseExpr = (code: string): t.Expression => {
	const ast = parse(`const __expr = (${code});`, {
		sourceType: 'module',
		plugins: ['jsx', 'typescript'],
	});
	const decl = ast.program.body[0] as t.VariableDeclaration;
	return decl.declarations[0].init!;
};

describe('AST analyzer', () => {
	describe('containsSignalAccess', () => {
		const accessorSet = new Set(['value']);

		it('should detect simple signal access', () => {
			const node = parseExpr('count.value');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect nested signal access', () => {
			const node = parseExpr('user.profile.name.value');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in binary expression', () => {
			const node = parseExpr('count.value + 1');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in conditional', () => {
			const node = parseExpr('show.value ? "yes" : "no"');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in template literal', () => {
			const node = parseExpr('`Hello ${name.value}`');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in call expression', () => {
			const node = parseExpr('format(count.value)');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in array', () => {
			const node = parseExpr('[count.value, name.value]');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in object', () => {
			const node = parseExpr('({ count: count.value })');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should not detect signal without accessor', () => {
			const node = parseExpr('count');
			expect(containsSignalAccess(node, accessorSet)).toBe(false);
		});

		it('should not detect regular property access', () => {
			const node = parseExpr('user.name');
			expect(containsSignalAccess(node, accessorSet)).toBe(false);
		});

		it('should handle circular references safely', () => {
			const node = parseExpr('count.value');
			const visited = new WeakSet<t.Node>();
			visited.add(node);
			expect(containsSignalAccess(node, accessorSet, visited)).toBe(false);
		});

		it('should detect signal in TS as expression', () => {
			const node = parseExpr('(count.value as number)');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in TS satisfies expression', () => {
			const node = parseExpr('(count.value satisfies number)');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in TS non-null expression', () => {
			const node = parseExpr('count.value!');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in await expression', () => {
			const node = parseExpr('await count.value');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in new expression', () => {
			const node = parseExpr('new Signal(count.value)');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in sequence expression', () => {
			const node = parseExpr('(a, count.value, b)');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in spread element', () => {
			const node = parseExpr('[...count.value]');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in tagged template expression', () => {
			const node = parseExpr('tag`Hello ${name.value}`');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in update expression', () => {
			const node = parseExpr('count.value++');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});

		it('should detect signal in spread argument', () => {
			const node = parseExpr('fn(...count.value)');
			expect(containsSignalAccess(node, accessorSet)).toBe(true);
		});
	});

	describe('isEventHandler', () => {
		it('should match onClick with on prefix', () => {
			const prefixes = new Set(['on', 'handle']);
			expect(isEventHandler('onClick', prefixes)).toBe(true);
		});

		it('should match handleSubmit with handle prefix', () => {
			const prefixes = new Set(['on', 'handle']);
			expect(isEventHandler('handleSubmit', prefixes)).toBe(true);
		});

		it('should NOT match OnClick (case sensitive)', () => {
			const prefixes = new Set(['on', 'handle']);
			expect(isEventHandler('OnClick', prefixes)).toBe(false);
		});

		it('should NOT match non-event names', () => {
			const prefixes = new Set(['on', 'handle']);
			expect(isEventHandler('value', prefixes)).toBe(false);
			expect(isEventHandler('className', prefixes)).toBe(false);
		});
	});

	describe('isAlreadyWrapped', () => {
		it('should return true for arrow function', () => {
			const node = parseExpr('() => 42');
			expect(isAlreadyWrapped(node)).toBe(true);
		});

		it('should return true for function expression', () => {
			const node = parseExpr('function() { return 42; }');
			expect(isAlreadyWrapped(node)).toBe(true);
		});

		it('should return false for plain expression', () => {
			const node = parseExpr('count.value');
			expect(isAlreadyWrapped(node)).toBe(false);
		});
	});

	describe('isAssignment', () => {
		it('should return true for assignment', () => {
			const node = parseExpr('count = 1');
			expect(isAssignment(node)).toBe(true);
		});

		it('should return true for update expression', () => {
			const node = parseExpr('count++');
			expect(isAssignment(node)).toBe(true);
		});

		it('should return false for plain expression', () => {
			const node = parseExpr('count.value');
			expect(isAssignment(node)).toBe(false);
		});
	});

	describe('analyzeNode', () => {
		it('should recommend wrapping for signal access', () => {
			const node = parseExpr('count.value');
			const result = analyzeNode(node, new Set(['value']), new Set(['on']));
			expect(result.containsSignal).toBe(true);
			expect(result.isEventHandler).toBe(false);
			expect(result.isAlreadyWrapped).toBe(false);
			expect(result.isAssignment).toBe(false);
			expect(result.shouldWrap).toBe(true);
		});

		it('should NOT recommend wrapping for event handler', () => {
			const node = parseExpr('count.value');
			const result = analyzeNode(node, new Set(['value']), new Set(['on']), 'onClick');
			expect(result.containsSignal).toBe(true);
			expect(result.isEventHandler).toBe(true);
			expect(result.shouldWrap).toBe(false);
		});

		it('should NOT recommend wrapping for already wrapped', () => {
			const node = parseExpr('() => count.value');
			const result = analyzeNode(node, new Set(['value']), new Set(['on']));
			expect(result.containsSignal).toBe(true);
			expect(result.isAlreadyWrapped).toBe(true);
			expect(result.shouldWrap).toBe(false);
		});

		it('should NOT recommend wrapping for assignment', () => {
			const node = parseExpr('count.value = 1');
			const result = analyzeNode(node, new Set(['value']), new Set(['on']));
			expect(result.containsSignal).toBe(true);
			expect(result.isAssignment).toBe(true);
			expect(result.shouldWrap).toBe(false);
		});
	});
});
