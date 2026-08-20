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

export {
	analyzeRequest,
	buildCatalog,
	buildCatalogFromIntrospection,
	buildCatalogFromIntrospectionSafe,
	buildCatalogSafe,
	compareCatalogs,
	createNexHandler,
	createOperationStore,
	execute,
	findBrokenOperations,
	findDeprecations,
	generateCatalogTypes,
	generateTypes,
	introspectionFromCatalog,
	isDocument,
	isValidRequest,
	normalizeRequest,
	parse,
	parseSafe,
	print,
	printCatalog,
	requestKey,
	subscribe,
	toEventStream,
	tokenize,
	validateDocument,
	validateRequest,
	type CatalogInput,
	type CatalogResult,
	type ExecuteOptions,
	type GenerateTypesOptions,
	type IntrospectionResult,
	type NexBudgetOptions,
	type NexHandlerOptions,
	type NormalizeOptions,
	type BrokenOperation,
	type OperationSource,
	type OperationStore,
	type ParseResult,
	type RequestInput,
	type RequestLimits,
	type SubscribeOptions,
} from './api/index.js';

export { createCostBudget } from './analysis/index.js';
export type {
	BudgetDecision,
	CostBudget,
	CostBudgetOptions,
	AnalysisOptions,
	DeprecationNotice,
	DeprecationOptions,
	RequestAnalysis,
} from './analysis/index.js';

export { sortCatalog } from './catalog/index.js';
export {
	BUILT_IN_SCALARS,
	ChangeSeverity,
	type Catalog,
	type CatalogChange,
} from './catalog/index.js';
export { DirectiveLocation } from './catalog/directive-locations.js';

export {
	createNexClient,
	readEventStream,
	type DehydratedNexState,
	type NexClient,
	type NexClientOptions,
	type NexRequestOptions,
} from './client/index.js';

export {
	ErrorPolicy,
	LiveDelivery,
	createLoader,
	type LoadMany,
	type Loader,
	type LoaderOptions,
	type Authorize,
	type AuthorizeRequest,
	applyPatch,
	diffValues,
	type ExecutionResult,
	type PatchOperation,
	type FieldResolver,
	type Instrumentation,
	type LiveSource,
	type LiveSources,
	type OperationTrace,
	type Page,
	type ResolverInfo,
	type Resolvers,
	type TypeNameResolver,
	type TypeResolvers,
} from './execution/index.js';

export {
	INTROSPECTION_QUERY,
	OPTIONAL_FEATURES,
	PIPELINE_OPERATORS,
	type PipelineOperatorDescription,
} from './introspection/index.js';

export {
	NexCatalogError,
	NexErrorCode,
	NexExecutionError,
	NexSyntaxError,
	NexValidationError,
	type SourceLocation,
} from './errors/index.js';

export { Kind, OperationType } from './language/kinds/index.js';
export { printSourceExcerpt } from './language/source-excerpt.js';
export { minifyRequest } from './language/minify.js';
export {
	valueToNode,
	type ValueToNodeOptions,
} from './language/value-to-node.js';
export {
	parseCoordinate,
	printCoordinate,
	type ArgumentCoordinateNode,
	type CoordinateNode,
	type DirectiveArgumentCoordinateNode,
	type DirectiveCoordinateNode,
	type MemberCoordinateNode,
	type TypeCoordinateNode,
} from './language/coordinates/index.js';
export {
	concatDocuments,
	getOperation,
	separateOperations,
} from './language/documents.js';
export { resolveCoordinate, type CoordinateTarget } from './catalog/index.js';
export {
	BREAK,
	SKIP,
	visit,
	visitWithTypes,
	visitorKeys,
	type TypedVisitFn,
	type TypedVisitor,
	type TypedVisitorInfo,
	type EnterLeaveVisitor,
	type VisitFn,
	type Visitor,
	type VisitorPath,
	type VisitorResult,
} from './language/visitor/index.js';
export {
	isExecutableDefinitionNode,
	isPipelineStageNode,
	isSelectionNode,
	isTypeNode,
	isTypeSystemDefinitionNode,
	isTypeSystemExtensionNode,
	isValueNode,
} from './language/predicates.js';
export { TokenKind, type Token } from './language/token/index.js';

export type {
	ArgumentNode,
	ASTNode,
	BinaryExpressionNode,
	BinaryOperator,
	BooleanValueNode,
	ComparisonOperator,
	CustomStageNode,
	DefinitionNode,
	DirectiveDefinitionNode,
	EnumTypeDefinitionNode,
	EnumValueDefinitionNode,
	ExecutableDefinitionNode,
	FieldDefinitionNode,
	InputObjectTypeDefinitionNode,
	InputValueDefinitionNode,
	InterfaceTypeDefinitionNode,
	ObjectTypeDefinitionNode,
	OperationTypeDefinitionNode,
	ScalarTypeDefinitionNode,
	SchemaDefinitionNode,
	TypeDefinitionNode,
	TypeSystemDefinitionNode,
	UnionTypeDefinitionNode,
	DirectiveNode,
	DocumentNode,
	EnumValueNode,
	ExpressionNode,
	FieldNode,
	FieldPathNode,
	FilterStageNode,
	FloatValueNode,
	FragmentDefinitionNode,
	FragmentSpreadNode,
	InlineFragmentNode,
	IntValueNode,
	ListTypeNode,
	ListValueNode,
	Location,
	NameNode,
	NamedTypeNode,
	NonNullTypeNode,
	NullValueNode,
	ObjectFieldNode,
	ObjectValueNode,
	OperationDefinitionNode,
	OptionalTypeNode,
	PageStageNode,
	PipelineStageNode,
	SelectionNode,
	SelectionSetNode,
	SkipStageNode,
	SortDirection,
	SortStageNode,
	StringValueNode,
	TakeStageNode,
	TypeNode,
	UnaryExpressionNode,
	UniqueStageNode,
	ValueNode,
	VariableDefinitionNode,
	VariableNode,
} from './language/ast/index.js';
