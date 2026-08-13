/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { transformSync } from '../transformer/index.js';
import { defaultConfig } from '../config/index.js';

/**
 * The rule `@effuse/core`'s prop binder applies, copied here as the oracle.
 *
 * The compiler decides whether a binding is reactive and the runtime decides
 * how it is applied, so a prop the runtime treats as ordinary must be wrapped
 * when it reads a signal. When the two disagreed, the prop rendered once and
 * never updated, with nothing reported.
 */
const runtimeTreatsAsEvent = (name: string): boolean => {
	if (name.length <= 2 || !name.startsWith('on')) return false;
	const third = name[2];
	return third !== undefined && third === third.toUpperCase();
};

const config = { ...defaultConfig, enableCache: false };

/** True when the compiler wrapped the attribute into a reactive getter. */
const compilerWraps = (attribute: string): boolean =>
	transformSync(
		`const A = () => <div ${attribute}={flag.value}>x</div>;`,
		'a.tsx',
		config
	).stats.propsWrapped > 0;

const NAMES: readonly string[] = [
	// Ordinary props, including every shape that used to be mistaken for an event.
	'title',
	'href',
	'once',
	'online',
	'onboarded',
	'onlyAdmins',
	'handler',
	'handled',
	'handleable',
	'on',
	'ontology',
	'id',
	'data-value',
	'aria-label',
	// Genuine event handlers.
	'onClick',
	'onInput',
	'onDoubleClick',
	'onKeyDown',
];

describe('compiler agrees with the runtime on event handlers', () => {
	for (const name of NAMES) {
		it(`treats ${name} the same way the runtime does`, () => {
			const isEvent = runtimeTreatsAsEvent(name);

			// An ordinary prop reading a signal must become a getter; an event
			// handler must be left alone.
			expect(compilerWraps(name)).toBe(!isEvent);
		});
	}

	it('leaves an already-wrapped handler untouched', () => {
		const result = transformSync(
			`const A = () => <button onClick={() => count.value++}>x</button>;`,
			'a.tsx',
			config
		);

		expect(result.stats.propsWrapped).toBe(0);
	});

	it('still wraps a signal-reading child expression', () => {
		const result = transformSync(
			`const A = () => <div>{count.value}</div>;`,
			'a.tsx',
			config
		);

		expect(result.stats.expressionsWrapped).toBe(1);
	});

	it('honours a configured prefix, applying the same word boundary', () => {
		const custom = { ...config, eventHandlerPrefixes: ['on', 'handle'] };
		const wraps = (attribute: string): boolean =>
			transformSync(
				`const A = () => <div ${attribute}={flag.value}>x</div>;`,
				'a.tsx',
				custom
			).stats.propsWrapped > 0;

		// `handle` is honoured at a word boundary...
		expect(wraps('handleSubmit')).toBe(false);
		// ...but does not swallow a prop that merely starts with those letters.
		expect(wraps('handler')).toBe(true);
		expect(wraps('handled')).toBe(true);
	});
});
