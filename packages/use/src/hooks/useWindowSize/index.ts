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

import { defineHook, type ReadonlySignal } from '@effuse/core';
import { isClient, createDebounce } from '../../internal/utils.js';
import { RESIZE_EVENT, ORIENTATION_CHANGE_EVENT } from './constants.js';
import { getWindowSize } from './utils.js';
import {
	traceWindowSizeInit,
	traceWindowSizeUpdate,
	traceWindowSizeCleanup,
} from './telemetry.js';
import {
	type WindowSizeState,
	WindowSizeState as WSS,
	isAvailable,
	getWidth,
	getHeight,
} from './state.js';

export { WindowSizeState, isAvailable, isUnavailable } from './state.js';
export { WindowSizeError } from './errors.js';

export interface UseWindowSizeConfig {
	readonly initialWidth?: number;

	readonly initialHeight?: number;

	readonly listenOrientation?: boolean;

	readonly includeScrollbar?: boolean;

	readonly debounce?: number;
}

export interface UseWindowSizeReturn {
	readonly width: ReadonlySignal<number>;

	readonly height: ReadonlySignal<number>;

	readonly isAvailable: ReadonlySignal<boolean>;
}

export const useWindowSize = defineHook<
	UseWindowSizeConfig | undefined,
	UseWindowSizeReturn
>({
	name: 'useWindowSize',
	setup: (ctx) => {
		const config = ctx.config ?? {};
		const initialWidth = config.initialWidth ?? 0;
		const initialHeight = config.initialHeight ?? 0;
		const listenOrientation = config.listenOrientation ?? true;
		const includeScrollbar = config.includeScrollbar ?? true;
		const debounceMs = config.debounce ?? 0;

		const createInitialState = (): WindowSizeState => {
			if (isClient()) {
				const size = getWindowSize();
				return WSS.Available({
					width: includeScrollbar
						? size.width
						: document.documentElement.clientWidth,
					height: includeScrollbar
						? size.height
						: document.documentElement.clientHeight,
				});
			}
			return WSS.Unavailable();
		};

		if (isClient()) {
			const size = getWindowSize();
			traceWindowSizeInit(size.width, size.height);
		}

		const internalState = ctx.signal<WindowSizeState>(createInitialState());

		const width = ctx.computed(() =>
			getWidth(internalState.value, initialWidth)
		);

		const height = ctx.computed(() =>
			getHeight(internalState.value, initialHeight)
		);

		const available = ctx.computed(() => isAvailable(internalState.value));

		const updateSize = (): void => {
			if (!isClient()) return;

			const newWidth = includeScrollbar
				? window.innerWidth
				: document.documentElement.clientWidth;
			const newHeight = includeScrollbar
				? window.innerHeight
				: document.documentElement.clientHeight;

			traceWindowSizeUpdate(newWidth, newHeight);
			internalState.value = WSS.Available({
				width: newWidth,
				height: newHeight,
			});
		};

		ctx.effect(() => {
			if (!isClient()) return undefined;

			const handler =
				debounceMs > 0 ? createDebounce(updateSize, debounceMs) : null;

			const onResize = handler ? handler.call : updateSize;

			window.addEventListener(RESIZE_EVENT, onResize, { passive: true });

			if (listenOrientation) {
				window.addEventListener(ORIENTATION_CHANGE_EVENT, onResize, {
					passive: true,
				});
			}

			return () => {
				traceWindowSizeCleanup();
				window.removeEventListener(RESIZE_EVENT, onResize);
				if (listenOrientation) {
					window.removeEventListener(ORIENTATION_CHANGE_EVENT, onResize);
				}
				handler?.cancel();
			};
		});

		return {
			width,
			height,
			isAvailable: available,
		};
	},
});
