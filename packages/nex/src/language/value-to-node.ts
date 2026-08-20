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

import type { Catalog } from '../catalog/index.js';
import { NexSyntaxError } from '../errors/index.js';
import type { ObjectFieldNode, ValueNode } from './ast/index.js';
import { Kind } from './kinds/index.js';
import { namedTypeOf } from '../validation/type-utils.js';

/** What the catalog says a value is for, when a caller knows. */
export interface ValueToNodeOptions {
	readonly catalog?: Catalog | undefined;
	/** The type the value is written for, so an enum is written as one. */
	readonly typeName?: string | undefined;
}

const refuse = (value: unknown): never => {
	throw new NexSyntaxError({
		message: `This value cannot be written as a Nex value: ${
			typeof value === 'function'
				? 'a function'
				: (JSON.stringify(value) ?? String(value))
		}`,
		location: { start: 0, line: 1, column: 1 },
	});
};

const isEnumMember = (options: ValueToNodeOptions, value: string): boolean => {
	if (options.catalog === undefined || options.typeName === undefined) {
		return false;
	}

	const definition = options.catalog.getType(options.typeName);
	return (
		definition?.kind === Kind.ENUM_TYPE_DEFINITION &&
		(definition.values ?? []).some((member) => member.name.value === value)
	);
};

/** What an input field of `typeName` is typed as, when the catalog knows. */
const fieldTypeName = (
	options: ValueToNodeOptions,
	field: string
): string | undefined => {
	if (options.catalog === undefined || options.typeName === undefined) {
		return undefined;
	}

	const definition = options.catalog.getType(options.typeName);
	if (definition?.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) return undefined;

	const declared = definition.fields?.find(
		(candidate) => candidate.name.value === field
	);
	return declared === undefined ? undefined : namedTypeOf(declared.type);
};

/**
 * Write a value as the node a request would carry.
 *
 * Reading a document into values is half the job; writing values back is what
 * lets a tool build a request, fill in a default, or record what was sent.
 * Told what the catalog expects, an enum is written as an enum rather than a
 * string, which is the one distinction a value cannot make on its own.
 *
 * @throws {NexSyntaxError} when the value is not something a request can hold.
 */
export const valueToNode = (
	value: unknown,
	options: ValueToNodeOptions = {}
): ValueNode => {
	if (value === null || value === undefined) return { kind: Kind.NULL };

	if (typeof value === 'boolean') return { kind: Kind.BOOLEAN, value };

	if (typeof value === 'number') {
		if (!Number.isFinite(value)) return refuse(value);
		return Number.isInteger(value)
			? { kind: Kind.INT, value: String(value) }
			: { kind: Kind.FLOAT, value: String(value) };
	}

	if (typeof value === 'string') {
		return isEnumMember(options, value)
			? { kind: Kind.ENUM, value }
			: { kind: Kind.STRING, value };
	}

	if (value instanceof Date) {
		return { kind: Kind.STRING, value: value.toISOString() };
	}

	if (Array.isArray(value)) {
		return {
			kind: Kind.LIST,
			values: value.map((item) => valueToNode(item, options)),
		};
	}

	if (typeof value === 'object') {
		const fields: ObjectFieldNode[] = Object.entries(
			value as Record<string, unknown>
		).map(([name, entry]) => ({
			kind: Kind.OBJECT_FIELD,
			name: { kind: Kind.NAME, value: name },
			value: valueToNode(entry, {
				...options,
				...(fieldTypeName(options, name) === undefined
					? { typeName: undefined }
					: { typeName: fieldTypeName(options, name) }),
			}),
		}));

		return { kind: Kind.OBJECT, fields };
	}

	return refuse(value);
};
