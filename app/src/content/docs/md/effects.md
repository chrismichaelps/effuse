---
title: Effects
---

# Effects API

Effuse provides specific functions to handle side effects and watch for state changes.

## 1. effect

The `effect` function runs immediately and re-runs whenever its tracked signals change.

```tsx
import { define, signal, effect } from '@effuse/core';

const DataFetcher = define({
	script: () => {
		const userId = signal(1);
		const userData = signal<any>(null);

		// Runs automatically when 'userId' changes
		effect(() => {
			fetch(`/api/users/${userId.value}`)
				.then((res) => res.json())
				.then((data) => {
					userData.value = data;
				});
		});

		return { userId, userData };
	},
	template: ({ userId, userData }) => (
		<div>
			<button onClick={() => userId.value++}>Next User</button>
			<pre>{JSON.stringify(userData.value, null, 2)}</pre>
		</div>
	),
});
```

## 2. Syncing Data with Effects

A common pattern is syncing external data with store state:

```tsx
import { define, signal, effect } from '@effuse/core';
import { useInfiniteQuery } from '@effuse/query';
import { todosStore } from '../store/todosStore';

const TodosPage = define({
  script: () => {
    const todosQuery = useInfiniteQuery({
      queryKey: ['todos'],
      queryFn: async ({ pageParam }) => {
        const res = await fetch(`/api/todos?page=${pageParam}`);
        return res.json();
      },
      initialPageParam: 1,
    });

    const syncedPageCount = signal(0);

    // Sync server data to store
    effect(() => {
      const pages = todosQuery.allPagesData.value;
      if (pages && pages.length > syncedPageCount.value) {
        if (syncedPageCount.value === 0) {
          todosStore.setTodos(pages.flat());
        } else {
          const newTodos = pages.slice(syncedPageCount.value).flat();
          todosStore.appendTodos(newTodos);
        }
        syncedPageCount.value = pages.length;
      }
    });

    return { todosQuery };
  },
  template: ...
});
```

## 3. watch

The `watch` function from the script context observes a specific signal and triggers a callback when it changes:

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// Logs only when count updates
		watch(count, (newVal) => {
			console.log(`Count changed to: ${newVal}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## 4. onMount for Side Effects

Use `onMount` for effects that should run once when the component mounts:

```tsx
import { define } from '@effuse/core';

const Analytics = define({
	script: ({ onMount }) => {
		onMount(() => {
			console.log('Component mounted');

			// Return cleanup function
			return () => {
				console.log('Component unmounted');
			};
		});

		return {};
	},
	template: () => <div>Tracked Component</div>,
});
```

## Best Practices

1. **Use effect for reactive side effects** that should re-run when dependencies change
2. **Use watch for specific signals** when you only care about one value changing
3. **Use onMount for initialization** that should only happen once
4. **Return cleanup functions** from onMount to prevent memory leaks
