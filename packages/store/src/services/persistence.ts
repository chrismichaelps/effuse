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

import { Context, Effect, Layer, type Option } from 'effect';
import {
  type StorageAdapter,
  localStorageAdapter,
  sessionStorageAdapter,
  noopAdapter,
  createMemoryAdapter,
} from '../persistence/adapters.js';

export interface PersistenceServiceApi {
  get: (key: string) => Effect.Effect<Option.Option<string>>;
  set: (key: string, value: string) => Effect.Effect<void>;
  remove: (key: string) => Effect.Effect<void>;
  clear: () => Effect.Effect<void>;
}

export class PersistenceService extends Context.Tag(
  'effuse/store/PersistenceService'
)<PersistenceService, PersistenceServiceApi>() { }

const createPersistenceApi = (
  adapter: StorageAdapter
): PersistenceServiceApi => ({
  get: (key: string) => adapter.getItem(key),
  set: (key: string, value: string) => adapter.setItem(key, value),
  remove: (key: string) => adapter.removeItem(key),
  clear: () => Effect.void,
});

export const LocalStoragePersistenceLive: Layer.Layer<PersistenceService> =
  Layer.succeed(PersistenceService, createPersistenceApi(localStorageAdapter));

export const SessionStoragePersistenceLive: Layer.Layer<PersistenceService> =
  Layer.succeed(
    PersistenceService,
    createPersistenceApi(sessionStorageAdapter)
  );

export const MemoryPersistenceLive: Layer.Layer<PersistenceService> =
  Layer.succeed(
    PersistenceService,
    createPersistenceApi(createMemoryAdapter())
  );

export const NoopPersistenceLive: Layer.Layer<PersistenceService> =
  Layer.succeed(PersistenceService, createPersistenceApi(noopAdapter));

export const makePersistenceLayer = (
  adapter: StorageAdapter
): Layer.Layer<PersistenceService> =>
  Layer.succeed(PersistenceService, createPersistenceApi(adapter));

export const usePersistence = <A, E, R>(
  fn: (service: PersistenceServiceApi) => Effect.Effect<A, E, R>
) =>
  Effect.gen(function* () {
    const service = yield* PersistenceService;
    return yield* fn(service);
  });

export const runWithPersistence = <A, E>(
  effect: Effect.Effect<A, E, PersistenceService>,
  adapter: 'local' | 'session' | 'memory' | 'noop' = 'local'
): Effect.Effect<A, E> => {
  const layer =
    adapter === 'local'
      ? LocalStoragePersistenceLive
      : adapter === 'session'
        ? SessionStoragePersistenceLive
        : adapter === 'memory'
          ? MemoryPersistenceLive
          : NoopPersistenceLive;
  return Effect.provide(effect, layer);
};
