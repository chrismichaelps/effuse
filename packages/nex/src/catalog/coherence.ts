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
	TypeNode,
	ValueNode,
	DirectiveNode,
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
import { SCALAR_LITERAL_KINDS } from '../language/scalar-literals.js';
import { printValue } from '../language/printer/index.js';
import { DEFAULT_IDENTITY_FIELD } from './catalog.js';
import {
	DIRECTIVE_LOCATION_LABELS,
	DirectiveLocation,
} from './directive-locations.js';

const IDENTITY_DIRECTIVE = 'identity';
const CHOICE_DIRECTIVE = 'choice';

const hasDirective = (
	directives:
		| readonly { readonly name: { readonly value: string } }[]
		| undefined,
	name: string
): boolean => (directives ?? []).some((one) => one.name.value === name);

/** Where each kind of type definition counts as, for a directive. */
const TYPE_LOCATIONS: Readonly<Record<string, DirectiveLocation>> = {
	[Kind.SCALAR_TYPE_DEFINITION]: DirectiveLocation.SCALAR,
	[Kind.OBJECT_TYPE_DEFINITION]: DirectiveLocation.OBJECT,
	[Kind.INTERFACE_TYPE_DEFINITION]: DirectiveLocation.INTERFACE,
	[Kind.UNION_TYPE_DEFINITION]: DirectiveLocation.UNION,
	[Kind.ENUM_TYPE_DEFINITION]: DirectiveLocation.ENUM,
	[Kind.INPUT_OBJECT_TYPE_DEFINITION]: DirectiveLocation.INPUT_OBJECT,
};
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
			checkDefault(argument, `Argument "${owner}(${name}:)"`);
		}
	};

	/**
	 * A default has to be a value of the type it is a default for.
	 *
	 * It is written once in the catalog and used on every request that leaves
	 * the argument out, so one that does not fit is one that fails for
	 * everybody, on requests that never mention it.
	 */
	function checkDefault(
		declared: InputValueDefinitionNode,
		subject: string
	): void {
		if (declared.defaultValue === undefined) return;
		if (fitsType(declared.defaultValue, declared.type)) return;

		report(
			`${subject} defaults to ${printValue(declared.defaultValue)}, which is not a value of "${printType(declared.type)}"`,
			declared.loc
		);
	}

	/**
	 * Whether a literal written in the catalog is a value of the type it is
	 * written for.
	 *
	 * The same question validation asks of a literal written in a request,
	 * asked of one written here - both read `SCALAR_LITERAL_KINDS`, so what a
	 * scalar takes is said in one place. What differs is only that nothing
	 * here can be a variable, since there is no request to take one from.
	 */
	function fitsType(value: ValueNode, type: TypeNode): boolean {
		if (type.kind === Kind.NON_NULL_TYPE) {
			return value.kind !== Kind.NULL && fitsType(value, type.type);
		}
		if (value.kind === Kind.NULL) return true;
		if (type.kind === Kind.OPTIONAL_TYPE) return fitsType(value, type.type);

		if (type.kind === Kind.LIST_TYPE) {
			// One value where a list is wanted is that list of one, the same
			// way it is when a caller sends it.
			return value.kind === Kind.LIST
				? value.values.every((item) => fitsType(item, type.type))
				: fitsType(value, type.type);
		}

		const typeName = type.name.value;
		const accepted = SCALAR_LITERAL_KINDS[typeName];
		if (accepted !== undefined) return accepted.includes(value.kind);

		const definition = index.types.get(typeName);

		if (definition?.kind === Kind.ENUM_TYPE_DEFINITION) {
			return (
				value.kind === Kind.ENUM &&
				(definition.values ?? []).some((one) => one.name.value === value.value)
			);
		}

		if (definition?.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
			if (value.kind !== Kind.OBJECT) return false;

			return value.fields.every((written) => {
				const field = (definition.fields ?? []).find(
					(one) => one.name.value === written.name.value
				);
				return field !== undefined && fitsType(written.value, field.type);
			});
		}

		// A scalar the server defines takes whatever it says it does, and it
		// is not here to be asked.
		return true;
	}

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
			checkDefault(field, `Field "${typeName}.${name}"`);
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

				if (!satisfies(field.type, required.type)) {
					report(
						`"${typeName}.${field.name.value}" is "${printType(field.type)}" where interface "${name}" declares "${printType(required.type)}"`,
						field.loc
					);
				}

				const supplied = new Map(
					(field.arguments ?? []).map((argument) => [
						argument.name.value,
						argument,
					])
				);

				for (const argument of required.arguments ?? []) {
					const given = supplied.get(argument.name.value);
					if (given === undefined) {
						report(
							`"${typeName}.${field.name.value}" is missing argument "${argument.name.value}", which interface "${name}" declares`,
							field.loc
						);
						continue;
					}

					// A caller writing against the interface passes what the
					// interface declared, so anything else here would be
					// handed a value it never asked for.
					if (printType(given.type) !== printType(argument.type)) {
						report(
							`"${typeName}.${field.name.value}" takes "${argument.name.value}" as "${printType(given.type)}" where interface "${name}" declares "${printType(argument.type)}"`,
							given.loc
						);
					}
				}

				// An argument of its own is fine, so long as someone calling
				// through the interface - who will never pass it - still can.
				for (const [argumentName, argument] of supplied) {
					const known = (required.arguments ?? []).some(
						(one) => one.name.value === argumentName
					);
					if (known || argument.type.kind !== Kind.NON_NULL_TYPE) continue;

					report(
						`"${typeName}.${field.name.value}" requires "${argumentName}", which interface "${name}" does not declare, so nothing calling through the interface could provide it`,
						argument.loc
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
		const named = new Set<string>();

		for (const root of roots) {
			if (root.operation === OperationType.QUERY) hasQuery = true;

			// Two roots for one operation leaves which one answers up to
			// whichever is read first, which is not something to decide for a
			// catalog that clearly means one of them.
			if (named.has(root.operation)) {
				report(
					`The schema block names the ${root.operation} root more than once`,
					root.loc
				);
				continue;
			}
			named.add(root.operation);

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
	 * A directive a catalog writes has to exist, and belong where it is.
	 *
	 * Requests are already held to this. Catalogs were not, so `@depreacted`
	 * was accepted and did nothing - and a warning nothing reads is worse than
	 * no warning, because it looks like one was given.
	 */
	const checkDirectiveUse = (
		directives: readonly DirectiveNode[] | undefined,
		location: DirectiveLocation,
		subject: string
	): void => {
		// A directive that did not say it may be written more than once means
		// one thing here, and two of it would be two answers to one question.
		const seen = new Set<string>();

		for (const written of directives ?? []) {
			const directiveName = written.name.value;
			const declared = index.directives.get(directiveName);

			if (declared === undefined) {
				report(
					`"@${directiveName}" is not defined, so ${subject} carries nothing`,
					written.loc
				);
				continue;
			}

			if (declared.repeatable !== true) {
				if (seen.has(directiveName)) {
					report(
						`"@${directiveName}" may only be used once on ${subject}; declare it repeatable to write it more than once`,
						written.loc
					);
				}
				seen.add(directiveName);
			}

			if (!declared.locations.some((allowed) => allowed.value === location)) {
				report(
					`"@${directiveName}" cannot be written on ${DIRECTIVE_LOCATION_LABELS[location] ?? location}`,
					written.loc
				);
			}
		}
	};

	if (index.schemaDefinition !== undefined) {
		checkDirectiveUse(
			index.schemaDefinition.directives,
			DirectiveLocation.SCHEMA,
			'the schema block'
		);
	}

	for (const [name, definition] of index.types) {
		const on = TYPE_LOCATIONS[definition.kind];
		if (on !== undefined) {
			checkDirectiveUse(definition.directives, on, `"${name}"`);
		}

		if (
			definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
			definition.kind === Kind.INTERFACE_TYPE_DEFINITION
		) {
			for (const field of definition.fields ?? []) {
				const coordinate = `${name}.${field.name.value}`;
				checkDirectiveUse(
					field.directives,
					DirectiveLocation.FIELD_DEFINITION,
					`"${coordinate}"`
				);

				for (const argument of field.arguments ?? []) {
					checkDirectiveUse(
						argument.directives,
						DirectiveLocation.ARGUMENT_DEFINITION,
						`"${coordinate}(${argument.name.value}:)"`
					);
				}
			}
			continue;
		}

		if (definition.kind === Kind.ENUM_TYPE_DEFINITION) {
			for (const value of definition.values ?? []) {
				checkDirectiveUse(
					value.directives,
					DirectiveLocation.ENUM_VALUE,
					`"${name}.${value.name.value}"`
				);
			}
			continue;
		}

		if (definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
			for (const field of definition.fields ?? []) {
				checkDirectiveUse(
					field.directives,
					DirectiveLocation.INPUT_FIELD_DEFINITION,
					`"${name}.${field.name.value}"`
				);
			}
		}
	}

	/**
	 * Whether one type may stand where another was promised.
	 *
	 * An implementation may promise more than the interface did - something
	 * that is always there where it might have been missing - since anyone
	 * reading through the interface is only ever surprised by getting less.
	 */
	function satisfies(given: TypeNode, promised: TypeNode): boolean {
		if (promised.kind === Kind.NON_NULL_TYPE) {
			return (
				given.kind === Kind.NON_NULL_TYPE &&
				satisfies(given.type, promised.type)
			);
		}

		// The promise allows nothing to be there, so something that always is
		// keeps it; unwrapping is what lets a list's members narrow too.
		if (given.kind === Kind.NON_NULL_TYPE) {
			return satisfies(given.type, promised);
		}

		if (promised.kind === Kind.OPTIONAL_TYPE) {
			return satisfies(given, promised.type);
		}
		if (given.kind === Kind.OPTIONAL_TYPE) {
			return satisfies(given.type, promised);
		}

		if (promised.kind === Kind.LIST_TYPE) {
			return (
				given.kind === Kind.LIST_TYPE && satisfies(given.type, promised.type)
			);
		}

		return printType(given) === printType(promised);
	}

	/**
	 * A choice has to be one a caller can actually make.
	 *
	 * A field that must always be given is not one among several; a default
	 * makes the choice for the caller every time; and one option is not a
	 * choice at all. Each of these would leave a type that reads like a choice
	 * and cannot behave as one.
	 */
	for (const [name, definition] of index.types) {
		if (definition.kind !== Kind.INPUT_OBJECT_TYPE_DEFINITION) continue;
		if (!hasDirective(definition.directives, CHOICE_DIRECTIVE)) continue;

		const fields = definition.fields ?? [];

		if (fields.length < 2) {
			report(
				`"${name}" offers a choice of ${String(fields.length)}; a choice needs at least two`,
				definition.loc
			);
		}

		for (const field of fields) {
			if (field.type.kind === Kind.NON_NULL_TYPE) {
				report(
					`"${name}.${field.name.value}" must be optional: a field of a choice that is always given leaves nothing to choose`,
					field.loc
				);
			}

			if (field.defaultValue !== undefined) {
				report(
					`"${name}.${field.name.value}" cannot carry a default: it would make the choice before the caller does`,
					field.loc
				);
			}
		}
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
