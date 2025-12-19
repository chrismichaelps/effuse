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

import { Config, Effect, Layer, Context } from 'effect';

export interface StoreConfigService {
	readonly persistByDefault: boolean;
	readonly storagePrefix: string;
	readonly debug: boolean;
}

export class StoreConfig extends Context.Tag('effuse/store/Config')<
	StoreConfig,
	StoreConfigService
>() {}

const DEFAULT_CONFIG: StoreConfigService = {
	persistByDefault: false,
	storagePrefix: 'effuse-store:',
	debug: false,
};

export const loadStoreConfig: Effect.Effect<StoreConfigService> = Effect.all({
	persistByDefault: Config.boolean('EFFUSE_STORE_PERSIST').pipe(
		Config.withDefault(DEFAULT_CONFIG.persistByDefault)
	),
	storagePrefix: Config.string('EFFUSE_STORE_PREFIX').pipe(
		Config.withDefault(DEFAULT_CONFIG.storagePrefix)
	),
	debug: Config.boolean('EFFUSE_STORE_DEBUG').pipe(
		Config.withDefault(DEFAULT_CONFIG.debug)
	),
}).pipe(Effect.catchAll(() => Effect.succeed(DEFAULT_CONFIG)));

export const StoreConfigLive: Layer.Layer<StoreConfig> = Layer.effect(
	StoreConfig,
	loadStoreConfig
);

let cachedConfig: StoreConfigService | null = null;

export const getConfig = (): StoreConfigService => {
	if (!cachedConfig) {
		cachedConfig = Effect.runSync(loadStoreConfig);
	}
	return cachedConfig;
};

export const resetConfigCache = (): void => {
	cachedConfig = null;
};
