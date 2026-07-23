import { describe, it, expect, vi, afterEach } from 'vitest';
import { createSSRRuntime, renderToString } from '@effuse/core';
import { jsx } from '@effuse/core/jsx-runtime';
import { injectInkStyles, inkProseStyles, InkLayer } from '../../styles/index.js';
import { Ink } from '../../renderer/Ink.js';

interface FakeStyleElement {
	readonly tagName: string;
	textContent: string;
	attributes: Record<string, string>;
	parent: FakeHead | null;
	setAttribute: (name: string, value: string) => void;
	remove: () => void;
}

interface FakeHead {
	children: FakeStyleElement[];
	appendChild: (el: FakeStyleElement) => void;
}

const createFakeDocument = () => {
	const head: FakeHead = {
		children: [],
		appendChild(el) {
			el.parent = head;
			head.children.push(el);
		},
	};

	const document = {
		head,
		createElement(tagName: string): FakeStyleElement {
			const el: FakeStyleElement = {
				tagName,
				textContent: '',
				attributes: {},
				parent: null,
				setAttribute(name, value) {
					el.attributes[name] = value;
				},
				remove() {
					if (el.parent) {
						el.parent.children = el.parent.children.filter(
							(child) => child !== el
						);
						el.parent = null;
					}
				},
			};
			return el;
		},
		querySelector(selector: string): FakeStyleElement | null {
			if (selector !== 'style[data-ink-prose]') return null;
			return (
				head.children.find(
					(child) => child.attributes['data-ink-prose'] === 'true'
				) ?? null
			);
		},
	};

	return { document, head };
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe('ink prose styles', () => {
	it('should export the prose CSS for server-side inlining', () => {
		expect(typeof inkProseStyles).toBe('string');
		expect(inkProseStyles).toContain('.prose');
		expect(inkProseStyles).toContain('.ink-');
	});

	it('should no-op without a document', () => {
		expect(typeof document).toBe('undefined');

		let cleanup: (() => void) | undefined;
		expect(() => {
			cleanup = injectInkStyles();
		}).not.toThrow();
		expect(() => cleanup?.()).not.toThrow();
	});

	it('should inject a single tagged style element', () => {
		const { document, head } = createFakeDocument();
		vi.stubGlobal('document', document);

		const cleanup = injectInkStyles();

		expect(head.children).toHaveLength(1);
		expect(head.children[0]?.attributes['data-ink-prose']).toBe('true');
		expect(head.children[0]?.textContent).toContain('.prose');

		cleanup();
		expect(head.children).toHaveLength(0);
	});

	it('should reuse an existing style element instead of duplicating', () => {
		const { document, head } = createFakeDocument();
		vi.stubGlobal('document', document);

		injectInkStyles();
		injectInkStyles();
		injectInkStyles();

		expect(head.children).toHaveLength(1);
	});
});

describe('ink SSR rendering', () => {
	it('should register InkLayer without a DOM', async () => {
		expect(typeof document).toBe('undefined');

		await expect(createSSRRuntime([InkLayer])).resolves.toBeDefined();
	});

	it('should render markdown to prose markup via renderToString', async () => {
		const runtime = await createSSRRuntime([]);

		const node = jsx(Ink, {
			content: '# Title\n\nSome **bold** text.',
		});

		const result = runtime.run(() =>
			renderToString(node, '/docs', runtime)
		);

		expect(result.html).toContain('class="prose"');
		expect(result.html).toContain('Title');
		expect(result.html).toContain('<strong');
		expect(result.html).toContain('bold');
	});
});
