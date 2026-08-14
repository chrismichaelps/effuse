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

/**
 * Counts entries into `String.prototype.replace` while `run` executes.
 *
 * This replaced a wall-clock comparison against the chained-`replace`
 * reference. That assertion flaked three times under the parallel workspace
 * gate — as a single measurement, then a best-of-five minimum, then a paired
 * majority — and was eventually skipped on CI to stop it blocking merges,
 * which left it running only where it still flaked.
 *
 * The property worth defending is not "faster by some margin", it is "does not
 * walk the string once per character class". Asserting the strategy is
 * deterministic, runs everywhere including CI, and states the optimisation
 * more tightly: reverting to the chained form fails immediately rather than
 * probabilistically.
 */
const replaceCalls = (run: () => void): number => {
	const original = String.prototype.replace;
	let calls = 0;
	String.prototype.replace = function (
		this: string,
		...args: unknown[]
	): string {
		calls += 1;
		return (
			original as unknown as (...values: unknown[]) => string
		).apply(this, args);
	} as typeof String.prototype.replace;

	try {
		run();
	} finally {
		String.prototype.replace = original;
	}

	return calls;
};

describe('escaping strategy', () => {
	it('escapes text without a chained replace', () => {
		const sample = 'Some text with <escapes> & more, of a realistic length';

		expect(replaceCalls(() => void escapeHtml(sample))).toBe(0);
	});

	it('escapes an attribute value without a chained replace', () => {
		const sample = 'Some "quoted" text & more, of a realistic length';

		expect(replaceCalls(() => void escapeAttr(sample))).toBe(0);
	});

	it('returns a clean string without scanning it twice', () => {
		const clean = 'a perfectly ordinary attribute value with nothing to escape';

		expect(replaceCalls(() => void escapeAttr(clean))).toBe(0);
		expect(replaceCalls(() => void escapeHtml(clean))).toBe(0);
	});

	it('leaves attribute names on the chained form deliberately', () => {
		// Names come from a fixed vocabulary and effectively always clear the
		// fast path, so the slow branch is not worth reimplementing the
		// whitespace class by character code. Pinned so the exemption stays a
		// decision rather than drift.
		expect(
			replaceCalls(() => void escapeAttrName('data-x y'))
		).toBeGreaterThan(0);
	});
});
