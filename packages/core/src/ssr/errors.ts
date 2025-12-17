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

export const createErrorHtml = (error: SSRError): string => {
	const isDev = process.env.NODE_ENV !== 'production';

	if (isDev) {
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
		<h1>${error._tag}</h1>
		<p>${error.message}</p>
		<pre>${JSON.stringify(error, null, 2)}</pre>
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
