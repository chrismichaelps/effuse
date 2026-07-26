import { describe, it, expect } from 'vitest';
import {
	escapeHtml,
	escapeAttr,
	escapeAttrName,
} from '../../ssr/escape.js';

/** The regex implementations these replaced, kept as the reference oracle. */
const referenceHtml = (s: string): string =>
	s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const referenceAttr = (s: string): string =>
	s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');

const referenceAttrName = (s: string): string =>
	referenceAttr(s)
		.replace(/\//g, '&#47;')
		.replace(/\s/g, '&#32;')
		.replace(/=/g, '&#61;');

const SAMPLES = [
	'',
	'plain text',
	'&',
	'<',
	'>',
	'"',
	"'",
	'&amp;',
	'<script>alert("xss")</script>',
	"Tom & Jerry said 'hi' <b>bold</b>",
	'a&b<c>d"e\'f',
	'&&&&',
	'<<<<',
	'trailing&',
	'&leading',
	'unicode: café © 日本語 🎉',
	'tab\there',
	'new\nline',
	'slash/and=equals',
	'  spaced  ',
	'a'.repeat(500),
	`${'a'.repeat(200)}&${'b'.repeat(200)}`,
];

describe('escapeHtml', () => {
	it('matches the regex reference on every sample', () => {
		for (const sample of SAMPLES) {
			expect(escapeHtml(sample), JSON.stringify(sample)).toBe(
				referenceHtml(sample)
			);
		}
	});

	it('returns the identical string instance when nothing needs escaping', () => {
		const clean = 'nothing to escape here';
		expect(escapeHtml(clean)).toBe(clean);
	});

	it('escapes the HTML-significant characters', () => {
		expect(escapeHtml('<a & b>')).toBe('&lt;a &amp; b&gt;');
	});

	it('does not escape quotes in text content', () => {
		expect(escapeHtml('say "hi"')).toBe('say "hi"');
	});
});

describe('escapeAttr', () => {
	it('matches the regex reference on every sample', () => {
		for (const sample of SAMPLES) {
			expect(escapeAttr(sample), JSON.stringify(sample)).toBe(
				referenceAttr(sample)
			);
		}
	});

	it('returns the identical string instance when nothing needs escaping', () => {
		const clean = 'nothing-to-escape';
		expect(escapeAttr(clean)).toBe(clean);
	});

	it('escapes quotes so an attribute cannot be broken out of', () => {
		expect(escapeAttr('" onload="evil()')).toBe(
			'&quot; onload=&quot;evil()'
		);
		expect(escapeAttr("' onload='evil()")).toBe('&#39; onload=&#39;evil()');
	});
});

describe('escapeAttrName', () => {
	it('matches the regex reference on every sample', () => {
		for (const sample of SAMPLES) {
			expect(escapeAttrName(sample), JSON.stringify(sample)).toBe(
				referenceAttrName(sample)
			);
		}
	});

	it('escapes separators that could forge a second attribute', () => {
		expect(escapeAttrName('a b')).toBe('a&#32;b');
		expect(escapeAttrName('a=b')).toBe('a&#61;b');
		expect(escapeAttrName('a/b')).toBe('a&#47;b');
	});

	it('escapes every whitespace form the regex reference did', () => {
		for (const ws of [' ', '\t', '\n', '\r', '\f', '\v']) {
			expect(escapeAttrName(`a${ws}b`)).toBe(referenceAttrName(`a${ws}b`));
		}
	});
});
