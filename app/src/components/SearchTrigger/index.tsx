import { define } from '@effuse/core';
import type { SearchStore } from '../../store/searchStore';
import './styles.css';

interface SearchTriggerProps {}

interface SearchTriggerExposed {
	isMac: boolean;
	handleClick: () => void;
}

export const SearchTrigger = define<SearchTriggerProps, SearchTriggerExposed>({
	script: ({ useCallback, useLayerProvider }) => {
		const isMac =
			typeof navigator !== 'undefined' &&
			navigator.platform.toLowerCase().includes('mac');

		const searchProvider = useLayerProvider('search');
		const store = searchProvider?.search as SearchStore | undefined;

		const handleClick = useCallback(() => {
			store?.open();
		});

		return {
			isMac,
			handleClick,
		};
	},
	template: ({ isMac, handleClick }) => (
		<button type="button" class="search-trigger" onClick={handleClick}>
			<img src="/icons/search.svg" alt="" class="search-trigger-icon" />
			<span class="search-trigger-text">Search</span>
			<span class="search-trigger-kbd">
				<kbd>{isMac ? '⌘' : 'Ctrl'}</kbd>
				<kbd>K</kbd>
			</span>
		</button>
	),
});
