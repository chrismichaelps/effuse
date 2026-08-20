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

import type {
	InputValueDefinitionNode,
	TypeNode,
	ValueNode,
} from '../../language/ast/index.js';
import { Kind } from '../../language/kinds/index.js';
import type { ValidationContext } from '../context.js';
import { displayType, isAssignable, namedTypeOf } from '../type-utils.js';

/** Scalar literals each built-in scalar accepts. */
const SCALAR_LITERALS: Readonly<Record<string, readonly string[]>> = {
	Int: [Kind.INT],
	Float: [Kind.INT, Kind.FLOAT],
	String: [Kind.STRING],
	Boolean: [Kind.BOOLEAN],
	ID: [Kind.STRING, Kind.INT],
	DateTime: [Kind.STRING],
};

/** Describe a literal for an error message. */
export const displayValue = (value: ValueNode): string => {
	switch (value.kind) {
		case Kind.VARIABLE:
			return `$${value.name.value}`;
		case Kind.INT:
		case Kind.FLOAT:
			return value.value;
		case Kind.STRING:
			return JSON.stringify(value.value);
		case Kind.BOOLEAN:
			return value.value ? 'true' : 'false';
		case Kind.NULL:
			return 'null';
		case Kind.ENUM:
			return value.value;
		case Kind.LIST:
			return `[${value.values.map(displayValue).join(', ')}]`;
		case Kind.OBJECT:
			return `{${value.fields
				.map((field) => `${field.name.value}: ${displayValue(field.value)}`)
				.join(', ')}}`;
	}
};

/** Whether a literal is an integer, directly or through an Int variable. */
export const isIntegerValue = (
	context: ValidationContext,
	value: ValueNode
): boolean => {
	if (value.kind === Kind.INT) return true;
	if (value.kind !== Kind.VARIABLE) return false;

	const declared = context.variables.get(value.name.value);
	return declared === undefined ? false : namedTypeOf(declared.type) === 'Int';
};

const checkInputObject = (
	context: ValidationContext,
	value: ValueNode,
	typeName: string,
	subject: string
): void => {
	const definition = context.catalog.getType(typeName);
	if (definition?.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) return;

	if (value.kind !== Kind.OBJECT) {
		context.report(
			`${subject} of type "${typeName}" cannot be ${displayValue(value)}`,
			value
		);
		return;
	}

	const fields = definition.fields ?? [];
	const byName = new Map<string, InputValueDefinitionNode>(
		fields.map((field) => [field.name.value, field])
	);
	const provided = new Set<string>();

	for (const field of value.fields) {
		const fieldName = field.name.value;
		const declared = byName.get(fieldName);

		if (declared === undefined) {
			context.report(
				`Unknown field "${fieldName}" on input type "${typeName}"`,
				field
			);
			continue;
		}
		if (provided.has(fieldName)) {
			context.report(
				`Field "${fieldName}" of input type "${typeName}" is provided more than once`,
				field
			);
			continue;
		}

		provided.add(fieldName);
		checkValue(context, field.value, declared.type, `Field "${fieldName}"`);
	}

	for (const field of fields) {
		const isRequired =
			field.type.kind === Kind.NON_NULL_TYPE &&
			field.defaultValue === undefined;
		if (isRequired && !provided.has(field.name.value)) {
			context.report(
				`Field "${field.name.value}" of input type "${typeName}" is required`,
				value
			);
		}
	}
};

/**
 * Check a literal against the type declared for the place it was written.
 *
 * `subject` names that place, for example `argument "id"`.
 */
export const checkValue = (
	context: ValidationContext,
	value: ValueNode,
	type: TypeNode,
	subject: string
): void => {
	if (value.kind === Kind.VARIABLE) {
		context.recordVariableUsage(value, type, subject);
		return;
	}

	if (type.kind === Kind.NON_NULL_TYPE) {
		if (value.kind === Kind.NULL) {
			context.report(
				`${subject} of type "${displayType(type)}" cannot be null`,
				value
			);
			return;
		}
		checkValue(context, value, type.type, subject);
		return;
	}

	if (value.kind === Kind.NULL) return;

	if (type.kind === Kind.OPTIONAL_TYPE) {
		checkValue(context, value, type.type, subject);
		return;
	}

	if (type.kind === Kind.LIST_TYPE) {
		if (value.kind === Kind.LIST) {
			for (const item of value.values)
				checkValue(context, item, type.type, subject);
			return;
		}
		checkValue(context, value, type.type, subject);
		return;
	}

	const typeName = type.name.value;
	const definition = context.catalog.getType(typeName);

	if (definition?.kind === Kind.ENUM_TYPE_DEFINITION) {
		const members = new Set(
			(definition.values ?? []).map((member) => member.name.value)
		);
		if (value.kind !== Kind.ENUM || !members.has(value.value)) {
			const written =
				value.kind === Kind.ENUM ? `"${value.value}"` : displayValue(value);
			context.report(
				`Value ${written} is not a member of enum "${typeName}"`,
				value
			);
		}
		return;
	}

	if (definition?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
		checkInputObject(context, value, typeName, subject);
		return;
	}

	const accepted = SCALAR_LITERALS[typeName];
	if (accepted !== undefined && !accepted.includes(value.kind)) {
		context.report(
			`${subject} of type "${typeName}" cannot be ${displayValue(value)}`,
			value
		);
	}
};

/** Whether a variable's declared type fits the place it was used. */
export const isVariableUsable = (
	declared: TypeNode,
	hasDefault: boolean,
	target: TypeNode
): boolean =>
	isAssignable(declared, target) ||
	(hasDefault &&
		target.kind === Kind.NON_NULL_TYPE &&
		isAssignable(declared, target.type));
