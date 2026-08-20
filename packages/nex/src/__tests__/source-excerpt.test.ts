/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { NexSyntaxError, parseSafe, printSourceExcerpt } from '../index.js';

describe('pointing at the source', () => {
	it('shows the line and marks the column', () => {
		const excerpt = printSourceExcerpt('{\n  user {\n    id\n}', {
			start: 19,
			line: 4,
			column: 1,
		});

		expect(excerpt).toBe(['3 |     id', '4 | }', '  | ^'].join('\n'));
	});

	it('shows the lines around it', () => {
		const source = 'a\nb\nc\nd\ne\nf\ng';
		const excerpt = printSourceExcerpt(
			source,
			{ start: 8, line: 5, column: 1 },
			{ context: 2 }
		);

		expect(excerpt.split('\n')).toEqual([
			'3 | c',
			'4 | d',
			'5 | e',
			'  | ^',
			'6 | f',
			'7 | g',
		]);
	});

	it('lines up the caret past a tab', () => {
		const excerpt = printSourceExcerpt('\t\tbad', {
			start: 2,
			line: 1,
			column: 3,
		});

		expect(excerpt).toBe(['1 | \t\tbad', '  | \t\t^'].join('\n'));
	});

	it('says nothing useful about a line that is not there', () => {
		expect(printSourceExcerpt('{ a }', { start: 0, line: 9, column: 1 })).toBe(
			''
		);
	});
});

describe('a syntax error that explains itself', () => {
	it('carries an excerpt of what it read', () => {
		const result = parseSafe('query A {\n  user(id: )\n}');
		if (result.success) return expect.unreachable();

		expect(result.error).toBeInstanceOf(NexSyntaxError);
		expect(result.error.excerpt).toContain('2 |   user(id: )');
		expect(result.error.excerpt).toContain('^');
	});

	it('reads the whole thing when asked to print itself', () => {
		const result = parseSafe('{ user( }');
		if (result.success) return expect.unreachable();

		const printed = result.error.toString();
		expect(printed).toContain('NexSyntaxError');
		expect(printed).toContain('1:');
		expect(printed).toContain('| { user( }');
	});

	it('still works for an error raised with no source at hand', () => {
		const error = new NexSyntaxError({
			message: 'somewhere',
			location: { start: 0, line: 1, column: 1 },
		});

		expect(error.excerpt).toBeUndefined();
		expect(error.toString()).toBe('NexSyntaxError: somewhere (1:1)');
	});
});
