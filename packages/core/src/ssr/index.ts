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
	AssetManifest,
	AssetManifestChunk,
	RequestContext,
} from './types.js';

export { createServerApp, type ServerApp } from './server-app.js';

export {
	createSSRRuntime,
	type SSRRuntime,
	type SSRRuntimeOptions,
} from './runtime.js';

export { createRequestScope, type RequestScope } from './request-scope.js';

export { useHead, isServer, runWithSSRContext } from './use-head.js';

export { useSeoMeta, useServerSeoMeta, type SeoMetaInput } from './seo-meta.js';

export {
	createServerTraceError,
	emitServerTrace,
	type ServerObservabilityHooks,
	type ServerTraceError,
	type ServerTraceEvent,
	type ServerTraceKind,
} from './observability.js';

export {
	createHandler,
	createStreamingHandler,
	parseQuery,
	createRequestContext,
	type HandlerConfig,
} from './handler.js';

export {
	handleLayerServerRequest,
	matchLayerServerRequest,
	normalizeServerResult,
} from './server-routing.js';

export { EFFUSE_ACTION_PREFIX } from './constants.js';

export {
	getLayerServerActionEntries,
	getLayerServerDiagnostics,
	getLayerServerMiddleware,
	getLayerServerRouteEntries,
	mergeServerRouteMetadata,
	normalizeServerActionInput,
	normalizeServerRouteInput,
	type LayerServerActionEntry,
	type LayerServerRouteEntry,
	type LayerServerRouteSource,
	type ServerMetadataDiagnostic,
} from './server-routes.js';

export {
	callLayerAction,
	createLayerActionClient,
	createLayerActionPath,
	createLayerActionUrl,
	isLayerActionError,
	isLayerActionErrorBody,
	LayerActionError,
	type LayerActionCallOptions,
	type LayerActionClient,
	type LayerActionErrorBody,
	type LayerActionName,
	type LayerActionResponseMode,
	type LayerActionResult,
	type LayerActionsFrom,
} from './actions.js';

export {
	createLayerServerManifest,
	createLayerServerManifestFromLayers,
	type LayerServerManifest,
	type LayerServerManifestAction,
	type LayerServerManifestLayer,
	type LayerServerManifestRoute,
} from './manifest.js';

export {
	compileServerPolicy,
	compileServerPolicyFromLayers,
	type CompiledServerAction,
	type CompiledServerManifest,
	type CompiledServerRoute,
} from './policy-compiler.js';

export {
	foldServerPolicy,
	type FoldedPolicy,
	type PolicyProvenanceEntry,
	type PolicySource,
} from './policy-merge.js';

export {
	fromServerFiles,
	serverFileToActionName,
	serverFileToRoutePath,
	type ServerActionFileModule,
	type ServerApiFileModule,
	type ServerFileSource,
	type ServerFilesInput,
	type ServerFilesOptions,
} from './server-files.js';

export {
	callLayerManifestAction,
	callLayerManifestRoute,
	createLayerRoutePath,
	createLayerRouteUrl,
	createLayerServerManifestClient,
	generateLayerServerClientModule,
	getLayerClientErrorBody,
	getLayerClientErrorStatus,
	isLayerClientError,
	LayerServerClientError,
	type GenerateLayerServerClientModuleOptions,
	type LayerClientError,
	type LayerRouteCallOptions,
	type LayerRoutePathOptions,
	type LayerServerManifestClient,
	type ManifestActionForLayer,
	type ManifestActionName,
	type ManifestLayerName,
	type ManifestRouteForPath,
	type ManifestRouteMethod,
	type ManifestRouteParams,
	type ManifestRoutePath,
} from './client.js';

export {
	createLayerServerErrorBody,
	isLayerServerError,
	isLayerServerErrorBody,
	LayerServerError,
	layerServerErrorResponse,
	type LayerServerErrorBody,
	type LayerServerErrorOptions,
} from './server-errors.js';

export {
	defineServerRequest,
	type ServerRequestContract,
	type ServerRequestDefinition,
	type ServerRequestOutput,
} from './request-contract.js';

export {
	serverSchema,
	type ServerOptionalSchema,
	type ServerSchemaInfer,
	type ServerSchemaInput,
	type ServerSchemaOutput,
} from './server-schema.js';

export {
	createServerValidationErrorBody,
	createServerValidationHelpers,
	isServerValidationErrorBody,
	isServerValidationError,
	serverValidationErrorResponse,
	ServerValidationError,
	validateServerValue,
	type ServerValidationErrorBody,
	type ServerValidationFailure,
	type ServerValidationHelpers,
	type ServerValidationIssue,
	type ServerValidationResult,
	type ServerValidationSource,
	type ServerValidationSuccess,
	type ServerValidator,
} from './validation.js';

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
	cleanupHydrationScript,
	serializeHydrationData,
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

export { renderToString, renderToFragment } from './render.js';
