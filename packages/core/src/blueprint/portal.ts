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

import { Match, Option, Predicate, pipe } from 'effect';
import type { EffuseChild } from '../render/node.js';
import { render } from '../render/index.js';
import { define } from './define.js';

export interface PortalContainer {
	readonly id: string;
	readonly element: Element;
	readonly cleanup: () => void;
}

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

interface PortalOwner {
	readonly target: Element | ShadowRoot;
	readonly dispose: () => void;
}

const portalOwners = new Map<string, PortalOwner>();
let portalIdCounter = 0;

const throwDisposalFailures = (failures: unknown[]): void => {
	if (failures.length === 1) throw failures[0];
	if (failures.length > 1) {
		throw new AggregateError(failures, 'Effuse portal disposal failed.');
	}
};

const disposePortalOwnersInTarget = (target: Element | ShadowRoot): void => {
	const failures: unknown[] = [];
	for (const owner of [...portalOwners.values()]) {
		if (owner.target !== target) continue;
		try {
			owner.dispose();
		} catch (error) {
			failures.push(error);
		}
	}
	throwDisposalFailures(failures);
};

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
				const target = Predicate.isFunction(props.target)
					? props.target()
					: props.target;
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

			portalOwners.get(portalId)?.dispose();

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
				disposePortalOwnersInTarget(renderTarget);
				(renderTarget as Element).innerHTML = '';
				renderTarget.appendChild(container);
			} else {
				renderTarget.appendChild(container);
			}

			let cleanup: () => void;
			try {
				cleanup = render(props.children, container);
			} catch (error) {
				container.remove();
				throw error;
			}
			let disposed = false;
			const dispose = (): void => {
				if (disposed) return;
				disposed = true;
				const failures: unknown[] = [];
				try {
					cleanup();
				} catch (error) {
					failures.push(error);
				}
				try {
					container.remove();
				} catch (error) {
					failures.push(error);
				}
				if (portalOwners.get(portalId) === owner) {
					portalOwners.delete(portalId);
				}
				isMounted.value = false;
				try {
					props.onUnmount?.();
				} catch (error) {
					failures.push(error);
				}
				throwDisposalFailures(failures);
			};
			const owner: PortalOwner = {
				target: renderTarget,
				dispose,
			};
			portalOwners.set(portalId, owner);

			isMounted.value = true;
			try {
				props.onMount?.(targetElement);
			} catch (error) {
				try {
					dispose();
				} catch (disposeError) {
					throw new AggregateError(
						[error, disposeError],
						'Effuse portal mount and rollback failed.'
					);
				}
				throw error;
			}

			return dispose;
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
