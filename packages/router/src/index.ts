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

import './registry.js';

export {
	createRouter,
	installRouter,
	type RouterInstance,
	type RouterOptions,
	type NavigateOptions,
} from './core/router.js';

export {
	createWebHistory,
	createHashHistory,
	type RouterHistory,
} from './core/history.js';

export {
	type Route,
	type RouteRecord,
	type RouteLocation,
	type RouteComponent,
	type LazyRouteComponent,
} from './core/route.js';

export {
	useRouter,
	useRoute,
	onRouteChange,
	navigateTo,
	goBack,
	goForward,
	isActiveRoute,
	getLinkClasses,
} from './utils/composables.js';

export { RouterView, type RouterViewProps } from './components/RouterView.js';

export { Link, RouterLink } from './components/Link.js';

export {
	type TypedRouteRecord,
	type TypedRoute,
	defineRoutes,
} from './types/index.js';

export {
	type TransitionConfig,
	type TransitionMode,
	transitions,
} from './utils/transitions.js';

export {
	type NavigationGuard,
	type AfterEachHook,
	type NavigationResult,
	NavigationResult as NavigationResultUtils,
	createAuthGuard,
	createUnsavedChangesGuard,
	combineGuards,
	guardWhen,
	guardMeta,
} from './navigation/guards.js';
