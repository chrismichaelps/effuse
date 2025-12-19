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

import type { Store } from '../core/types.js';

// Scope identifier
export type ScopeId = string;

// Scope tree node
export interface ScopeNode {
	id: ScopeId;
	parent: ScopeNode | null;
	stores: Map<string, Store<unknown>>;
}

const ROOT_SCOPE: ScopeNode = {
	id: '__root__',
	parent: null,
	stores: new Map(),
};

let currentScope: ScopeNode = ROOT_SCOPE;
const scopeRegistry = new Map<ScopeId, ScopeNode>([
	[ROOT_SCOPE.id, ROOT_SCOPE],
]);
let scopeCounter = 0;

// Initialize child scope
export const createScope = (parentScope?: ScopeNode): ScopeNode => {
	scopeCounter++;
	const id = `scope_${String(scopeCounter)}`;
	const node: ScopeNode = {
		id,
		parent: parentScope ?? currentScope,
		stores: new Map(),
	};
	scopeRegistry.set(id, node);
	return node;
};

// Dispose scope
export const disposeScope = (scope: ScopeNode): void => {
	scope.stores.clear();
	scopeRegistry.delete(scope.id);
};

// Activate scope
export const enterScope = (scope: ScopeNode): void => {
	currentScope = scope;
};

// Exit active scope
export const exitScope = (): void => {
	if (currentScope.parent) {
		currentScope = currentScope.parent;
	}
};

// Current scope access
export const getCurrentScope = (): ScopeNode => currentScope;

// Root scope access
export const getRootScope = (): ScopeNode => ROOT_SCOPE;

// Register store in scope
export const registerScopedStore = <T>(
	name: string,
	store: Store<T>,
	scope: ScopeNode = currentScope
): void => {
	scope.stores.set(name, store as Store<unknown>);
};

// Find store in scope hierarchy
export const getScopedStore = <T>(
	name: string,
	scope: ScopeNode = currentScope
): Store<T> | null => {
	let current: ScopeNode | null = scope;
	while (current) {
		const store = current.stores.get(name);
		if (store) return store as Store<T>;
		current = current.parent;
	}
	return null;
};

// Scope store detection
export const hasScopedStore = (
	name: string,
	scope: ScopeNode = currentScope
): boolean => {
	return getScopedStore(name, scope) !== null;
};

// Execute in scope
export const runInScope = <R>(scope: ScopeNode, fn: () => R): R => {
	const prev = currentScope;
	currentScope = scope;
	try {
		return fn();
	} finally {
		currentScope = prev;
	}
};

// Execute in transient scope
export const withScope = <R>(fn: (scope: ScopeNode) => R): R => {
	const scope = createScope();
	try {
		return runInScope(scope, () => fn(scope));
	} finally {
		disposeScope(scope);
	}
};
