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

import { Context, Effect, Layer, Ref } from 'effect';
import type { EffuseChild } from '../render/node.js';
import { render } from '../render/index.js';

export interface PortalContainer {
  readonly id: string;
  readonly element: Element;
  readonly cleanup: () => void;
}

export interface PortalServiceInterface {
  readonly registerOutlet: (id: string, element: Element) => Effect.Effect<void>;
  readonly unregisterOutlet: (id: string) => Effect.Effect<void>;
  readonly getOutlet: (id: string) => Effect.Effect<Element | undefined>;
  readonly renderToPortal: (
    id: string,
    content: EffuseChild
  ) => Effect.Effect<() => void>;
}

export class PortalService extends Context.Tag('effuse/PortalService')<
  PortalService,
  PortalServiceInterface
>() { }

const createPortalRegistry = () => {
  const outlets = new Map<string, Element>();
  const portals = new Map<string, PortalContainer>();

  return {
    outlets,
    portals,
  };
};

export const PortalServiceLive = Layer.effect(
  PortalService,
  Effect.gen(function* () {
    const registryRef = yield* Ref.make(createPortalRegistry());

    const registerOutlet = (id: string, element: Element): Effect.Effect<void> =>
      Ref.update(registryRef, (registry) => {
        registry.outlets.set(id, element);
        return registry;
      });

    const unregisterOutlet = (id: string): Effect.Effect<void> =>
      Ref.update(registryRef, (registry) => {
        registry.outlets.delete(id);
        const portal = registry.portals.get(id);
        if (portal) {
          portal.cleanup();
          registry.portals.delete(id);
        }
        return registry;
      });

    const getOutlet = (id: string): Effect.Effect<Element | undefined> =>
      Ref.get(registryRef).pipe(
        Effect.map((registry) => registry.outlets.get(id))
      );

    const renderToPortal = (
      id: string,
      content: EffuseChild
    ): Effect.Effect<() => void> =>
      Effect.gen(function* () {
        const registry = yield* Ref.get(registryRef);
        const outlet = registry.outlets.get(id);

        if (!outlet) {
          const placeholder = document.createComment(`portal:${id}`);
          return () => {
            placeholder.remove();
          };
        }

        const existingPortal = registry.portals.get(id);
        if (existingPortal) {
          existingPortal.cleanup();
        }

        const cleanup = render(content, outlet);

        const portalContainer: PortalContainer = {
          id,
          element: outlet,
          cleanup,
        };

        yield* Ref.update(registryRef, (reg) => {
          reg.portals.set(id, portalContainer);
          return reg;
        });

        return () => {
          cleanup();
          Effect.runSync(
            Ref.update(registryRef, (reg) => {
              reg.portals.delete(id);
              return reg;
            })
          );
        };
      });

    return {
      registerOutlet,
      unregisterOutlet,
      getOutlet,
      renderToPortal,
    };
  })
);

let globalPortalService: PortalServiceInterface | null = null;

export const setGlobalPortalService = (service: PortalServiceInterface): void => {
  globalPortalService = service;
};

export const getGlobalPortalService = (): PortalServiceInterface | null => {
  return globalPortalService;
};

export const createPortal = (
  content: EffuseChild,
  target: string | Element
): { cleanup: () => void } => {
  const targetElement =
    typeof target === 'string' ? document.querySelector(target) : target;

  if (!targetElement) {
    return { cleanup: () => { } };
  }

  const cleanup = render(content, targetElement);

  return { cleanup };
};

export const Portal = (props: {
  target: string | Element;
  children: EffuseChild;
}): null => {
  const result = createPortal(props.children, props.target);

  if (typeof window !== 'undefined') {
    queueMicrotask(() => {
      const cleanup = result.cleanup;
      window.addEventListener(
        'beforeunload',
        () => {
          cleanup();
        },
        { once: true }
      );
    });
  }

  return null;
};
