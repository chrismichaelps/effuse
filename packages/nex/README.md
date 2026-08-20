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

## Running only what a server knows

A store holds the operations a server will run, each under the name
`requestKey` gives it. A client that ships its operations at build time and a
server that registered the same ones agree without exchanging anything else:

```ts
import { createOperationStore, handleHttpRequest } from '@effuse/nex';

const operations = await createOperationStore.from([
  '{ posts | page first: 10 { title } }',
  'query Post($id: ID!) { post(id: $id) { title } }',
]);

await handleHttpRequest(request, {
  catalog,
  resolvers,
  operations,
  persistedOnly: true,
});
```

A client then sends `{ "id": "6f1c…", "variables": { … } }` instead of the
request itself. With `persistedOnly`, anything sent whole is refused, which
bounds what a client can ask for to what was registered ahead of time - and
makes cost analysis a property of the deployment rather than of each request.
Batches work the same way, by name.

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

`visitWithTypes` walks the same tree with the catalog beside it, so a handler
is told which type a field belongs to, what it returns, and what an argument or
input field expects - what a lint rule or a cost model needs and a plain walk
cannot know. It reads rather than rewrites: tracking types through edits would
describe a tree that no longer exists.

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

## Typing a request

`generateTypes` writes the TypeScript a request comes back as, and the
variables it takes, so a client is typed without a runtime in between:

```ts
generateTypes(
  'query Feed($status: Status) { posts(status: $status) | page first: 2 { title } }',
  catalog
);
```

```ts
export type FeedVariables = {
  status?: 'DRAFT' | 'PUBLISHED' | null;
};

export type FeedData = {
  posts: {
    items: {
      title: string;
    }[];
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    totalCount: number;
  };
};
```

Nullability follows the catalog, enums become the values they can take, a
paged field takes the page shape, and a selection on an interface or a union
becomes one variant per branch, discriminated by `__typename`. A custom scalar
is `unknown`, so a caller has to say what they expect before using it.

The request is validated first: types written from a request that cannot run
would lie about what comes back.

`generateCatalogTypes` does the same for the other side: one type per catalog
type, plus a `CatalogResolvers` map that says what each resolver is given and
what it must return.

```ts
export type CatalogResolvers<TContext = unknown> = {
  Query?: {
    posts?: (
      source: Query,
      args: { status?: Status | null; first?: number | null },
      context: TContext,
      info: ResolverInfo
    ) => Post[] | Promise<Post[]>;
  };
};
```

An interface or union entry also takes `__resolveType`, and every part is
optional, since a field with no resolver reads its own property.

## Changing a catalog without breaking clients

`compareCatalogs` reads two catalogs and says what each difference asks of the
clients already out there:

```ts
compareCatalogs(before, after);
// [
//   { severity: 'breaking', coordinate: 'Query.legacy', message: '"Query.legacy" was removed' },
//   { severity: 'risky', coordinate: 'Status.SCHEDULED', message: '"Status.SCHEDULED" was added, ...' },
//   { severity: 'safe', coordinate: 'Post.byline', message: '"Post.byline" was added' },
// ]
```

A field that leaves breaks whoever asked for it; one that arrives asks nothing
of anyone. In between sit the changes a client meets without failing outright -
a new enum value it has no branch for - which are worth seeing before a release
rather than after. Promising more than before is safe (`String` to `String!`);
promising less is not.

That is the abstract answer. `findBrokenOperations` gives the concrete one, by
checking the operations a server actually holds:

```ts
findBrokenOperations(operations, after);
// [{ operation: 'query Feed { ... }', problems: [NexValidationError: Cannot query field "body" ...] }]
```

Pair it with an operation store in CI and a release says exactly which requests
would stop working, rather than which shapes changed.

## What a request still leans on

A request can validate cleanly and still ask for things on their way out.
`findDeprecations` reports one notice per place, not per name, so a client can
see exactly how much there is to change:

```ts
findDeprecations('{ feed { byline } }', catalog);
// [
//   { coordinate: 'Query.feed', reason: 'use posts', path: ['feed'], ... },
//   { coordinate: 'Post.byline', message: '"Post.byline" is deprecated', ... },
// ]
```

Fields, arguments, input fields, and enum values all count, wherever they were
written - inside a fragment, an argument, or a pipeline filter. A server can
run this over its operation store to see what its clients still depend on
before removing anything.

## Cost and depth

`analyzeRequest` prices a request before it runs. A field costs what its `@cost(value:)` says and one unit otherwise, plus everything it selects; a list multiplies its subtree by the rows it is expected to yield, read from `| page first:` or `| take`, and assumed to be 20 when the request leaves it open.

```ts
analyzeRequest('{ posts | page first: 10 { title } }', catalog); // { cost: 11, depth: 2 }
validateRequest(request, catalog, { maxCost: 500, maxDepth: 8 });
```

## Asking a source once

A field on fifty rows asks fifty times for the same handful of things, and a
source answering one at a time turns one request into fifty queries. A loader
gathers what a run asks for and asks once:

```ts
import { createLoader } from '@effuse/nex';

const handler = createNexHandler({
  catalog,
  resolvers: {
    Post: {
      author: (post, _args, context) => context.authors.load(post.authorId),
    },
  },
});

// One loader per request, never one per server: what a loader remembers is
// what that request has already seen.
const context = () => ({
  authors: createLoader({
    load: (ids) => db.users.whereIn('id', ids),
  }),
});
```

Rows of a list resolve together rather than one after another, which is what
gives a loader something to gather: the fifty rows above reach it in the same
turn, and the source is asked once for the three authors they share.

## Talking to a server

`createNexClient` is the other side of `handleHttpRequest`: it sends requests,
keeps what came back, and hands a render over to the browser.

```ts
import { createNexClient } from '@effuse/nex';

const nex = createNexClient({
  endpoint: '/nex',
  headers: () => ({ authorization: `Bearer ${token()}` }),
});

const result = await nex.request('{ posts | page first: 10 { title } }');

for await (const snapshot of nex.subscribe(
  'live Feed { postAdded { title } }'
)) {
  render(snapshot);
}
```

Answers are kept by what the request does rather than by how it was typed, so
two spellings of one request share an answer. Two callers asking at once share
one request in flight, and a request that failed is never kept - it is asked
again rather than remembered.

Pass `batch: true` and requests made in the same tick travel as one round trip,
which the handler already understands. Membership is decided the moment each
request is made rather than on a timer, so nothing is ever held waiting for a
request that has not been asked for; `{ size }` caps how many travel together,
and a lone request is still sent on its own.

### Server rendering and the browser

The same client runs on both sides, which is what makes the handoff a two-liner:

```ts
// While rendering
await nex.prefetch('{ posts | page first: 10 { title } }');
const payload = nex.dehydrate(); // plain JSON, ready to inline

// In the browser
nex.hydrate(payload);
await nex.request('{ posts | page first: 10 { title } }'); // no request goes out
```

Because entries are keyed by `requestKey`, a render and the browser that takes
over agree on what has already been asked without exchanging anything else -
the same key a persisted-operation store uses.

Point the client at an operation store and it sends the name rather than the
request, which pairs with a server running `persistedOnly`.

## The context a server passes

Whatever is passed as `context` is what resolvers, the authorizer, and live
sources receive - typed as itself, inferred from the call:

```ts
interface Session {
  userId: string;
  roles: string[];
}

await execute({
  request: '{ me secret }',
  catalog,
  context: session, // Session
  resolvers: {
    Query: { me: (_source, _args, context) => context.userId }, // Session
  },
  authorize: ({ requires, context }) => context.roles.includes(requires ?? ''),
});
```

A response keeps its shape the same way. Name what the request returns - the
type `generateTypes` writes for it - and the result reads without a cast:

```ts
const result = await execute<FeedData>({ request, catalog, resolvers });

result.data?.posts.items[0]?.title; // string, no cast
```

The client takes the same parameter: `nex.request<FeedData>(request)`. Nothing
casts, and a context or a response that changes shape is caught where it is
read rather than where it fails. `Resolvers<Session>`, `Authorize<Session>`,
`LiveSources<Session>`, and `createNexHandler<Session>` are there for the
places a type has to be written out, and `generateCatalogTypes` emits a
`CatalogResolvers<TContext>` that lines up with them.

## Serving requests

`createNexHandler` builds the request handler a server mounts. It answers web
`Request`s with web `Response`s, which is exactly what `@effuse/server` binds
to its Node and Bun adapters:

```ts
import { createNodeServer } from '@effuse/server';
import { createNexHandler } from '@effuse/nex';

const server = createNodeServer(
  createNexHandler({ catalog, resolvers, sources, context: { user } })
);

await server.listen({ port: 4000 });
```

Nothing about HTTP itself lives in this package: the runtime owns listening,
body limits, graceful shutdown, and static files, while this owns what a Nex
request means. A live operation comes back as a streaming `Response`, which the
adapters serve without buffering, and when a caller goes away its source is
closed rather than left producing.

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
  authorize: ({ requires, context }) => context.roles.includes(requires ?? ''),
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

- **A caller that goes away** stops the work it started. Pass a `signal` to
  `execute` or `subscribe`, and the run is checked before each field rather
  than only at the start; the request handler passes the request's own signal,
  so a disconnect ends the run and closes a live source.
- **Guarded fields** are refused unless an `authorize` callback says otherwise.
  A field the catalog marks `@auth` is asked about before anything of it runs,
  and with no authorizer configured it is refused rather than quietly resolved:
  a guard the server never checks is worse than no guard at all. A live
  operation is checked before its source is opened.
- **Introspection** answers by default. Pass `introspection: false` to `execute`, `subscribe`, or the handler and `__schema` and `__type` are refused during validation, before anything runs. `__typename` is unaffected.
- **Cost and depth** are not enforced unless asked for. Set `limits` and an expensive request is refused before a resolver is called.
- **Every run carries a trace.** `extensions.traceId` names it, taken from the
  server's own `traceId` when it has one, and `instrumentation.onOperation`
  reports what each run cost, how long it took, and how many problems it
  carried - including runs refused before anything resolved.
  `instrumentation.onFieldError` hands over each field that failed. A watcher
  that throws never breaks the run it watches.
- **Error messages** go out as written. `formatError` rewrites every error - request, field, and live snapshot alike - so internal detail never reaches a client.
- **Batches** are capped at ten requests; lower it with `maxBatchSize`.

What the package refuses on its own, whatever the options say:

- A document nested deeper than 256 levels, or carrying more than 100,000 tokens, is refused as a syntax error rather than being walked into a stack overflow.
- Response objects and coerced inputs are built with no prototype, so a request writing `__proto__` as an alias, or a client sending it as an input key, cannot reach `Object.prototype`.
- Cursors are read back only if this package handed them out.
- Nothing reaches for a runtime global: cursors encode their own base64, so the package runs unchanged in Node, Bun, an edge worker, or a browser.

## What is covered, and how it is held

Each capability, and what keeps it honest:

| Capability             | Held by                                                                                                                   |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Lexer, parser, printer | Round-trip tests, adversarial input (depth and token caps), source excerpts on every error                                |
| Catalog and extensions | Coherence rules with one test each, `printCatalog` round-trip, `sortCatalog` settled ordering                             |
| Validation             | A test per rule, including the pipeline rules this language adds, plus cost and depth limits                              |
| Execution              | Nullability, error policies, mutation ordering, leaf coercion; a conformance sweep across the behaviours a client expects |
| Pipelines and paging   | Filter, sort, take, skip, unique, page; opaque cursors this package alone hands out                                       |
| Live operations        | Snapshot and differential delivery, source closed when a caller goes away                                                 |
| Introspection          | Answers from the catalog, bounded depth, rebuildable into a catalog offline                                               |
| Authorization          | `@auth` refused unless an authorizer says otherwise, checked before a resolver runs or a stream opens                     |
| Cancellation           | A signal checked before each field; the handler passes the request's own                                                  |
| Transport              | Web `Request` and `Response`, batching, server-sent events, status codes per case                                         |
| Client                 | Caching by request identity, in-flight sharing, request batching, SSR handoff                                             |
| Types                  | Context and response shape carried as parameters; `generateTypes` and `generateCatalogTypes` write both ends              |
| Evolution              | `compareCatalogs` grades a change, `findBrokenOperations` names what stops working                                        |
| Observability          | A trace on every run, operation and field-error hooks that cannot break a run                                             |
| Performance            | `pnpm bench:nex` with budgets over a scalar field, a large list, and a paged list                                         |
| Public surface         | Pinned by a test and by a build-time check that imports the built entry and runs a request                                |

Not implemented, and why: federation is future work in the specification;
binary transports and multipart uploads belong to whatever serves the package;
rate limiting is a deployment concern that cost and depth limits inform rather
than replace.

## Specification coverage

Implemented: section 2 (the language in full), section 3 (the type system and the catalog it builds), section 4 (introspection, including pipeline operators, cost, and authorization), section 5 (validation, cost, and depth limits), section 6 (execution and error policies), section 7 (the response shape), section 8 (the page shape), and the schema extensions of section 10.

Section 9 is covered for HTTP, including batching and server-sent events for live operations; binary protocols and multipart uploads are not. Federation, which the specification lists as future work, is not implemented.

## License

MIT
