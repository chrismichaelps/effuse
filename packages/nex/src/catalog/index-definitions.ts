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
	DirectiveDefinitionNode,
	DocumentNode,
	SchemaDefinitionNode,
	TypeDefinitionNode,
} from '../language/ast/index.js';
import { NexCatalogError } from '../errors/index.js';
import { Kind } from '../language/kinds/index.js';
import { applyExtensions } from './apply-extensions.js';
import { BUILT_IN_DIRECTIVES } from './built-in-directives.js';

const TYPE_DEFINITION_KINDS: ReadonlySet<string> = new Set([
	Kind.SCALAR_TYPE_DEFINITION,
	Kind.OBJECT_TYPE_DEFINITION,
	Kind.INTERFACE_TYPE_DEFINITION,
	Kind.UNION_TYPE_DEFINITION,
	Kind.ENUM_TYPE_DEFINITION,
	Kind.INPUT_OBJECT_TYPE_DEFINITION,
]);

/** The definitions of a document, grouped by what the catalog needs. */
export interface CatalogIndex {
	readonly types: ReadonlyMap<string, TypeDefinitionNode>;
	readonly directives: ReadonlyMap<string, DirectiveDefinitionNode>;
	readonly schemaDefinition: SchemaDefinitionNode | undefined;
}

/**
 * Group the type system definitions of `document` by name, reporting every
 * name that was defined twice. Executable definitions are ignored: a document
 * may mix requests and catalog definitions.
 */
export const indexDefinitions = (
	document: DocumentNode
): {
	readonly index: CatalogIndex;
	readonly errors: readonly NexCatalogError[];
} => {
	const types = new Map<string, TypeDefinitionNode>();
	const directives = new Map<string, DirectiveDefinitionNode>();
	const declared = new Set<string>();
	const errors: NexCatalogError[] = [];
	let schemaDefinition: SchemaDefinitionNode | undefined;

	for (const builtIn of BUILT_IN_DIRECTIVES) {
		directives.set(builtIn.name.value, builtIn);
	}

	for (const definition of document.definitions) {
		if (definition.kind === Kind.SCHEMA_DEFINITION) {
			if (schemaDefinition !== undefined) {
				errors.push(
					new NexCatalogError({
						message: 'The schema block is already defined',
						location: definition.loc,
					})
				);
				continue;
			}
			schemaDefinition = definition;
			continue;
		}

		if (definition.kind === Kind.DIRECTIVE_DEFINITION) {
			const name = definition.name.value;
			if (declared.has(name)) {
				errors.push(
					new NexCatalogError({
						message: `Directive "@${name}" is already defined`,
						location: definition.loc,
					})
				);
				continue;
			}
			declared.add(name);
			directives.set(name, definition);
			continue;
		}

		if (!TYPE_DEFINITION_KINDS.has(definition.kind)) continue;

		const typeDefinition = definition as TypeDefinitionNode;
		const name = typeDefinition.name.value;
		if (types.has(name)) {
			errors.push(
				new NexCatalogError({
					message: `Type "${name}" is already defined`,
					location: typeDefinition.loc,
				})
			);
			continue;
		}
		types.set(name, typeDefinition);
	}

	const extended = applyExtensions(document, types, schemaDefinition);
	errors.push(...extended.errors);

	return {
		index: { types, directives, schemaDefinition: extended.schemaDefinition },
		errors,
	};
};
