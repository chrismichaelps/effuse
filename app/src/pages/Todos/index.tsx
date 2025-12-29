import { define, computed, For, useHead, signal, effect } from '@effuse/core';
import { useInfiniteQuery, useMutation } from '@effuse/query';
import type {
	todosStore as TodosStoreType,
	Todo,
} from '../../store/todosStore.js';
import { DocsLayout } from '../../components/docs/DocsLayout';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';

const API_BASE = 'https://jsonplaceholder.typicode.com';
const PAGE_SIZE = 10;

export const TodosPage = define({
	script: ({ useCallback, useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const todosStore = useStore('todosStore') as typeof TodosStoreType;

		const t = computed(() => i18nStore.translations.value?.examples?.todos);

		effect(() => {
			useHead({
				title: `${t.value?.title as string} - Effuse Playground`,
				description: t.value?.description as string,
			});
		});

		const todosQuery = useInfiniteQuery<Todo[], number>({
			queryKey: ['todos'],
			queryFn: async ({ pageParam }) => {
				const response = await fetch(
					`${API_BASE}/todos?userId=1&_page=${pageParam}&_limit=${PAGE_SIZE}`
				);
				if (!response.ok) throw new Error('Failed to fetch todos');
				return response.json() as Promise<Todo[]>;
			},
			initialPageParam: 1,
			getNextPageParam: (lastPage, allPages) =>
				lastPage.length < PAGE_SIZE ? undefined : allPages.length + 1,
			staleTime: 60000,
		});

		const addMutation = useMutation<Todo, { title: string }>({
			mutationFn: async ({ title }) => {
				const response = await fetch(`${API_BASE}/todos`, {
					method: 'POST',
					headers: { 'Content-Type': 'application/json' },
					body: JSON.stringify({ title, completed: false, userId: 1 }),
				});
				if (!response.ok) throw new Error('Failed to add todo');
				return response.json() as Promise<Todo>;
			},
			onSuccess: (data) => {
				const newTodo: Todo = { ...data, id: todosStore.generateId() };
				todosStore.addTodo(newTodo);
			},
		});

		const {
			filter,
			isEditModalOpen,
			editTitle,
			todos: storeTodos,
		} = todosStore;

		const inputValue = signal('');
		const syncedPageCount = signal(0);

		effect(() => {
			const pages = todosQuery.allPagesData.value;
			if (pages && pages.length > syncedPageCount.value) {
				if (syncedPageCount.value === 0) {
					todosStore.setTodos(pages.flat());
				} else {
					const newPages = pages.slice(syncedPageCount.value);
					const newTodos = newPages.flat();
					todosStore.appendTodos(newTodos);
				}
				syncedPageCount.value = pages.length;
			}
		});

		const filteredTodos = computed(() => {
			switch (filter.value) {
				case 'completed':
					return storeTodos.value.filter((t) => t.completed);
				case 'pending':
					return storeTodos.value.filter((t) => !t.completed);
				case 'all':
				default:
					return storeTodos.value;
			}
		});
		const totalCount = computed(() => storeTodos.value.length);
		const completedCount = computed(
			() => storeTodos.value.filter((t) => t.completed).length
		);
		const pendingCount = computed(
			() => totalCount.value - completedCount.value
		);
		const isAdding = computed(() => addMutation.isPending.value);
		const isLoading = computed(
			() => storeTodos.value.length === 0 && todosQuery.isPending.value
		);

		const setFilter = (f: 'all' | 'completed' | 'pending') =>
			todosStore.setFilter(f);
		const toggleTodo = (id: number) => todosStore.toggleTodo(id);
		const deleteTodo = (id: number) => todosStore.deleteTodo(id);
		const openEditModal = (todo: Todo) => todosStore.openEditModal(todo);
		const closeEditModal = () => todosStore.closeEditModal();
		const setEditTitle = (title: string) => todosStore.setEditTitle(title);
		const saveEdit = () => todosStore.saveEdit();

		const handleAddTodo = useCallback(() => {
			const title = inputValue.value.trim();
			if (title && !addMutation.isPending.value) {
				addMutation.mutate({ title });
				inputValue.value = '';
			}
		});

		const handleInputChange = useCallback((e: Event) => {
			inputValue.value = (e.target as HTMLInputElement).value;
		});

		const handleKeyDown = useCallback((e: KeyboardEvent) => {
			if (e.key === 'Enter') {
				handleAddTodo();
			}
		});

		const loadMore = useCallback(() => {
			if (
				todosQuery.hasNextPage.value &&
				!todosQuery.isFetchingNextPage.value
			) {
				todosQuery.fetchNextPage();
			}
		});

		const handleScroll = useCallback((e: Event) => {
			const target = e.target as HTMLElement;
			const scrollTop = target.scrollTop;
			const scrollHeight = target.scrollHeight;
			const clientHeight = target.clientHeight;
			if (scrollHeight - scrollTop - clientHeight < 100) {
				loadMore();
			}
		});

		return {
			t,
			todosQuery,
			filteredTodos,
			totalCount,
			completedCount,
			pendingCount,
			filter,
			isEditModalOpen,
			editTitle,
			inputValue,
			handleAddTodo,
			handleInputChange,
			handleKeyDown,
			isAdding,
			isLoading,
			setFilter,
			toggleTodo,
			deleteTodo,
			openEditModal,
			closeEditModal,
			setEditTitle,
			saveEdit,
			loadMore,
			handleScroll,
			hasNextPage: todosQuery.hasNextPage,
			isFetchingNextPage: todosQuery.isFetchingNextPage,
		};
	},
	template: ({
		t,
		todosQuery,
		filteredTodos,
		totalCount,
		completedCount,
		pendingCount,
		filter,
		isEditModalOpen,
		editTitle,
		inputValue,
		handleAddTodo,
		handleInputChange,
		handleKeyDown,
		isAdding,
		isLoading,
		setFilter,
		toggleTodo,
		deleteTodo,
		openEditModal,
		closeEditModal,
		setEditTitle,
		saveEdit,
		loadMore,
		handleScroll,
		hasNextPage,
		isFetchingNextPage,
	}) => (
		<DocsLayout currentPath="/todos">
			<div class="py-12 px-4">
				{computed(() =>
					isEditModalOpen.value ? (
						<div class="fixed inset-0 z-50 flex items-center justify-center">
							<div
								class="absolute inset-0 bg-black bg-opacity-50"
								onClick={() => closeEditModal()}
							/>
							<div class="relative bg-white rounded-2xl shadow-2xl w-full max-w-md mx-4 overflow-hidden">
								<div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
									<h2 class="text-xl font-semibold text-white">
										{t.value?.editTodo}
									</h2>
								</div>
								<div class="p-6">
									<label class="block mb-2 text-sm font-medium text-slate-700">
										{t.value?.todoTitle}
									</label>
									<input
										type="text"
										value={editTitle}
										onInput={(e: Event) =>
											setEditTitle((e.target as HTMLInputElement).value)
										}
										onKeyDown={(e: KeyboardEvent) => {
											if (e.key === 'Enter') saveEdit();
											if (e.key === 'Escape') closeEditModal();
										}}
										class="w-full px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
										placeholder={
											t.value?.enterTodoTitlePlaceholder ??
											'Enter todo title...'
										}
									/>
								</div>
								<div class="px-6 py-4 bg-slate-50 flex justify-end gap-3">
									<button
										type="button"
										onClick={() => closeEditModal()}
										class="px-4 py-2 bg-slate-200 text-slate-700 rounded-lg font-medium hover:bg-slate-300"
									>
										{t.value?.cancel}
									</button>
									<button
										type="button"
										onClick={() => saveEdit()}
										class="px-4 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
									>
										{t.value?.saveChanges}
									</button>
								</div>
							</div>
						</div>
					) : null
				)}
				<div class="max-w-3xl mx-auto">
					<header class="text-center mb-10">
						<h1 class="text-4xl font-bold text-slate-800 mb-3">
							{t.value?.title}
						</h1>
						<p class="text-slate-600 text-lg">{t.value?.description}</p>
					</header>
					<div class="flex flex-wrap justify-center gap-3 mb-10">
						<span class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							useInfiniteQuery
						</span>
						<span class="bg-purple-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							Portal Modal
						</span>
						<span class="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							@effuse/store
						</span>
					</div>
					<div class="bg-white rounded-xl shadow-lg border border-slate-200 p-4 mb-6">
						<div class="flex gap-3">
							<input
								type="text"
								id="todo-input"
								placeholder={t.value?.addPlaceholder ?? ''}
								value={inputValue}
								onInput={handleInputChange}
								onKeyDown={handleKeyDown}
								class="flex-1 px-4 py-3 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
							/>
							<button
								type="button"
								id="add-todo-btn"
								onClick={() => handleAddTodo()}
								class={() =>
									inputValue.value.trim().length > 0 && !isAdding.value
										? 'px-6 py-3 bg-blue-600 text-white rounded-lg font-semibold hover:bg-blue-700 transition-colors'
										: 'px-6 py-3 bg-blue-300 text-white rounded-lg font-semibold cursor-not-allowed transition-colors'
								}
							>
								{isAdding.value ? t.value?.adding : t.value?.add}
							</button>
						</div>
					</div>
					<div class="bg-white rounded-xl shadow-lg border border-slate-200 p-4 mb-6">
						<div class="flex justify-center gap-8">
							<div class="text-center">
								<div class="text-2xl font-bold text-slate-800">
									{totalCount.value}
								</div>
								<div class="text-sm text-slate-500">{t.value?.total}</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-green-600">
									{completedCount.value}
								</div>
								<div class="text-sm text-slate-500">{t.value?.completed}</div>
							</div>
							<div class="text-center">
								<div class="text-2xl font-bold text-amber-600">
									{pendingCount.value}
								</div>
								<div class="text-sm text-slate-500">{t.value?.pending}</div>
							</div>
						</div>
					</div>
					<div class="flex justify-center gap-2 mb-6">
						<button
							type="button"
							onClick={() => setFilter('all')}
							class={() =>
								filter.value === 'all'
									? 'px-4 py-2 rounded-lg font-medium bg-slate-800 text-white'
									: 'px-4 py-2 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200'
							}
						>
							{t.value?.all}
						</button>
						<button
							type="button"
							onClick={() => setFilter('completed')}
							class={() =>
								filter.value === 'completed'
									? 'px-4 py-2 rounded-lg font-medium bg-green-600 text-white'
									: 'px-4 py-2 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200'
							}
						>
							{t.value?.completed}
						</button>
						<button
							type="button"
							onClick={() => setFilter('pending')}
							class={() =>
								filter.value === 'pending'
									? 'px-4 py-2 rounded-lg font-medium bg-amber-600 text-white'
									: 'px-4 py-2 rounded-lg font-medium bg-slate-100 text-slate-600 hover:bg-slate-200'
							}
						>
							{t.value?.pending}
						</button>
					</div>

					<div class="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
						<div
							class="divide-y divide-slate-100 max-h-96 overflow-y-auto"
							onScroll={handleScroll}
						>
							{computed(() =>
								isLoading.value ? (
									<div class="p-8 text-center text-slate-400">
										{t.value?.loadingTodos}
									</div>
								) : null
							)}

							{computed(() =>
								!isLoading.value && totalCount.value === 0 ? (
									<div class="p-8 text-center text-slate-400">
										{t.value?.noTodos}
									</div>
								) : null
							)}
							<For each={filteredTodos} keyExtractor={(t) => t.id}>
								{(todoSignal) => (
									<div class="px-6 py-4 flex items-center gap-4 hover:bg-slate-50 transition-colors group">
										<button
											type="button"
											onClick={() => toggleTodo(todoSignal.value.id)}
											class={() =>
												todoSignal.value.completed
													? 'w-6 h-6 rounded-full bg-green-500 border-green-500 text-white border-2 flex items-center justify-center flex-shrink-0'
													: 'w-6 h-6 rounded-full border-slate-300 hover:border-green-400 border-2 flex items-center justify-center flex-shrink-0'
											}
										>
											{todoSignal.value.completed ? (
												<span class="text-xs font-bold">✓</span>
											) : null}
										</button>
										<div class="flex-1 min-w-0">
											<p
												class={() =>
													todoSignal.value.completed
														? 'line-through text-slate-400'
														: 'text-slate-700'
												}
											>
												{todoSignal.value.title}
											</p>
										</div>
										<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
											<button
												type="button"
												onClick={() => openEditModal(todoSignal.value)}
												class="px-3 py-1 bg-blue-100 text-blue-700 rounded text-sm font-medium hover:bg-blue-200"
											>
												{t.value?.edit}
											</button>
											<button
												type="button"
												onClick={() => deleteTodo(todoSignal.value.id)}
												class="px-3 py-1 bg-red-100 text-red-700 rounded text-sm font-medium hover:bg-red-200"
											>
												{t.value?.delete}
											</button>
										</div>
										<span class="flex-shrink-0 bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-xs font-medium">
											{t.value?.user} {todoSignal.value.userId}
										</span>
									</div>
								)}
							</For>
							{computed(() =>
								todosQuery.isFetching.value && totalCount.value > 0 ? (
									<div class="p-4 text-center text-slate-400 text-sm">
										{todosQuery.isFetchingNextPage.value
											? t.value?.loadingMore
											: t.value?.refreshing}
									</div>
								) : null
							)}
						</div>
						{computed(() =>
							hasNextPage.value ? (
								<div class="p-4 border-t border-slate-100 text-center">
									<button
										onClick={() => loadMore()}
										class="px-6 py-2 bg-slate-100 text-slate-700 rounded-lg font-medium hover:bg-slate-200 disabled:opacity-50"
									>
										{isFetchingNextPage.value
											? t.value?.loadingMore
											: t.value?.loadMore}
									</button>
								</div>
							) : null
						)}
						{computed(() =>
							todosQuery.isError.value ? (
								<div class="p-4 bg-red-50 text-red-600 text-center">
									{todosQuery.error.value?.message || 'Error loading todos'}
								</div>
							) : null
						)}
					</div>
				</div>
			</div>
		</DocsLayout>
	),
});
