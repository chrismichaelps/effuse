<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  Effuse Query handles loading, caching, and synchronizing server state. It provides reactive hooks for data fetching with built-in reliability.
</p>

# `@effuse/query`

Query owns request deduplication, cache lifetime, retries, cancellation,
mutations, infinite queries, optimistic updates, and reactive fetch status.

## Install

```bash
pnpm add @effuse/query @effuse/core
```

## Component Setup

Provide one client at the application boundary, then consume it from hooks:

```tsx
import { define } from '@effuse/core';
import {
	createQueryClient,
	QueryClientProvider,
	useQuery,
} from '@effuse/query';

const browserClient = createQueryClient();

export const UserName = define({
	props: { userId: '' },
	script: ({ props }) => {
		const user = useQuery({
			queryKey: ['user', props.userId],
			queryFn: () =>
				fetch(`/api/users/${props.userId}`).then((res) => res.json()),
		});
		return { user };
	},
	template: ({ user }) => <p>{() => user.data.value?.name ?? 'Loading'}</p>,
});

export const App = define({
	script: () => ({ browserClient }),
	template: ({ browserClient }) => (
		<QueryClientProvider client={browserClient}>
			<UserName userId="user-42" />
		</QueryClientProvider>
	),
});
```

Provide the browser client above pages that share cache state; do not create a
new client in each leaf component. Server rendering uses one client per request,
as described below.

## Public Surface

| Area               | APIs                                                               |
| ------------------ | ------------------------------------------------------------------ |
| Client             | `createQueryClient`, `provideQueryClient`, `useQueryClient`        |
| Queries            | `useQuery`, `useQueries`, `useCombinedQueries`, `useInfiniteQuery` |
| Mutations          | `useMutation`, `useOptimisticMutation`, `useIsMutating`            |
| Server preparation | `prefetchQueryAsync`, `fetchQuery`, `ensureQueryData`              |
| Keys and options   | `createQueryKeys`, `queryOptions`, `keepPreviousData`              |

Query functions return promises in normal application code; no additional
runtime API is required.

## Server Request Ownership

Create a `QueryClient` for each server request and provide it to that request's
component tree. Do not keep an authenticated server query client in a module
singleton: ordinary keys such as `['current-user']` do not identify a tenant.

Effuse deduplicates work inside the owning client or execution batch. Standalone
query executions are isolated by default, so unrelated requests cannot share an
in-flight promise merely because their keys match.

## Lifecycle Ownership

Component-owned query hooks release observers, cache subscriptions, polling,
and browser event listeners automatically during unmount. Focus refetch,
reconnect refetch, and `refetchInterval` begin after browser mount; they never
create recurring work during server rendering.

```ts
const user = useQuery({
	queryKey: ['user', userId],
	queryFn: () => loadUser(userId),
	refetchInterval: 30_000,
});
```

Component-owned initial queries start on browser mount. Synchronous SSR never
launches query work it cannot await. Prefetch server data explicitly with a
request-owned client, dehydrate that client into the response, and hydrate it in
the browser without sharing authenticated cache entries across requests.

Standalone hooks retain explicit ownership:

- call `dispose()` on `useQuery` and `useInfiniteQuery` results
- call `dispose()` on `useMutation` results to cancel active mutation work
- call `dispose()` on `useIsFetching` and `useIsMutating` signals
- call `dispose()` on each `useQueries` result or on the combined result

All cleanup methods are idempotent and use Effuse-owned application contracts.

Only one mutation call is active per `useMutation` result. A newer call,
`reset()`, or `dispose()` rejects the previous `mutateAsync()` promise with
`CancellationError`. Component cleanup calls `dispose()` automatically and
suppresses late state writes and callbacks, including work waiting in an async
`onMutate` handler.
