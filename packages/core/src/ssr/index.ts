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

export type {
	HeadProps,
	MetaTag,
	LinkTag,
	ScriptTag,
	OpenGraphProps,
	TwitterCardProps,
	RenderResult,
	SSRContext,
	ServerAppOptions,
	RequestContext,
} from './types.js';

export { createServerApp, type ServerApp } from './server-app.js';

export { useHead, isServer } from './use-head.js';

export { useSeoMeta, useServerSeoMeta, type SeoMetaInput } from './seo-meta.js';

export {
	createHandler,
	parseQuery,
	createRequestContext,
	type HandlerConfig,
} from './handler.js';

export {
	mergeHeadProps,
	headToHtml,
	mergeLayerHeads,
} from './head-registry.js';

export {
	getHydrationData,
	initHydration,
	checkHydrationMatch,
	applyHydratedHead,
	HYDRATION_SCRIPT_ID,
	type HydrationData,
} from './hydration.js';

export {
	CycleError,
	RenderError,
	ValidationError,
	HydrationError,
	HeadMergeError,
	PluginError,
	type SSRError,
} from './errors.js';
