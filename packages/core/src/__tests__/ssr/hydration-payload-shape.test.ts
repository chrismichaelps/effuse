// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, describe, expect, it } from 'vitest';
import {
	applyHydratedHead,
	getHydrationData,
	initHydration,
	serializeHydrationData,
} from '../../ssr/hydration.js';
import { HYDRATION_SCRIPT_ID } from '../../constants.js';

/** Put `content` in the hydration script, as a transformed document might. */
const putScript = (content: string): void => {
	document.body.replaceChildren();
	const script = document.createElement('script');
	script.id = HYDRATION_SCRIPT_ID;
	script.type = 'application/json';
	script.textContent = content;
	document.body.append(script);
};

const VALID = {
	head: { title: 'T' },
	state: { a: 1 },
	url: '/',
};

describe('hydration payloads that parse but have the wrong shape', () => {
	afterEach(() => {
		document.body.replaceChildren();
		document.title = '';
	});

	// `getHydrationData` catches a parse failure and then cast the result, so
	// these reached `applyHydratedHead` and threw on `head.title`.
	const WRONG: [string, string][] = [
		['an empty object', '{}'],
		['an array', '[]'],
		['a null head', '{"head":null}'],
		['a string', '"str"'],
		['a number', '123'],
		['a head that is not an object', '{"head":5}'],
	];

	it.each(WRONG)('returns null for %s', (_label, content) => {
		putScript(content);

		expect(getHydrationData()).toBeNull();
	});

	it.each(WRONG)('does not throw from initHydration for %s', (_label, content) => {
		putScript(content);

		expect(() => initHydration()).not.toThrow();
		expect(initHydration()).toBeNull();
	});
});

describe('hydration payloads that were already handled', () => {
	afterEach(() => {
		document.body.replaceChildren();
	});

	it.each([
		['malformed json', 'not json'],
		['empty content', ''],
		['a literal null', 'null'],
	])('still returns null for %s', (_label, content) => {
		putScript(content);

		expect(getHydrationData()).toBeNull();
		expect(() => initHydration()).not.toThrow();
	});

	it('returns null when there is no script at all', () => {
		document.body.replaceChildren();

		expect(getHydrationData()).toBeNull();
		expect(initHydration()).toBeNull();
	});
});

describe('a valid hydration payload', () => {
	afterEach(() => {
		document.body.replaceChildren();
		document.title = '';
	});

	it('round-trips through the serializer', () => {
		const html = serializeHydrationData(VALID);
		const content = /type="application\/json">([\s\S]*)<\/script>/.exec(
			html
		)?.[1] as string;
		putScript(content);

		expect(getHydrationData()).toEqual(VALID);
	});

	it('is returned and applies its title', () => {
		putScript(JSON.stringify(VALID));

		expect(initHydration()).toEqual(VALID);
		expect(document.title).toBe('T');
	});

	it('is accepted with an empty head and empty state', () => {
		const payload = { head: {}, state: {}, url: '/' };
		putScript(JSON.stringify(payload));

		expect(getHydrationData()).toEqual(payload);
		expect(() => initHydration()).not.toThrow();
	});

	it('tolerates a head carrying no title', () => {
		expect(() => applyHydratedHead({})).not.toThrow();
	});

	it('tolerates being called directly with no head at all', () => {
		// A public export, so a consumer reaches it without going through
		// `getHydrationData` and its shape check.
		expect(() => applyHydratedHead(null as never)).not.toThrow();
		expect(() => applyHydratedHead(undefined as never)).not.toThrow();
		expect(() => applyHydratedHead('str' as never)).not.toThrow();
	});
});
