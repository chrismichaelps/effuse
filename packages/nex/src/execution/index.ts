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

export { collectFields, isIncluded, mergeSelectionSets } from './collect.js';
export {
	executeOperation,
	type ExecutionPlan,
	type ExecutionOutcome,
} from './execute.js';
export {
	defaultFieldResolver,
	resolveTypeName,
	resolverFor,
	type FieldResolver,
	type ResolverInfo,
	type SelectedField,
	type Resolvers,
	type TypeNameResolver,
	type TypeResolvers,
} from './resolvers.js';
export { ErrorPolicy, LiveDelivery, type ExecutionResult } from './result.js';
export { applyPatch, diffValues, type PatchOperation } from './patch.js';
export {
	executeLive,
	liveRootField,
	type LiveSource,
	type LiveSources,
} from './live.js';
export { applyPipeline, type PipelineResult } from './pipeline/apply.js';
export { decodeCursor, encodeCursor } from './pipeline/cursor.js';
export { paginate, type Page } from './pipeline/page.js';
export {
	coerceArgumentValues,
	coerceInputValue,
	coerceVariableValues,
	valueFromNode,
} from './values.js';
export {
	authRequirement,
	type Authorize,
	type AuthorizeRequest,
} from './authorize.js';
export {
	newTraceId,
	notify,
	type FieldTrace,
	type Instrumentation,
	type OperationTrace,
} from './instrumentation.js';
export {
	createLoader,
	type LoadMany,
	type Loader,
	type LoaderOptions,
} from './loader.js';
export { parseRef, refFor, type ObjectReference } from './reference.js';
export type { NexScalar, NexScalars } from './scalars.js';
export {
	createMetrics,
	type Metrics,
	type MetricsOptions,
	type MetricsSnapshot,
	type Tally,
} from './metrics.js';
export type {
	DirectiveContext,
	NexDirective,
	NexDirectives,
} from './directives.js';
export { selectionUnder, type SelectionContext } from './selection.js';
export { alreadyNarrowed } from './narrowed.js';
