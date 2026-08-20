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
	EnumTypeDefinitionNode,
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	InputValueDefinitionNode,
	InterfaceTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	TypeDefinitionNode,
} from '../language/ast/index.js';
import { Kind } from '../language/kinds/index.js';
import { printType } from '../language/printer/index.js';
import type { Catalog } from './catalog.js';

/** How much a change asks of the clients already out there. */
export const ChangeSeverity = {
	/** Something that ran before will stop running. */
	BREAKING: 'breaking',
	/** Nothing stops running, but a client may be surprised. */
	RISKY: 'risky',
	/** Nothing already written is affected. */
	SAFE: 'safe',
} as const;

export type ChangeSeverity =
	(typeof ChangeSeverity)[keyof typeof ChangeSeverity];

/** One difference between two catalogs. */
export interface CatalogChange {
	readonly severity: ChangeSeverity;
	/** What changed, named as a coordinate. */
	readonly coordinate: string;
	/** What happened, in words. */
	readonly message: string;
}

const fieldsOf = (
	definition: TypeDefinitionNode | undefined
): readonly FieldDefinitionNode[] =>
	definition?.kind === Kind.OBJECT_TYPE_DEFINITION ||
	definition?.kind === Kind.INTERFACE_TYPE_DEFINITION
		? ((definition as ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode)
				.fields ?? [])
		: [];

const inputFieldsOf = (
	definition: TypeDefinitionNode | undefined
): readonly InputValueDefinitionNode[] =>
	definition?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION
		? ((definition as InputObjectTypeDefinitionNode).fields ?? [])
		: [];

const valuesOf = (definition: TypeDefinitionNode | undefined) =>
	definition?.kind === Kind.ENUM_TYPE_DEFINITION
		? ((definition as EnumTypeDefinitionNode).values ?? [])
		: [];

const byName = <T extends { readonly name: { readonly value: string } }>(
	entries: readonly T[]
): ReadonlyMap<string, T> =>
	new Map(entries.map((entry) => [entry.name.value, entry]));

const isRequired = (field: InputValueDefinitionNode): boolean =>
	field.type.kind === Kind.NON_NULL_TYPE && field.defaultValue === undefined;

/**
 * Compare two catalogs, and say what each difference asks of the clients
 * already out there.
 *
 * A field that leaves breaks whoever asked for it; a field that arrives asks
 * nothing of anyone. In between sit the changes a client may notice without
 * failing outright - a new enum value it has no branch for, say - which are
 * worth seeing before a release rather than after.
 */
export const compareCatalogs = (
	before: Catalog,
	after: Catalog
): readonly CatalogChange[] => {
	const changes: CatalogChange[] = [];

	const note = (
		severity: ChangeSeverity,
		coordinate: string,
		message: string
	): void => {
		changes.push({ severity, coordinate, message });
	};

	for (const [name, definition] of before.types) {
		const current = after.getType(name);

		if (current === undefined) {
			note(ChangeSeverity.BREAKING, name, `"${name}" was removed`);
			continue;
		}

		if (current.kind !== definition.kind) {
			note(
				ChangeSeverity.BREAKING,
				name,
				`"${name}" changed from ${definition.kind} to ${current.kind}`
			);
			continue;
		}

		const currentFields = byName(fieldsOf(current));
		for (const field of fieldsOf(definition)) {
			const coordinate = `${name}.${field.name.value}`;
			const currentField = currentFields.get(field.name.value);

			if (currentField === undefined) {
				note(
					ChangeSeverity.BREAKING,
					coordinate,
					`"${coordinate}" was removed`
				);
				continue;
			}

			const was = printType(field.type);
			const is = printType(currentField.type);

			if (was !== is) {
				// Promising more than before keeps every reader working; promising
				// less does not.
				const stricter = is === `${was}!`;
				note(
					stricter ? ChangeSeverity.SAFE : ChangeSeverity.BREAKING,
					coordinate,
					`"${coordinate}" changed from "${was}" to "${is}"`
				);
			}

			const currentArguments = byName(currentField.arguments ?? []);
			for (const argument of field.arguments ?? []) {
				const argumentCoordinate = `${coordinate}(${argument.name.value}:)`;
				const currentArgument = currentArguments.get(argument.name.value);

				if (currentArgument === undefined) {
					note(
						ChangeSeverity.BREAKING,
						argumentCoordinate,
						`"${argumentCoordinate}" was removed`
					);
					continue;
				}

				const argumentWas = printType(argument.type);
				const argumentIs = printType(currentArgument.type);
				if (argumentWas !== argumentIs) {
					note(
						ChangeSeverity.BREAKING,
						argumentCoordinate,
						`"${argumentCoordinate}" changed from "${argumentWas}" to "${argumentIs}"`
					);
				}
			}

			const declared = byName(field.arguments ?? []);
			for (const argument of currentField.arguments ?? []) {
				if (declared.has(argument.name.value)) continue;

				const argumentCoordinate = `${coordinate}(${argument.name.value}:)`;
				note(
					isRequired(argument) ? ChangeSeverity.BREAKING : ChangeSeverity.SAFE,
					argumentCoordinate,
					isRequired(argument)
						? `"${argumentCoordinate}" was added and is required`
						: `"${argumentCoordinate}" was added`
				);
			}
		}

		const declaredFields = byName(fieldsOf(definition));
		for (const field of fieldsOf(current)) {
			if (declaredFields.has(field.name.value)) continue;
			const coordinate = `${name}.${field.name.value}`;
			note(ChangeSeverity.SAFE, coordinate, `"${coordinate}" was added`);
		}

		const currentInputFields = byName(inputFieldsOf(current));
		for (const field of inputFieldsOf(definition)) {
			const coordinate = `${name}.${field.name.value}`;
			const currentField = currentInputFields.get(field.name.value);

			if (currentField === undefined) {
				note(
					ChangeSeverity.BREAKING,
					coordinate,
					`"${coordinate}" was removed`
				);
				continue;
			}

			const was = printType(field.type);
			const is = printType(currentField.type);
			if (was !== is) {
				note(
					ChangeSeverity.BREAKING,
					coordinate,
					`"${coordinate}" changed from "${was}" to "${is}"`
				);
			}
		}

		const declaredInputFields = byName(inputFieldsOf(definition));
		for (const field of inputFieldsOf(current)) {
			if (declaredInputFields.has(field.name.value)) continue;

			const coordinate = `${name}.${field.name.value}`;
			note(
				isRequired(field) ? ChangeSeverity.BREAKING : ChangeSeverity.SAFE,
				coordinate,
				isRequired(field)
					? `"${coordinate}" was added and is required`
					: `"${coordinate}" was added`
			);
		}

		const currentValues = byName(valuesOf(current));
		for (const value of valuesOf(definition)) {
			if (currentValues.has(value.name.value)) continue;

			const coordinate = `${name}.${value.name.value}`;
			note(ChangeSeverity.BREAKING, coordinate, `"${coordinate}" was removed`);
		}

		const declaredValues = byName(valuesOf(definition));
		for (const value of valuesOf(current)) {
			if (declaredValues.has(value.name.value)) continue;

			const coordinate = `${name}.${value.name.value}`;
			note(
				ChangeSeverity.RISKY,
				coordinate,
				`"${coordinate}" was added, which a client with no branch for it will meet`
			);
		}
	}

	for (const [name] of after.types) {
		if (before.getType(name) !== undefined) continue;
		note(ChangeSeverity.SAFE, name, `"${name}" was added`);
	}

	return changes;
};
