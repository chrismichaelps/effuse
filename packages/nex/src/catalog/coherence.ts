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

import { NexCatalogError } from '../errors/index.js';
import type {
	FieldDefinitionNode,
	InputValueDefinitionNode,
	InterfaceTypeDefinitionNode,
	Location,
	ObjectTypeDefinitionNode,
	TypeDefinitionNode,
} from '../language/ast/index.js';
import { Kind, OperationType } from '../language/kinds/index.js';
import { printType } from '../language/printer/index.js';
import { BUILT_IN_SCALARS } from './built-in-scalars.js';
import { DEFAULT_IDENTITY_FIELD } from './catalog.js';

const IDENTITY_DIRECTIVE = 'identity';
import type { CatalogIndex } from './index-definitions.js';
import { unwrapType } from './named-type.js';

/** Types that hold fields, and so can implement an interface. */
const FIELD_HOLDER_KINDS: ReadonlySet<string> = new Set([
	Kind.OBJECT_TYPE_DEFINITION,
	Kind.INTERFACE_TYPE_DEFINITION,
]);

/** Types a field may carry. */
const OUTPUT_KINDS: ReadonlySet<string> = new Set([
	Kind.SCALAR_TYPE_DEFINITION,
	Kind.OBJECT_TYPE_DEFINITION,
	Kind.INTERFACE_TYPE_DEFINITION,
	Kind.UNION_TYPE_DEFINITION,
	Kind.ENUM_TYPE_DEFINITION,
]);

/** Types an argument or an input field may carry. */
const INPUT_KINDS: ReadonlySet<string> = new Set([
	Kind.SCALAR_TYPE_DEFINITION,
	Kind.ENUM_TYPE_DEFINITION,
	Kind.INPUT_OBJECT_TYPE_DEFINITION,
]);

/** How each kind reads in an error message. */
const KIND_LABELS: Readonly<Record<string, string>> = {
	[Kind.SCALAR_TYPE_DEFINITION]: 'scalar',
	[Kind.OBJECT_TYPE_DEFINITION]: 'output',
	[Kind.INTERFACE_TYPE_DEFINITION]: 'output',
	[Kind.UNION_TYPE_DEFINITION]: 'output',
	[Kind.ENUM_TYPE_DEFINITION]: 'enum',
	[Kind.INPUT_OBJECT_TYPE_DEFINITION]: 'input',
};

const RESERVED_PREFIX = '__';

const CONVENTIONAL_ROOTS: Readonly<Record<string, string>> = {
	[OperationType.QUERY]: 'Query',
	[OperationType.MUTATION]: 'Mutation',
	[OperationType.LIVE]: 'Live',
};

/**
 * Check that a catalog holds together: every name resolves, every type is used
 * where its kind is allowed, every interface is honoured, and nothing is
 * declared twice. Every problem is reported, not just the first.
 */
export const checkCoherence = (
	index: CatalogIndex
): readonly NexCatalogError[] => {
	const errors: NexCatalogError[] = [];

	const report = (message: string, location?: Location | undefined): void => {
		errors.push(new NexCatalogError({ message, location }));
	};

	const typeNamed = (name: string): TypeDefinitionNode | undefined =>
		index.types.get(name);

	const isKnown = (name: string): boolean =>
		BUILT_IN_SCALARS.has(name) || index.types.has(name);

	/** Check a type reference resolves, and lands where its kind is allowed. */
	const checkReference = (
		typeName: string,
		allowed: ReadonlySet<string>,
		wanted: 'input' | 'output',
		subject: string,
		location: Location | undefined
	): void => {
		if (!isKnown(typeName)) {
			report(`${subject} refers to unknown type "${typeName}"`, location);
			return;
		}
		if (BUILT_IN_SCALARS.has(typeName)) return;

		const definition = typeNamed(typeName);
		if (definition === undefined || allowed.has(definition.kind)) return;

		const label = KIND_LABELS[definition.kind] ?? 'unusable';
		report(
			`${subject} cannot carry ${label} type "${typeName}", which is not ${wanted === 'input' ? 'an input' : 'an output'} type`,
			location
		);
	};

	/** `subject` already carries the quoted name, so the message reads as one. */
	const checkReserved = (
		name: string,
		subject: string,
		location: Location | undefined
	): void => {
		if (!name.startsWith(RESERVED_PREFIX)) return;
		report(
			`${subject} is reserved: names beginning with "__" belong to introspection`,
			location
		);
	};

	const checkArguments = (
		args: readonly InputValueDefinitionNode[] | undefined,
		owner: string
	): void => {
		const seen = new Set<string>();

		for (const argument of args ?? []) {
			const name = argument.name.value;
			if (seen.has(name)) {
				report(
					`Argument "${name}" is defined more than once on "${owner}"`,
					argument.loc
				);
				continue;
			}
			seen.add(name);

			checkReserved(name, `Argument "${owner}(${name}:)"`, argument.loc);
			checkReference(
				unwrapType(argument.type).name.value,
				INPUT_KINDS,
				'input',
				`Argument "${owner}(${name}:)"`,
				argument.loc
			);
		}
	};

	const checkFields = (
		fields: readonly FieldDefinitionNode[] | undefined,
		typeName: string
	): void => {
		if (fields === undefined || fields.length === 0) {
			report(`Type "${typeName}" must define at least one field`);
			return;
		}

		const seen = new Set<string>();

		for (const field of fields) {
			const name = field.name.value;
			if (seen.has(name)) {
				report(
					`Field "${name}" is defined more than once on type "${typeName}"`,
					field.loc
				);
				continue;
			}
			seen.add(name);

			checkReserved(name, `Field "${typeName}.${name}"`, field.loc);
			checkReference(
				unwrapType(field.type).name.value,
				OUTPUT_KINDS,
				'output',
				`Field "${typeName}.${name}"`,
				field.loc
			);
			checkArguments(field.arguments, `${typeName}.${name}`);
		}
	};

	const checkInputFields = (
		fields: readonly InputValueDefinitionNode[] | undefined,
		typeName: string
	): void => {
		if (fields === undefined || fields.length === 0) {
			report(`Type "${typeName}" must define at least one field`);
			return;
		}

		const seen = new Set<string>();

		for (const field of fields) {
			const name = field.name.value;
			if (seen.has(name)) {
				report(
					`Field "${name}" is defined more than once on type "${typeName}"`,
					field.loc
				);
				continue;
			}
			seen.add(name);

			checkReserved(name, `Field "${typeName}.${name}"`, field.loc);
			checkReference(
				unwrapType(field.type).name.value,
				INPUT_KINDS,
				'input',
				`Field "${typeName}.${name}"`,
				field.loc
			);
		}
	};

	/** A type must declare everything the interfaces it names declare. */
	const checkInterfaces = (
		holder: ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode
	): void => {
		const typeName = holder.name.value;
		const declared = new Map(
			(holder.fields ?? []).map((field) => [field.name.value, field])
		);

		for (const implemented of holder.interfaces ?? []) {
			const name = implemented.name.value;
			const target = typeNamed(name);

			if (target === undefined) {
				report(
					`Type "${typeName}" implements unknown type "${name}"`,
					implemented.loc
				);
				continue;
			}
			if (target.kind !== Kind.INTERFACE_TYPE_DEFINITION) {
				report(
					`Type "${typeName}" cannot implement "${name}": "${name}" is not an interface`,
					implemented.loc
				);
				continue;
			}

			for (const required of target.fields ?? []) {
				const field = declared.get(required.name.value);

				if (field === undefined) {
					report(
						`Type "${typeName}" says it implements "${name}" but does not declare "${required.name.value}"`,
						implemented.loc
					);
					continue;
				}

				if (printType(field.type) !== printType(required.type)) {
					report(
						`"${typeName}.${field.name.value}" is "${printType(field.type)}" where interface "${name}" declares "${printType(required.type)}"`,
						field.loc
					);
				}

				const supplied = new Set(
					(field.arguments ?? []).map((argument) => argument.name.value)
				);
				for (const argument of required.arguments ?? []) {
					if (supplied.has(argument.name.value)) continue;
					report(
						`"${typeName}.${field.name.value}" is missing argument "${argument.name.value}", which interface "${name}" declares`,
						field.loc
					);
				}
			}
		}
	};

	/**
	 * An input type that requires itself, however deep the chain, can never be
	 * given a value; only a nullable link makes it constructible.
	 */
	const checkInputCycles = (): void => {
		for (const [name, definition] of index.types) {
			if (definition.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) continue;

			const walk = (
				current: string,
				path: readonly string[],
				seen: ReadonlySet<string>
			): void => {
				const type = typeNamed(current);
				if (type?.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) return;

				for (const field of type.fields ?? []) {
					if (field.type.kind !== Kind.NON_NULL_TYPE) continue;

					const next = unwrapType(field.type).name.value;
					const step = `${current}.${field.name.value}`;

					if (next === name) {
						report(
							`Input type "${name}" cannot be built: "${step}" requires "${next}"`,
							field.loc
						);
						continue;
					}
					if (seen.has(next)) continue;

					walk(next, [...path, step], new Set([...seen, next]));
				}
			};

			walk(name, [], new Set([name]));
		}
	};

	for (const [name, definition] of index.types) {
		checkReserved(name, `Type "${name}"`, definition.loc);

		if (FIELD_HOLDER_KINDS.has(definition.kind)) {
			const holder = definition as
				| ObjectTypeDefinitionNode
				| InterfaceTypeDefinitionNode;
			checkFields(holder.fields, name);
			checkInterfaces(holder);
			continue;
		}

		if (definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
			checkInputFields(definition.fields, name);
			continue;
		}

		if (definition.kind === Kind.UNION_TYPE_DEFINITION) {
			const members = definition.types ?? [];
			if (members.length === 0) {
				report(
					`Union "${name}" must include at least one type`,
					definition.loc
				);
			}

			const seen = new Set<string>();
			for (const member of members) {
				const memberName = member.name.value;
				if (seen.has(memberName)) {
					report(
						`"${memberName}" is listed more than once in union "${name}"`,
						member.loc
					);
					continue;
				}
				seen.add(memberName);

				const target = typeNamed(memberName);
				if (target === undefined) {
					report(
						`Union "${name}" refers to unknown type "${memberName}"`,
						member.loc
					);
					continue;
				}
				if (target.kind !== Kind.OBJECT_TYPE_DEFINITION) {
					report(
						`Union "${name}" cannot include "${memberName}", which is not an object type`,
						member.loc
					);
				}
			}
			continue;
		}

		if (definition.kind === Kind.ENUM_TYPE_DEFINITION) {
			const values = definition.values ?? [];
			if (values.length === 0) {
				report(`Enum "${name}" must define at least one value`, definition.loc);
			}

			const seen = new Set<string>();
			for (const value of values) {
				const valueName = value.name.value;
				if (seen.has(valueName)) {
					report(
						`Value "${valueName}" is defined more than once on enum "${name}"`,
						value.loc
					);
					continue;
				}
				seen.add(valueName);
				checkReserved(valueName, `Value "${name}.${valueName}"`, value.loc);
			}
		}
	}

	for (const [name, directive] of index.directives) {
		if (name.startsWith(RESERVED_PREFIX)) continue;
		checkArguments(directive.arguments, `@${name}`);
	}

	checkInputCycles();

	// Roots are checked last so a catalog with deeper problems reports those
	// first: a missing query root is usually a symptom, not the cause.
	const roots = index.schemaDefinition?.operationTypes;

	if (roots === undefined) {
		if (!index.types.has(CONVENTIONAL_ROOTS[OperationType.QUERY] ?? 'Query')) {
			report('A catalog must define a query root type');
		}
	} else {
		let hasQuery = false;

		for (const root of roots) {
			if (root.operation === OperationType.QUERY) hasQuery = true;

			const target = typeNamed(root.type.name.value);
			if (target === undefined) {
				report(
					`The ${root.operation} root type "${root.type.name.value}" is not defined`,
					root.loc
				);
				continue;
			}
			if (target.kind !== Kind.OBJECT_TYPE_DEFINITION) {
				report(
					`The ${root.operation} root type "${root.type.name.value}" must be an object type`,
					root.loc
				);
			}
		}

		if (!hasQuery) report('A catalog must define a query root type');
	}

	/**
	 * A type saying what identifies it has to have that field.
	 *
	 * The reference a client caches an object under is built from this field's
	 * value, so a name that resolves to nothing would be found at run time, on
	 * a row, rather than here.
	 */
	for (const [name, definition] of index.types) {
		if (definition.kind !== Kind.OBJECT_TYPE_DEFINITION) continue;

		const marked = (definition.directives ?? []).find(
			(directive) => directive.name.value === IDENTITY_DIRECTIVE
		);
		if (marked === undefined) continue;

		const named = (marked.arguments ?? []).find(
			(argument) => argument.name.value === 'field'
		);
		const field =
			named?.value.kind === Kind.STRING
				? named.value.value
				: DEFAULT_IDENTITY_FIELD;

		if ((definition.fields ?? []).some((one) => one.name.value === field)) {
			continue;
		}

		report(
			`"${name}" says "${field}" identifies it, but declares no such field`,
			marked.loc
		);
	}

	return errors;
};
