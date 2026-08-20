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
import type { OperationType } from '../language/kinds/index.js';

/** What a resolver is told about the field it is resolving. */
/**
 * One field a request asked for, below the field being resolved.
 *
 * Fragments have been followed and `@skip` and `@include` applied, so this is
 * what the response will actually carry rather than what was typed.
 */
export interface SelectedField {
	/** The field's name in the catalog. */
	readonly name: string;
	/** The key it answers under, which is its alias when it has one. */
	readonly alias: string;
	/** What it was asked with, already read. */
	readonly arguments: Readonly<Record<string, unknown>>;
	/** What was asked for below it. */
	readonly fields: readonly SelectedField[];
}

export interface ResolverInfo {
	/** The field being resolved, by its name in the catalog. */
	readonly fieldName: string;
	/** The type that declares it. */
	readonly parentTypeName: string;
	/** Response path to this field, including list indices. */
	readonly path: readonly (string | number)[];
	/** The operation being run. */
	readonly operation: OperationType;
	/** Variables the request is running with, already coerced. */
	readonly variables: Readonly<Record<string, unknown>>;
	/** The catalog the request was checked against. */
	readonly catalog: Catalog;
	/**
	 * What the request asked for below this field.
	 *
	 * A resolver that reads rows can select the columns that were asked for
	 * rather than every column there is, and one that stands in front of
	 * another service can forward what it was asked rather than guess. Worked
	 * out when called and not before, so a resolver that does not care pays
	 * nothing for it.
	 */
	readonly selection: () => readonly SelectedField[];
}

/**
 * Produce the value of one field.
 *
 * `TContext` is whatever the run was given as its context, so a resolver reads
 * it as itself rather than casting `unknown` back into shape.
 */
export type FieldResolver<
	TContext = unknown,
	TSource = unknown,
	TArgs extends Readonly<Record<string, unknown>> = Readonly<
		Record<string, unknown>
	>,
	TResult = unknown,
> = (
	source: TSource,
	args: TArgs,
	context: TContext,
	info: ResolverInfo
) => TResult | Promise<TResult>;

/** Decide which object type a value of an interface or union type is. */
export type TypeNameResolver<TContext = unknown> = (
	value: unknown,
	context: TContext
) => string | undefined;

/** The resolvers for one type: its fields, and how to narrow it. */
export interface TypeResolvers<TContext = unknown> {
	readonly __resolveType?: TypeNameResolver<TContext>;
	readonly [fieldName: string]:
		| FieldResolver<TContext>
		| TypeNameResolver<TContext>
		| undefined;
}

/** Resolvers by type name. Types and fields left out fall back to defaults. */
export type Resolvers<TContext = unknown> = Readonly<
	Record<string, TypeResolvers<TContext>>
>;

/**
 * Read a field straight off the source value.
 *
 * A property that holds a function is called, so a plain object of getters
 * works as a source without any resolvers at all.
 */
export const defaultFieldResolver: FieldResolver = (
	source,
	args,
	context,
	info
) => {
	if (source === null || typeof source !== 'object') return undefined;

	const property = (source as Record<string, unknown>)[info.fieldName];
	return typeof property === 'function'
		? (property as FieldResolver)(source, args, context, info)
		: property;
};

/** The resolver for a field, or the default when none was supplied. */
export const resolverFor = <TContext>(
	resolvers: Resolvers<TContext>,
	typeName: string,
	fieldName: string
): FieldResolver<TContext> => {
	const candidate = resolvers[typeName]?.[fieldName];
	return typeof candidate === 'function'
		? (candidate as FieldResolver<TContext>)
		: (defaultFieldResolver as FieldResolver<TContext>);
};

/**
 * Work out which object type a value really is.
 *
 * A `__typename` on the value wins, then the type's own `__resolveType`, then
 * the only possible type when the catalog leaves no choice.
 */
export const resolveTypeName = <TContext>(
	catalog: Catalog,
	resolvers: Resolvers<TContext>,
	abstractTypeName: string,
	value: unknown,
	context: TContext
): string | undefined => {
	if (value !== null && typeof value === 'object') {
		const declared = (value as Record<string, unknown>).__typename;
		if (typeof declared === 'string') return declared;
	}

	const narrow = resolvers[abstractTypeName]?.__resolveType;
	if (narrow !== undefined) {
		const resolved = narrow(value, context);
		if (resolved !== undefined) return resolved;
	}

	const possible = catalog.getPossibleTypes(abstractTypeName);
	return possible.length === 1 ? possible[0]?.name.value : undefined;
};
