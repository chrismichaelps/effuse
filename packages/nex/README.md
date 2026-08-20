<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  Nex is a hierarchical, strongly typed query language for Effuse: a request names the shape it wants, and the response matches it.
</p>

# `@effuse/nex`

Nex owns the language and everything built on it: lexer, parser, printer, the
schema definition language, the catalog those definitions build, validation of a
request against that catalog, cost analysis, execution, live operations,
introspection, and an HTTP mapping.

## Install

```bash
pnpm add @effuse/nex
```

## Usage

```ts
import { parse, print, parseSafe } from '@effuse/nex';

const document = parse(`
  query GetPosts($limit: Int = 10) {
    posts
      | filter status == PUBLISHED
      | sort createdAt desc
      | page first: $limit after: $cursor {
          title
          author { name }
        }
  }
`);

print(document); // canonical Nex source

const result = parseSafe('{ posts');
if (!result.success) {
  console.error(result.error.message, result.error.location); // line, column, offset
}
```

## Public Surface

| Export                                  | Description                                                            |
| --------------------------------------- | ---------------------------------------------------------------------- |
| `parse(source)`                         | Parse Nex source into a `DocumentNode`; throws `NexSyntaxError`.       |
| `parseSafe(source)`                     | Same, returning `{ success, document }` or `{ success, error }`.       |
| `print(document)`                       | Render a document back to canonical Nex source.                        |
| `tokenize(source)`                      | Scan source into its token stream.                                     |
| `validateDocument(value)`               | Check an untrusted value is a well-formed document; throws on failure. |
| `isDocument(value)`                     | Type guard for the same check.                                         |
| `buildCatalog(input)`                   | Build a catalog from schema source or a document; throws on failure.   |
| `buildCatalogSafe(input)`               | Same, returning `{ success, catalog }` or `{ success, errors }`.       |
| `validateRequest(input, catalog)`       | Check a request against a catalog; returns every problem found.        |
| `isValidRequest(input, catalog)`        | Whether the request has no problems.                                   |
| `Kind`, `OperationType`, `TokenKind`    | Node, operation, and token kind constants.                             |
| `NexSyntaxError`                        | Plain `Error` subclass carrying `location` and `_tag`.                 |
| `NexCatalogError`, `NexValidationError` | The same shape for catalog and request problems, with a `path`.        |
| AST node types                          | `DocumentNode`, `FieldNode`, `PipelineStageNode`, and the rest.        |

The public API is plain TypeScript: no Effect types are exposed, and a build-time check (`scripts/check-public-types.mjs`) fails the build if any leak into the published declarations.

## Pipelines

Any list field may carry pipeline stages, parsed in written order into typed nodes:

| Stage                                | Node                                                                                           |
| ------------------------------------ | ---------------------------------------------------------------------------------------------- |
| `\| filter <condition>`              | `FilterStageNode` with a `BinaryExpressionNode` / `UnaryExpressionNode` / `FieldPathNode` tree |
| `\| sort <path> [asc\|desc]`         | `SortStageNode` (`asc` when the direction is implicit)                                         |
| `\| take <n>` / `\| skip <n>`        | `TakeStageNode` / `SkipStageNode`                                                              |
| `\| page first: <n> after: <cursor>` | `PageStageNode`                                                                                |
| `\| unique`                          | `UniqueStageNode`                                                                              |
| anything else                        | `CustomStageNode`, so custom operators keep parsing                                            |

Filter conditions support `==`, `!=`, `<`, `<=`, `>`, `>=`, `and`, `or`, `not`, parentheses, and dotted paths. A bare name on the left of a comparison is a field path; on the right it is an enum value.

## Types

`ID!` is non-null, `ID?` is explicitly optional, and both list spellings parse to the same AST: `[Post!]!` and `Post![]!` are interchangeable.

## Schema definitions and the catalog

`parse` accepts schema definitions alongside requests, so one document may hold both:

```nex
schema { query: Query mutation: Mutation live: Live }

type User implements Node {
  id: ID!
  email: String?
  posts: [Post!]! @connection
}

enum Status { DRAFT PUBLISHED ARCHIVED }
input CreatePostInput { title: String! tags: [String!] }
directive @auth(requires: Role!) repeatable on FIELD | OBJECT
```

Object and interface fields may carry a default (`status: Status = DRAFT`), as the specification writes them. Descriptions in front of a definition are kept on the node and printed back in the spelling they were written in.

`buildCatalog` turns those definitions into a lookup surface:

```ts
import { buildCatalog } from '@effuse/nex';

const catalog = buildCatalog(schemaSource);

catalog.getRootType('query'); // the Query object type
catalog.getField('User', 'email'); // the field definition
catalog.isConnectionField('User', 'posts'); // true, so `| page` applies
catalog.getPossibleTypes('Node'); // every object implementing it
catalog.getDirective('auth');
```

Building checks that the catalog hangs together: no name defined twice, no field declared twice on one type, every referenced type defined (the built-in scalars aside), interfaces used where interfaces belong, union members that are object types, and root operations that name object types. `buildCatalogSafe` reports every problem at once; `buildCatalog` throws the first.

Root operation types come from the `schema` block, falling back to the conventional `Query`, `Mutation`, and `Live` names when a document has no schema block.

## Validating a request

`validateRequest` checks a parsed request against a catalog and returns every problem it found, in document order. An empty array means the request is ready to execute.

```ts
import { buildCatalog, validateRequest } from '@effuse/nex';

const catalog = buildCatalog(`
  type Query { posts(status: Status): [Post!]! @connection }
  type Post { id: ID! title: String! createdAt: DateTime! }
  enum Status { DRAFT PUBLISHED }
`);

const problems = validateRequest(
  '{ posts | sort createdAt desc | page first: 10 { title } }',
  catalog
);
// []

validateRequest('{ posts | page first: 10 { headline } }', catalog);
// [NexValidationError: Cannot query field "headline" on type "Post"]
```

Each problem carries the message, the `location` it was written at, and the response `path` that leads to it.

What it checks:

- **Only executable definitions** - a request holds operations and fragments; catalog definitions sent as a request are refused rather than ignored.
- **Selections that share a response key** must describe the same thing: the same field, with the same arguments. Two branches of a union are exempt, since only one of them can run.
- **Operations** - unique names, a lone anonymous operation, a root type the catalog actually defines.
- **Fields** - the field exists on its parent type, composite fields carry a selection, leaf fields do not, and a union is only entered through a fragment.
- **Arguments** - known, provided once, required ones present, and every literal checked against its declared type, down through input objects and lists.
- **Variables** - declared once, an input type, used somewhere, and usable at each place they are written, counting a default value as satisfying a non-null position.
- **Fragments** - unique names, a composite type condition the catalog knows, spreads that can actually apply, no cycles, nothing left unused.
- **Directives** - known, allowed at that location, repeated only when declared repeatable, arguments checked like a field's.
- **Pipelines** - stages only on list fields; `| page` only on a `@connection` field, with forward or backward arguments but never both and always a page size; `| take` and `| skip` counts that are integers; `| sort` and `| filter` paths that resolve on the item type, ending on a leaf, with enum comparisons checked for membership. A stage the language does not define is left to the runtime that adds it.

## Running a request

```ts
import { buildCatalog, execute } from '@effuse/nex';

const catalog = buildCatalog(`
  type Query { posts: [Post!]! @connection }
  type Post { id: ID! title: String! rank: Int! author: User! }
  type User { id: ID! name: String! }
`);

const result = await execute({
  request:
    '{ posts | sort rank asc | page first: 2 { title author { name } } }',
  catalog,
  resolvers: {
    Query: { posts: () => db.posts.all() },
    Post: { author: (post) => db.users.byId(post.authorId) },
  },
  variables: {},
});

result.data; // { posts: { items: [...], pageInfo: {...}, totalCount: 3 } }
result.errors; // present only when something went wrong
result.extensions.cost; // what the request was priced at
```

A field with no resolver reads the property of the same name off its source value, so a plain object works as a source with no resolvers at all.

`execute` parses, validates, coerces variables, and only then resolves - the order specification section 6 lays out. Pass `validate: false` for a request already checked, and `limits: { maxCost, maxDepth }` to refuse an expensive one before any resolver runs.

### What execution does

- **Queries** resolve their fields concurrently. A **mutation** resolves its root fields one after another, as does a `transaction { ... }` block; everything below them resolves concurrently again.
- **Nullability** follows the type: a failing nullable field becomes `null` and the error is reported; a failing non-null field nulls the nearest nullable parent instead, up to `data: null`.
- **Error policy** is `partial` by default (data and errors together), `failFast` to stop at the first problem, or `ignore` to null the failures silently.
- **Pipelines** run over the rows a resolver returned: `filter` and `sort` read dotted paths, resolving a relation through its resolver when the row only points at it, and `take`, `skip`, `unique`, and `page` follow.
- **Pages** come back in the shape of specification section 8 - `items`, `pageInfo`, `totalCount` - with opaque cursors this package hands out and only accepts back.
- **Leaf values** are checked as they are serialized: an `Int` field that resolves to a string is an error, not a silent `NaN`.

## Live operations

A `live` operation watches exactly one field. Give `subscribe` a source for it and read the stream; each event produces a full snapshot in the same response shape a query returns.

```ts
import { subscribe } from '@effuse/nex';

const stream = subscribe({
  request:
    'live Feed { postAdded(channel: "general") { title author { name } } }',
  catalog,
  resolvers,
  sources: {
    Live: { postAdded: (args) => broker.subscribe(String(args.channel)) },
  },
});

for await (const snapshot of stream) {
  send(snapshot); // { data, errors?, extensions }
}
```

Stop reading and the source is closed with the loop.

### Sending only what changed

A board of players changes one score at a time, and sending the whole board
each time is mostly repetition. Ask for differential delivery and the first
event carries the whole response, the rest carry what changed:

```ts
const stream = subscribe({
  request,
  catalog,
  sources,
  delivery: 'differential',
});

let snapshot;
for await (const event of stream) {
  snapshot = event.patch ? applyPatch(snapshot, event.patch) : event.data;
  render(snapshot);
}
```

A patch is a list of `set` and `remove` operations, each with the path it
applies at, and `applyPatch` returns a new value rather than touching the one
it was given. A snapshot that failed cannot be described as a change against
the one before it, so the next one that succeeds is sent whole again.

`diffValues` and `applyPatch` are exported on their own, for a client that
keeps its own cache.

## Introspection

`__schema` and `__type` answer from the catalog with no wiring, alongside `__typename`. Beyond the shape of the catalog, they report what the catalog knows: whether a field is a `@connection`, what it costs, what it requires of the caller, which pipeline operators the runtime understands, and which optional features it supports.

```ts
await execute({
  request: '{ __schema { features { name supported } } }',
  catalog,
});
// costAnalysis, differentialLive, transactions, introspection
```

```ts
await execute({
  request: '{ __schema { pipelineOperators { name appliesTo } } }',
  catalog,
});
```

## What kind of problem an error is

Every error carries a `code`, so a client branches on that rather than on a
message written for people:

| Code                        | Raised when                                                  |
| --------------------------- | ------------------------------------------------------------ |
| `SYNTAX`                    | The source could not be read as a document                   |
| `CATALOG`                   | The catalog itself does not hold together                    |
| `VALIDATION`                | The request does not agree with the catalog                  |
| `COST_LIMIT`, `DEPTH_LIMIT` | The request is priced or nested above what the server allows |
| `VARIABLE`                  | A variable was missing, or its value does not fit its type   |
| `RESOLVER`                  | A resolver threw                                             |
| `NON_NULL`                  | A field the catalog declares non-null produced null          |
| `CURSOR`                    | A cursor was not one this server handed out                  |
| `INTERNAL`                  | Anything else that went wrong while running                  |

The code travels in the response, under `extensions.code`, alongside whatever
extensions a server adds of its own.

## Errors that point at the source

Every error the lexer and parser raise carries an excerpt of what it was reading:

```ts
const result = parseSafe('query A {\n  user(id: )\n}');
if (!result.success) console.error(String(result.error));
```

```text
NexSyntaxError: Expected a value, found ")" (2:12)

1 | query A {
2 |   user(id: )
  |            ^
3 | }
```

`printSourceExcerpt(source, location, { context })` does the same for any location - a validation error, a field that failed - as long as the source is at hand.

## A client that only has introspection

A client with no access to the catalog's source can rebuild one from what the server says:

```ts
import {
  INTROSPECTION_QUERY,
  buildCatalogFromIntrospection,
  validateRequest,
} from '@effuse/nex';

const response = await fetch('/nex', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ query: INTROSPECTION_QUERY }),
});

const catalog = buildCatalogFromIntrospection(await response.json());
validateRequest('{ posts | page first: 10 { title } }', catalog); // checked locally
```

The rebuilt catalog validates, analyses, and prints exactly like one built from source, `@connection`, `@cost`, `@auth`, and deprecation included. Introspection requests are themselves bounded: a request that walks the type graph more than three times over is refused.

## Pointing at one thing in a catalog

A coordinate names a single thing, which is what a lint rule, a deprecation note, or a review comment needs:

```ts
resolveCoordinate(catalog, 'Post.title'); // the field definition
resolveCoordinate(catalog, 'Query.posts(first:)'); // the argument definition
resolveCoordinate(catalog, 'Status.DRAFT'); // the enum value
resolveCoordinate(catalog, '@tag(name:)'); // the directive's argument
```

`parseCoordinate` reads the five shapes - `Type`, `Type.member`, `Type.member(argument:)`, `@directive`, `@directive(argument:)` - and `printCoordinate` writes them back out. Anything else is refused with a message that quotes what it was given.

## Working with documents

```ts
separateOperations(document); // { A: DocumentNode, B: DocumentNode }
concatDocuments(schemaDoc, extensionsDoc);
getOperation(document, 'A');
```

`separateOperations` gives each operation its own document carrying only the fragments it reaches, which is what a persisted-operation store wants; an anonymous operation is keyed by the empty string.

## Naming a request

A persisted-operation store, a response cache, and a request log all need one
name for one request, whatever formatting it arrived in:

```ts
import { normalizeRequest, requestKey } from '@effuse/nex';

normalizeRequest('query Feed{posts|take 2{title}}');
// query Feed {
//   posts
//     | take 2 {
//     title
//   }
// }

await requestKey('query Feed { posts | take 2 { title } }');
// "6f1c…" - the SHA-256 of the normalized request
```

Both keep only the operation asked for, with the fragments it reaches, so two
requests that run the same way get the same name even when they were sent from
different files. Hashing goes through the platform's own crypto, so this works
in Node, Bun, an edge worker, and a browser alike.

## Walking a document

`visit` walks any node the parser produces, and rewrites it if the visitor asks:

```ts
import { visit, SKIP, BREAK } from '@effuse/nex';

// Rename a field everywhere it is written
const renamed = visit(document, {
  Name: (node) =>
    node.value === 'legacy' ? { ...node, value: 'current' } : node,
});

// Collect the fields a request asks for, without descending into fragments
const fields: string[] = [];
visit(document, {
  Field: (node) => void fields.push(node.name.value),
  FragmentSpread: () => SKIP,
});
```

A handler returns nothing to leave a node alone, a node to replace it, `null` to remove it, `SKIP` to leave its children unvisited, or `BREAK` to end the walk. Handlers can be per-kind (`Field`), per-kind with `enter`/`leave`, or `enter`/`leave` for every node; each is told the node, the key it sits under, its parent, and the path from the root.

The walk never mutates what it was given - an edited document comes back as a new tree - and `visitorKeys` lists the children of every node kind, so a tool can drive its own traversal from the same table.

`isExecutableDefinitionNode`, `isTypeSystemDefinitionNode`, `isTypeSystemExtensionNode`, `isSelectionNode`, `isValueNode`, `isTypeNode`, and `isPipelineStageNode` narrow a node without matching on `kind` by hand.

## What a catalog must satisfy

`buildCatalog` refuses a catalog that does not hold together, reporting every problem rather than the first:

- A query root type exists, and every declared root is an object type.
- Fields carry output types, arguments and input fields carry input types.
- Object, interface, and input types declare at least one field; enums declare at least one value; unions include at least one object type, listed once each.
- A type that says it implements an interface declares every field the interface does, with the same type and at least the same arguments.
- Nothing is declared twice - a field, an argument, an enum value, a union member.
- No name begins with `__`, which belongs to introspection.
- No input type requires itself, directly or through a chain, since nothing could ever be built for it.

## Extending a catalog

`extend` adds to what a catalog already declares - fields to a type or interface, members to a union, values to an enum, fields to an input type, directives to a scalar, root types to the schema block. An extension may appear before the definition it extends, and one that adds nothing, extends a type the catalog does not define, or redeclares something is refused when the catalog is built.

```nex
extend type User implements Node { nickname: String? }
extend enum Status { SCHEDULED }
extend schema { live: Live }
```

## Cost and depth

`analyzeRequest` prices a request before it runs. A field costs what its `@cost(value:)` says and one unit otherwise, plus everything it selects; a list multiplies its subtree by the rows it is expected to yield, read from `| page first:` or `| take`, and assumed to be 20 when the request leaves it open.

```ts
analyzeRequest('{ posts | page first: 10 { title } }', catalog); // { cost: 11, depth: 2 }
validateRequest(request, catalog, { maxCost: 500, maxDepth: 8 });
```

## Serving over HTTP

`handleHttpRequest` maps HTTP onto this package without knowing anything about a particular server: hand it a method, a URL, headers, and a body, and it hands back a status, headers, and either a body or a stream.

```ts
import { handleHttpRequest } from '@effuse/nex';

const answer = await handleHttpRequest(
  {
    method: request.method,
    url: request.url,
    headers,
    body: await request.text(),
  },
  { catalog, resolvers, sources, context: { user } }
);

if (answer.stream) {
  for await (const frame of answer.stream) write(frame); // server-sent events
} else {
  send(answer.status, answer.headers, answer.body);
}
```

How it maps:

| Situation                                                                                | Answer                                                                  |
| ---------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `POST` with `application/json`                                                           | Runs the request                                                        |
| `GET` with a `query` parameter                                                           | Runs it, but only if it is a query                                      |
| A mutation or live operation over `GET`                                                  | `405`, with `Allow: POST`                                               |
| Any other method                                                                         | `405`, with `Allow: GET, POST`                                          |
| A body that is not JSON, or carries no `query`                                           | `400`                                                                   |
| A content type other than JSON                                                           | `415`                                                                   |
| A request that does not parse, does not agree with the catalog, or is missing a variable | `400`                                                                   |
| A field that failed while running                                                        | `200`, with the errors beside the data                                  |
| A JSON array of requests                                                                 | Runs them together, answers with an array in the same order             |
| A live operation                                                                         | `200 text/event-stream`, one `next` event per snapshot, then `complete` |

Batches are capped at ten requests unless `maxBatchSize` says otherwise, and a live operation cannot be batched.

## Running this in production

The defaults are safe to start from; these are the knobs a server should reach for.

```ts
const answer = await handleHttpRequest(request, {
  catalog,
  resolvers,
  sources,
  context: { user },
  introspection: process.env.NODE_ENV !== 'production',
  limits: { maxCost: 5_000, maxDepth: 12 },
  maxBatchSize: 5,
  formatError: (error) =>
    error.extensions.safe === true
      ? error
      : new NexExecutionError({
          message: 'Something went wrong',
          path: error.path,
        }),
});
```

- **Introspection** answers by default. Pass `introspection: false` to `execute`, `subscribe`, or the handler and `__schema` and `__type` are refused during validation, before anything runs. `__typename` is unaffected.
- **Cost and depth** are not enforced unless asked for. Set `limits` and an expensive request is refused before a resolver is called.
- **Error messages** go out as written. `formatError` rewrites every error - request, field, and live snapshot alike - so internal detail never reaches a client.
- **Batches** are capped at ten requests; lower it with `maxBatchSize`.

What the package refuses on its own, whatever the options say:

- A document nested deeper than 256 levels, or carrying more than 100,000 tokens, is refused as a syntax error rather than being walked into a stack overflow.
- Response objects and coerced inputs are built with no prototype, so a request writing `__proto__` as an alias, or a client sending it as an input key, cannot reach `Object.prototype`.
- Cursors are read back only if this package handed them out.
- Nothing reaches for a runtime global: cursors encode their own base64, so the package runs unchanged in Node, Bun, an edge worker, or a browser.

## Specification coverage

Implemented: section 2 (the language in full), section 3 (the type system and the catalog it builds), section 4 (introspection, including pipeline operators, cost, and authorization), section 5 (validation, cost, and depth limits), section 6 (execution and error policies), section 7 (the response shape), section 8 (the page shape), and the schema extensions of section 10.

Section 9 is covered for HTTP, including batching and server-sent events for live operations; binary protocols and multipart uploads are not. Federation, which the specification lists as future work, is not implemented.

## License

MIT
