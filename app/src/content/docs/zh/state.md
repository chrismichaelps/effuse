---
title: 状态管理
---

# 状态管理

Effuse 通过 **@effuse/store** 提供全局状态管理。

## 创建 Store

使用 `@effuse/store` 的 `createStore` 创建响应式 store：

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
	'todos', // Store 名称
	{
		// 初始状态
		todos: [],
		filter: 'all',

		// Actions - 使用 'this' 访问状态信号
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
	{ devtools: true } // 启用 Redux DevTools
);

// 连接到 Redux DevTools
connectDevTools(todosStore);
```

## 在组件中使用 Store

直接导入 store 并使用其状态和操作：

```tsx
import { define, computed, For } from '@effuse/core';
import { todosStore } from '../store/todosStore';

const TodoList = define({
	script: () => {
		// 从 store 解构状态和操作
		const { todos, filter, toggleTodo, deleteTodo, setFilter } = todosStore;

		// 创建计算派生状态
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

## Store 状态是响应式的

Store 状态属性自动包装在信号中：

```typescript
// 访问当前值
const currentFilter = todosStore.filter.value;

// 更新值（触发响应式）
todosStore.filter.value = 'completed';

// 或使用 action 方法
todosStore.setFilter('completed');
```

## 最佳实践

1. **每个领域单一 Store**：为每个功能区域创建专注的 store
2. **使用 Actions 进行修改**：为了清晰度使用 action 方法而不是直接修改
3. **DevTools 集成**：启用 devtools 以调试状态更改
4. **使用 Computed 处理派生状态**：在组件中创建计算值，而不是 store 中
