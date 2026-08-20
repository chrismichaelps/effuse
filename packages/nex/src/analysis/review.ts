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

import { BUILT_IN_SCALARS, type Catalog } from '../catalog/index.js';
import type {
	DirectiveNode,
	FieldDefinitionNode,
	InputValueDefinitionNode,
	Location,
	TypeDefinitionNode,
	TypeNode,
} from '../language/ast/index.js';
import { Kind, type OperationType } from '../language/kinds/index.js';
import { namedTypeOf } from '../validation/type-utils.js';

/** What a review found. */
export const ReviewCode = {
	/** A list a caller cannot put a limit on. */
	UNBOUNDED_LIST: 'UNBOUNDED_LIST',
	/** An object a client has no way to cache. */
	UNIDENTIFIED_OBJECT: 'UNIDENTIFIED_OBJECT',
	/** A change a client cannot see the result of. */
	OPAQUE_MUTATION: 'OPAQUE_MUTATION',
	/** Something no request can reach. */
	UNREACHABLE_TYPE: 'UNREACHABLE_TYPE',
	/** A warning nobody can act on. */
	DEPRECATED_WITHOUT_REASON: 'DEPRECATED_WITHOUT_REASON',
	/** A key where the thing itself could be. */
	FOREIGN_KEY: 'FOREIGN_KEY',
	/** A name written unlike the rest of the catalog. */
	UNCONVENTIONAL_NAME: 'UNCONVENTIONAL_NAME',
	/** A name saying again what asking for it already means. */
	REDUNDANT_NAME: 'REDUNDANT_NAME',
} as const;

/** One of the things a review can find. */
export type ReviewCode = (typeof ReviewCode)[keyof typeof ReviewCode];

/** Something a catalog does that will be felt later. */
export interface ReviewNotice {
	/** Which of the things a review looks for this is. */
	readonly code: ReviewCode;
	/** What it is about, named as a coordinate. */
	readonly coordinate: string;
	/** What is wrong and what to do about it. */
	readonly message: string;
	/** Where it was written. */
	readonly location?: Location | undefined;
}

/** What to look at, for a catalog that means something a review would flag. */
export interface ReviewOptions {
	/**
	 * Whether to say anything about how things are named. Defaults to `true`.
	 *
	 * Naming is the one part of this a catalog can reasonably disagree with -
	 * a package ported from elsewhere, or one whose house style is its own -
	 * so it can be turned off without losing what would actually break.
	 */
	readonly naming?: boolean | undefined;
}

const CONNECTION = 'connection';
const PascalCase = /^[A-Z][A-Za-z0-9]*$/u;
const camelCase = /^[a-z][A-Za-z0-9]*$/u;
const SCREAMING_SNAKE_CASE = /^[A-Z][A-Z0-9]*(?:_[A-Z0-9]+)*$/u;

/**
 * Words a field on a root repeats by being there at all.
 *
 * Asking for a field is already asking to get it, so the verb says nothing
 * the request did not. The word has to end there - `getaway` is a noun.
 */
const REDUNDANT_PREFIXES: readonly string[] = ['get', 'fetch', 'list', 'query'];

const startsWithWord = (name: string, word: string): boolean =>
	name.length > word.length &&
	name.startsWith(word) &&
	name[word.length] === name[word.length]?.toUpperCase();

/**
 * The type a field named after a key would return instead.
 *
 * `authorId` on a type that also knows about `Author` is a table's way of
 * saying what a graph says by returning the thing: a client holding an
 * identifier has to ask again to do anything with it.
 */
const keyedType = (fieldName: string): string | undefined => {
	const stem = /^(?<name>[a-z][A-Za-z0-9]*?)(?:Id|Ids)$/u.exec(fieldName)
		?.groups?.name;
	if (stem === undefined || stem.length === 0) return undefined;

	return `${stem[0]?.toUpperCase() ?? ''}${stem.slice(1)}`;
};
const DEPRECATED = 'deprecated';
const OPERATIONS: readonly OperationType[] = ['query', 'mutation', 'live'];

const hasDirective = (
	directives: readonly DirectiveNode[] | undefined,
	name: string
): boolean => (directives ?? []).some((one) => one.name.value === name);

/** Whether a type is a list at any depth, past optional and non-null. */
const isList = (type: TypeNode): boolean => {
	if (type.kind === Kind.LIST_TYPE) return true;
	if (type.kind === Kind.NON_NULL_TYPE || type.kind === Kind.OPTIONAL_TYPE) {
		return isList(type.type);
	}
	return false;
};

/**
 * Look over a catalog for what will be felt in production.
 *
 * Nothing here stops a catalog from working - `buildCatalog` has already
 * refused what cannot - and nothing here is style. Each of these is a way a
 * catalog that runs today makes something impossible later: a list that grows
 * without bound, an object a client cannot cache, a change it cannot see, a
 * type nobody can reach, a warning nobody can act on.
 *
 * Everything found is reported, named by coordinate so it can be looked up or
 * pointed at, and it is advice rather than a verdict: a catalog is free to
 * mean it.
 */
export const reviewCatalog = (
	catalog: Catalog,
	options: ReviewOptions = {}
): readonly ReviewNotice[] => {
	const naming = options.naming !== false;
	const notices: ReviewNotice[] = [];

	const say = (
		code: ReviewCode,
		coordinate: string,
		message: string,
		location: Location | undefined
	): void => {
		notices.push({
			code,
			coordinate,
			message,
			...(location === undefined ? {} : { location }),
		});
	};

	const roots = new Set(
		OPERATIONS.map(
			(operation) => catalog.getRootType(operation)?.name.value
		).filter((name): name is string => name !== undefined)
	);

	/** Every type a request can get to, from the roots outwards. */
	const reachable = new Set<string>();
	const reach = (typeName: string): void => {
		if (reachable.has(typeName) || BUILT_IN_SCALARS.has(typeName)) return;

		const definition = catalog.getType(typeName);
		if (definition === undefined) return;
		reachable.add(typeName);

		const follow = (
			members: readonly (FieldDefinitionNode | InputValueDefinitionNode)[]
		): void => {
			for (const member of members) {
				reach(namedTypeOf(member.type));
				for (const argument of (member as FieldDefinitionNode).arguments ??
					[]) {
					reach(namedTypeOf(argument.type));
				}
			}
		};

		if (
			definition.kind === Kind.OBJECT_TYPE_DEFINITION ||
			definition.kind === Kind.INTERFACE_TYPE_DEFINITION
		) {
			follow(definition.fields ?? []);
			for (const implemented of definition.interfaces ?? []) {
				reach(implemented.name.value);
			}

			// An interface leads to whatever implements it, since a request
			// spreading a fragment reaches those types through it.
			if (definition.kind === Kind.INTERFACE_TYPE_DEFINITION) {
				for (const member of catalog.getPossibleTypes(typeName)) {
					reach(member.name.value);
				}
			}
			return;
		}

		if (definition.kind === Kind.UNION_TYPE_DEFINITION) {
			for (const member of definition.types ?? []) reach(member.name.value);
			return;
		}

		if (definition.kind === Kind.INPUT_OBJECT_TYPE_DEFINITION) {
			follow(definition.fields ?? []);
		}
	};

	for (const root of roots) reach(root);

	const mutationRoot = catalog.getRootType('mutation')?.name.value;

	for (const [typeName, definition] of catalog.types) {
		if (!reachable.has(typeName)) {
			say(
				ReviewCode.UNREACHABLE_TYPE,
				typeName,
				`No request can reach "${typeName}"; remove it, or return it from a field`,
				definition.loc
			);
			continue;
		}

		checkMembers(typeName, definition);
	}

	/** The things said about one type and the fields it declares. */
	function checkMembers(
		typeName: string,
		definition: TypeDefinitionNode
	): void {
		if (naming && !PascalCase.test(typeName)) {
			say(
				ReviewCode.UNCONVENTIONAL_NAME,
				typeName,
				`"${typeName}" is a type, and types in this catalog are written in PascalCase`,
				definition.loc
			);
		}

		if (definition.kind === Kind.ENUM_TYPE_DEFINITION) {
			for (const value of definition.values ?? []) {
				const valueName = value.name.value;
				checkDeprecation(
					`${typeName}.${valueName}`,
					value.directives,
					value.loc
				);

				if (naming && !SCREAMING_SNAKE_CASE.test(valueName)) {
					say(
						ReviewCode.UNCONVENTIONAL_NAME,
						`${typeName}.${valueName}`,
						`"${valueName}" is an enum value, and enum values in this catalog are written in SCREAMING_SNAKE_CASE`,
						value.loc
					);
				}
			}
			return;
		}

		if (
			definition.kind !== Kind.OBJECT_TYPE_DEFINITION &&
			definition.kind !== Kind.INTERFACE_TYPE_DEFINITION
		) {
			return;
		}

		const fields = definition.fields ?? [];

		// A type carrying something that looks like an identifier can be cached
		// per object rather than per request, and only says so if it is asked to.
		if (
			definition.kind === Kind.OBJECT_TYPE_DEFINITION &&
			!roots.has(typeName) &&
			catalog.identityField(typeName) === undefined &&
			fields.some((field) => field.name.value === 'id')
		) {
			say(
				ReviewCode.UNIDENTIFIED_OBJECT,
				typeName,
				`"${typeName}" has an "id" but does not say it identifies by it; mark it @identity so a client can cache it`,
				definition.loc
			);
		}

		for (const field of fields) {
			const fieldName = field.name.value;
			const coordinate = `${typeName}.${fieldName}`;
			checkDeprecation(coordinate, field.directives, field.loc);

			if (naming) {
				if (!camelCase.test(fieldName)) {
					say(
						ReviewCode.UNCONVENTIONAL_NAME,
						coordinate,
						`"${fieldName}" is a field, and fields in this catalog are written in camelCase`,
						field.loc
					);
				}

				for (const argument of field.arguments ?? []) {
					if (camelCase.test(argument.name.value)) continue;
					say(
						ReviewCode.UNCONVENTIONAL_NAME,
						`${coordinate}(${argument.name.value}:)`,
						`"${argument.name.value}" is an argument, and arguments in this catalog are written in camelCase`,
						argument.loc
					);
				}

				const redundant = REDUNDANT_PREFIXES.find((word) =>
					startsWithWord(fieldName, word)
				);
				if (redundant !== undefined && roots.has(typeName)) {
					say(
						ReviewCode.REDUNDANT_NAME,
						coordinate,
						`"${fieldName}" says "${redundant}", which asking for it already means; name it after what it answers with`,
						field.loc
					);
				}
			}

			// A key where the thing itself could be: a client holding an
			// identifier has to ask again before it can do anything with it.
			const keyed = keyedType(fieldName);
			if (
				keyed !== undefined &&
				keyed !== typeName &&
				BUILT_IN_SCALARS.has(namedTypeOf(field.type)) &&
				catalog.getType(keyed)?.kind === Kind.OBJECT_TYPE_DEFINITION
			) {
				say(
					ReviewCode.FOREIGN_KEY,
					coordinate,
					`"${coordinate}" answers with a key; answer with "${keyed}" so a caller does not have to ask again`,
					field.loc
				);
			}

			if (isList(field.type) && !hasDirective(field.directives, CONNECTION)) {
				say(
					ReviewCode.UNBOUNDED_LIST,
					coordinate,
					`"${coordinate}" answers with every row there is; mark it @connection so a caller can page it`,
					field.loc
				);
			}

			// A caller who cannot see what a change did has to guess, or ask
			// again for everything that might have moved.
			if (
				typeName === mutationRoot &&
				BUILT_IN_SCALARS.has(namedTypeOf(field.type))
			) {
				say(
					ReviewCode.OPAQUE_MUTATION,
					coordinate,
					`"${coordinate}" answers with a scalar; answer with what it changed so a client can see the result`,
					field.loc
				);
			}
		}
	}

	function checkDeprecation(
		coordinate: string,
		directives: readonly DirectiveNode[] | undefined,
		location: Location | undefined
	): void {
		const directive = (directives ?? []).find(
			(one) => one.name.value === DEPRECATED
		);
		if (directive === undefined) return;

		const reason = (directive.arguments ?? []).find(
			(argument) => argument.name.value === 'reason'
		);

		if (reason === undefined) {
			say(
				ReviewCode.DEPRECATED_WITHOUT_REASON,
				coordinate,
				`"${coordinate}" is deprecated without saying why; give a reason so a caller knows what to use instead`,
				location
			);
		}
	}

	return notices;
};
