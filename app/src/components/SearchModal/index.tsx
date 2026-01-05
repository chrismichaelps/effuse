import {
	define,
	computed,
	effect,
	For,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';
import type { SearchStore, SearchResultItem } from '../../store/searchStore';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import './styles.css';

interface SearchModalExposed {
	isOpen: Signal<boolean>;
	query: Signal<string>;
	results: Signal<readonly SearchResultItem[]>;
	isLoading: Signal<boolean>;
	selectedIndex: Signal<number>;
	showLoading: ReadonlySignal<boolean>;
	showNoResults: ReadonlySignal<boolean>;
	showEmptyState: ReadonlySignal<boolean>;
	showResults: ReadonlySignal<boolean>;
	handleInput: (e: Event) => void;
	handleBackdropClick: (e: MouseEvent) => void;
	handleResultClick: (result: SearchResultItem) => void;
	t: ReadonlySignal<any>;
}

export const SearchModal = define<Record<string, never>, SearchModalExposed>({
	script: ({ onMount, useStore, useCallback, useLayerProvider }) => {
		const searchProvider = useLayerProvider('search');
		const store = searchProvider?.search as SearchStore;

		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(() => i18nStore.translations.value?.search);

		const handleInput = useCallback((e: Event) => {
			const target = e.target as HTMLInputElement;
			store?.search(target.value);
		});

		const handleKeyDown = useCallback((e: KeyboardEvent) => {
			if (!store?.isOpen.value) return;

			switch (e.key) {
				case 'ArrowDown':
					e.preventDefault();
					store.selectNext();
					break;
				case 'ArrowUp':
					e.preventDefault();
					store.selectPrevious();
					break;
				case 'Enter': {
					e.preventDefault();
					const selected = store.getSelected();
					if (selected?.filePath) {
						const slug =
							selected.filePath.split('/').pop()?.replace('.md', '') ?? '';
						const anchor = selected.anchor ? `#${selected.anchor}` : '';
						store.close();
						window.location.href = `/docs/${slug}${anchor}`;
					}
					break;
				}
			}
		});

		const handleBackdropClick = useCallback((e: MouseEvent) => {
			if (
				(e.target as HTMLElement).classList.contains('search-modal-backdrop')
			) {
				store?.close();
			}
		});

		const handleResultClick = useCallback((result: SearchResultItem) => {
			if (result.filePath) {
				const slug = result.filePath.split('/').pop()?.replace('.md', '') ?? '';
				const anchor = result.anchor ? `#${result.anchor}` : '';
				const targetUrl = `/docs/${slug}${anchor}`;

				store?.close();
				window.location.href = targetUrl;

				if (result.anchor) {
					setTimeout(() => {
						const element = document.getElementById(result.anchor!);
						if (element) {
							element.scrollIntoView({ behavior: 'smooth', block: 'start' });
						}
					}, 100);
				}
			}
		});

		onMount(() => {
			window.addEventListener('keydown', handleKeyDown);

			return () => {
				window.removeEventListener('keydown', handleKeyDown);
				document.body.style.overflow = '';
			};
		});

		effect(() => {
			if (store?.isOpen.value) {
				document.body.style.overflow = 'hidden';
				(window as any).__lenis?.stop();
			} else {
				document.body.style.overflow = '';
				(window as any).__lenis?.start();
			}
		});

		effect(() => {
			const idx = store?.selectedIndex.value;
			if (idx !== undefined && idx >= 0) {
				const element = document.querySelector(
					`.search-result-item:nth-child(${idx + 1})`
				);
				if (element) {
					element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
				}
			}
		});

		const showLoading = computed(
			() =>
				(store?.isLoading.value ?? false) &&
				(store?.query.value.length ?? 0) > 0
		);
		const showNoResults = computed(
			() =>
				!(store?.isLoading.value ?? true) &&
				(store?.query.value.length ?? 0) > 0 &&
				(store?.results.value.length ?? 0) === 0
		);
		const showEmptyState = computed(
			() =>
				!(store?.isLoading.value ?? true) &&
				(store?.query.value.length ?? 0) === 0
		);
		const showResults = computed(
			() =>
				!(store?.isLoading.value ?? true) &&
				(store?.query.value.length ?? 0) > 0 &&
				(store?.results.value.length ?? 0) > 0
		);

		return {
			isOpen: store?.isOpen,
			query: store?.query,
			results: store?.results,
			isLoading: store?.isLoading,
			selectedIndex: store?.selectedIndex,
			showLoading,
			showNoResults,
			showEmptyState,
			showResults,
			handleInput,
			handleBackdropClick,
			handleResultClick,
			t,
		};
	},
	template: ({
		isOpen,
		query,
		results,
		selectedIndex,
		handleInput,
		handleBackdropClick,
		handleResultClick,
		showLoading,
		showNoResults,
		showEmptyState,
		showResults,
		t,
	}) => (
		<div
			class={() => `search-modal-backdrop ${isOpen?.value ? '' : 'hidden'}`}
			onClick={handleBackdropClick}
		>
			<div class="search-modal">
				<div class="search-input-wrapper">
					<img src="/icons/search.svg" alt="" class="search-icon" />
					<input
						type="text"
						class="search-input"
						placeholder={t.value?.placeholder}
						value={query}
						onInput={handleInput}
						autofocus
					/>
					<kbd class="search-kbd">ESC</kbd>
				</div>

				<div class="search-results" data-lenis-prevent>
					<div class={() => (showLoading.value ? '' : 'hidden')}>
						<div class="search-loading">
							<div class="search-loading-spinner"></div>
						</div>
					</div>

					<div class={() => (showNoResults.value ? '' : 'hidden')}>
						<div class="search-empty">
							<img
								src="/icons/search-empty.svg"
								alt=""
								class="search-empty-icon"
							/>
							<div class="search-empty-title"> {t.value?.noResults}</div>
							<div class="search-empty-subtitle"> {t.value?.tryDifferent}</div>
						</div>
					</div>

					<div class={() => (showEmptyState.value ? '' : 'hidden')}>
						<div class="search-empty">
							<img src="/icons/plus.svg" alt="" class="search-empty-icon" />
							<div class="search-empty-title"> {t.value?.startTyping}</div>
							<div class="search-empty-subtitle"> {t.value?.searchAcross}</div>
						</div>
					</div>

					<div
						class={() => (showResults.value ? 'search-results-list' : 'hidden')}
					>
						<For
							each={results as Signal<SearchResultItem[]>}
							keyExtractor={(item) => item.id}
						>
							{(result, index) => (
								<div
									class={() =>
										`search-result-item ${selectedIndex?.value === index.value ? 'selected' : ''}`
									}
									onClick={() => handleResultClick(result.value)}
								>
									<div class="search-result-heading">
										{computed(
											() => result.value.heading ?? t.value?.documentation
										)}
										<span class="search-result-badges">
											{result.value.matchedIn === 'code' ? (
												<span class="search-result-badge code">
													{t.value?.resultCode}
												</span>
											) : null}
											{result.value.matchedIn === 'title' ? (
												<span class="search-result-badge title">
													{t.value?.resultTitle}
												</span>
											) : null}
											{result.value.matchedIn === 'heading' ? (
												<span class="search-result-badge heading">
													{t.value?.resultSection}
												</span>
											) : null}
										</span>
									</div>
									{result.value.matchedIn === 'code' ? (
										<pre class="search-result-text code-match">
											{result.value.text}
										</pre>
									) : (
										<div class="search-result-text">{result.value.text}</div>
									)}
								</div>
							)}
						</For>
					</div>
				</div>

				<div class="search-footer">
					<div class="search-footer-actions">
						<span class="search-footer-action">
							<kbd>↑</kbd>
							<kbd>↓</kbd>
							{t.value?.toNavigate}
						</span>
						<span class="search-footer-action">
							<kbd>↵</kbd>
							{t.value?.toSelect}
						</span>
					</div>
					<div class="search-footer-powered">
						<span>{t.value?.poweredByPrefix}</span>
						<img
							src="/logo/logo-white.svg"
							alt="Effuse"
							class="search-footer-logo"
						/>
						<span>{t.value?.poweredBySuffix}</span>
					</div>
				</div>
			</div>
		</div>
	),
});
