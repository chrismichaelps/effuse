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

export const STORAGE_PREFIX = 'effuse-store:';
export const ROOT_SCOPE_ID = '__root__';
export const SCOPE_PREFIX = 'scope_';

export const StoreConstants = {
  STORAGE_PREFIX,
  ROOT_SCOPE_ID,
  SCOPE_PREFIX,
  DEBUG_PREFIX: '[store]',
  DEVTOOLS_PREFIX: 'Effuse:',
} as const;

export const StoreConfigOptions = {
  persistByDefault: Config.boolean('EFFUSE_STORE_PERSIST').pipe(
    Config.withDefault(false)
  ),
  storagePrefix: Config.string('EFFUSE_STORE_PREFIX').pipe(
    Config.withDefault(STORAGE_PREFIX)
  ),
  debug: Config.boolean('EFFUSE_STORE_DEBUG').pipe(Config.withDefault(false)),
  devtools: Config.boolean('EFFUSE_STORE_DEVTOOLS').pipe(
    Config.withDefault(false)
  ),
};

export interface StoreConfigValues {
  persistByDefault: boolean;
  storagePrefix: string;
  debug: boolean;
  devtools: boolean;
}

export const loadStoreConfigValues: Effect.Effect<StoreConfigValues> =
  Effect.all({
    persistByDefault: StoreConfigOptions.persistByDefault,
    storagePrefix: StoreConfigOptions.storagePrefix,
    debug: StoreConfigOptions.debug,
    devtools: StoreConfigOptions.devtools,
  }).pipe(
    Effect.catchAll(() =>
      Effect.succeed({
        persistByDefault: false,
        storagePrefix: STORAGE_PREFIX,
        debug: false,
        devtools: false,
      })
    )
  );

let cachedConfig: StoreConfigValues | null = null;

export const getStoreConfig = (): StoreConfigValues => {
  if (!cachedConfig) {
    cachedConfig = Effect.runSync(loadStoreConfigValues);
  }
  return cachedConfig;
};

export const resetStoreConfigCache = (): void => {
  cachedConfig = null;
};
