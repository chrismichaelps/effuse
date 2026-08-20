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

/**
 * The catalog every catalog carries, written in Nex itself.
 *
 * Parsing this at first use keeps one description of the introspection types,
 * and means the package eats its own grammar.
 */
export const INTROSPECTION_SOURCE = `
	"What this catalog is made of."
	type __Schema {
		description: String
		types: [__Type!]!
		queryType: __Type!
		mutationType: __Type
		liveType: __Type
		directives: [__Directive!]!
		"The pipeline stages this runtime understands."
		pipelineOperators: [__PipelineOperator!]!
		"The optional features this runtime supports."
		features: [__Feature!]!
	}

	"Something the specification leaves optional, and whether it is here."
	type __Feature {
		name: String!
		description: String!
		supported: Boolean!
	}

	"A named type, or a wrapper around one."
	type __Type {
		kind: __TypeKind!
		name: String
		description: String
		fields(includeDeprecated: Boolean = false): [__Field!]
		interfaces: [__Type!]
		possibleTypes: [__Type!]
		enumValues(includeDeprecated: Boolean = false): [__EnumValue!]
		inputFields: [__InputValue!]
		ofType: __Type
	}

	enum __TypeKind {
		SCALAR
		OBJECT
		INTERFACE
		UNION
		ENUM
		INPUT_OBJECT
		LIST
		NON_NULL
		OPTIONAL
	}

	type __Field {
		name: String!
		description: String
		args: [__InputValue!]!
		type: __Type!
		isDeprecated: Boolean!
		deprecationReason: String
		"Whether \`| page\` applies to this field."
		isConnection: Boolean!
		"What the field costs, when it declares a cost."
		cost: Int
		"What the field requires of the caller, when it says so."
		auth: String
	}

	type __InputValue {
		name: String!
		description: String
		type: __Type!
		defaultValue: String
		isDeprecated: Boolean!
		deprecationReason: String
	}

	type __EnumValue {
		name: String!
		description: String
		isDeprecated: Boolean!
		deprecationReason: String
	}

	type __Directive {
		name: String!
		description: String
		locations: [String!]!
		args: [__InputValue!]!
		isRepeatable: Boolean!
	}

	"A stage that may follow a list field."
	type __PipelineOperator {
		name: String!
		description: String
		arguments: [String!]!
		"The kind of field the stage may follow."
		appliesTo: String!
	}
`;
