import { describe, expect, it, vi } from 'vitest';
import { ErrorBoundary } from '../../components/ErrorBoundary.js';
import {
	CreateElementNode,
	EFFUSE_NODE,
	type EffuseChild,
} from '../../render/node.js';
import { renderToFragment } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';

const element = (
	tag: string,
	props: Record<string, unknown>,
	children: EffuseChild[] = []
) => CreateElementNode({ [EFFUSE_NODE]: true, tag, props, children });

const render = async (child: EffuseChild): Promise<string> => {
	const runtime = await createSSRRuntime([]);
	try {
		return runtime.run(() => renderToFragment(child as never, runtime));
	} finally {
		await runtime.dispose();
	}
};

describe('SSR ErrorBoundary propagation (issue #487)', () => {
	it('renders a fallback and reports the original server error once', async () => {
		const failure = new Error('server child exploded');
		const onError = vi.fn();
		const html = await render(
			ErrorBoundary({
				fallback: element('p', { 'data-fallback': true }, ['server recovered']),
				children: () => {
					throw failure;
				},
				onError,
			})
		);

		expect(html).toBe('<p data-fallback>server recovered</p>');
		expect(onError).toHaveBeenCalledOnce();
		expect(onError).toHaveBeenCalledWith(failure);
	});

	it('escalates a throwing fallback to the parent boundary', async () => {
		const innerError = vi.fn();
		const outerError = vi.fn();
		const html = await render(
			ErrorBoundary({
				fallback: element('p', { 'data-outer': true }, ['outer recovered']),
				onError: outerError,
				children: ErrorBoundary({
					fallback: () => {
						throw new Error('inner fallback exploded');
					},
					onError: innerError,
					children: () => {
						throw new Error('inner child exploded');
					},
				}),
			})
		);

		expect(html).toBe('<p data-outer>outer recovered</p>');
		expect(innerError).toHaveBeenCalledOnce();
		expect(outerError).toHaveBeenCalledOnce();
		expect(outerError.mock.calls[0]?.[0]).toMatchObject({
			message: 'inner fallback exploded',
		});
	});
});
