---
title: Gestión de Estado
---

# Gestión de Estado

Effuse proporciona gestión de estado global a través de **@effuse/store**.

## Creando un Store

Usa `createStore` de `@effuse/store` para crear un store reactivo:

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
	'todos', // Nombre del store
	{
		// Estado inicial
		todos: [],
		filter: 'all',

		// Acciones - usa 'this' para acceder a las señales de estado
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
	{ devtools: true } // Habilitar Redux DevTools
);

// Conectar a Redux DevTools
connectDevTools(todosStore);
```

## Usando Stores en Componentes

Importa el store directamente y usa su estado y acciones:

```tsx
import { define, computed, For } from '@effuse/core';
import { todosStore } from '../store/todosStore';

const TodoList = define({
	script: () => {
		// Desestructura estado y acciones del store
		const { todos, filter, toggleTodo, deleteTodo, setFilter } = todosStore;

		// Crea estado derivado computado
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
				<button onClick={() => setFilter('all')}>Todos</button>
				<button onClick={() => setFilter('completed')}>Completados</button>
				<button onClick={() => setFilter('pending')}>Pendientes</button>
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

## El Estado del Store es Reactivo

Las propiedades del estado del store se envuelven automáticamente en señales:

```typescript
// Acceder valor actual
const currentFilter = todosStore.filter.value;

// Actualizar valor (dispara reactividad)
todosStore.filter.value = 'completed';

// O usar métodos de acción
todosStore.setFilter('completed');
```

## Mejores Prácticas

1. **Un Store por Dominio**: Crea stores enfocados para cada área de funcionalidad
2. **Acciones para Mutaciones**: Usa métodos de acción en lugar de mutación directa para claridad
3. **Integración con DevTools**: Habilita devtools para depurar cambios de estado
4. **Computed para Estado Derivado**: Crea valores computados en componentes, no en stores
