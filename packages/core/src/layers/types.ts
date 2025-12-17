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

import type { Component } from '../render/node.js';
import type { HeadProps } from '../ssr/types.js';

export type Guard = (
	to: RouteConfig,
	from: RouteConfig | null
) => boolean | Promise<boolean>;

export interface RouteConfig {
	readonly path: string;
	readonly component: Component;
	readonly name?: string;
	readonly meta?: Record<string, unknown>;
	readonly head?: HeadProps;
	readonly children?: readonly RouteConfig[];
	readonly redirect?: string;
	readonly beforeEnter?: Guard;
}

export interface StoreConfig {
	readonly name: string;
	readonly state: Record<string, unknown>;
	readonly actions?: Record<string, (...args: unknown[]) => void>;
}

export type PluginCleanup = () => void;

export type PluginFn = () =>
	| Promise<undefined | PluginCleanup>
	| undefined
	| PluginCleanup;

export type LayerRestriction =
	| 'components'
	| 'routes'
	| 'styles'
	| 'stores'
	| 'providers'
	| 'plugins';

export interface EffuseLayer {
	readonly name?: string;
	readonly domain?: string;
	readonly extends?: readonly EffuseLayer[];
	readonly dependencies?: readonly string[];
	readonly restrict?: readonly LayerRestriction[];
	readonly head?: HeadProps;
	readonly components?: Record<string, Component>;
	readonly routes?: readonly RouteConfig[];
	readonly routeOptions?: {
		readonly lazy?: boolean;
		readonly guards?: readonly Guard[];
	};
	readonly stores?: readonly StoreConfig[];
	readonly styles?: readonly (string | (() => string))[];
	readonly providers?: readonly Component[];
	readonly plugins?: readonly PluginFn[];
}

export interface ResolvedLayer extends EffuseLayer {
	readonly _resolved: true;
}
