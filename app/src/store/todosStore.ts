import { createStore, connectDevTools } from '@effuse/store';

export interface Todo {
	id: number;
	userId: number;
	title: string;
	completed: boolean;
}

interface TodosUIState {
	todos: Todo[];
	editingTodo: Todo | null;
	isEditModalOpen: boolean;
	editTitle: string;
	newTodoTitle: string;
	filter: 'all' | 'completed' | 'pending';
}

let nextLocalId = 1000;

export const todosStore = createStore<
	TodosUIState & {
		setTodos: (todos: Todo[]) => void;
		appendTodos: (todos: Todo[]) => void;
		addTodo: (todo: Todo) => void;
		deleteTodo: (id: number) => void;
		toggleTodo: (id: number) => void;
		updateTodo: (id: number, title: string) => void;
		openEditModal: (todo: Todo) => void;
		closeEditModal: () => void;
		setEditTitle: (title: string) => void;
		saveEdit: () => void;
		setNewTodoTitle: (title: string) => void;
		setFilter: (filter: 'all' | 'completed' | 'pending') => void;
		generateId: () => number;
	}
>(
	'todosUI',
	{
		todos: [],
		editingTodo: null,
		isEditModalOpen: false,
		editTitle: '',
		newTodoTitle: '',
		filter: 'all',
		setTodos(todos: Todo[]) {
			this.todos.value = todos;
		},
		appendTodos(todos: Todo[]) {
			this.todos.value = [...this.todos.value, ...todos];
		},
		addTodo(todo: Todo) {
			this.todos.value = [todo, ...this.todos.value];
			this.newTodoTitle.value = '';
		},
		deleteTodo(id: number) {
			this.todos.value = this.todos.value.filter((t) => t.id !== id);
		},
		toggleTodo(id: number) {
			this.todos.value = this.todos.value.map((todo) =>
				todo.id === id ? { ...todo, completed: !todo.completed } : todo
			);
		},
		updateTodo(id: number, title: string) {
			this.todos.value = this.todos.value.map((todo) =>
				todo.id === id ? { ...todo, title } : todo
			);
		},
		openEditModal(todo: Todo) {
			this.editingTodo.value = todo;
			this.editTitle.value = todo.title;
			this.isEditModalOpen.value = true;
		},
		closeEditModal() {
			this.editingTodo.value = null;
			this.editTitle.value = '';
			this.isEditModalOpen.value = false;
		},
		setEditTitle(title: string) {
			this.editTitle.value = title;
		},
		saveEdit() {
			const todo = this.editingTodo.value;
			const title = this.editTitle.value.trim();
			if (todo && title) {
				this.todos.value = this.todos.value.map((t) =>
					t.id === todo.id ? { ...t, title } : t
				);
			}
			this.editingTodo.value = null;
			this.editTitle.value = '';
			this.isEditModalOpen.value = false;
		},
		setNewTodoTitle(title: string) {
			this.newTodoTitle.value = title;
		},
		setFilter(filter: 'all' | 'completed' | 'pending') {
			this.filter.value = filter;
		},
		generateId() {
			return nextLocalId++;
		},
	},
	{ devtools: true }
);
connectDevTools(todosStore);
