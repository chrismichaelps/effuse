/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, expect, it } from 'vitest';
import { parseSafe } from '../index.js';

const reason = (source: string): string => {
	const parsed = parseSafe(source);
	return parsed.success ? 'accepted' : parsed.error.message;
};

describe('a stage given something it does not take', () => {
	it('says so rather than letting it derail the rest', () => {
		// Taken as "unique", then "id" is a stray name and the errors that
		// follow are about everything except what was actually wrong.
		expect(reason('{ posts | unique id { id } }')).toMatch(
			/"\| unique" takes nothing/
		);
	});

	it('still takes one that was written on its own', () => {
		expect(reason('{ posts | unique { id } }')).toBe('accepted');
	});

	it('still takes one followed by another stage', () => {
		expect(reason('{ posts | unique | sort rank asc { id } }')).toBe(
			'accepted'
		);
	});

	it('still takes one that ends the field', () => {
		// A list of scalars has no selection set, so the field ends right
		// after the stage and nothing follows it at all.
		expect(reason('{ tags | unique }')).toBe('accepted');
	});
});

describe('a stage missing what it needs', () => {
	it('says what take needs', () => {
		expect(reason('{ posts | take { id } }')).toMatch(
			/"\| take" needs a count/
		);
	});

	it('says what skip needs', () => {
		expect(reason('{ posts | skip { id } }')).toMatch(
			/"\| skip" needs a count/
		);
	});

	it('says what sort needs', () => {
		expect(reason('{ posts | sort { id } }')).toMatch(
			/"\| sort" needs a field to sort by/
		);
	});

	it('says what filter needs', () => {
		expect(reason('{ posts | filter { id } }')).toMatch(
			/"\| filter" needs something to test/
		);
	});

	it('takes them when they are given', () => {
		expect(reason('{ posts | take 2 { id } }')).toBe('accepted');
		expect(reason('{ posts | skip 2 { id } }')).toBe('accepted');
		expect(reason('{ posts | sort rank desc { id } }')).toBe('accepted');
		expect(reason('{ posts | filter rank > 1 { id } }')).toBe('accepted');
	});
});
