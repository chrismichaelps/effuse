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

import { devtools } from './sync.js';

export const logReactivity = (message: string, data?: unknown): void => {
	devtools.log('reactivity', message, data);
};

export const logRender = (message: string, data?: unknown): void => {
	devtools.log('render', message, data);
};

export const logRouter = (message: string, data?: unknown): void => {
	devtools.log('router', message, data);
};

export const logStore = (message: string, data?: unknown): void => {
	devtools.log('store', message, data);
};

export const logEffect = (message: string, data?: unknown): void => {
	devtools.log('effect', message, data);
};

export const logLifecycle = (message: string, data?: unknown): void => {
	devtools.log('lifecycle', message, data);
};

export const logInk = (message: string, data?: unknown): void => {
	devtools.log('ink', message, data);
};
