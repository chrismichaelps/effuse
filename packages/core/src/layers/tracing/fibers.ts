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

import { getGlobalTracing } from './global.js';

export const traceFiberCreated = (fiberId: string, parentId?: string): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('fibers')) return;

	const data: Record<string, unknown> = {};
	if (parentId) {
		data['parent'] = parentId;
	}

	tracing.log('fibers', 'created', fiberId, data);
};

export const traceFiberDone = (fiberId: string, duration: number): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('fibers')) return;

	tracing.logWithDuration('fibers', 'done', fiberId, duration);
};

export const traceFiberInterrupted = (fiberId: string): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('fibers')) return;

	tracing.log('fibers', 'interrupted', fiberId);
};

export const traceFiberCount = (count: number, peak: number): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('fibers')) return;

	tracing.log('fibers', 'snapshot', `${String(count)} active`, {
		current: count,
		peak,
	});
};

export const traceFiberBuildPhase = (
	phase: number,
	layerNames: string[]
): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('fibers')) return;

	tracing.log('fibers', 'build-phase', `level ${String(phase)}`, {
		layers: layerNames,
		parallel: layerNames.length,
	});
};
