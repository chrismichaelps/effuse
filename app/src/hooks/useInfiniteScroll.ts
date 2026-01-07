import { defineHook, type Signal } from '@effuse/core';

interface InfiniteScrollConfig {
	threshold?: number;
}
interface InfiniteScrollReturn {
	onLoadMore: (callback: () => void) => void;
	handleScroll: (e: Event) => void;
	isNearBottom: Signal<boolean>;
}

export const useInfiniteScroll = defineHook<
	InfiniteScrollConfig,
	InfiniteScrollReturn
>({
	name: 'useInfiniteScroll',
	setup: ({ config, signal }): InfiniteScrollReturn => {
		const threshold = config.threshold ?? 100;
		const isNearBottom = signal(false);
		let loadMoreCallback: (() => void) | null = null;

		const handleScroll = (e: Event) => {
			const target = e.target as HTMLElement;
			const scrollTop = target.scrollTop;
			const scrollHeight = target.scrollHeight;
			const clientHeight = target.clientHeight;
			const nearBottom = scrollHeight - scrollTop - clientHeight < threshold;

			isNearBottom.value = nearBottom;

			if (nearBottom) {
				loadMoreCallback?.();
			}
		};

		return {
			onLoadMore: (callback: () => void) => {
				loadMoreCallback = callback;
			},
			handleScroll,
			isNearBottom,
		};
	},
});
