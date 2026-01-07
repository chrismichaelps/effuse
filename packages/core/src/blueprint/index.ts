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

export {
	blueprint,
	isBlueprint,
	instantiateBlueprint,
	view,
	type BlueprintOptions,
	type PropsDef,
} from './blueprint.js';

export {
	define,
	type DefineOptions,
	type DefineOptionsWithLayer,
	type LayerScriptContext,
	type LayerPropsFor,
	type InferExposed,
	type InferProps,
	type TemplateArgs,
} from './define.js';
export {
	type ScriptContext,
	type ExposedValues,
	type EffuseRegistry,
	setGlobalStoreGetter,
	setGlobalRouter,
} from './script-context.js';

export {
	createComponentLifecycleSync,
	type ComponentLifecycle,
} from './lifecycle.js';

export {
	PropSchema,
	PropsValidationError,
	type PropDefinition,
	type PropSchemaBuilder,
	type AnyPropSchemaBuilder,
	type PropSchemaInfer,
} from './props.js';

export {
	PortalService,
	PortalServiceLive,
	Portal,
	PortalOutlet,
	createPortal,
	registerPortalOutlet,
	unregisterPortalOutlet,
	getPortalOutlet,
	renderToNamedPortal,
	setGlobalPortalService,
	getGlobalPortalService,
	type PortalServiceInterface,
	type PortalContainer,
	type PortalProps,
	type PortalInsertMode,
	type PortalPriority,
	PORTAL_PRIORITY,
} from './portal.js';

export { useCallback, useMemo } from './hooks.js';
