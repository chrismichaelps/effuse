---
title: Data Fetching
---

# Data Fetching

Effuse provides a powerful data fetching and caching library through **@effuse/query**, inspired by TanStack Query but built specifically for Effuse's signal-based reactivity.

## useQuery

The `useQuery` hook is used to fetch and cache data.

```tsx
import { define } from '@effuse/core';
import { useQuery } from '@effuse/query';

const UserList = define({
  script: () => {
    const { data, error, status, isLoading } = useQuery({
      queryKey: ['users'],
      queryFn: () => fetch('/api/users').then((res) => res.json()),
    });

    return { users: data, error, isLoading };
  },
  template: ({ users, error, isLoading }) => (
    <div>
      <Show when={isLoading}>
        <p>Loading...</p>
      </Show>
      <Show when={error}>
        <p>Error: {error.value.message}</p>
      </Show>
      <Show when={users}>
        <ul>
          <For each={users} keyExtractor={(u) => u.id}>
            {(user) => <li>{user.value.name}</li>}
          </For>
        </ul>
      </Show>
    </div>
  ),
});
```

## useMutation

Use `useMutation` for creating, updating, or deleting data.

```typescript
const { mutate, isPending } = useMutation({
  mutationFn: (newUser) =>
    fetch('/api/users', {
      method: 'POST',
      body: JSON.stringify(newUser),
    }),
  onSuccess: () => {
    // Invalidate and refetch users
    queryClient.invalidateQueries({ queryKey: ['users'] });
  },
});
```

## Query Options

| Option      | Type                | Description                                |
| :---------- | :------------------ | :----------------------------------------- |
| `queryKey`  | `any[]`             | Unique key for the query                   |
| `queryFn`   | `() => Promise<T>`  | Function that fetches the data             |
| `staleTime` | `number`            | Time in ms before data is considered stale |
| `cacheTime` | `number`            | Time in ms to keep unused data in cache    |
| `enabled`   | `Signal<boolean>`   | Whether the query should run automatically |
| `retry`     | `number \| boolean` | Retry behavior on failure                  |

## useInfiniteQuery

For paginated or "load more" lists, use `useInfiniteQuery`.

```typescript
const { data, fetchNextPage, hasNextPage } = useInfiniteQuery({
  queryKey: ['posts'],
  queryFn: ({ pageParam = 1 }) => fetch(`/api/posts?page=${pageParam}`),
  getNextPageParam: (lastPage) => lastPage.nextPage,
});
```
