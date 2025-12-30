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

import { Layer } from 'effect';
import { SchedulerLive } from './scheduler/scheduler.js';
import { BlueprintLive } from './blueprint/blueprint.js';

export { Renderer, type RendererService } from './renderer/index.js';
export { CanvasService, type CanvasServiceInterface } from './canvas/index.js';
export {
	BlueprintService,
	BlueprintLive,
	type BlueprintServiceInterface,
} from './blueprint/index.js';
export {
	Scheduler,
	SchedulerLive,
	type SchedulerService,
} from './scheduler/index.js';

export { RouterService, makeRouterLayer, type RouterApi } from './router.js';
export { StoreService, makeStoreLayer, type StoreApi } from './store.js';

export {
	DOMRendererLive,
	PropService,
	PropServiceLive,
	EventService,
	EventServiceLive,
	ReconcileService,
	ReconcileServiceLive,
	MountService,
	MountServiceLive,
	type PropBindingResult,
	type EventBindingResult,
	type ReconcileResult,
	type MountedNode,
} from './dom-renderer/index.js';

export const EffuseLive = Layer.mergeAll(SchedulerLive, BlueprintLive);
