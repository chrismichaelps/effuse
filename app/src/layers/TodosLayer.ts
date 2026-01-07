import { defineLayer, signal, computed, isTaggedError } from '@effuse/core';
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
		const message = isTaggedError(err) ? err.toString() : err.message;
		console.error('[TodosLayer] error:', message);
	},
});
