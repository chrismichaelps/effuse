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

import type { TracingServiceApi } from './TracingService.js';
import { createRuntimeContext } from '../../context/runtime-context.js';

let globalTracingService: TracingServiceApi | null = null;
const tracingRuntimeContext = createRuntimeContext<TracingServiceApi>();

/**
 * Latched once any tracing service is installed. Resolving a service walks the
 * runtime context, which is real work to do per signal created and per signal
 * written; applications that never enable tracing answer with one boolean.
 */
let tracingEverInstalled = false;

export const setGlobalTracing = (service: TracingServiceApi): void => {
	tracingEverInstalled = true;
	globalTracingService = service;
};

export const hasTracing = (): boolean => tracingEverInstalled;

export const getGlobalTracing = (): TracingServiceApi | null => {
	if (!tracingEverInstalled) return null;
	return tracingRuntimeContext.current() ?? globalTracingService;
};

export const runWithTracing = <T>(
	service: TracingServiceApi,
	fn: () => T
): T => {
	tracingEverInstalled = true;
	return tracingRuntimeContext.run(service, fn);
};

export const clearGlobalTracing = (): void => {
	globalTracingService = null;
};
