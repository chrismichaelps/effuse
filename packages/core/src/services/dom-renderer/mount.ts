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

import { Context, Effect, Layer, pipe, Predicate } from 'effect';
import type { Signal } from '../../reactivity/signal.js';
import { untrack, isSignal } from '../../reactivity/index.js';
import { watchEffect } from '../../effects/effect.js';
import type { EffectHandle } from '../../types/index.js';
import { type EffuseChild, type EffuseNode } from '../../render/node.js';
import {
	PropService,
	PropServiceLive,
	type PropBindingResult,
} from './props.js';
import {
	EventService,
	EventServiceLive,
	type EventBindingResult,
} from './events.js';
import { instantiateBlueprint } from '../../blueprint/blueprint.js';
import {
	runWithProvideScope,
	type ProvideScope,
} from '../../blueprint/provide-inject.js';
import type { BlueprintContext } from '../../schema/node.js';
import { isSuspendToken } from '../../suspense/Suspense.js';
import { isEffuseNode } from '../../render/index.js';
import { mapEffuseErrors } from '../../errors.js';
import { registerComponent } from '../../hmr/runtime.js';

export interface MountedNode {
	nodes: Node[];
	cleanup: () => void;
}

export interface MountServiceInterface {
	readonly mount: (
		child: EffuseChild,
		container: Element
	) => Effect.Effect<MountedNode, never, PropService | EventService>;

	readonly unmount: (mounted: MountedNode) => Effect.Effect<void>;
}

export class MountService extends Context.Tag('effuse/MountService')<
	MountService,
	MountServiceInterface
>() { }

type CleanupFn = () => void;

const getRenderErrorMessage = (error: unknown): string => {
	if (error instanceof Error) {
		return error.message;
	}
	if (Predicate.isObject(error) && Predicate.hasProperty(error, 'message')) {
		return String(error.message);
	}
	return String(error);
};

const createRenderErrorNode = (error: unknown): HTMLElement => {
	const node = document.createElement('div');
	node.className = 'effuse-render-error';
	node.setAttribute('role', 'alert');
	node.setAttribute('data-effuse-render-error', 'true');
	node.textContent = `Effuse render error: ${getRenderErrorMessage(error)}`;
	return node;
};

const runCleanups = (cleanups: CleanupFn[]): void => {
	for (const cleanup of cleanups) {
		cleanup();
	}
};

const insertAfterAnchor = (anchor: Comment, nodes: readonly Node[]): void => {
	const insertPoint: Node | null = anchor.nextSibling;
	for (const node of nodes) {
		if (anchor.parentNode) {
			anchor.parentNode.insertBefore(node, insertPoint);
		}
	}
};

const isSuspendRenderError = (error: unknown): boolean => {
	if (isSuspendToken(error)) return true;
	if (!Predicate.isObject(error)) return false;

	const value = error as Record<string, unknown>;
	if (isSuspendToken(value.cause)) return true;
	if (isSuspendToken(value.error)) return true;
	if (isSuspendToken(value.defect)) return true;

	const message = Predicate.isString(value.message) ? value.message : '';
	return message.includes('"resourceId"') && message.includes('"promise"');
};

const removeNodes = (nodes: Node[]): void => {
	for (const node of nodes) {
		if (Predicate.isNotNullable(node.parentNode)) {
			node.parentNode.removeChild(node);
		}
	}
	nodes.length = 0;
};

const mountDynamicValue = (
	label: string,
	evaluate: () => unknown,
	cleanups: CleanupFn[],
	onRender?: (nodes: Node[], anchor: Comment) => void
): Effect.Effect<Node[], never, PropService | EventService> => {
	const anchor = document.createComment(label);
	const currentNodes: Node[] = [];
	const dynamicCleanups: CleanupFn[] = [];
	let effectHandle: EffectHandle | null = null;
	let didNotifyRender = false;

	const clearMountedValue = (): void => {
		removeNodes(currentNodes);
		runCleanups(dynamicCleanups);
		dynamicCleanups.length = 0;
	};

	const setMountedNodes = (nodes: Node[]): void => {
		currentNodes.splice(0, currentNodes.length, ...nodes);
		if (!didNotifyRender) {
			didNotifyRender = true;
			onRender?.(currentNodes, anchor);
		}
	};

	const mountResolvedValue = (value: unknown): void => {
		if (value == null || Predicate.isBoolean(value)) {
			setMountedNodes([]);
			return;
		}

		if (Predicate.isString(value) || Predicate.isNumber(value)) {
			const textNode = document.createTextNode(String(value));
			if (Predicate.isNotNullable(anchor.parentNode)) {
				anchor.parentNode.insertBefore(textNode, anchor.nextSibling);
			}
			setMountedNodes([textNode]);
			return;
		}

		untrack(() => {
			const childCleanups: CleanupFn[] = [];

			let mountResult: Node[];
			try {
				mountResult = Effect.runSync(
					pipe(
						mountChild(value as EffuseChild, childCleanups),
						Effect.provide(PropServiceLive),
						Effect.provide(EventServiceLive),
						mapEffuseErrors
					)
				);
			} catch (error) {
				if (isSuspendRenderError(error)) {
					setMountedNodes([]);
					return;
				}

				runCleanups(childCleanups);
				const errorNode = createRenderErrorNode(error);
				insertAfterAnchor(anchor, [errorNode]);
				setMountedNodes([errorNode]);
				return;
			}

			insertAfterAnchor(anchor, mountResult);
			setMountedNodes(mountResult);
			dynamicCleanups.push(...childCleanups);
		});
	};

	const runEffect = (): void => {
		effectHandle = watchEffect(() => {
			let value: unknown;
			try {
				value = evaluate();
			} catch (error) {
				clearMountedValue();
				const errorNode = createRenderErrorNode(error);
				insertAfterAnchor(anchor, [errorNode]);
				setMountedNodes([errorNode]);
				return;
			}

			clearMountedValue();
			mountResolvedValue(value);
		});
	};

	queueMicrotask(runEffect);

	cleanups.push(() => {
		if (Predicate.isNotNullable(effectHandle)) {
			effectHandle.stop();
		}
		clearMountedValue();
	});

	return Effect.succeed([anchor]);
};

const mountChild = (
	child: EffuseChild,
	cleanups: CleanupFn[]
): Effect.Effect<Node[], never, PropService | EventService> => {
	if (child == null) {
		return Effect.succeed([]);
	}

	if (Predicate.isString(child) || Predicate.isNumber(child)) {
		const textNode = document.createTextNode(String(child));
		return Effect.succeed([textNode]);
	}

	if (Predicate.isBoolean(child)) {
		return Effect.succeed([]);
	}

	if (Predicate.isFunction(child)) {
		const fn = child as () => unknown;
		return mountDynamicValue('fn', fn, cleanups);
	}

	if (isSignal(child)) {
		const sig = child as Signal<EffuseChild>;
		return mountDynamicValue('signal', () => sig.value, cleanups);
	}

	if (Array.isArray(child)) {
		return pipe(
			Effect.all(child.map((c: EffuseChild) => mountChild(c, cleanups))),
			Effect.map((results) => results.flat())
		);
	}

	if (isEffuseNode(child)) {
		return mountNode(child, cleanups);
	}

	return Effect.succeed([]);
};

const mountNode = (
	node: EffuseNode,
	cleanups: CleanupFn[]
): Effect.Effect<Node[], never, PropService | EventService> => {
	switch (node._tag) {
		case 'Text': {
			const domNode = document.createTextNode(node.text);
			return Effect.succeed([domNode]);
		}
		case 'Element': {
			const tag = node.tag;
			const props = node.props;
			const children = node.children;

			return pipe(
				Effect.Do,
				Effect.bind('propService', () => PropService),
				Effect.bind('eventService', () => EventService),
				Effect.flatMap(({ propService, eventService }) => {
					const element = document.createElement(tag);
					const bindingCleanups: CleanupFn[] = [];

					const propEffects: Effect.Effect<PropBindingResult>[] = [];
					const eventEffects: Effect.Effect<EventBindingResult>[] = [];

					if (props) {
						for (const [key, value] of Object.entries(props)) {
							if (key === 'children' || key === 'key') continue;

							if (key.startsWith('on') && Predicate.isFunction(value)) {
								const eventName = key.slice(2).toLowerCase();
								eventEffects.push(
									eventService.bindEvent(
										element,
										eventName,
										value as EventListener
									)
								);
								continue;
							}

							if (
								(key === 'value' || key === 'checked') &&
								(Predicate.isFunction(value) || isSignal(value)) &&
								(element instanceof HTMLInputElement ||
									element instanceof HTMLTextAreaElement ||
									element instanceof HTMLSelectElement)
							) {
								propEffects.push(
									propService.bindFormControl(
										element,
										value as
											| (() => string | number | boolean)
											| Signal<string | number | boolean>
									)
								);
								continue;
							}

							propEffects.push(propService.bindProp(element, key, value));
						}
					}

					const allBindingEffects = [
						...propEffects.map((e) => pipe(e, mapEffuseErrors)),
						...eventEffects.map((e) => pipe(e, mapEffuseErrors)),
					];

					return pipe(
						Effect.all(allBindingEffects),
						Effect.orDie,
						Effect.map((results) => {
							for (const result of results) {
								bindingCleanups.push(result.cleanup);
							}
							cleanups.push(() => {
								for (const fn of bindingCleanups) {
									fn();
								}
							});
							return element;
						}),
						Effect.flatMap(() =>
							pipe(
								Effect.all(children.map((c) => mountChild(c, cleanups))),
								Effect.map((results) => {
									for (const childNode of results.flat()) {
										element.appendChild(childNode);
									}
									return [element] as Node[];
								})
							)
						)
					);
				})
			);
		}
		case 'Fragment': {
			return pipe(
				Effect.all(node.children.map((c) => mountChild(c, cleanups))),
				Effect.map((results) => results.flat())
			);
		}
		case 'List': {
			const anchor = document.createComment('list');
			let currentNodes: Node[] = [];
			const listCleanups: CleanupFn[] = [];
			let effectHandle: { stop: () => void } | null = null;

			const runEffect = () => {
				effectHandle = watchEffect(() => {
					const children = node.children;

					for (const n of currentNodes) {
						if (Predicate.isNotNullable(n.parentNode)) {
							n.parentNode.removeChild(n);
						}
					}
					for (const cleanup of listCleanups) {
						cleanup();
					}
					listCleanups.length = 0;

					if (children.length === 0) {
						currentNodes = [];
						return;
					}

					const childCleanups: CleanupFn[] = [];
					try {
						const mountResult = Effect.runSync(
							pipe(
								Effect.all(children.map((c) => mountChild(c, childCleanups))),
								Effect.map((results) => results.flat()),
								Effect.provide(PropServiceLive),
								Effect.provide(EventServiceLive),
								mapEffuseErrors
							)
						);

						const insertPoint: Node | null = anchor.nextSibling;
						for (const n of mountResult) {
							if (anchor.parentNode) {
								anchor.parentNode.insertBefore(n, insertPoint);
							}
						}
						currentNodes = mountResult;
						listCleanups.push(...childCleanups);
					} catch {
						// Error during list mounting - silently recover
						currentNodes = [];
					}
				});
			};

			queueMicrotask(runEffect);

			cleanups.push(() => {
				if (Predicate.isNotNullable(effectHandle)) {
					effectHandle.stop();
				}
				for (const cleanup of listCleanups) {
					cleanup();
				}
			});

			return Effect.succeed([anchor]);
		}
		case 'Blueprint': {
			const context = instantiateBlueprint(
				node.blueprint,
				node.props,
				node.portals ?? {}
			);

			const stateWithLifecycle = context.state as unknown as {
				lifecycle?: { runCleanup: () => void };
				_provideScope?: ProvideScope;
			};

			if (stateWithLifecycle.lifecycle) {
				const lifecycle = stateWithLifecycle.lifecycle;
				cleanups.push(() => {
					lifecycle.runCleanup();
				});
			}

			const provideScope = stateWithLifecycle._provideScope;
			const childView = provideScope
				? () =>
						runWithProvideScope(provideScope, () =>
							node.blueprint.view(context as BlueprintContext)
						)
				: () => node.blueprint.view(context as BlueprintContext);

			// HMR: create anchor and register instance
			const hmrId = (node.blueprint as unknown as Record<string, unknown>).__hmrId as
				| string
				| undefined;

			return mountDynamicValue('', childView, cleanups, (mountedNodes, anchor) => {
				if (!hmrId) return;

				const parent = anchor.parentNode as Element | null;
				if (!parent) return;

				const instanceCleanup = registerComponent(
					hmrId,
					node.blueprint,
					node.props,
					mountedNodes,
					() => {
						for (const cleanup of cleanups) cleanup();
					},
					parent,
					anchor
				);
				cleanups.push(instanceCleanup);
			});
		}
		default: {
			let tag: unknown = 'unknown';
			if (Predicate.isObject(node)) {
				const n = node as Record<string, unknown>;
				tag = n._tag || n.type || 'unknown';
			}
			throw new Error(
				`Paint failed: Unknown node tag "${Predicate.isString(tag) ? tag : 'unknown'}"`
			);
		}
	}
};

export const MountServiceLive = Layer.succeed(MountService, {
	mount: (child: EffuseChild, container: Element) =>
		pipe(
			Effect.sync(() => {
				const cleanups: CleanupFn[] = [];
				return { cleanups };
			}),
			Effect.flatMap(({ cleanups }) =>
				pipe(
					mountChild(child, cleanups),
					Effect.map((nodes) => {
						for (const nodeItem of nodes) {
							container.appendChild(nodeItem);
						}
						return {
							nodes,
							cleanup: () => {
								for (const fn of cleanups) {
									fn();
								}
								for (const nodeItem of nodes) {
									if (Predicate.isNotNullable(nodeItem.parentNode)) {
										nodeItem.parentNode.removeChild(nodeItem);
									}
								}
							},
						};
					})
				)
			)
		),

	unmount: (mounted: MountedNode) =>
		Effect.sync(() => {
			mounted.cleanup();
		}),
});
