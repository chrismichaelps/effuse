import { defineLayer, signal } from '@effuse/core';
import { todosStore } from '../store/todosStore';

export const TodosLayer = defineLayer({
	name: 'todos',
	dependencies: ['i18n'],
	props: {
		isLoading: signal(false),
		filter: signal<'all' | 'completed' | 'pending'>('all'),
		totalCount: signal(0),
	},
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
	setup: (ctx) => {
		ctx.props.filter.value = todosStore.filter.value;
		ctx.props.totalCount.value = todosStore.todos.value.length;

		return () => {
			console.log('[TodosLayer] cleanup');
		};
	},
});
