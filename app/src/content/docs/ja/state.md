---
title: 状態管理
---

# 状態管理

Effuse は **@effuse/store** を通じてグローバル状態管理を提供します。

## ストアの作成

`@effuse/store` の `createStore` を使用してリアクティブなストアを作成します：

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
	'todos', // ストア名
	{
		// 初期状態
		todos: [],
		filter: 'all',

		// アクション - 'this' を使用して状態シグナルにアクセス
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
	{ devtools: true } // Redux DevTools を有効化
);

// Redux DevTools に接続
connectDevTools(todosStore);
```

## コンポーネントでのストアの使用

ストアを直接インポートし、状態とアクションを使用します：

```tsx
import { define, computed, For } from '@effuse/core';
import { todosStore } from '../store/todosStore';

const TodoList = define({
	script: () => {
		// ストアから状態とアクションを分割代入
		const { todos, filter, toggleTodo, deleteTodo, setFilter } = todosStore;

		// 計算された派生状態を作成
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

## ストア状態はリアクティブ

ストア状態プロパティは自動的にシグナルでラップされます：

```typescript
// 現在の値にアクセス
const currentFilter = todosStore.filter.value;

// 値を更新（リアクティビティをトリガー）
todosStore.filter.value = 'completed';

// またはアクションメソッドを使用
todosStore.setFilter('completed');
```

## ベストプラクティス

1. **ドメインごとに単一のストア**: 各機能領域に集中したストアを作成
2. **ミューテーションにはアクション**: 明確さのため直接変更ではなくアクションメソッドを使用
3. **DevTools 統合**: 状態変更のデバッグのため devtools を有効化
4. **派生状態には Computed**: コンポーネント内で計算値を作成、ストアではなく
