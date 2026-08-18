// @vitest-environment jsdom
/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
	parseStackFrames,
	readSourceFrame,
	renderErrorPage,
	selectPrimaryFrame,
} from '../../ssr/error-page.js';
import { createErrorHtml } from '../../ssr/errors.js';
import { RenderError } from '../../ssr/errors.js';

const dirs: string[] = [];

/** Write a real file so the code frame has something to read. */
const sourceFile = (contents: string): string => {
	const dir = mkdtempSync(join(tmpdir(), 'effuse-error-'));
	dirs.push(dir);
	const file = join(dir, 'sample.ts');
	writeFileSync(file, contents);
	return file;
};

afterEach(() => {
	while (dirs.length > 0) {
		rmSync(dirs.pop() as string, { recursive: true, force: true });
	}
});

describe('parseStackFrames', () => {
	it('reads function, file, line and column', () => {
		const frames = parseStackFrames(
			'Error: boom\n    at totalFor (/app/src/cart.ts:10:29)'
		);

		expect(frames).toEqual([
			{
				fn: 'totalFor',
				file: '/app/src/cart.ts',
				line: 10,
				column: 29,
				app: true,
			},
		]);
	});

	it('reads a frame with no function name', () => {
		const frames = parseStackFrames('Error\n    at /app/src/cart.ts:3:1');

		expect(frames[0]?.fn).toBe('<anonymous>');
		expect(frames[0]?.file).toBe('/app/src/cart.ts');
	});

	it('strips a file:// prefix', () => {
		const frames = parseStackFrames('Error\n    at f (file:///app/a.ts:1:2)');

		expect(frames[0]?.file).toBe('/app/a.ts');
	});

	it('marks dependency and runtime frames as not application code', () => {
		const frames = parseStackFrames(
			[
				'Error',
				'    at mine (/app/src/a.ts:1:1)',
				'    at dep (/app/node_modules/x/index.js:2:2)',
				'    at run (node:internal/async_hooks:91:14)',
			].join('\n')
		);

		expect(frames.map((frame) => frame.app)).toEqual([true, false, false]);
	});

	it('ignores the message lines and anything unparseable', () => {
		expect(parseStackFrames('Error: boom\n  not a frame')).toEqual([]);
		expect(parseStackFrames(undefined)).toEqual([]);
	});
});

describe('readSourceFrame', () => {
	it('returns a window around the line and marks the target', () => {
		const file = sourceFile('a\nb\nc\nd\ne\nf\ng\n');
		const lines = readSourceFrame(file, 4, 1);

		expect(lines.map((line) => line.number)).toEqual([3, 4, 5]);
		expect(lines.map((line) => line.text)).toEqual(['c', 'd', 'e']);
		expect(lines.filter((line) => line.target)).toHaveLength(1);
		expect(lines.find((line) => line.target)?.number).toBe(4);
	});

	it('clamps at the start and end of the file', () => {
		const file = sourceFile('a\nb');

		expect(readSourceFrame(file, 1, 5).map((l) => l.number)).toEqual([1, 2]);
		expect(readSourceFrame(file, 2, 5).map((l) => l.number)).toEqual([1, 2]);
	});

	it('returns nothing rather than throwing for an unreadable file', () => {
		// A frame can point at a generated file or one that no longer exists,
		// and neither should turn the error page into a second error.
		expect(readSourceFrame('/no/such/file.ts', 1)).toEqual([]);
	});

	it('returns nothing for a line outside the file', () => {
		expect(readSourceFrame(sourceFile('a\n'), 99)).toEqual([]);
	});
});

describe('selectPrimaryFrame', () => {
	const wrapper = {
		name: 'RenderError',
		stack: 'RenderError\n    at rethrow (/app/packages/core/src/ssr/render.ts:153:11)',
	};
	const root = {
		name: 'TypeError',
		stack: [
			'TypeError',
			'    at dep (/app/node_modules/x/i.js:1:1)',
			'    at totalFor (/app/src/cart.ts:10:29)',
		].join('\n'),
	};

	it('prefers the root cause over the wrapper', () => {
		// The framework wraps a failure in a RenderError whose stack points at
		// the re-throw site, which says where it was noticed, not what broke.
		expect(selectPrimaryFrame([wrapper, root])?.file).toBe('/app/src/cart.ts');
	});

	it('prefers an application frame over a dependency frame', () => {
		expect(selectPrimaryFrame([root])?.fn).toBe('totalFor');
	});

	it('falls back to the first frame when none are application code', () => {
		const onlyDeps = {
			stack: 'Error\n    at dep (/app/node_modules/x/i.js:1:1)',
		};

		expect(selectPrimaryFrame([onlyDeps])?.file).toBe(
			'/app/node_modules/x/i.js'
		);
	});

	it('returns nothing when there is no stack at all', () => {
		expect(selectPrimaryFrame([{ name: 'E' }])).toBeUndefined();
	});
});

describe('renderErrorPage', () => {
	const page = (over: Record<string, unknown> = {}): string =>
		renderErrorPage(
			(over.tag as string) ?? 'RenderError',
			(over.message as string) ?? 'boom',
			(over.url as string) ?? '/checkout',
			over.error ?? { name: 'TypeError', message: 'boom' },
			(over.diagnostic as string) ?? '{}'
		);

	it('shows the tag, message and url', () => {
		const html = page();

		expect(html).toContain('RenderError');
		expect(html).toContain('boom');
		expect(html).toContain('/checkout');
	});

	it('escapes the message rather than rendering it', () => {
		const html = page({ message: '<img src=x onerror=alert(1)>' });

		expect(html).not.toContain('<img src=x');
		expect(html).toContain('&lt;img');
	});

	it('escapes the url', () => {
		const html = page({ url: '/a"><script>alert(1)</script>' });

		expect(html).not.toContain('<script>alert(1)</script>');
	});

	it('escapes source lines it reads from disk', () => {
		const file = sourceFile('const evil = "<script>alert(1)</script>";\n');
		const html = page({
			error: { name: 'E', stack: `E\n    at f (${file}:1:1)` },
		});

		expect(html).toContain('&lt;script&gt;');
		expect(html).not.toContain('<script>alert(1)</script>');
	});

	it('renders the code frame for the failing line', () => {
		const file = sourceFile('one\ntwo\nthree\n');
		const html = page({
			error: { name: 'E', stack: `E\n    at f (${file}:2:2)` },
		});

		expect(html).toContain('(2:2)');
		expect(html).toContain('two');
	});

	it('lists the cause chain', () => {
		const html = page({
			error: {
				name: 'RenderError',
				message: 'outer',
				cause: { name: 'TypeError', message: 'inner detail' },
			},
		});

		expect(html).toContain('Caused By');
		expect(html).toContain('inner detail');
	});

	it('terminates on a cyclic cause chain', () => {
		const a: Record<string, unknown> = { name: 'A', message: 'a' };
		a.cause = a;

		expect(() => page({ error: a })).not.toThrow();
	});

	it('omits the frame card when no stack is available', () => {
		const html = page({
			message: 'no stack here',
			error: { name: 'E', message: 'no stack here' },
		});

		expect(html).not.toContain('class="frame"');
		expect(html).toContain('no stack here');
	});
});

describe('createErrorHtml in production', () => {
	const original = process.env.NODE_ENV;

	afterEach(() => {
		process.env.NODE_ENV = original;
	});

	it('leaks neither source, stack nor message', () => {
		process.env.NODE_ENV = 'production';
		const error = new RenderError({
			message: 'secret internal detail',
			url: '/admin',
			cause: new Error('inner secret'),
		});

		const html = createErrorHtml(error);

		expect(html).not.toContain('secret internal detail');
		expect(html).not.toContain('inner secret');
		expect(html).not.toContain('/admin');
		expect(html).not.toContain('Call Stack');
		expect(html).toContain('Something went wrong');
	});

	it('shows the detail in development', () => {
		process.env.NODE_ENV = 'development';
		const html = createErrorHtml(
			new RenderError({ message: 'visible detail', url: '/x' })
		);

		expect(html).toContain('visible detail');
	});
});

describe('paging between errors', () => {
	const aggregate = {
		name: 'AggregateError',
		message: 'two failed',
		errors: [
			{ name: 'TypeError', message: 'first failure' },
			{ name: 'RangeError', message: 'second failure' },
		],
	};

	const html = (error: unknown): string =>
		renderErrorPage('RenderError', 'outer', '/x', error, '{}');

	it('gives each aggregated error its own panel', () => {
		const page = html(aggregate);

		expect(page).toContain('first failure');
		expect(page).toContain('second failure');
		expect(page).toContain('/2</span>');
	});

	it('reports a single error as one of one', () => {
		expect(html({ name: 'E', message: 'only' })).toContain('/1</span>');
	});

	it('renders inert arrows when there is nothing to page to', () => {
		expect(html({ name: 'E', message: 'only' })).toContain('arrow-off');
	});

	it('selects the first error by default', () => {
		const page = html(aggregate);

		expect(page).toContain('id="pg-0" class="pgin" checked');
		expect(page).not.toContain('id="pg-1" class="pgin" checked');
	});
});

describe('the pager', () => {
	// Radio inputs and labels, not a script: the error response is asserted to
	// carry no `<script>`, which also keeps the page working under a strict CSP.
	const aggregate = {
		name: 'AggregateError',
		message: 'two failed',
		errors: [
			{ name: 'TypeError', message: 'first failure' },
			{ name: 'RangeError', message: 'second failure' },
		],
	};

	const html = (error: unknown): string =>
		renderErrorPage('RenderError', 'outer', '/x', error, '{}');

	it('ships no script at all', () => {
		expect(html(aggregate)).not.toContain('<script>');
	});

	it('renders one radio per error, with the first selected', () => {
		const page = html(aggregate);

		expect(page).toContain('id="pg-0"');
		expect(page).toContain('id="pg-1"');
		expect((page.match(/name="effuse-pager"/g) ?? []).length).toBe(2);
		expect(page).toContain('id="pg-0" class="pgin" checked');
	});

	it('wires each arrow to the neighbouring error, wrapping around', () => {
		const page = html(aggregate);

		// From panel 0: back wraps to 1, forward goes to 1.
		expect(page).toContain('<label for="pg-1" title="Previous error"');
		expect(page).toContain('<label for="pg-0" title="Previous error"');
	});

	it('reveals exactly one panel and one nav per selection', () => {
		const page = html(aggregate);

		expect(page).toContain('#pg-0:checked ~ .shell .panel[data-panel="0"]');
		expect(page).toContain('#pg-1:checked ~ .shell .panel[data-panel="1"]');
		expect(page).toContain('#pg-0:checked ~ .shell .nav[data-for="0"]');
	});

	it('shows inert arrows for a single error', () => {
		const page = html({ name: 'E', message: 'only' });

		expect(page).toContain('arrow-off');
		expect(page).not.toContain('title="Next error"');
	});
});

describe('the pager in a document', () => {
	const aggregate = {
		name: 'AggregateError',
		message: 'two failed',
		errors: [
			{ name: 'TypeError', message: 'first failure' },
			{ name: 'RangeError', message: 'second failure' },
		],
	};

	const load = (error: unknown): void => {
		const page = renderErrorPage('RenderError', 'outer', '/x', error, '{}');
		document.body.innerHTML = /<body>([\s\S]*)<\/body>/.exec(page)?.[1] ?? '';
	};

	/**
	 * Which panel the stylesheet would reveal.
	 *
	 * Matched with the real selector rather than read from `getComputedStyle`,
	 * because jsdom does not resolve a sibling combinator through the cascade —
	 * a computed-style assertion here passes or fails for the wrong reason.
	 */
	const revealed = (): string | null => {
		for (const panel of document.querySelectorAll('[data-panel]')) {
			const index = panel.getAttribute('data-panel') as string;
			if (
				document.querySelector(
					`#pg-${index}:checked ~ .shell .panel[data-panel="${index}"]`
				)
			) {
				return index;
			}
		}
		return null;
	};

	it('reveals the first panel, then the second once its radio is selected', () => {
		load(aggregate);
		expect(revealed()).toBe('0');

		(document.getElementById('pg-1') as HTMLInputElement).checked = true;

		expect(revealed()).toBe('1');
	});

	it('points each arrow at a radio that exists', () => {
		load(aggregate);

		for (const label of document.querySelectorAll('label[for]')) {
			const target = label.getAttribute('for') as string;
			expect(document.getElementById(target)).not.toBeNull();
		}
	});

	it('keeps the single panel revealed when there is only one error', () => {
		load({ name: 'E', message: 'only' });

		expect(revealed()).toBe('0');
	});
});
