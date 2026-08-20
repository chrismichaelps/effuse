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

/** One change between two snapshots. */
export type PatchOperation =
	| {
			readonly op: 'set';
			readonly path: readonly (string | number)[];
			readonly value: unknown;
	  }
	| { readonly op: 'remove'; readonly path: readonly (string | number)[] };

const isObject = (value: unknown): value is Record<string, unknown> =>
	typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Describe what changed between two values.
 *
 * Only the leaves that moved are reported, so a snapshot that changed one
 * score in a list of players is a handful of bytes rather than the whole
 * board. A value that changed shape - an object where a list used to be - is
 * replaced whole, since describing that in parts would say less for more.
 */
export const diffValues = (
	previous: unknown,
	next: unknown,
	path: readonly (string | number)[] = []
): readonly PatchOperation[] => {
	if (Object.is(previous, next)) return [];

	if (Array.isArray(previous) && Array.isArray(next)) {
		const operations: PatchOperation[] = [];

		for (const [index, item] of next.entries()) {
			operations.push(...diffValues(previous[index], item, [...path, index]));
		}
		for (let index = next.length; index < previous.length; index += 1) {
			operations.push({ op: 'remove', path: [...path, index] });
		}

		return operations;
	}

	if (isObject(previous) && isObject(next)) {
		const operations: PatchOperation[] = [];

		for (const [key, value] of Object.entries(next)) {
			operations.push(...diffValues(previous[key], value, [...path, key]));
		}
		for (const key of Object.keys(previous)) {
			if (key in next) continue;
			operations.push({ op: 'remove', path: [...path, key] });
		}

		return operations;
	}

	return [{ op: 'set', path, value: next }];
};

const cloneStep = (value: unknown): unknown =>
	Array.isArray(value) ? [...value] : isObject(value) ? { ...value } : value;

/**
 * Apply a patch, handing back a new value.
 *
 * What it was given is left alone, so a client can keep the snapshot it had
 * until it decides to move on.
 */
export const applyPatch = (
	value: unknown,
	operations: readonly PatchOperation[]
): unknown => {
	// Each step copies the container it writes into, so the value handed in is
	// never touched, and an empty patch hands it straight back.
	let current = value;

	for (const operation of operations) {
		current = write(current, operation.path, operation);
	}

	return current;
};

const write = (
	target: unknown,
	path: readonly (string | number)[],
	operation: PatchOperation
): unknown => {
	const [head, ...rest] = path;
	if (head === undefined) {
		return operation.op === 'set' ? operation.value : undefined;
	}

	const container = cloneStep(target);

	if (Array.isArray(container) && typeof head === 'number') {
		if (rest.length === 0 && operation.op === 'remove') {
			return container.slice(0, head);
		}
		container[head] = write(container[head], rest, operation);
		return container;
	}

	if (isObject(container)) {
		if (rest.length === 0 && operation.op === 'remove') {
			const kept = { ...container };
			delete kept[String(head)];
			return kept;
		}
		return {
			...container,
			[String(head)]: write(container[String(head)], rest, operation),
		};
	}

	// Nothing there to write into: build what the path asks for.
	if (typeof head === 'number') {
		const built: unknown[] = [];
		built[head] = write(undefined, rest, operation);
		return built;
	}
	return { [String(head)]: write(undefined, rest, operation) };
};
