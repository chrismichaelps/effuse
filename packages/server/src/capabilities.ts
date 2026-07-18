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

import type { AdapterCapabilities, ServerRuntime } from './contract.js';

/**
 * The machine-readable runtime compatibility matrix.
 *
 * Every flag is validated by the shared conformance suite, so this table
 * describes behavior that is actually tested rather than aspirational.
 */
export const adapterCapabilities: Readonly<
	Record<ServerRuntime, AdapterCapabilities>
> = {
	node: {
		runtime: 'node',
		streaming: true,
		requestAbort: true,
		gracefulShutdown: true,
		multipart: true,
		setCookieMultiValue: true,
		ephemeralPort: true,
	},
	bun: {
		runtime: 'bun',
		streaming: true,
		requestAbort: true,
		gracefulShutdown: true,
		multipart: true,
		setCookieMultiValue: true,
		ephemeralPort: true,
	},
};

/** Returns the declared capabilities for a runtime. */
export const getCapabilities = (
	runtime: ServerRuntime
): AdapterCapabilities => adapterCapabilities[runtime];
