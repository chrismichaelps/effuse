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
 * Cost is compared against the chained-replace reference measured in the same
 * process, so the assertion states the optimization directly and does not
 * depend on the speed of the machine running it.
 */
const nsPerOp = (iterations: number, fn: () => void): number => {
	for (let index = 0; index < iterations; index++) fn();
	const start = process.hrtime.bigint();
	for (let index = 0; index < iterations; index++) fn();
	return Number(process.hrtime.bigint() - start) / iterations;
};

/**
 * Best-of-N cost for two functions, sampled in alternation.
 *
 * A single timing carries the scheduler's noise into the assertion, and the
 * workspace gate runs eleven projects at once. The minimum approximates the
 * uncontended cost, so a spike has to hit every round of one function and
 * spare the other to matter. Alternating keeps both under similar conditions.
 */
const compareCost = (
	sample: string,
	reference: (value: string) => string,
	actual: (value: string) => string
): { reference: number; actual: number } => {
	let bestReference = Number.POSITIVE_INFINITY;
	let bestActual = Number.POSITIVE_INFINITY;

	for (let round = 0; round < PERF_ROUNDS; round += 1) {
		bestReference = Math.min(
			bestReference,
			nsPerOp(PERF_ITERATIONS, () => void reference(sample))
		);
		bestActual = Math.min(
			bestActual,
			nsPerOp(PERF_ITERATIONS, () => void actual(sample))
		);
	}

	return { reference: bestReference, actual: bestActual };
};

// Same total work as one 100k measurement, spread over rounds.
const PERF_ITERATIONS = 20_000;
const PERF_ROUNDS = 5;

describe('escaping cost', () => {
	it('escapes text faster than the chained reference', () => {
		const cost = compareCost(
			'Some text with <escapes> & more, of a realistic length',
			referenceHtml,
			escapeHtml
		);

		expect(cost.actual).toBeLessThan(cost.reference);
	});

	it('escapes an attribute value faster than the chained reference', () => {
		const cost = compareCost(
			'Some "quoted" text & more, of a realistic length',
			referenceAttr,
			escapeAttr
		);

		expect(cost.actual).toBeLessThan(cost.reference);
	});

	it('returns a clean string without scanning it twice', () => {
		const cost = compareCost(
			'a perfectly ordinary attribute value with nothing to escape',
			referenceAttr,
			escapeAttr
		);

		expect(cost.actual).toBeLessThan(cost.reference);
	});
});
