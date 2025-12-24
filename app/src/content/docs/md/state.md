---
title: State Management
---

# State Management

Effuse provides global state management through **@effuse/store**.

## Creating a Store

Use `createStore` from `@effuse/store` to create a reactive store:

```typescript
import { createStore, connectDevTools } from '@effuse/store';

interface Todo {
	id: number;
	title: string;
	completed: boolean;
}

interface TodosState {
	todos: Todo[];
	filter: 'all' | 'completed' | 'pending';
}

export const todosStore = createStore<
	TodosState & {
		addTodo: (todo: Todo) => void;
		toggleTodo: (id: number) => void;
		deleteTodo: (id: number) => void;
		setFilter: (filter: 'all' | 'completed' | 'pending') => void;
	}
>(
	'todos', // Store name
	{
		// Initial state
		todos: [],
		filter: 'all',

		// Actions - use 'this' to access state signals
		addTodo(todo: Todo) {
			this.todos.value = [todo, ...this.todos.value];
		},

		toggleTodo(id: number) {
			this.todos.value = this.todos.value.map((t) =>
				t.id === id ? { ...t, completed: !t.completed } : t
			);
		},

		deleteTodo(id: number) {
			this.todos.value = this.todos.value.filter((t) => t.id !== id);
		},

		setFilter(filter: 'all' | 'completed' | 'pending') {
			this.filter.value = filter;
		},
	},
	{ devtools: true } // Enable Redux DevTools
);

// Connect to Redux DevTools
connectDevTools(todosStore);
```

## Using Stores in Components

Import the store directly and use its state and actions:

```tsx
import { define, computed, For } from '@effuse/core';
import { todosStore } from '../store/todosStore';

const TodoList = define({
	script: () => {
		// Destructure state and actions from store
		const { todos, filter, toggleTodo, deleteTodo, setFilter } = todosStore;

		// Create computed derived state
		const filteredTodos = computed(() => {
			switch (filter.value) {
				case 'completed':
					return todos.value.filter((t) => t.completed);
				case 'pending':
					return todos.value.filter((t) => !t.completed);
				default:
					return todos.value;
			}
		});

		const totalCount = computed(() => todos.value.length);

		return {
			filteredTodos,
			totalCount,
			filter,
			toggleTodo,
			deleteTodo,
			setFilter,
		};
	},
	template: ({ filteredTodos, totalCount, filter, toggleTodo, setFilter }) => (
		<div>
			<p>Total: {totalCount}</p>

			<div>
				<button onClick={() => setFilter('all')}>All</button>
				<button onClick={() => setFilter('completed')}>Completed</button>
				<button onClick={() => setFilter('pending')}>Pending</button>
			</div>

			<For each={filteredTodos} keyExtractor={(t) => t.id}>
				{(todoSignal) => (
					<div onClick={() => toggleTodo(todoSignal.value.id)}>
						{todoSignal.value.title}
					</div>
				)}
			</For>
		</div>
	),
});
```

## Store State is Reactive

Store state properties are automatically wrapped in signals:

```typescript
// Access current value
const currentFilter = todosStore.filter.value;

// Update value (triggers reactivity)
todosStore.filter.value = 'completed';

// Or use action methods
todosStore.setFilter('completed');
```

## Best Practices

1. **Single Store per Domain**: Create focused stores for each feature area
2. **Actions for Mutations**: Use action methods instead of direct mutation for clarity
3. **DevTools Integration**: Enable devtools for debugging state changes
4. **Computed for Derived State**: Create computed values in components, not stores
