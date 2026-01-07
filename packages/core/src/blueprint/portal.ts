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

import {
	Context,
	Effect,
	Layer,
	Match,
	Option,
	Predicate,
	Ref,
	pipe,
} from 'effect';
import type { EffuseChild } from '../render/node.js';
import { render } from '../render/index.js';
import { define } from './define.js';

export interface PortalContainer {
	readonly id: string;
	readonly element: Element;
	readonly cleanup: () => void;
}

export interface PortalServiceInterface {
	readonly registerOutlet: (
		id: string,
		element: Element
	) => Effect.Effect<void>;
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
>() {}

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

		const registerOutlet = (
			id: string,
			element: Element
		): Effect.Effect<void> =>
			Ref.update(registryRef, (registry) => {
				registry.outlets.set(id, element);
				return registry;
			});

		const unregisterOutlet = (id: string): Effect.Effect<void> =>
			Ref.update(registryRef, (registry) => {
				registry.outlets.delete(id);
				pipe(
					Option.fromNullable(registry.portals.get(id)),
					Option.map((portal) => {
						portal.cleanup();
						registry.portals.delete(id);
					})
				);
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

export const setGlobalPortalService = (
	service: PortalServiceInterface
): void => {
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
		return { cleanup: () => {} };
	}

	const cleanup = render(content, targetElement);

	return { cleanup };
};

const namedOutlets = new Map<string, Element>();

export const registerPortalOutlet = (name: string, element: Element): void => {
	namedOutlets.set(name, element);
};

export const unregisterPortalOutlet = (name: string): void => {
	namedOutlets.delete(name);
};

export const getPortalOutlet = (name: string): Element | undefined => {
	return namedOutlets.get(name);
};

export const renderToNamedPortal = (
	name: string,
	content: EffuseChild
): { cleanup: () => void } => {
	const outlet = namedOutlets.get(name);
	if (!outlet) {
		return { cleanup: () => {} };
	}
	return createPortal(content, outlet);
};

const portalCleanups = new Map<string, () => void>();
let portalIdCounter = 0;

export type PortalInsertMode = 'append' | 'prepend' | 'replace';

export type PortalPriority = 'low' | 'normal' | 'high' | 'overlay' | number;

export const PORTAL_PRIORITY = {
	LOW: 100,
	NORMAL: 1000,
	HIGH: 10000,
	OVERLAY: 100000,
	DEFAULT: 1000,
} as const;

const PRIORITY_VALUES: Record<string, number> = {
	low: PORTAL_PRIORITY.LOW,
	normal: PORTAL_PRIORITY.NORMAL,
	high: PORTAL_PRIORITY.HIGH,
	overlay: PORTAL_PRIORITY.OVERLAY,
};

export interface PortalProps {
	target: string | Element | (() => string | Element | null);
	children: EffuseChild;
	disabled?: boolean | (() => boolean);
	insertMode?: PortalInsertMode;
	priority?: PortalPriority;
	onMount?: (element: Element) => void;
	onUnmount?: () => void;
	useShadow?: boolean;
	key?: string;
}

export const Portal = define<PortalProps>({
	script: ({ props, onMount, signal }) => {
		const isMounted = signal(false);

		onMount(() => {
			if (typeof window === 'undefined') return () => {};

			const isDisabled = pipe(
				Match.value(props.disabled),
				Match.when(Predicate.isFunction, (fn) => fn()),
				Match.orElse((val) => val === true)
			);

			if (isDisabled) {
				isMounted.value = true;
				return () => {
					isMounted.value = false;
				};
			}

			const resolveTarget = (): Element | null => {
				const target =
					typeof props.target === 'function' ? props.target() : props.target;
				if (!target) return null;
				return typeof target === 'string'
					? document.querySelector(target)
					: target;
			};

			const targetElement = resolveTarget();

			if (!targetElement) {
				return () => {};
			}

			const portalId = pipe(
				Option.fromNullable(props.key),
				Option.getOrElse(() => {
					portalIdCounter++;
					return `portal-${String(portalIdCounter)}`;
				})
			);

			pipe(
				Option.fromNullable(portalCleanups.get(portalId)),
				Option.map((cleanup) => {
					cleanup();
				})
			);

			let renderTarget: Element | ShadowRoot = targetElement;
			if (props.useShadow) {
				const shadowRoot = targetElement.shadowRoot;
				if (shadowRoot) {
					renderTarget = shadowRoot;
				} else {
					try {
						renderTarget = targetElement.attachShadow({ mode: 'open' });
					} catch {
						renderTarget = targetElement;
					}
				}
			}

			const container = document.createElement('div');
			container.setAttribute('data-portal', portalId);

			pipe(
				Option.fromNullable(props.priority),
				Option.map((priority) => {
					const zIndex = pipe(
						Match.value(priority),
						Match.when(Predicate.isNumber, (n) => n),
						Match.orElse((str) =>
							pipe(
								Option.fromNullable(PRIORITY_VALUES[str]),
								Option.getOrElse(() => PORTAL_PRIORITY.DEFAULT)
							)
						)
					);
					container.style.position = 'relative';
					container.style.zIndex = String(zIndex);
				})
			);

			const insertMode = pipe(
				Option.fromNullable(props.insertMode),
				Option.getOrElse((): PortalInsertMode => 'append')
			);
			if (insertMode === 'prepend') {
				renderTarget.insertBefore(container, renderTarget.firstChild);
			} else if (insertMode === 'replace') {
				(renderTarget as Element).innerHTML = '';
				renderTarget.appendChild(container);
			} else {
				renderTarget.appendChild(container);
			}

			const cleanup = render(props.children, container);
			portalCleanups.set(portalId, cleanup);

			isMounted.value = true;
			pipe(
				Option.fromNullable(props.onMount),
				Option.map((fn) => {
					fn(targetElement);
				})
			);

			return () => {
				cleanup();
				container.remove();
				portalCleanups.delete(portalId);
				isMounted.value = false;
				pipe(
					Option.fromNullable(props.onUnmount),
					Option.map((fn) => {
						fn();
					})
				);
			};
		});

		return { isMounted };
	},
	template: () => {
		return null;
	},
});

export const PortalOutlet = define<{ name: string; class?: string }>({
	script: ({ props, onMount }) => {
		onMount(() => {
			const outletId = `portal-outlet-${props.name}`;
			let outletElement = document.getElementById(outletId);

			if (!outletElement) {
				outletElement = document.createElement('div');
				outletElement.id = outletId;
				outletElement.setAttribute('data-portal-outlet', props.name);
				if (props.class) {
					outletElement.className = props.class;
				}
				document.body.appendChild(outletElement);
			}

			registerPortalOutlet(props.name, outletElement);

			return () => {
				unregisterPortalOutlet(props.name);
				pipe(
					Option.fromNullable(outletElement),
					Option.map((el) => {
						el.remove();
					})
				);
			};
		});

		return {};
	},
	template: () => null,
});
