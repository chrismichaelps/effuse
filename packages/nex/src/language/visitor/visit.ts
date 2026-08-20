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

import type { ASTNode } from '../ast/index.js';
import { visitorKeys } from './keys.js';

/** Returned from a visitor to leave a node's children unvisited. */
export const SKIP: unique symbol = Symbol('nex.skip');
/** Returned from a visitor to stop the walk. */
export const BREAK: unique symbol = Symbol('nex.break');

/** Where a node sits: the keys walked to reach it from the root. */
export type VisitorPath = readonly (string | number)[];

/**
 * What a visitor may hand back.
 *
 * Nothing leaves the node alone, `SKIP` keeps the walk out of its children,
 * `BREAK` ends the walk, `null` removes the node, and a node replaces it.
 */
export type VisitorResult<TNode> =
	| void
	| undefined
	| typeof SKIP
	| typeof BREAK
	| null
	| TNode;

export type VisitFn<TNode = ASTNode> = (
	node: TNode,
	key: string | number | undefined,
	parent: ASTNode | readonly ASTNode[] | undefined,
	path: VisitorPath
) => VisitorResult<TNode>;

/** A pair of handlers for one kind, or for every node. */
export interface EnterLeaveVisitor<TNode = ASTNode> {
	readonly enter?: VisitFn<TNode>;
	readonly leave?: VisitFn<TNode>;
}

/**
 * Handlers by node kind, plus `enter` and `leave` for every node.
 *
 * A kind's handler wins over the general one, which is what makes a visitor
 * for one kind read as a one-liner.
 */
/** The node a kind stands for. */
export type NodeOfKind<TKind extends ASTNode['kind']> = Extract<
	ASTNode,
	{ readonly kind: TKind }
>;

/**
 * Handlers by node kind, plus ones for every node.
 *
 * Each kind is handed the node that kind is, rather than the whole union: a
 * visitor keyed by `Field` already said which node it wants, and making the
 * caller narrow it again is asking twice.
 */
export type Visitor = EnterLeaveVisitor & {
	readonly [TKind in ASTNode['kind']]?:
		| VisitFn<NodeOfKind<TKind>>
		| EnterLeaveVisitor<NodeOfKind<TKind>>
		| undefined;
};

/**
 * Reading a handler off a visitor that is keyed by kind.
 *
 * The visitor a caller writes says which node each handler takes; walking it
 * happens over the union, and this is the one place those two views meet.
 */
type HandlerLookup = Readonly<
	Record<string, VisitFn | EnterLeaveVisitor | undefined>
>;

const handlerFor = (
	visitor: Visitor,
	kind: string,
	phase: 'enter' | 'leave'
): VisitFn | undefined => {
	const specific = (visitor as HandlerLookup)[kind];

	if (typeof specific === 'function') {
		return phase === 'enter' ? specific : undefined;
	}
	if (specific !== undefined) {
		return specific[phase];
	}

	const general = visitor[phase];
	return typeof general === 'function' ? general : undefined;
};

const isNode = (value: unknown): value is ASTNode =>
	typeof value === 'object' &&
	value !== null &&
	typeof (value as { kind?: unknown }).kind === 'string';

/**
 * Walk a document, and optionally rewrite it on the way.
 *
 * The walk never touches what it was given: a visitor that replaces or removes
 * nodes gets a new tree back, and the original is still there to compare
 * against. Depth is bounded by what the parser will accept, so a document that
 * parsed can always be walked.
 */
export const visit = <TNode extends ASTNode>(
	root: TNode,
	visitor: Visitor
): TNode => {
	let stopped = false;

	const walk = (
		node: ASTNode,
		key: string | number | undefined,
		parent: ASTNode | readonly ASTNode[] | undefined,
		path: VisitorPath
	): ASTNode | null => {
		if (stopped) return node;

		const enter = handlerFor(visitor, node.kind, 'enter');
		let current = node;

		if (enter !== undefined) {
			const result = enter(current, key, parent, path);

			if (result === BREAK) {
				stopped = true;
				return current;
			}
			if (result === SKIP) return current;
			if (result === null) return null;
			if (isNode(result)) current = result;
		}

		const edits: [string, unknown][] = [];

		for (const childKey of visitorKeys[current.kind] ?? []) {
			const child = (current as unknown as Record<string, unknown>)[childKey];
			if (child === undefined || child === null) continue;

			if (Array.isArray(child)) {
				const kept: ASTNode[] = [];
				let changed = false;

				for (const [index, item] of child.entries()) {
					if (!isNode(item)) {
						kept.push(item as ASTNode);
						continue;
					}

					const walked = walk(item, index, current, [...path, childKey, index]);
					if (walked === null) {
						changed = true;
						continue;
					}
					if (walked !== item) changed = true;
					kept.push(walked);
					if (stopped) break;
				}

				if (changed) edits.push([childKey, kept]);
				if (stopped) break;
				continue;
			}

			if (!isNode(child)) continue;

			const walked = walk(child, childKey, current, [...path, childKey]);
			if (walked === null) edits.push([childKey, undefined]);
			else if (walked !== child) edits.push([childKey, walked]);
			if (stopped) break;
		}

		if (edits.length > 0) {
			const next = { ...current } as Record<string, unknown>;
			for (const [childKey, value] of edits) {
				if (value === undefined) delete next[childKey];
				else next[childKey] = value;
			}
			current = next as unknown as ASTNode;
		}

		if (stopped) return current;

		const leave = handlerFor(visitor, current.kind, 'leave');
		if (leave !== undefined) {
			const result = leave(current, key, parent, path);

			if (result === BREAK) {
				stopped = true;
				return current;
			}
			if (result === null) return null;
			if (isNode(result)) return result;
		}

		return current;
	};

	const walked = walk(root, undefined, undefined, []);
	return (walked ?? root) as TNode;
};
