<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  A functional state management system built on Effect-ts. It offers typed, robust global state handling designed to scale with your application's logic.
</p>

## Install

```bash
pnpm add @effuse/store
```

## Create a store

```ts
import { createStore } from '@effuse/store';

export const session = createStore('session', {
	userId: null as string | null,
	signIn(userId: string) {
		this.userId.value = userId;
	},
});

session.signIn('user-42');
session.getSnapshot(); // { userId: 'user-42' }
```

Stores created at application root remain globally available through
`getStore(name)`.

## Server request isolation

Wrap request work in `withScope()` when a store contains request-owned state.
`createStore()` automatically registers with the active scope, and normal
`getStore()` calls resolve that request's store after asynchronous boundaries.

```ts
import { createStore, getStore, withScope } from '@effuse/store';

export const handleRequest = (userId: string) =>
	withScope(async () => {
		createStore('session', { userId });

		await loadAccount(userId);

		return getStore<{ userId: string }>('session').getSnapshot();
	});
```

Resolution follows one rule: current scope, parent scopes, then the global
application registry. A transient scope and its stores are disposed only after
its synchronous or asynchronous callback settles.

## Concurrent action ownership

`useConcurrency()` returns a callable controller. Use `cancellable: true` to
receive an `AbortSignal` as the final action argument; `switch` aborts the
superseded call instead of merely ignoring its result.

```ts
import { useConcurrency } from '@effuse/store';

const saveDraft = useConcurrency(
	async (draftId: string, signal: AbortSignal) => {
		await fetch(`/api/drafts/${draftId}`, {
			method: 'POST',
			signal,
		});
	},
	{
		strategy: 'switch',
		cancellable: true,
		onError: (error, [draftId]) => {
			console.error(`Could not save ${draftId}`, error);
		},
	}
);

saveDraft('draft-42');
saveDraft.dispose();
```

`dispose()` is idempotent: it clears debounce and concat queues, aborts active
cancellable work, and ignores future calls. `destroy()` remains as a deprecated
compatibility alias. Legacy actions receive exactly their original arguments;
Effuse only appends a signal when `cancellable: true` is explicit.

For server request work, call `dispose()` in the request cleanup path. Action
rejections are consumed by every fire-and-forget strategy and can be observed
through `onError`; intentional abort rejections are not reported as failures.
