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
import { DevTools } from './service.js';

export const logReactivityE = (
	message: string,
	data?: unknown
): Effect.Effect<void, never, DevTools> =>
	Effect.flatMap(DevTools, (dt) => dt.log('reactivity', message, data));

export const logRenderE = (
	message: string,
	data?: unknown
): Effect.Effect<void, never, DevTools> =>
	Effect.flatMap(DevTools, (dt) => dt.log('render', message, data));

export const logRouterE = (
	message: string,
	data?: unknown
): Effect.Effect<void, never, DevTools> =>
	Effect.flatMap(DevTools, (dt) => dt.log('router', message, data));

export const logStoreE = (
	message: string,
	data?: unknown
): Effect.Effect<void, never, DevTools> =>
	Effect.flatMap(DevTools, (dt) => dt.log('store', message, data));

export const logEffectE = (
	message: string,
	data?: unknown
): Effect.Effect<void, never, DevTools> =>
	Effect.flatMap(DevTools, (dt) => dt.log('effect', message, data));

export const logLifecycleE = (
	message: string,
	data?: unknown
): Effect.Effect<void, never, DevTools> =>
	Effect.flatMap(DevTools, (dt) => dt.log('lifecycle', message, data));

export const logInkE = (
	message: string,
	data?: unknown
): Effect.Effect<void, never, DevTools> =>
	Effect.flatMap(DevTools, (dt) => dt.log('ink', message, data));
