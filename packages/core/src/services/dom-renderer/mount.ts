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
	patchElementRef,
	type PropBindingResult,
} from './props.js';
import {
	EventService,
	EventServiceLive,
	clearElementEvents,
	patchElementEvent,
	type EventBindingResult,
} from './events.js';
import { instantiateBlueprint } from '../../blueprint/blueprint.js';
import {
	getCurrentProvideScope,
	runWithProvideScope,
	type ProvideScope,
} from '../../blueprint/provide-inject.js';
import type { BlueprintContext } from '../../schema/node.js';
import { isSuspendToken } from '../../suspense/Suspense.js';
import { isEffuseNode } from '../../render/index.js';
import { mapEffuseErrors } from '../../errors.js';
import { registerComponent } from '../../hmr/runtime.js';
import {
	claimElement,
	claimText,
	createHydrationCursor,
	dropUnclaimed,
	insertAtCursor,
	type HydrationCursor,
} from './hydration-cursor.js';
import { captureIdScope } from '../../hooks/useId.js';
import {
	createDOMElement,
	getChildNamespace,
	getDOMNamespace,
	getElementNamespace,
	type DOMNamespace,
} from '../../render/attribute-name.js';
import {
	getErrorBoundaryController,
	normalizeBoundaryError,
	type ErrorBoundaryController,
} from '../../components/error-boundary-runtime.js';

export interface MountedNode {
	nodes: Node[];
	cleanup: () => void;
}

export interface MountServiceInterface {
	readonly mount: (
		child: EffuseChild,
		container: Element
	) => Effect.Effect<MountedNode, never, PropService | EventService>;

	/**
	 * Adopt the server-rendered markup already inside `container` instead of
	 * building a second copy of the tree next to it.
	 */
	readonly hydrate: (
		child: EffuseChild,
		container: Element
	) => Effect.Effect<MountedNode, never, PropService | EventService>;

	readonly unmount: (mounted: MountedNode) => Effect.Effect<void>;
}

export class MountService extends Context.Tag('effuse/MountService')<
	MountService,
	MountServiceInterface
>() {}

type CleanupFn = () => void;

interface DynamicMountRecord {
	readonly getNodes: () => readonly Node[];
}

interface BlueprintMountRecord {
	readonly blueprint: Extract<EffuseNode, { _tag: 'Blueprint' }>;
	readonly updateProps: (props: Record<string, unknown>) => void;
}

interface RenderErrorBoundary {
	readonly controller: ErrorBoundaryController;
	readonly parent: RenderErrorBoundary | undefined;
	active: boolean;
}

const captureRenderError = (
	boundary: RenderErrorBoundary | undefined,
	error: unknown
): boolean => {
	if (!boundary) return false;
	if (boundary.controller.hasError()) {
		return captureRenderError(boundary.parent, error);
	}

	try {
		boundary.controller.capture(
			normalizeBoundaryError(error),
			!boundary.active
		);
	} catch (captureError) {
		return captureRenderError(boundary.parent, captureError);
	}

	return true;
};

const dynamicMountRecords = new WeakMap<Comment, DynamicMountRecord>();
const blueprintMountRecords = new WeakMap<Comment, BlueprintMountRecord>();
const pendingDynamicMounts: Array<() => void> = [];
let dynamicMountFlushScheduled = false;

const scheduleDynamicMountFlush = (): void => {
	if (dynamicMountFlushScheduled || pendingDynamicMounts.length === 0) return;

	dynamicMountFlushScheduled = true;
	queueMicrotask(() => {
		try {
			let next = pendingDynamicMounts.shift();
			while (next) {
				next();
				next = pendingDynamicMounts.shift();
			}
		} finally {
			dynamicMountFlushScheduled = false;
			scheduleDynamicMountFlush();
		}
	});
};

const queueDynamicMount = (mount: () => void): void => {
	pendingDynamicMounts.push(mount);
	scheduleDynamicMountFlush();
};

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
	const errors: unknown[] = [];
	for (const cleanup of cleanups) {
		try {
			cleanup();
		} catch (error) {
			errors.push(error);
		}
	}
	if (errors.length === 1) throw errors[0];
	if (errors.length > 1) {
		throw new AggregateError(
			errors,
			`[Effuse] Renderer cleanup failed in ${errors.length} resources.`
		);
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

const isScalarChild = (value: unknown): value is string | number =>
	Predicate.isString(value) || Predicate.isNumber(value);

const getNodeKey = (node: EffuseNode): string | number | undefined =>
	(node as { readonly key?: string | number | undefined }).key;

const isCommentNode = (node: Node | undefined): node is Comment =>
	Predicate.isNotNullable(node) && node.nodeType === Node.COMMENT_NODE;

const isEventProp = (key: string): boolean =>
	key.length > 2 &&
	key.startsWith('on') &&
	key[2] !== undefined &&
	key[2] === key[2].toUpperCase();

const arePropsPatchCompatible = (
	previous: Record<string, unknown> | null | undefined,
	next: Record<string, unknown> | null | undefined
): boolean => {
	const previousProps = previous ?? {};
	const nextProps = next ?? {};
	const keys = new Set([
		...Object.keys(previousProps),
		...Object.keys(nextProps),
	]);

	for (const key of keys) {
		if (key === 'children' || key === 'key' || key === 'ref') continue;
		if (isEventProp(key)) continue;
		if (!Object.is(previousProps[key], nextProps[key])) {
			return false;
		}
	}

	return true;
};

const patchEventProps = (
	element: Element,
	previous: Record<string, unknown> | null | undefined,
	next: Record<string, unknown> | null | undefined
): void => {
	const previousProps = previous ?? {};
	const nextProps = next ?? {};
	const keys = new Set([
		...Object.keys(previousProps),
		...Object.keys(nextProps),
	]);

	for (const key of keys) {
		if (!isEventProp(key) || Object.is(previousProps[key], nextProps[key])) {
			continue;
		}

		const eventName = key.slice(2).toLowerCase();
		patchElementEvent(element, eventName, nextProps[key]);
	}
};

const isBlueprintChild = (
	child: EffuseChild
): child is Extract<EffuseNode, { _tag: 'Blueprint' }> =>
	isEffuseNode(child) && child._tag === 'Blueprint';

const haveSameBlueprintIdentity = (
	previous: Extract<EffuseNode, { _tag: 'Blueprint' }>,
	next: Extract<EffuseNode, { _tag: 'Blueprint' }>
): boolean =>
	previous.blueprint === next.blueprint &&
	getNodeKey(previous) === getNodeKey(next);

const haveSameChildSignature = (
	previous: EffuseChild,
	next: EffuseChild
): boolean => {
	if (Object.is(previous, next)) return true;
	if (previous == null || next == null) return previous == null && next == null;
	if (Predicate.isBoolean(previous) || Predicate.isBoolean(next)) {
		return Predicate.isBoolean(previous) && Predicate.isBoolean(next);
	}
	if (isScalarChild(previous) || isScalarChild(next)) {
		return (
			isScalarChild(previous) &&
			isScalarChild(next) &&
			String(previous) === String(next)
		);
	}
	if (Array.isArray(previous) || Array.isArray(next)) {
		if (!Array.isArray(previous) || !Array.isArray(next)) return false;
		return (
			previous.length === next.length &&
			previous.every((child, index) =>
				haveSameChildSignature(child, next[index])
			)
		);
	}
	if (Predicate.isFunction(previous) || Predicate.isFunction(next)) {
		return Object.is(previous, next);
	}
	if (isSignal(previous) || isSignal(next)) {
		return Object.is(previous, next);
	}
	if (!isEffuseNode(previous) || !isEffuseNode(next)) return false;
	if (
		previous._tag !== next._tag ||
		getNodeKey(previous) !== getNodeKey(next)
	) {
		return false;
	}

	switch (previous._tag) {
		case 'Text':
			return next._tag === 'Text' && previous.text === next.text;
		case 'Element':
			return (
				next._tag === 'Element' &&
				previous.tag === next.tag &&
				arePropsPatchCompatible(previous.props, next.props) &&
				previous.children.length === next.children.length &&
				previous.children.every((child, index) =>
					haveSameChildSignature(child, next.children[index])
				)
			);
		case 'Fragment':
		case 'List':
			return (
				(previous as { readonly children: EffuseChild[] }).children.length ===
					(next as { readonly children: EffuseChild[] }).children.length &&
				(previous as { readonly children: EffuseChild[] }).children.every(
					(child, index) =>
						haveSameChildSignature(
							child,
							(next as { readonly children: EffuseChild[] }).children[index]
						)
				)
			);
		case 'Blueprint':
			return (
				next._tag === 'Blueprint' &&
				previous.blueprint === next.blueprint &&
				arePropsPatchCompatible(previous.props, next.props)
			);
		default:
			return false;
	}
};

const advanceDomIndexForChild = (
	parent: Element,
	domIndex: number,
	child: EffuseChild,
	isLastChild: boolean
): number => {
	if (child == null || Predicate.isBoolean(child)) return domIndex;
	if (
		isScalarChild(child) ||
		(isEffuseNode(child) && child._tag === 'Element')
	) {
		return domIndex + 1;
	}

	if (isLastChild) {
		return parent.childNodes.length;
	}

	return -1;
};

const getDynamicSpanLength = (anchor: Comment): number | null => {
	const record = dynamicMountRecords.get(anchor);
	if (!record) return null;
	return 1 + record.getNodes().length;
};

const patchBlueprintChild = (
	parent: Element,
	domIndex: number,
	previous: Extract<EffuseNode, { _tag: 'Blueprint' }>,
	next: Extract<EffuseNode, { _tag: 'Blueprint' }>
): number | null => {
	const node = parent.childNodes[domIndex];
	if (!isCommentNode(node)) return null;

	const record = blueprintMountRecords.get(node);
	if (!record || record.blueprint.blueprint !== previous.blueprint) {
		return null;
	}

	record.updateProps(next.props);
	return getDynamicSpanLength(node);
};

const patchElementChildren = (
	element: Element,
	previousChildren: readonly EffuseChild[],
	nextChildren: readonly EffuseChild[]
): boolean => {
	if (previousChildren.length !== nextChildren.length) return false;

	let domIndex = 0;
	for (let index = 0; index < previousChildren.length; index++) {
		const previousChild = previousChildren[index];
		const nextChild = nextChildren[index];
		const isLastChild = index === previousChildren.length - 1;

		if (
			isBlueprintChild(previousChild) &&
			isBlueprintChild(nextChild) &&
			haveSameBlueprintIdentity(previousChild, nextChild)
		) {
			const spanLength = patchBlueprintChild(
				element,
				domIndex,
				previousChild,
				nextChild
			);
			if (spanLength === null) return false;
			domIndex += spanLength;
			continue;
		}

		if (haveSameChildSignature(previousChild, nextChild)) {
			const nextDomIndex = advanceDomIndexForChild(
				element,
				domIndex,
				previousChild,
				isLastChild
			);
			if (nextDomIndex < 0) return false;
			domIndex = nextDomIndex;
			continue;
		}

		const domNode = element.childNodes[domIndex];
		if (!domNode) return false;

		if (isScalarChild(previousChild) && isScalarChild(nextChild)) {
			domNode.textContent = String(nextChild);
			domIndex++;
			continue;
		}

		if (
			isEffuseNode(previousChild) &&
			isEffuseNode(nextChild) &&
			previousChild._tag === 'Element' &&
			nextChild._tag === 'Element' &&
			domNode instanceof Element &&
			patchElementNode(domNode, previousChild, nextChild)
		) {
			domIndex++;
			continue;
		}

		return false;
	}

	return true;
};

const patchElementNode = (
	element: Element,
	previous: Extract<EffuseNode, { _tag: 'Element' }>,
	next: Extract<EffuseNode, { _tag: 'Element' }>
): boolean => {
	if (previous.tag !== next.tag || getNodeKey(previous) !== getNodeKey(next)) {
		return false;
	}
	if (element.tagName.toLowerCase() !== next.tag.toLowerCase()) {
		return false;
	}
	if (!arePropsPatchCompatible(previous.props, next.props)) {
		return false;
	}
	patchEventProps(element, previous.props, next.props);
	if (!patchElementChildren(element, previous.children, next.children)) {
		return false;
	}
	if (!Object.is(previous.props?.ref, next.props?.ref)) {
		patchElementRef(element, next.props?.ref);
	}
	return true;
};

const patchMountedValue = (
	previous: EffuseChild | undefined,
	next: EffuseChild,
	currentNodes: readonly Node[]
): boolean => {
	if (previous === undefined || currentNodes.length !== 1) return false;

	const currentNode = currentNodes[0];
	if (isScalarChild(previous) && isScalarChild(next)) {
		if (currentNode.nodeType !== Node.TEXT_NODE) return false;
		currentNode.textContent = String(next);
		return true;
	}

	if (
		isEffuseNode(previous) &&
		isEffuseNode(next) &&
		previous._tag === 'Element' &&
		next._tag === 'Element' &&
		currentNode instanceof Element
	) {
		return patchElementNode(currentNode, previous, next);
	}

	return false;
};

const mountDynamicValue = (
	label: string,
	evaluate: () => unknown,
	cleanups: CleanupFn[],
	onRender?: (nodes: Node[], anchor: Comment) => void,
	componentScope?: ProvideScope,
	hydrationCursor?: HydrationCursor,
	errorBoundary?: RenderErrorBoundary,
	namespace: DOMNamespace = 'html'
): Effect.Effect<Node[], never, PropService | EventService> => {
	const provideScope = componentScope ?? getCurrentProvideScope();
	const runWithCapturedIdScope = captureIdScope();
	const anchor = document.createComment(label);

	// The anchor has no server counterpart, so it is inserted at the cursor;
	// the value it tracks then claims the nodes that follow it.
	if (hydrationCursor) {
		insertAtCursor(hydrationCursor, anchor);
	}
	// Consumed by the first evaluation only — later updates render normally.
	let pendingCursor = hydrationCursor;
	const currentNodes: Node[] = [];
	const dynamicCleanups: CleanupFn[] = [];
	let previousValue: EffuseChild | undefined;
	let effectHandle: EffectHandle | null = null;
	let didNotifyRender = false;
	let active = true;

	dynamicMountRecords.set(anchor, {
		getNodes: () => currentNodes,
	});

	const clearMountedValue = (): void => {
		removeNodes(currentNodes);
		try {
			runCleanups(dynamicCleanups);
		} finally {
			dynamicCleanups.length = 0;
		}
	};

	const setMountedNodes = (nodes: Node[]): void => {
		currentNodes.splice(0, currentNodes.length, ...nodes);
		if (!didNotifyRender) {
			didNotifyRender = true;
			onRender?.(currentNodes, anchor);
		}
	};

	const mountResolvedValue = (value: unknown): void => {
		const cursor = pendingCursor;
		pendingCursor = undefined;

		if (value == null || Predicate.isBoolean(value)) {
			setMountedNodes([]);
			previousValue = value as EffuseChild;
			return;
		}

		if (Predicate.isString(value) || Predicate.isNumber(value)) {
			const textNode = cursor
				? claimText(cursor, String(value))
				: document.createTextNode(String(value));
			if (!cursor && Predicate.isNotNullable(anchor.parentNode)) {
				anchor.parentNode.insertBefore(textNode, anchor.nextSibling);
			}
			setMountedNodes([textNode]);
			previousValue = value;
			return;
		}

		untrack(() => {
			const childCleanups: CleanupFn[] = [];

			let mountResult: Node[];
			try {
				mountResult = Effect.runSync(
					pipe(
						mountChild(
							value as EffuseChild,
							childCleanups,
							cursor,
							errorBoundary,
							namespace
						),
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
				if (captureRenderError(errorBoundary, error)) {
					setMountedNodes([]);
					return;
				}
				const errorNode = createRenderErrorNode(error);
				insertAfterAnchor(anchor, [errorNode]);
				setMountedNodes([errorNode]);
				return;
			}

			// Hydrated nodes are already in the document, in place.
			if (!cursor) {
				insertAfterAnchor(anchor, mountResult);
			}
			setMountedNodes(mountResult);
			dynamicCleanups.push(...childCleanups);
			previousValue = value as EffuseChild;
		});
	};

	const runEffect = (): void => {
		if (!active) return;
		effectHandle = watchEffect(() =>
			runWithCapturedIdScope(() => {
				const update = (): void => {
					let value: unknown;
					try {
						value = evaluate();
					} catch (error) {
						clearMountedValue();
						previousValue = undefined;
						if (captureRenderError(errorBoundary, error)) {
							setMountedNodes([]);
							return;
						}
						const errorNode = createRenderErrorNode(error);
						insertAfterAnchor(anchor, [errorNode]);
						setMountedNodes([errorNode]);
						return;
					}

					if (
						patchMountedValue(previousValue, value as EffuseChild, currentNodes)
					) {
						previousValue = value as EffuseChild;
						return;
					}

					clearMountedValue();
					mountResolvedValue(value);
				};

				if (provideScope) {
					runWithProvideScope(provideScope, update);
				} else {
					update();
				}
			})
		);
	};

	// Hydration claims nodes in document order, so the first evaluation has to
	// happen now — deferring it to a microtask would let later siblings claim
	// this value's markup.
	if (hydrationCursor) {
		runEffect();
	} else {
		queueDynamicMount(runEffect);
	}

	cleanups.push(() => {
		active = false;
		if (Predicate.isNotNullable(effectHandle)) {
			effectHandle.stop();
		}
		dynamicMountRecords.delete(anchor);
		blueprintMountRecords.delete(anchor);
		clearMountedValue();
	});

	return Effect.succeed([anchor]);
};

const mountChild = (
	child: EffuseChild,
	cleanups: CleanupFn[],
	cursor?: HydrationCursor,
	errorBoundary?: RenderErrorBoundary,
	namespace: DOMNamespace = 'html'
): Effect.Effect<Node[], never, PropService | EventService> => {
	// While hydrating, every DOM decision must happen at execution time so
	// siblings claim server nodes in document order. Suspending defers the
	// eager branches below (text nodes, blueprint instantiation) accordingly.
	if (cursor) {
		return Effect.suspend(() =>
			mountChildInner(child, cleanups, cursor, errorBoundary, namespace)
		);
	}
	return mountChildInner(child, cleanups, undefined, errorBoundary, namespace);
};

const mountChildInner = (
	child: EffuseChild,
	cleanups: CleanupFn[],
	cursor: HydrationCursor | undefined,
	errorBoundary: RenderErrorBoundary | undefined,
	namespace: DOMNamespace
): Effect.Effect<Node[], never, PropService | EventService> => {
	if (child == null) {
		return Effect.succeed([]);
	}

	if (Predicate.isString(child) || Predicate.isNumber(child)) {
		const textNode = cursor
			? claimText(cursor, String(child))
			: document.createTextNode(String(child));
		return Effect.succeed([textNode]);
	}

	if (Predicate.isBoolean(child)) {
		return Effect.succeed([]);
	}

	if (Predicate.isFunction(child)) {
		const fn = child as () => unknown;
		return mountDynamicValue(
			'fn',
			fn,
			cleanups,
			undefined,
			undefined,
			cursor,
			errorBoundary,
			namespace
		);
	}

	if (isSignal(child)) {
		const sig = child as Signal<EffuseChild>;
		return mountDynamicValue(
			'signal',
			() => sig.value,
			cleanups,
			undefined,
			undefined,
			cursor,
			errorBoundary,
			namespace
		);
	}

	if (Array.isArray(child)) {
		return pipe(
			Effect.all(
				child.map((c: EffuseChild) =>
					mountChild(c, cleanups, cursor, errorBoundary, namespace)
				)
			),
			Effect.map((results) => results.flat())
		);
	}

	if (isEffuseNode(child)) {
		return mountNode(child, cleanups, cursor, errorBoundary, namespace);
	}

	return Effect.succeed([]);
};

const mountNode = (
	node: EffuseNode,
	cleanups: CleanupFn[],
	cursor?: HydrationCursor,
	errorBoundary?: RenderErrorBoundary,
	namespace: DOMNamespace = 'html'
): Effect.Effect<Node[], never, PropService | EventService> => {
	switch (node._tag) {
		case 'Text': {
			const domNode = cursor
				? claimText(cursor, node.text)
				: document.createTextNode(node.text);
			return Effect.succeed([domNode]);
		}
		case 'Element': {
			const tag = node.tag;
			const props = node.props;
			const children = node.children;
			const elementNamespace = getElementNamespace(namespace, tag);
			const childNamespace = getChildNamespace(elementNamespace, tag);

			return pipe(
				Effect.Do,
				Effect.bind('propService', () => PropService),
				Effect.bind('eventService', () => EventService),
				Effect.flatMap(({ propService, eventService }) => {
					const element = cursor
						? claimElement(cursor, tag, elementNamespace)
						: createDOMElement(document, tag, elementNamespace);
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
							bindingCleanups.push(() => clearElementEvents(element));
							cleanups.push(() => {
								runCleanups(bindingCleanups);
							});
							return element;
						}),
						Effect.flatMap(() => {
							// Hydration walks the element's own children in place; a
							// created element simply has none to claim, so the same code
							// path inserts a fresh subtree.
							const childCursor = cursor
								? createHydrationCursor(element)
								: undefined;

							return pipe(
								Effect.all(
									children.map((c) =>
										mountChild(
											c,
											cleanups,
											childCursor,
											errorBoundary,
											childNamespace
										)
									)
								),
								Effect.map((results) => {
									if (childCursor) {
										dropUnclaimed(childCursor);
										return [element] as Node[];
									}
									for (const childNode of results.flat()) {
										element.appendChild(childNode);
									}
									return [element] as Node[];
								})
							);
						})
					);
				})
			);
		}
		case 'Fragment': {
			return pipe(
				Effect.all(
					node.children.map((c) =>
						mountChild(c, cleanups, cursor, errorBoundary, namespace)
					)
				),
				Effect.map((results) => results.flat())
			);
		}
		case 'List': {
			const anchor = document.createComment('list');
			const runWithCapturedIdScope = captureIdScope();
			const controller = getErrorBoundaryController(node);
			const ownedBoundary = controller
				? { controller, parent: errorBoundary, active: false }
				: undefined;
			let currentNodes: Node[] = [];
			const listCleanups: CleanupFn[] = [];
			let effectHandle: { stop: () => void } | null = null;
			// The deferred mount below can outlive this node: cleanup may run
			// before the microtask, leaving nothing for it to stop.
			let active = true;

			if (cursor) {
				insertAtCursor(cursor, anchor);
			}
			let pendingCursor = cursor;

			const runEffect = () => {
				if (!active) return;
				effectHandle = watchEffect(() =>
					runWithCapturedIdScope(() => {
						let retryBoundary = true;
						const listCursor = pendingCursor;
						pendingCursor = undefined;

						for (const n of currentNodes) {
							if (Predicate.isNotNullable(n.parentNode)) {
								n.parentNode.removeChild(n);
							}
						}
						try {
							runCleanups(listCleanups);
						} finally {
							listCleanups.length = 0;
						}

						while (retryBoundary) {
							retryBoundary = false;
							const childBoundary =
								ownedBoundary && !ownedBoundary.controller.hasError()
									? ownedBoundary
									: errorBoundary;
							if (ownedBoundary) {
								ownedBoundary.active = childBoundary === ownedBoundary;
							}
							const childCleanups: CleanupFn[] = [];
							try {
								const children = node.children;
								if (children.length === 0) {
									currentNodes = [];
									return;
								}
								const mountResult = Effect.runSync(
										pipe(
											Effect.all(
												children.map((c) =>
													mountChild(
														c,
														childCleanups,
														listCursor,
														childBoundary,
														namespace
													)
												)
											),
										Effect.map((results) => results.flat()),
										Effect.provide(PropServiceLive),
										Effect.provide(EventServiceLive),
										mapEffuseErrors
									)
								);

								if (
									ownedBoundary &&
									childBoundary === ownedBoundary &&
									ownedBoundary.controller.hasError()
								) {
									runCleanups(childCleanups);
									removeNodes(mountResult);
									retryBoundary = true;
									continue;
								}

								if (!listCursor) {
									const insertPoint: Node | null = anchor.nextSibling;
									for (const n of mountResult) {
										if (anchor.parentNode) {
											anchor.parentNode.insertBefore(n, insertPoint);
										}
									}
								}
								currentNodes = mountResult;
								listCleanups.push(...childCleanups);
							} catch (error) {
								runCleanups(childCleanups);
								currentNodes = [];
								if (captureRenderError(childBoundary, error)) {
									if (
										ownedBoundary &&
										childBoundary === ownedBoundary &&
										ownedBoundary.controller.hasError()
									) {
										retryBoundary = true;
										continue;
									}
									return;
								}

								const errorNode = createRenderErrorNode(error);
								insertAfterAnchor(anchor, [errorNode]);
								currentNodes = [errorNode];
							} finally {
								if (ownedBoundary) ownedBoundary.active = false;
							}
						}
					})
				);
			};

			// Same ordering constraint as dynamic values: claims must land before
			// the next sibling is walked.
			if (cursor) {
				runEffect();
			} else {
				queueMicrotask(runEffect);
			}

			cleanups.push(() => {
				active = false;
				if (Predicate.isNotNullable(effectHandle)) {
					effectHandle.stop();
				}
				try {
					runCleanups(listCleanups);
				} finally {
					removeNodes(currentNodes);
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
				updateProps?: (props: Record<string, unknown>) => void;
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
			const hmrId = (node.blueprint as unknown as Record<string, unknown>)
				.__hmrId as string | undefined;

			return mountDynamicValue(
				'',
				childView,
				cleanups,
				(mountedNodes, anchor) => {
					if (Predicate.isFunction(stateWithLifecycle.updateProps)) {
						blueprintMountRecords.set(anchor, {
							blueprint: node,
							updateProps: stateWithLifecycle.updateProps,
						});
					}

					if (!hmrId) return;

					const parent = anchor.parentNode as Element | null;
					if (!parent) return;

					const instanceCleanup = registerComponent(
						hmrId,
						node.blueprint,
						node.props,
						mountedNodes,
						() => {
							runCleanups(cleanups);
						},
						parent,
						anchor
					);
					cleanups.push(instanceCleanup);
				},
				provideScope,
				cursor,
				errorBoundary,
				namespace
			);
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

const createMountedNode = (
	nodes: Node[],
	cleanups: CleanupFn[]
): MountedNode => ({
	nodes,
	cleanup: () => {
		try {
			runCleanups(cleanups);
		} finally {
			for (const nodeItem of nodes) {
				if (Predicate.isNotNullable(nodeItem.parentNode)) {
					nodeItem.parentNode.removeChild(nodeItem);
				}
			}
		}
	},
});

export const MountServiceLive = Layer.succeed(MountService, {
	mount: (child: EffuseChild, container: Element) =>
		pipe(
			Effect.sync(() => {
				const cleanups: CleanupFn[] = [];
				return { cleanups };
			}),
			Effect.flatMap(({ cleanups }) =>
				pipe(
					mountChild(
						child,
						cleanups,
						undefined,
						undefined,
						getDOMNamespace(container.namespaceURI)
					),
					Effect.map((nodes) => {
						for (const nodeItem of nodes) {
							container.appendChild(nodeItem);
						}
						return createMountedNode(nodes, cleanups);
					})
				)
			)
		),

	hydrate: (child: EffuseChild, container: Element) =>
		pipe(
			Effect.sync(() => ({
				cleanups: [] as CleanupFn[],
				cursor: createHydrationCursor(container),
			})),
			Effect.flatMap(({ cleanups, cursor }) =>
				pipe(
					mountChild(
						child,
						cleanups,
						cursor,
						undefined,
						getDOMNamespace(container.namespaceURI)
					),
					Effect.map((nodes) => {
						// Whatever the client render never claimed was rendered by a
						// stale or divergent server pass; it must not survive.
						dropUnclaimed(cursor);
						return createMountedNode(nodes, cleanups);
					})
				)
			)
		),

	unmount: (mounted: MountedNode) =>
		Effect.sync(() => {
			mounted.cleanup();
		}),
});
