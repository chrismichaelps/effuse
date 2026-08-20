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
 * The request a client sends to learn what a server can do.
 *
 * It asks for everything `buildCatalogFromIntrospection` needs to rebuild a
 * catalog, and nothing else: type references are unwrapped far enough for the
 * wrappers a type reference can carry.
 */
export const INTROSPECTION_QUERY = `
	query Introspection {
		__schema {
			queryType { name }
			mutationType { name }
			liveType { name }
			types {
				kind
				name
				description
				fields(includeDeprecated: true) {
					name
					description
					isDeprecated
					deprecationReason
					isConnection
					cost
					auth
					args {
						name
						description
						defaultValue
						type { ...TypeRef }
					}
					type { ...TypeRef }
				}
				inputFields {
					name
					description
					defaultValue
					type { ...TypeRef }
				}
				interfaces { name }
				enumValues(includeDeprecated: true) {
					name
					description
					isDeprecated
					deprecationReason
				}
				possibleTypes { name }
			}
			directives {
				name
				description
				isRepeatable
				locations
				args {
					name
					description
					defaultValue
					type { ...TypeRef }
				}
			}
		}
	}

	fragment TypeRef on __Type {
		kind
		name
		ofType {
			kind
			name
			ofType {
				kind
				name
				ofType {
					kind
					name
					ofType { kind name }
				}
			}
		}
	}
`;
