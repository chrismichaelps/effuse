<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  The core library for Effuse. It provides the reactive Signals engine and the lightweight DOM renderer, serving as the foundation for building interactive interfaces.
</p>

## Framework Direction

Effuse core is moving toward a capability-first framework model: typed layers,
local layer aliases in `define({ script })`, shared hook/component layer DX, and
layer-owned server APIs/actions with client-side action helpers and server
manifests for typed clients. Server handlers also receive validation helpers for
params, query, headers, JSON bodies, and form data so request contracts live next
to the layer that owns the capability. Typed server errors can be returned with
`ctx.response.error`, thrown with `LayerServerError`, and narrowed from action
clients through `LayerActionError<T>`.
Layer-owned server routes and actions can also declare middleware plus cache,
CORS, runtime, region, and duration metadata that flows into responses and the
server manifest.

Read the detailed proposal in [FRAMEWORK_DX_PROPOSAL.md](./FRAMEWORK_DX_PROPOSAL.md).

## Async Derived State

`asyncComputed` is derived state whose computation is asynchronous, without the
correctness hole that every other implementation of the idea shares.

Synchronous dependency tracking collects reads into a call-stack-scoped context,
and an `await` unwinds that stack. Reads after resumption land nowhere. VueUse's
`computedAsync` documents the consequence: only dependencies referenced before
the first `await` are tracked. Vue forbids async in `computed` outright, Solid's
own reactivity discussion calls async derivations "very difficult" outside
`createResource`, and React sends you to a query library.

The design removes the failure rather than defending against it — the tracked
half and the async half are separate functions:

```ts
const user = asyncComputed({
  // Synchronous. Tracked completely, because there is no await in it.
  source: () => ({ id: userId.value, page: page.value }),
  equals: (a, b) => a.id === b.id && a.page === b.page,

  // Async, and handed an already-resolved value. Nothing left to track.
  load: async ({ id, page }, ctx) =>
    fetch(`/users/${id}?page=${page}`, { signal: ctx.signal }).then((r) => r.json()),

  hydrationKey: 'user',
});

user.value;    // Value | undefined — reading never throws
user.loading;  // boolean
user.error;    // unknown | undefined
user.stale;    // the value belongs to a superseded source
```

What it does that hand-rolled versions usually miss:

| Behaviour | Why it matters |
| --- | --- |
| `ctx.signal` aborts on supersede and dispose | A cancelled request still costs bandwidth and a server connection slot |
| Superseded results are discarded | The lost-update bug: a stale response arriving last overwrites a newer one |
| Cancellation is not an error | Otherwise every keystroke in a search box reports a failure the user never caused |
| Stale-while-revalidate by default | Blanking on each keystroke is a spinner flash that reads as a slower interface |
| Errors are state, never thrown | A throw during render is a crash; an error boundary is the wrong place for a failed fetch |
| One load per batch | Two source signals changing together are one logical change |
| Retry with backoff, and `shouldRetry` | A 404 will not become a 200 by asking again |

### Server-side rendering

Without SSR support an async computation is worse than useless: the server
renders a spinner, the client hydrates and immediately refetches, and the request
is paid for twice.

Supplying a `hydrationKey` makes the value part of the page payload.

```ts
// Server
const collector = createAsyncCollector();
const html = runWithAsyncCollector(collector, () => render());

await collector.settle();          // awaits every pending computation
const state = collector.serialize();  // merge into the hydration payload
collector.dispose();               // cancels anything still in flight

// Client, once, before the first render
hydrateAsyncState(payload.state);
```

The client then starts **settled**, with the server's value, and only loads when
its source actually changes.

Three details worth knowing:

- **The collector lives in async context, not a module global.** Concurrent
  requests interleave across every `await` in Node, and a shared global would
  hand one request's data to another — a leak between users, not merely a bug.
- **`settle` is bounded** by both a wave count and a time budget. A load can
  create another load; the bound turns a cyclic dependency into a slow request
  rather than a hung one, and an unresponsive provider into a page rendered
  without that data.
- **Hydrated entries are consumed.** The payload describes the *initial* render,
  so a component remounted later fetches fresh data rather than resurrecting a
  value that may be minutes old.

## Browser Hooks

Core browser hooks keep server rendering and the browser's pre-mount hydration
pass deterministic. Storage reads, DOM listeners, element-ref resolution, and
observer construction begin after component mount.

| Hook | Standalone cleanup |
| --- | --- |
| `useLocalStorage`, `useSessionStorage` | `result.dispose()` |
| `useOnClickOutside` | returned `stop()` function |
| `useResizeObserver`, `useIntersectionObserver` | `signal.stop()` |

```ts
const size = useResizeObserver(() => panelRef);
const preferences = useLocalStorage('preferences', defaults);
```

Component-owned resources stop automatically during unmount. Call the cleanup
API when using a hook outside a component. A storage write requested before
mount updates the signal immediately and is flushed at mount without first
replacing it from the stored value.
