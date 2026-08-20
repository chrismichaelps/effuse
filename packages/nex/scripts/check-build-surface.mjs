#!/usr/bin/env node
/**
 * Guard what ships: the built entry point must expose the whole public API and
 * still work when imported the way a consumer imports it. Type checking and
 * the test suite both read `src`, so neither of them notices an export that
 * never made it into the barrel.
 */
import { dirname, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const entry = pathToFileURL(resolve(packageRoot, 'dist/index.js')).href;

const REQUIRED = [
	'analyzeRequest',
	'applyPatch',
	'buildCatalog',
	'buildCatalogFromIntrospection',
	'buildCatalogFromIntrospectionSafe',
	'buildCatalogSafe',
	'ChangeSeverity',
	'compareCatalogs',
	'createLoader',
	'createNexClient',
	'createOperationStore',
	'concatDocuments',
	'diffValues',
	'readEventStream',
	'execute',
	'findBrokenOperations',
	'findDeprecations',
	'generateCatalogTypes',
	'generateTypes',
	'introspectionFromCatalog',
	'minifyRequest',
	'createNexHandler',
	'isDocument',
	'isValidRequest',
	'normalizeRequest',
	'getOperation',
	'parse',
	'parseCoordinate',
	'parseSafe',
	'print',
	'printCatalog',
	'sortCatalog',
	'valueToNode',
	'visitWithTypes',
	'printCoordinate',
	'printSourceExcerpt',
	'requestKey',
	'resolveCoordinate',
	'separateOperations',
	'subscribe',
	'toEventStream',
	'tokenize',
	'validateDocument',
	'validateRequest',
	'BUILT_IN_SCALARS',
	'DirectiveLocation',
	'ErrorPolicy',
	'LiveDelivery',
	'OPTIONAL_FEATURES',
	'Kind',
	'NexCatalogError',
	'NexErrorCode',
	'NexExecutionError',
	'NexSyntaxError',
	'NexValidationError',
	'OperationType',
	'INTROSPECTION_QUERY',
	'PIPELINE_OPERATORS',
	'TokenKind',
	'visit',
	'visitorKeys',
	'BREAK',
	'SKIP',
	'isExecutableDefinitionNode',
	'isSelectionNode',
	'isTypeNode',
	'isTypeSystemDefinitionNode',
	'isTypeSystemExtensionNode',
	'isValueNode',
];

const nex = await import(entry);
const missing = REQUIRED.filter((name) => nex[name] === undefined);

if (missing.length > 0) {
	console.error(
		`[build-surface] dist/index.js is missing: ${missing.join(', ')}`
	);
	process.exit(1);
}

const catalog = nex.buildCatalog(`
	type Query { posts: [Post!]! @connection }
	type Post { id: ID! title: String! rank: Int! }
`);

const result = await nex.execute({
	request: '{ posts | sort rank asc | page first: 1 { title } }',
	catalog,
	resolvers: {
		Query: {
			posts: () => [
				{ id: '2', title: 'second', rank: 2 },
				{ id: '1', title: 'first', rank: 1 },
			],
		},
	},
});

const page = result.data?.posts;
const title = page?.items?.[0]?.title;

if (result.errors !== undefined || title !== 'first') {
	console.error(
		`[build-surface] the built package did not run a request: ${JSON.stringify(result)}`
	);
	process.exit(1);
}

console.log(
	`[build-surface] ${String(REQUIRED.length)} public exports present, and the build runs a request`
);
