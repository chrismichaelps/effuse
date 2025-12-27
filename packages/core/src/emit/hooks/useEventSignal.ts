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

import { signal } from '../../reactivity/signal.js';
import { effect } from '../../effects/effect.js';
import type { Signal } from '../../types/index.js';
import type { EmitContextData, EmitOptions, EventSignal, EventMap } from '../types/index.js';

export function useEventSignal<T extends EventMap, P>(
  ctx: EmitContextData<T>,
  event: string,
  options: EmitOptions = {}
): EventSignal<P> {
  let sourceSig = ctx.signals.get(event) as Signal<P | undefined> | undefined;
  if (!sourceSig) {
    sourceSig = signal<P | undefined>(undefined);
    ctx.signals.set(event, sourceSig as Signal<unknown>);
  }

  if (!options.debounce && !options.throttle && !options.once && !options.filter) {
    const sig = sourceSig;
    return {
      get value() {
        return sig.value;
      },
    };
  }

  const resultSig = signal<P | undefined>(undefined);
  let lastUpdateTime = 0;
  let debounceTimer: ReturnType<typeof setTimeout> | null = null;
  let hasFired = false;
  const source = sourceSig;

  effect(() => {
    const value = source.value;
    if (value === undefined) return;

    if (options.once && hasFired) return;

    if (options.filter && !options.filter(value)) return;

    const now = Date.now();

    if (typeof options.throttle === 'number') {
      if (now - lastUpdateTime < options.throttle) return;
      lastUpdateTime = now;
    }

    if (typeof options.debounce === 'number') {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        resultSig.value = value;
        if (options.once) hasFired = true;
      }, options.debounce);
      return;
    }

    resultSig.value = value;
    if (options.once) hasFired = true;
  });

  return {
    get value() {
      return resultSig.value;
    },
  };
}

export function createEventSignal<P>(initialValue?: P): Signal<P | undefined> {
  return signal<P | undefined>(initialValue);
}
