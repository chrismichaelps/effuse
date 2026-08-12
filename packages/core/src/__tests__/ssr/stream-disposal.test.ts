/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createServerApp } from '../../ssr/server-app.js';
import { defineLayer } from '../../layers/api/defineLayer.js';
import { CreateTextNode, type Component } from '../../render/node.js';
import { EFFUSE_NODE } from '../../constants.js';

const Root = (() =>
	CreateTextNode({ [EFFUSE_NODE]: true, text: 'hi' })) as unknown as Component;

/**
 * `controller.close()` ends the stream for the consumer, so `start` finishes
 * its `finally` after the last read resolves. Disposal is therefore observable
 * a turn later, not before the reader sees `done`.
 */
const settle = async (): Promise<void> => {
	await new Promise((resolve) => setTimeout(resolve, 50));
};

const drain = async (stream: ReadableStream<Uint8Array>): Promise<string> => {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	let html = '';
	for (;;) {
		const { done, value } = await reader.read();
		if (done) break;
		html += decoder.decode(value);
	}
	return html;
};

/** Captures process-level unhandled rejections for the duration of `run`. */
const withRejectionWatch = async (
	run: () => Promise<void>
): Promise<unknown[]> => {
	const rejections: unknown[] = [];
	const onRejection = (reason: unknown): void => {
		rejections.push(reason);
	};
	process.on('unhandledRejection', onRejection);
	try {
		await run();
		// Rejections surface a turn later than the code that caused them.
		await new Promise((resolve) => setTimeout(resolve, 50));
	} finally {
		process.off('unhandledRejection', onRejection);
	}
	return rejections;
};

/** A layer whose cleanup throws, the shape that makes disposal reject. */
const failingLayer = (onCleanup?: () => void) =>
	defineLayer({
		name: 'failing',
		setup: () => () => {
			onCleanup?.();
			throw new Error('layer cleanup exploded');
		},
	} as never);

describe('SSR stream runtime disposal', () => {
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('does not leak an unhandled rejection when a layer cleanup fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const app = createServerApp(Root).useLayers([failingLayer() as never]);

		const rejections = await withRejectionWatch(async () => {
			await drain(await app.renderToStream('/'));
		});

		expect(rejections).toEqual([]);
	});

	it('still streams the whole document when disposal fails', async () => {
		vi.spyOn(console, 'error').mockImplementation(() => {});
		const app = createServerApp(Root).useLayers([failingLayer() as never]);

		const html = await drain(await app.renderToStream('/'));

		expect(html).toContain('hi');
		expect(html).toContain('</html>');
	});

	it('reports the disposal failure rather than swallowing it', async () => {
		const error = vi.spyOn(console, 'error').mockImplementation(() => {});
		const app = createServerApp(Root).useLayers([failingLayer() as never]);

		await drain(await app.renderToStream('/'));
		await settle();

		expect(error).toHaveBeenCalled();
		const reported = error.mock.calls.flat().map((value) => String(value));
		expect(reported.some((value) => value.includes('exploded'))).toBe(true);
	});

	it('disposes the runtime once the stream has been read', async () => {
		let cleanupRan = false;
		const app = createServerApp(Root).useLayers([
			defineLayer({
				name: 'slow',
				setup: () => async () => {
					await new Promise((resolve) => setTimeout(resolve, 10));
					cleanupRan = true;
				},
			} as never) as never,
		]);

		await drain(await app.renderToStream('/'));
		await settle();

		expect(cleanupRan).toBe(true);
	});

	it('leaves a healthy stream untouched', async () => {
		const app = createServerApp(Root);

		const rejections = await withRejectionWatch(async () => {
			const html = await drain(await app.renderToStream('/'));
			expect(html).toContain('hi');
		});

		expect(rejections).toEqual([]);
	});
});
