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

import { Context } from 'effect';
import type { RouteConfig, StoreConfig, PluginFn, Guard } from './types.js';
import type { Component } from '../render/node.js';

export interface RouterConfig {
	readonly routes: readonly RouteConfig[];
	readonly lazy: boolean;
	readonly guards: readonly Guard[];
	readonly domain?: string;
}

export interface StyleConfig {
	readonly styles: readonly (string | (() => string))[];
	readonly domain?: string;
}

export interface ProviderConfig {
	readonly providers: readonly Component[];
}

export interface PluginConfig {
	readonly plugins: readonly PluginFn[];
}

export interface StoreServiceConfig {
	readonly stores: readonly StoreConfig[];
}

export class RouterService extends Context.Tag('RouterService')<
	RouterService,
	RouterConfig
>() {}

export class StoreService extends Context.Tag('StoreService')<
	StoreService,
	StoreServiceConfig
>() {}

export class StyleService extends Context.Tag('StyleService')<
	StyleService,
	StyleConfig
>() {}

export class ProviderService extends Context.Tag('ProviderService')<
	ProviderService,
	ProviderConfig
>() {}

export class PluginService extends Context.Tag('PluginService')<
	PluginService,
	PluginConfig
>() {}

export type LayerServices =
	| RouterService
	| StoreService
	| StyleService
	| ProviderService
	| PluginService;
