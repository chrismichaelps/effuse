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

import { Config, Effect } from 'effect';

export const EffuseConfig = {
	debug: Config.boolean('EFFUSE_DEBUG').pipe(Config.withDefault(false)),
	strictMode: Config.boolean('EFFUSE_STRICT').pipe(Config.withDefault(true)),
	ssrMode: Config.boolean('EFFUSE_SSR').pipe(Config.withDefault(false)),
};

export interface EffuseConfigType {
	debug: boolean;
	strictMode: boolean;
	ssrMode: boolean;
}

export const loadEffuseConfig = Effect.all({
	debug: EffuseConfig.debug,
	strictMode: EffuseConfig.strictMode,
	ssrMode: EffuseConfig.ssrMode,
});

export const defaultEffuseConfig: EffuseConfigType = {
	debug: false,
	strictMode: true,
	ssrMode: false,
};

let cachedConfig: EffuseConfigType | null = null;

export const getEffuseConfig = (): EffuseConfigType => {
	if (!cachedConfig) {
		cachedConfig = Effect.runSync(
			loadEffuseConfig.pipe(Effect.orElseSucceed(() => defaultEffuseConfig))
		);
	}
	return cachedConfig;
};

export const isDebugEnabled = (): boolean => getEffuseConfig().debug;
export const isStrictMode = (): boolean => getEffuseConfig().strictMode;
export const isSSRMode = (): boolean => getEffuseConfig().ssrMode;
