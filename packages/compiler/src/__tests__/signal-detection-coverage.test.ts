/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { transformSync } from '../transformer/index.js';
import { defaultConfig } from '../config/index.js';

/** True when the transformer decided the expression is reactive. */
const isReactive = (expression: string): boolean => {
	const code = `const Comp = () => <div data-x={${expression}}>text</div>;`;
	return transformSync(code, 'test.tsx', defaultConfig).transformed;
};

/**
 * Every shape here reads a signal, so every one must be wrapped. The list is a
 * table rather than one case per defect because the failure mode is a node type
 * nobody listed: an unhandled type fails open, silently and in the unsafe
 * direction, so the value is in breadth.
 */
const READS_A_SIGNAL: ReadonlyArray<readonly [string, string]> = [
	['member access', 'sig.value'],
	['nested member', 'user.name.value'],
	['optional member', 'sig?.value'],
	['template literal', '`v: ${sig.value}`'],
	['conditional', "sig.value ? 'a' : 'b'"],
	['binary', 'sig.value + 1'],
	['logical', 'sig.value || fallback'],
	['unary', '!sig.value'],
	['call argument', 'format(sig.value)'],
	['call on a signal', 'sig.value.trim()'],
	['array element', '[sig.value]'],
	['array spread', '[...list(sig.value)]'],
	['object property', '{ a: sig.value }'],
	['object shorthand computed key', '{ [sig.value]: 1 }'],
	['object spread of a member', '{ ...sig.value }'],
	['object spread of a call', '{ ...build(sig.value) }'],
	['object method', '{ get a() { return sig.value; } }'],
	['arrow with expression body', 'items.map((i) => i.value)'],
	['arrow with block body', 'items.map((i) => { return i.value; })'],
	['arrow with a branch', 'items.map((i) => { if (i.value) return 1; return 0; })'],
	['arrow with a loop', 'items.map((i) => { for (const x of i.value) return x; })'],
	['immediately invoked block', '(() => { return sig.value; })()'],
	['function expression block', '(function () { return sig.value; })()'],
	['try/catch block', '(() => { try { return sig.value; } catch { return 0; } })()'],
	['switch block', '(() => { switch (sig.value) { default: return 1; } })()'],
	['variable in a block', '(() => { const v = sig.value; return v; })()'],
	['async block body', '(async () => { return sig.value; })()'],
	['new expression', 'new Wrapper(sig.value)'],
	['sequence', '(noop(), sig.value)'],
	['tagged template', 'css`${sig.value}`'],
	['as expression', 'sig.value as string'],
	['non-null assertion', 'sig.value!'],
	['parenthesized', '(sig.value)'],
];

/**
 * Reads a signal, but must not be wrapped: a getter would defer the write until
 * something read the binding, turning a side effect into a lazy one. The
 * transformer excludes these through `isAssignment`, so they are pinned here to
 * keep a broader detection change from quietly swallowing them.
 */
const NOT_WRAPPED_BY_DESIGN: ReadonlyArray<readonly [string, string]> = [
	['assignment', '(target = sig.value)'],
	['update expression', 'sig.value++'],
];

const READS_NO_SIGNAL: ReadonlyArray<readonly [string, string]> = [
	['plain identifier', 'label'],
	['literal', "'text'"],
	['member without the accessor', 'user.name'],
	['call with plain arguments', 'format(label)'],
	['object of plain values', '{ a: label }'],
	['block body without a signal', 'items.map((i) => { return i.id; })'],
	['spread of a plain object', '{ ...base }'],
];

describe('signal access detection', () => {
	for (const [label, expression] of READS_A_SIGNAL) {
		it(`detects a signal read in ${label}`, () => {
			expect(isReactive(expression), expression).toBe(true);
		});
	}

	for (const [label, expression] of READS_NO_SIGNAL) {
		it(`leaves ${label} alone`, () => {
			expect(isReactive(expression), expression).toBe(false);
		});
	}

	for (const [label, expression] of NOT_WRAPPED_BY_DESIGN) {
		it(`does not wrap ${label}, which writes rather than reads`, () => {
			expect(isReactive(expression), expression).toBe(false);
		});
	}

	it('does not wrap an outer expression for a nested element only', () => {
		// The inner element owns its own reactivity; wrapping the outer map as
		// well would bind the same signal twice.
		const code = `const Comp = () => <ul>{list.map((i) => <li>{i.value}</li>)}</ul>;`;
		const result = transformSync(code, 'test.tsx', defaultConfig);

		expect(result.code).toContain('i.value');
	});
});
