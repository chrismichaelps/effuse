/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { Effect } from 'effect';
import type { BlueprintDef, EffuseChild } from '../render/node.js';
import { el } from '../render/element.js';
import { render } from '../render/index.js';
import { MountError, RenderError } from '../errors/index.js';

export interface Canvas {
	paint: <P extends Record<string, unknown>>(
		blueprint: BlueprintDef<P>,
		props?: P
	) => void;

	render: (node: EffuseChild) => void;

	dispose: () => void;

	paintEffect: <P extends Record<string, unknown>>(
		blueprint: BlueprintDef<P>,
		props?: P
	) => Effect.Effect<void, RenderError | MountError>;

	renderEffect: (node: EffuseChild) => Effect.Effect<void, RenderError>;
}

export const canvas = (target: Element | string): Canvas => {
	const container =
		typeof target === 'string' ? document.querySelector(target) : target;

	if (!container) {
		const targetStr =
			typeof target === 'string' ? target : `<${target.tagName.toLowerCase()}>`;
		throw new MountError({
			message: `Canvas target not found: ${targetStr}`,
			target,
		});
	}

	let cleanupFn: (() => void) | null = null;

	const canvasPaintEffect = <P extends Record<string, unknown>>(
		blueprint: BlueprintDef<P>,
		props?: P
	): Effect.Effect<void, RenderError | MountError> =>
		Effect.try({
			try: () => {
				if (cleanupFn) {
					cleanupFn();
					cleanupFn = null;
				}

				const node = el(blueprint, props ?? ({} as P));
				cleanupFn = render(node as EffuseChild, container);
			},
			catch: (error) =>
				new RenderError({
					message: `Paint failed: ${String(error)}`,
					node: undefined,
				}),
		});

	const canvasRenderEffect = (
		node: EffuseChild
	): Effect.Effect<void, RenderError> =>
		Effect.try({
			try: () => {
				if (cleanupFn) {
					cleanupFn();
					cleanupFn = null;
				}

				cleanupFn = render(node, container);
			},
			catch: (error) =>
				new RenderError({
					message: `Render failed: ${String(error)}`,
					node,
				}),
		});

	return {
		paint: <P extends Record<string, unknown>>(
			blueprint: BlueprintDef<P>,
			props?: P
		): void => {
			Effect.runSync(canvasPaintEffect(blueprint, props));
		},

		render: (node: EffuseChild): void => {
			Effect.runSync(canvasRenderEffect(node));
		},

		dispose: (): void => {
			if (cleanupFn) {
				cleanupFn();
				cleanupFn = null;
			}
			container.innerHTML = '';
		},

		paintEffect: canvasPaintEffect,
		renderEffect: canvasRenderEffect,
	};
};

export const canvasEffect = (
	target: Element | string
): Effect.Effect<Canvas, MountError> =>
	Effect.try({
		try: () => canvas(target),
		catch: (error) =>
			new MountError({
				message: String(error),
				target,
			}),
	});

export const mount = <P = Record<string, unknown>>(
	blueprint: BlueprintDef<P>,
	target: Element | string,
	props?: P
): Canvas => {
	const c = canvas(target);
	c.paint(blueprint as BlueprintDef, props as Record<string, unknown>);
	return c;
};

export const mountEffect = <P extends Record<string, unknown>>(
	blueprint: BlueprintDef<P>,
	target: Element | string,
	props?: P
): Effect.Effect<Canvas, MountError | RenderError> =>
	Effect.gen(function* () {
		const c = yield* canvasEffect(target);
		yield* c.paintEffect(blueprint, props);
		return c;
	});
