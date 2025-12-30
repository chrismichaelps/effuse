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

export const traceComponentMount = (
	name: string,
	props?: Record<string, unknown>,
	duration?: number
): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('components')) return;

	const logData: Record<string, unknown> = {};
	if (props && Object.keys(props).length > 0) {
		logData['props'] = props;
	}

	if (duration !== undefined) {
		tracing.logWithDuration('components', 'mount', name, duration, logData);
	} else {
		tracing.log('components', 'mount', name, logData);
	}
};

export const traceComponentUnmount = (
	name: string,
	lifetime?: number
): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('components')) return;

	if (lifetime !== undefined) {
		tracing.log('components', 'unmount', name, {
			lifetime: `${lifetime.toFixed(0)}ms`,
		});
	} else {
		tracing.log('components', 'unmount', name);
	}
};

export const traceComponentRender = (
	name: string,
	duration: number,
	reason?: string
): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('components')) return;

	const logData: Record<string, unknown> = {};
	if (reason) {
		logData['reason'] = reason;
	}

	tracing.logWithDuration('components', 'render', name, duration, logData);
};
