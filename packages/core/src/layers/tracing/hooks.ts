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

const formatValue = (v: unknown): string => {
	if (v === null) return 'null';
	if (v === undefined) return 'undefined';
	if (typeof v === 'string') return `'${v}'`;
	if (typeof v === 'object') return '{...}';
	if (typeof v === 'number' || typeof v === 'boolean') return String(v);
	return 'unknown';
};

const formatConfigSummary = (config?: Record<string, unknown>): string => {
	if (!config || Object.keys(config).length === 0) return '';
	const entries = Object.entries(config)
		.map(([k, v]) => `${k}: ${formatValue(v)}`)
		.join(', ');
	return `({ ${entries} })`;
};

export const traceHookSetup = (
	hookName: string,
	duration: number,
	config?: Record<string, unknown>
): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('hooks')) return;

	const name = `${hookName}${formatConfigSummary(config)}`;
	const data: Record<string, unknown> =
		config && Object.keys(config).length > 0 ? { ...config } : {};

	tracing.logWithDuration('hooks', 'hook:setup', name, duration, data);
};

export const traceHookEffect = (
	hookName: string,
	effectIndex: number,
	duration: number
): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('hooks')) return;

	tracing.logWithDuration(
		'hooks',
		'hook:effect',
		`${hookName}[${String(effectIndex)}]`,
		duration
	);
};

export const traceHookCleanup = (hookName: string): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('hooks')) return;

	tracing.log('hooks', 'hook:cleanup', hookName);
};

export const traceHookDispose = (
	hookName: string,
	duration: number,
	cleanupCount: number
): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('hooks')) return;

	tracing.logWithDuration('hooks', 'hook:dispose', hookName, duration, {
		cleanups: cleanupCount,
	});
};

export const traceHookMount = (hookName: string): void => {
	const tracing = getGlobalTracing();
	if (!tracing?.isCategoryEnabled('hooks')) return;

	tracing.log('hooks', 'hook:mount', hookName);
};
