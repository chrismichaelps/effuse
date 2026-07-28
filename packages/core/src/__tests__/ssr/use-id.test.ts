import { describe, expect, it } from 'vitest';
import { createServerApp } from '../../ssr/server-app.js';
import {
	CreateListNode,
	CreateTextNode,
	type Component,
} from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';
import { useId } from '../../hooks/useId.js';

const IdRoot = (() =>
	CreateListNode({
		[EFFUSE_NODE]: true,
		children: [
			CreateTextNode({ [EFFUSE_NODE]: true, text: useId() }),
			CreateTextNode({ [EFFUSE_NODE]: true, text: useId() }),
		],
	})) as unknown as Component;

const renderedIds = (html: string): string[] => html.match(/:e\d+/g) ?? [];

describe('SSR useId ownership', () => {
	it('restarts the deterministic sequence for every request', async () => {
		const app = createServerApp(IdRoot);

		const first = await app.renderToHtml('/first');
		const second = await app.renderToHtml('/second');

		expect(renderedIds(first)).toEqual([':e1', ':e2']);
		expect(renderedIds(second)).toEqual([':e1', ':e2']);
	});

	it('isolates concurrent render sequences', async () => {
		const app = createServerApp(IdRoot);

		const [first, second] = await Promise.all([
			app.renderToHtml('/first'),
			app.renderToHtml('/second'),
		]);

		expect(renderedIds(first)).toEqual([':e1', ':e2']);
		expect(renderedIds(second)).toEqual([':e1', ':e2']);
	});
});
