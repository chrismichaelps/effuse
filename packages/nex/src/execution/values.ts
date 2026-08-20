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

import type { NexScalars } from './scalars.js';
import { BUILT_IN_SCALARS, type Catalog } from '../catalog/index.js';
import type {
	ArgumentNode,
	FieldDefinitionNode,
	InputValueDefinitionNode,
	OperationDefinitionNode,
	TypeNode,
	ValueNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { displayType } from '../validation/type-utils.js';

/** Turn a literal from the request into the value a resolver will see. */
export const valueFromNode = (
	node: ValueNode,
	variables: Readonly<Record<string, unknown>>
): unknown => {
	switch (node.kind) {
		case Kind.VARIABLE:
			return variables[node.name.value];
		case Kind.INT:
			return Number.parseInt(node.value, 10);
		case Kind.FLOAT:
			return Number.parseFloat(node.value);
		case Kind.STRING:
		case Kind.ENUM:
			return node.value;
		case Kind.BOOLEAN:
			return node.value;
		case Kind.NULL:
			return null;
		case Kind.LIST:
			return node.values.map((item) => valueFromNode(item, variables));
		case Kind.OBJECT:
			return node.fields.reduce<Record<string, unknown>>(
				(object, field) => {
					object[field.name.value] = valueFromNode(field.value, variables);
					return object;
				},
				Object.create(null) as Record<string, unknown>
			);
	}
};

const isInteger = (value: unknown): boolean =>
	typeof value === 'number' && Number.isInteger(value);

/**
 * Check and convert an incoming value against the type declared for it.
 *
 * Returns the value to use, or the problems that stopped it being usable.
 */
export const coerceInputValue = (
	catalog: Catalog,
	value: unknown,
	type: TypeNode,
	subject: string,
	scalars: NexScalars = {}
): { readonly value: unknown } | { readonly errors: readonly string[] } => {
	if (type.kind === Kind.NON_NULL_TYPE) {
		if (value === null || value === undefined) {
			return {
				errors: [`${subject} of type "${displayType(type)}" cannot be null`],
			};
		}
		return coerceInputValue(catalog, value, type.type, subject, scalars);
	}

	if (value === null || value === undefined) return { value: null };

	if (type.kind === Kind.OPTIONAL_TYPE) {
		return coerceInputValue(catalog, value, type.type, subject, scalars);
	}

	if (type.kind === Kind.LIST_TYPE) {
		const items = Array.isArray(value) ? value : [value];
		const coerced: unknown[] = [];
		const errors: string[] = [];

		for (const item of items) {
			const result = coerceInputValue(
				catalog,
				item,
				type.type,
				subject,
				scalars
			);
			if ('errors' in result) errors.push(...result.errors);
			else coerced.push(result.value);
		}

		return errors.length > 0 ? { errors } : { value: coerced };
	}

	const typeName = type.name.value;
	const definition = catalog.getType(typeName);

	if (definition?.kind === Kind.ENUM_TYPE_DEFINITION) {
		const members = new Set(
			(definition.values ?? []).map((member) => member.name.value)
		);
		return typeof value === 'string' && members.has(value)
			? { value }
			: {
					errors: [
						`${subject} of enum "${typeName}" cannot be ${JSON.stringify(value)}`,
					],
				};
	}

	if (definition?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
		if (typeof value !== 'object' || Array.isArray(value)) {
			return {
				errors: [`${subject} of type "${typeName}" must be an object`],
			};
		}

		const source = value as Record<string, unknown>;
		// Built without a prototype: an input object carries whatever keys the
		// client sent, and `__proto__` is one a client may send.
		const fields = Object.create(null) as Record<string, unknown>;
		const errors: string[] = [];
		const declared = new Map<string, InputValueDefinitionNode>(
			(definition.fields ?? []).map((field) => [field.name.value, field])
		);

		for (const key of Object.keys(source)) {
			if (declared.has(key)) continue;
			errors.push(`Unknown field "${key}" on input type "${typeName}"`);
		}

		for (const [key, field] of declared) {
			const supplied = source[key];

			if (supplied === undefined) {
				if (field.defaultValue !== undefined) {
					fields[key] = valueFromNode(field.defaultValue, {});
					continue;
				}
				if (field.type.kind === Kind.NON_NULL_TYPE) {
					errors.push(`Field "${key}" of input type "${typeName}" is required`);
				}
				continue;
			}

			const result = coerceInputValue(
				catalog,
				supplied,
				field.type,
				`Field "${key}"`,
				scalars
			);
			if ('errors' in result) errors.push(...result.errors);
			else fields[key] = result.value;
		}

		return errors.length > 0 ? { errors } : { value: fields };
	}

	if (!BUILT_IN_SCALARS.has(typeName)) {
		const scalar = scalars[typeName];
		if (scalar === undefined) return { value };

		// The server said what one of these is, so it decides whether this is
		// one - and what it says becomes the reason a caller is given.
		try {
			return { value: scalar.parse(value) };
		} catch (cause) {
			return {
				errors: [
					`${subject} of type "${typeName}" cannot be read: ${
						cause instanceof Error ? cause.message : String(cause)
					}`,
				],
			};
		}
	}

	const accepted =
		(typeName === 'Int' && isInteger(value)) ||
		(typeName === 'Float' && typeof value === 'number') ||
		(typeName === 'Boolean' && typeof value === 'boolean') ||
		(typeName === 'String' && typeof value === 'string') ||
		(typeName === 'DateTime' &&
			(typeof value === 'string' || value instanceof Date)) ||
		(typeName === 'ID' && (typeof value === 'string' || isInteger(value)));

	return accepted
		? { value: typeName === 'ID' ? String(value) : value }
		: {
				errors: [
					`${subject} of type "${typeName}" cannot be ${JSON.stringify(value)}`,
				],
			};
};

/** Coerce the variables an operation declares against the values supplied. */
export const coerceVariableValues = (
	catalog: Catalog,
	operation: OperationDefinitionNode,
	supplied: Readonly<Record<string, unknown>>,
	scalars: NexScalars = {}
):
	| { readonly variables: Readonly<Record<string, unknown>> }
	| { readonly errors: readonly string[] } => {
	const variables = Object.create(null) as Record<string, unknown>;
	const errors: string[] = [];

	for (const definition of operation.variableDefinitions ?? []) {
		const name = definition.variable.name.value;
		const value = supplied[name];

		if (value === undefined) {
			if (definition.defaultValue !== undefined) {
				variables[name] = valueFromNode(definition.defaultValue, {});
				continue;
			}
			if (definition.type.kind === Kind.NON_NULL_TYPE) {
				errors.push(
					`Variable "$${name}" of required type "${displayType(definition.type)}" was not provided`
				);
			}
			continue;
		}

		const result = coerceInputValue(
			catalog,
			value,
			definition.type,
			`Variable "$${name}"`,
			scalars
		);
		if ('errors' in result) errors.push(...result.errors);
		else variables[name] = result.value;
	}

	return errors.length > 0 ? { errors } : { variables };
};

/** Build the argument object a resolver is called with. */
/**
 * Whether a value written in a request leans on a variable anywhere inside it.
 *
 * A variable has already been read by the time an argument is built, so
 * reading it a second time would hand a scalar what it produced rather than
 * what a caller wrote. Only a value written out in full is read here.
 */
const isWrittenOut = (node: ValueNode): boolean => {
	if (node.kind === Kind.VARIABLE) return false;
	if (node.kind === Kind.LIST) return node.values.every(isWrittenOut);
	if (node.kind === Kind.OBJECT) {
		return node.fields.every((field) => isWrittenOut(field.value));
	}
	return true;
};

export const coerceArgumentValues = (
	definition: FieldDefinitionNode,
	provided: readonly ArgumentNode[] | undefined,
	variables: Readonly<Record<string, unknown>>,
	catalog?: Catalog,
	scalars: NexScalars = {}
): Readonly<Record<string, unknown>> => {
	const written = new Map<string, ArgumentNode>(
		(provided ?? []).map((argument) => [argument.name.value, argument])
	);
	const args = Object.create(null) as Record<string, unknown>;

	for (const declared of definition.arguments ?? []) {
		const name = declared.name.value;
		const argument = written.get(name);

		if (argument === undefined) {
			if (declared.defaultValue !== undefined) {
				args[name] = valueFromNode(declared.defaultValue, variables);
			}
			continue;
		}

		if (
			argument.value.kind === Kind.VARIABLE &&
			!(argument.value.name.value in variables)
		) {
			if (declared.defaultValue !== undefined) {
				args[name] = valueFromNode(declared.defaultValue, variables);
			}
			continue;
		}

		const value = valueFromNode(argument.value, variables);

		// A value written out in the request has not been read yet, so this is
		// where a scalar the server defined gets to say what it is.
		if (catalog !== undefined && isWrittenOut(argument.value)) {
			const read = coerceInputValue(
				catalog,
				value,
				declared.type,
				`Argument "${name}"`,
				scalars
			);

			if ('errors' in read) {
				throw new Error(read.errors[0] ?? `Argument "${name}" cannot be read`);
			}

			args[name] = read.value;
			continue;
		}

		args[name] = value;
	}

	return args;
};
