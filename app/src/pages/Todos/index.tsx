import { define, computed, For, useHead, signal, effect } from '@effuse/core';
import { isTaggedError } from '@effuse/core';
import { useInfiniteQuery, useMutation } from '@effuse/query';
import type {
	todosStore as TodosStoreType,
	Todo,
} from '../../store/todosStore.js';
import { DocsLayout } from '../../components/docs/DocsLayout';
import { useInfiniteScroll } from '../../hooks/index.js';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import { triggerHaptic } from '../../components/Haptics';
import { TodoError } from '../../errors.js';
import '../../styles/examples.css';

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
				const url = `${API_BASE}/todos?userId=1&_page=${pageParam}&_limit=${PAGE_SIZE}`;
				const response = await fetch(url);
				if (!response.ok) {
					throw new TodoError({
						message: `Failed to fetch todos (HTTP ${response.status})`,
						operation: 'fetch',
					});
				}
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
				if (!response.ok) {
					throw new TodoError({
						message: `Failed to add todo (HTTP ${response.status})`,
						operation: 'add',
					});
				}
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

		const infiniteScroll = useInfiniteScroll({
			threshold: 100,
		});

		infiniteScroll.onLoadMore(() => loadMore());

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
			handleScroll: infiniteScroll.handleScroll,
			hasNextPage: todosQuery.hasNextPage,
			isFetchingNextPage: todosQuery.isFetchingNextPage,
		};
	},
	template: ({
		t,
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
		todosQuery,
	}) => (
		<DocsLayout currentPath="/todos">
			<div class="example-container">
				{computed(() =>
					isEditModalOpen.value ? (
						<div class="modal-overlay">
							<div class="modal-backdrop" onClick={() => closeEditModal()} />
							<div class="modal-card">
								<div class="px-6 py-4 bg-white/5">
									<h3 class="text-xl font-bold text-white">
										{t.value?.editTodo}
									</h3>
								</div>
								<div class="p-6">
									<label class="block mb-2 text-sm font-medium text-slate-400">
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
										class="example-input"
										placeholder={
											t.value?.enterTodoTitlePlaceholder ??
											'Enter todo title...'
										}
										autoFocus
									/>
								</div>
								<div class="px-6 py-4 bg-white/5 flex justify-end gap-3">
									<button
										type="button"
										onClick={() => closeEditModal()}
										class="btn-secondary"
									>
										{t.value?.cancel}
									</button>
									<button
										type="button"
										onClick={() => saveEdit()}
										class="btn-premium"
									>
										{t.value?.saveChanges}
									</button>
								</div>
							</div>
						</div>
					) : null
				)}

				<header class="example-header">
					<h1 class="example-title">{t.value?.title}</h1>
					<p class="example-description">{t.value?.description}</p>
				</header>

				<div class="flex flex-wrap justify-center gap-3 mb-10">
					<span class="example-badge">useInfiniteQuery</span>
					<span class="example-badge">Portal Modal</span>
					<span
						class="example-badge"
						style="background: rgba(141, 240, 204, 0.1); color: var(--accent-mint); border-color: rgba(141, 240, 204, 0.1);"
					>
						@effuse/store
					</span>
				</div>

				<div class="example-card">
					<div class="flex gap-3">
						<input
							type="text"
							placeholder={t.value?.addPlaceholder ?? ''}
							value={inputValue}
							onInput={handleInputChange}
							onKeyDown={handleKeyDown}
							class="example-input"
						/>
						<button
							type="button"
							onClick={() => {
								triggerHaptic('light');
								handleAddTodo();
							}}
							class={() =>
								inputValue.value.trim().length > 0 && !isAdding.value
									? 'btn-premium'
									: 'btn-premium opacity-50 cursor-not-allowed'
							}
						>
							{isAdding.value ? t.value?.adding : t.value?.add}
						</button>
					</div>
				</div>

				<div class="stat-grid">
					<div
						class="stat-card"
						style="background: rgba(255, 255, 255, 0.03); border-color: rgba(255, 255, 255, 0.05);"
					>
						<div class="stat-label">{t.value?.total}</div>
						<div class="stat-value" style="color: var(--text-primary);">
							{totalCount.value}
						</div>
					</div>
					<div class="stat-card">
						<div class="stat-label">{t.value?.completed}</div>
						<div class="stat-value">{completedCount.value}</div>
					</div>
					<div
						class="stat-card"
						style="background: rgba(182, 157, 248, 0.03); border-color: rgba(182, 157, 248, 0.1);"
					>
						<div class="stat-label">{t.value?.pending}</div>
						<div class="stat-value" style="color: var(--accent-lilac);">
							{pendingCount.value}
						</div>
					</div>
				</div>

				<div class="flex justify-center gap-2 mb-6">
					<button
						type="button"
						onClick={() => {
							triggerHaptic('light');
							setFilter('all');
						}}
						class={() =>
							filter.value === 'all' ? 'btn-premium' : 'btn-secondary'
						}
						style="padding: 0.5rem 1rem;"
					>
						{t.value?.all}
					</button>
					<button
						type="button"
						onClick={() => {
							triggerHaptic('light');
							setFilter('completed');
						}}
						class={() =>
							filter.value === 'completed' ? 'btn-premium' : 'btn-secondary'
						}
						style="padding: 0.5rem 1rem;"
					>
						{t.value?.completed}
					</button>
					<button
						type="button"
						onClick={() => {
							triggerHaptic('light');
							setFilter('pending');
						}}
						class={() =>
							filter.value === 'pending' ? 'btn-premium' : 'btn-secondary'
						}
						style="padding: 0.5rem 1rem;"
					>
						{t.value?.pending}
					</button>
				</div>

				<div class="example-card" style="padding: 0; overflow: hidden;">
					<div
						class="max-h-[500px] overflow-y-auto custom-scrollbar"
						onScroll={handleScroll}
					>
						{computed(() =>
							isLoading.value ? (
								<div class="p-12 text-center text-slate-500 italic">
									{t.value?.loadingTodos}
								</div>
							) : null
						)}

						{computed(() =>
							!isLoading.value && totalCount.value === 0 ? (
								<div class="p-12 text-center text-slate-500 italic">
									{t.value?.noTodos}
								</div>
							) : null
						)}

						<For each={filteredTodos} keyExtractor={(t) => t.id}>
							{(todoSignal) => (
								<div class="px-6 py-5 flex items-center gap-4 hover:bg-white/[0.02] transition-colors group">
									<button
										type="button"
										onClick={() => {
											triggerHaptic('light');
											toggleTodo(todoSignal.value.id);
										}}
										class={() =>
											todoSignal.value.completed
												? 'w-6 h-6 rounded-full bg-mint text-slate-900 flex items-center justify-center flex-shrink-0 animate-water-drop'
												: 'w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center flex-shrink-0 transition-colors'
										}
										style={() => ({
											background: todoSignal.value.completed
												? 'var(--accent-mint)'
												: 'rgba(255,255,255,0.05)',
										})}
									>
										{todoSignal.value.completed ? (
											<span class="text-[10px] font-black">✓</span>
										) : null}
									</button>
									<div class="flex-1 min-w-0">
										<p
											class={() =>
												todoSignal.value.completed
													? 'text-slate-500 line-through'
													: 'text-slate-200 font-medium'
											}
										>
											{todoSignal.value.title}
										</p>
									</div>
									<div class="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
										<button
											type="button"
											onClick={() => openEditModal(todoSignal.value)}
											class="btn-secondary"
											style="padding: 0.3rem 0.8rem; font-size: 0.75rem;"
										>
											{t.value?.edit}
										</button>
										<button
											type="button"
											onClick={() => deleteTodo(todoSignal.value.id)}
											class="btn-secondary"
											style="padding: 0.3rem 0.8rem; font-size: 0.75rem; border-color: rgba(255, 100, 100, 0.2); color: #ff6b6b;"
										>
											{t.value?.delete}
										</button>
									</div>
									<span class="flex-shrink-0 example-badge">
										ID: {todoSignal.value.userId}
									</span>
								</div>
							)}
						</For>

						{computed(() =>
							todosQuery.isFetching.value && totalCount.value > 0 ? (
								<div class="p-4 text-center text-slate-500 text-sm bg-white/[0.01]">
									{todosQuery.isFetchingNextPage.value
										? t.value?.loadingMore
										: t.value?.refreshing}
								</div>
							) : null
						)}
					</div>

					{computed(() =>
						hasNextPage.value ? (
							<div class="p-4 text-center bg-white/5">
								<button
									onClick={() => loadMore()}
									class="btn-secondary w-full max-w-xs mx-auto"
									disabled={isFetchingNextPage.value}
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
							<div class="p-4 bg-red-500/10 text-red-400 border-t border-red-500/20 text-center text-sm">
								{isTaggedError(todosQuery.error.value)
									? todosQuery.error.value.toString()
									: todosQuery.error.value?.message || 'Error loading todos'}
							</div>
						) : null
					)}
				</div>
			</div>
		</DocsLayout>
	),
});
