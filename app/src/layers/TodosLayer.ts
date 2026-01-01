import { defineLayer, signal, computed } from '@effuse/core';
import { todosStore } from '../store/todosStore';

export const TodosLayer = defineLayer({
	name: 'todos',
	dependencies: ['i18n'],
	store: todosStore,
	deriveProps: (store) => ({
		isLoading: signal(false),
		filter: store.filter,
		totalCount: computed(() => store.todos.value.length),
	}),
	provides: {
		todosStore: () => todosStore,
	},
	onMount: () => {
		console.log('[TodosLayer] mounted');
	},
	onUnmount: () => {
		console.log('[TodosLayer] unmounted');
	},
	onError: (err) => {
		console.error('[TodosLayer] error:', err.message);
	},
});
