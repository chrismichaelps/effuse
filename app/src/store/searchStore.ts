import { createStore, connectDevTools } from '@effuse/store';
import { effect } from '@effuse/core';
import { i18nStore } from './appI18n.js';
import { loadDocsIndex, type DocEntry } from '../utils/docsIndexer.js';
import { searchDocs, type SearchResultItem } from '../utils/searchEngine.js';

const STORE_NAME = 'search';
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 50;

interface SearchState {
	query: string;
	results: readonly SearchResultItem[];
	isLoading: boolean;
	error: string | null;
	isOpen: boolean;
	selectedIndex: number;
	docsIndex: readonly DocEntry[];
}

interface SearchActions {
	setQuery: (query: string) => void;
	search: (query: string) => void;
	clearResults: () => void;
	open: () => void;
	close: () => void;
	toggle: () => void;
	selectNext: () => void;
	selectPrevious: () => void;
	getSelected: () => SearchResultItem | null;
	init: () => void;
	indexDocs: () => Promise<void>;
}

export const searchStore = createStore<SearchState & SearchActions>(
	STORE_NAME,
	{
		query: '',
		results: [],
		isLoading: false,
		error: null,
		isOpen: false,
		selectedIndex: 0,
		docsIndex: [],

		setQuery(query: string) {
			this.query.value = query;
			this.selectedIndex.value = 0;
		},

		search(query: string) {
			this.query.value = query;
			this.selectedIndex.value = 0;

			if (query.length < MIN_QUERY_LENGTH) {
				this.results.value = [];
				return;
			}

			this.isLoading.value = true;
			this.error.value = null;

			setTimeout(() => {
				const results = searchDocs(this.docsIndex.value, query);
				this.results.value = results;
				this.isLoading.value = false;
			}, DEBOUNCE_MS);
		},

		clearResults() {
			this.query.value = '';
			this.results.value = [];
			this.error.value = null;
			this.selectedIndex.value = 0;
		},

		open() {
			this.isOpen.value = true;
		},

		close() {
			this.isOpen.value = false;
			this.clearResults();
		},

		toggle() {
			if (this.isOpen.value) {
				this.close();
			} else {
				this.open();
			}
		},

		selectNext() {
			const len = this.results.value.length;
			if (len > 0) {
				this.selectedIndex.value = (this.selectedIndex.value + 1) % len;
			}
		},

		selectPrevious() {
			const len = this.results.value.length;
			if (len > 0) {
				this.selectedIndex.value = (this.selectedIndex.value - 1 + len) % len;
			}
		},

		getSelected(): SearchResultItem | null {
			const idx = this.selectedIndex.value;
			const res = this.results.value;
			return res[idx] ?? null;
		},

		async indexDocs() {
			const locale = i18nStore.locale.value || 'en';
			const docs = await loadDocsIndex(locale);
			this.docsIndex.value = docs;
		},

		init() {
			if (typeof window !== 'undefined') {
				this.indexDocs();

				effect(() => {
					const locale = i18nStore.locale.value;
					if (locale) {
						this.indexDocs();
					}
				});

				const handleKeyDown = (e: KeyboardEvent) => {
					if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
						e.preventDefault();
						this.toggle();
					}

					if (e.key === 'Escape' && this.isOpen.value) {
						e.preventDefault();
						this.close();
					}
				};
				window.addEventListener('keydown', handleKeyDown);
			}
		},
	},
	{ devtools: true }
);

connectDevTools(searchStore);

export type SearchStore = typeof searchStore;
export type { SearchResultItem };
