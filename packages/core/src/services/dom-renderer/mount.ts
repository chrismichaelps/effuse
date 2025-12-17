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

import { Context, Effect, Layer, pipe } from 'effect';
import type { Signal } from '../../reactivity/signal.js';
import { untrack, isSignal } from '../../reactivity/index.js';
import { effect } from '../../effects/effect.js';
import type { EffectHandle } from '../../types/index.js';
import {
	type EffuseChild,
	type EffuseNode,
	type BlueprintDef,
	isEffuseNode,
} from '../../render/node.js';
import { NodeType } from '../../constants.js';
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
import type { BlueprintContext } from '../../schema/node.js';
import { isSuspendToken } from '../../suspense/token.js';

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

const mountChild = (
	child: EffuseChild,
	cleanups: CleanupFn[]
): Effect.Effect<Node[], never, PropService | EventService> => {
	if (child == null) {
		return Effect.succeed([]);
	}

	if (typeof child === 'string' || typeof child === 'number') {
		const textNode = document.createTextNode(String(child));
		return Effect.succeed([textNode]);
	}

	if (typeof child === 'boolean') {
		return Effect.succeed([]);
	}

	if (isSignal(child)) {
		const sig = child as Signal<EffuseChild>;
		const anchor = document.createComment('signal');
		let currentNodes: Node[] = [];
		const signalCleanups: CleanupFn[] = [];
		let effectHandle: EffectHandle | null = null;

		const runEffect = () => {
			effectHandle = effect(() => {
				const value = sig.value;

				for (const node of currentNodes) {
					node.parentNode?.removeChild(node);
				}

				for (const cleanup of signalCleanups) {
					cleanup();
				}
				signalCleanups.length = 0;

				if (value == null) {
					currentNodes = [];
					return;
				}

				if (typeof value === 'string' || typeof value === 'number') {
					const textNode = document.createTextNode(String(value));
					anchor.parentNode?.insertBefore(textNode, anchor.nextSibling);
					currentNodes = [textNode];
					return;
				}

				untrack(() => {
					const childCleanups: CleanupFn[] = [];

					let mountResult: Node[];
					try {
						mountResult = Effect.runSync(
							pipe(
								mountChild(value, childCleanups),
								Effect.provide(PropServiceLive),
								Effect.provide(EventServiceLive)
							)
						);
					} catch (err) {
						const isSuspendError = (e: unknown): boolean => {
							if (isSuspendToken(e)) return true;
							if (typeof e === 'object' && e !== null) {
								const anyErr = e as Record<string, unknown>;
								if (isSuspendToken(anyErr.cause)) return true;
								if (isSuspendToken(anyErr.error)) return true;
								if (isSuspendToken(anyErr.defect)) return true;
								const msg = String(anyErr.message || '');
								if (msg.includes('"resourceId"') && msg.includes('"promise"')) {
									return true;
								}
							}
							return false;
						};

						if (isSuspendError(err)) {
							currentNodes = [];
							return;
						}
						throw err;
					}

					const insertPoint: Node | null = anchor.nextSibling;
					for (const node of mountResult) {
						if (anchor.parentNode) {
							anchor.parentNode.insertBefore(node, insertPoint);
						}
					}
					currentNodes = mountResult;
					signalCleanups.push(...childCleanups);
				});
			});
		};

		queueMicrotask(runEffect);

		cleanups.push(() => {
			effectHandle?.stop();
			for (const cleanup of signalCleanups) {
				cleanup();
			}
		});
		return Effect.succeed([anchor]);
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

const getNodeChildren = (node: EffuseNode): readonly unknown[] => {
	if ('children' in node && Array.isArray(node.children)) {
		return node.children;
	}
	return [];
};

const getNodeProps = (node: EffuseNode): Record<string, unknown> | null => {
	if ('props' in node && node.props != null) {
		return node.props as Record<string, unknown>;
	}
	return null;
};

const getNodeTag = (node: EffuseNode): string => {
	if ('tag' in node && typeof node.tag === 'string') {
		return node.tag;
	}
	return 'div';
};

const getNodeText = (node: EffuseNode): string => {
	if ('text' in node && typeof node.text === 'string') {
		return node.text;
	}
	return '';
};

const mountNode = (
	node: EffuseNode,
	cleanups: CleanupFn[]
): Effect.Effect<Node[], never, PropService | EventService> => {
	const nodeType = node.type;

	if (nodeType === NodeType.TEXT) {
		const domNode = document.createTextNode(getNodeText(node));
		return Effect.succeed([domNode]);
	}

	if (nodeType === NodeType.ELEMENT) {
		const tag = getNodeTag(node);
		const props = getNodeProps(node);
		const children = getNodeChildren(node);

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

						if (key.startsWith('on') && typeof value === 'function') {
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
							isSignal(value) &&
							(element instanceof HTMLInputElement ||
								element instanceof HTMLTextAreaElement ||
								element instanceof HTMLSelectElement)
						) {
							const result = Effect.runSync(
								propService.bindFormControl(
									element,
									value as Signal<string | number | boolean>
								)
							);
							bindingCleanups.push(result.cleanup);
							continue;
						}

						propEffects.push(propService.bindProp(element, key, value));
					}
				}

				for (const propEffect of propEffects) {
					const result = Effect.runSync(propEffect);
					bindingCleanups.push(result.cleanup);
				}

				for (const eventEffect of eventEffects) {
					const result = Effect.runSync(eventEffect);
					bindingCleanups.push(result.cleanup);
				}

				cleanups.push(() => {
					for (const fn of bindingCleanups) {
						fn();
					}
				});

				return pipe(
					Effect.all(
						children.map((c) => mountChild(c as EffuseChild, cleanups))
					),
					Effect.map((results) => {
						for (const childNode of results.flat()) {
							element.appendChild(childNode);
						}
						return [element];
					})
				);
			})
		);
	}

	if (nodeType === NodeType.FRAGMENT || nodeType === NodeType.LIST) {
		if (nodeType === NodeType.LIST) {
			const anchor = document.createComment('list');
			let currentNodes: Node[] = [];
			const listCleanups: CleanupFn[] = [];
			let effectHandle: { stop: () => void } | null = null;

			const runEffect = () => {
				effectHandle = effect(() => {
					const children = getNodeChildren(node);

					for (const n of currentNodes) {
						n.parentNode?.removeChild(n);
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
								Effect.all(
									children.map((c) =>
										mountChild(c as EffuseChild, childCleanups)
									)
								),
								Effect.map((results) => results.flat()),
								Effect.provide(PropServiceLive),
								Effect.provide(EventServiceLive)
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
					} catch (err) {
						currentNodes = [];
					}
				});
			};

			queueMicrotask(runEffect);

			cleanups.push(() => {
				effectHandle?.stop();
				for (const cleanup of listCleanups) {
					cleanup();
				}
			});

			return Effect.succeed([anchor]);
		}

		const children = getNodeChildren(node);
		return pipe(
			Effect.all(children.map((c) => mountChild(c as EffuseChild, cleanups))),
			Effect.map((results) => results.flat())
		);
	}

	if (nodeType === NodeType.BLUEPRINT) {
		const blueprintNode = node as unknown as {
			blueprint: BlueprintDef;
			props: Record<string, unknown>;
			portals: Record<string, unknown> | null;
		};
		const context = instantiateBlueprint(
			blueprintNode.blueprint,
			blueprintNode.props,
			blueprintNode.portals ?? {}
		);
		const childView = blueprintNode.blueprint.view(context as BlueprintContext);
		return mountChild(childView, cleanups);
	}

	return Effect.succeed([]);
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
									nodeItem.parentNode?.removeChild(nodeItem);
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
