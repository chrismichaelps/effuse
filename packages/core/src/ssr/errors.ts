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

import { Data } from 'effect';
import { escapeHtml } from './escape.js';

export class CycleError extends Data.TaggedError('CycleError')<{
	readonly message: string;
	readonly layers: readonly string[];
}> {}

export class RenderError extends Data.TaggedError('RenderError')<{
	readonly message: string;
	readonly url: string;
	readonly cause?: unknown;
}> {}

export class ValidationError extends Data.TaggedError('ValidationError')<{
	readonly message: string;
	readonly path?: readonly string[];
	readonly expected?: string;
	readonly received?: string;
}> {}

export class HydrationError extends Data.TaggedError('HydrationError')<{
	readonly message: string;
	readonly serverState: unknown;
	readonly clientState: unknown;
}> {}

export class HeadMergeError extends Data.TaggedError('HeadMergeError')<{
	readonly message: string;
	readonly conflictingKeys: readonly string[];
}> {}

export class PluginError extends Data.TaggedError('PluginError')<{
	readonly message: string;
	readonly pluginName?: string;
	readonly cause?: unknown;
}> {}

export type SSRError =
	| CycleError
	| RenderError
	| ValidationError
	| HydrationError
	| HeadMergeError
	| PluginError;

type ErrorDiagnostic = {
	readonly name: string;
	readonly message: string;
	readonly stack?: string;
	cause?: unknown;
	errors?: readonly unknown[];
	[key: string]: unknown;
};

const serializeDiagnosticValue = (
	value: unknown,
	seen: WeakSet<object>
): unknown => {
	if (
		value === null ||
		typeof value === 'boolean' ||
		typeof value === 'string'
	) {
		return value;
	}
	if (typeof value === 'number') {
		return Number.isFinite(value) ? value : String(value);
	}
	if (typeof value === 'bigint' || typeof value === 'symbol') {
		return String(value);
	}
	if (typeof value === 'undefined') return '[undefined]';
	if (typeof value === 'function')
		return `[Function ${value.name || 'anonymous'}]`;

	if (seen.has(value)) return '[Circular]';
	seen.add(value);

	if (value instanceof Error) {
		const diagnostic: ErrorDiagnostic = {
			name: value.name,
			message: value.message,
			...(value.stack ? { stack: value.stack } : {}),
		};
		if ('cause' in value && value.cause !== undefined) {
			diagnostic.cause = serializeDiagnosticValue(value.cause, seen);
		}
		if (value instanceof AggregateError) {
			diagnostic.errors = [...value.errors].map((error) =>
				serializeDiagnosticValue(error, seen)
			);
		}
		for (const [key, property] of Object.entries(value)) {
			if (!(key in diagnostic)) {
				diagnostic[key] = serializeDiagnosticValue(property, seen);
			}
		}
		return diagnostic;
	}

	if (Array.isArray(value)) {
		return value.map((item) => serializeDiagnosticValue(item, seen));
	}

	const diagnostic: Record<string, unknown> = {};
	for (const [key, property] of Object.entries(value)) {
		diagnostic[key] = serializeDiagnosticValue(property, seen);
	}
	return diagnostic;
};

export const createErrorDiagnostic = (error: SSRError): unknown =>
	serializeDiagnosticValue(error, new WeakSet<object>());

export const createErrorHtml = (error: SSRError): string => {
	const isDev = process.env.NODE_ENV !== 'production';

	if (isDev) {
		const diagnostic = escapeHtml(
			JSON.stringify(createErrorDiagnostic(error), null, 2)
		);
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>SSR Error</title>
	<style>
		body { font-family: system-ui, sans-serif; padding: 2rem; background: #1a1a2e; color: #eee; }
		.error { background: #16213e; padding: 1.5rem; border-radius: 8px; border-left: 4px solid #e94560; }
		pre { background: #0f0f23; padding: 1rem; border-radius: 4px; overflow-x: auto; }
	</style>
</head>
<body>
	<div class="error">
		<h1>${escapeHtml(error._tag)}</h1>
		<p>${escapeHtml(error.message)}</p>
		<pre>${diagnostic}</pre>
	</div>
</body>
</html>`;
	}

	return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="utf-8">
	<meta name="viewport" content="width=device-width, initial-scale=1">
	<title>Error</title>
</head>
<body>
	<h1>Something went wrong</h1>
	<p>Please try again later.</p>
</body>
</html>`;
};
