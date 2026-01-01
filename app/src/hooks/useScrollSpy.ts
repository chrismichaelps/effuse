import { defineHook, type Signal } from '@effuse/core';

interface TocItem {
	id: string;
	title: string;
}

interface ScrollSpyConfig {
	containerSelector: string;
	threshold: number;
}

interface ScrollSpyReturn {
	activeId: Signal<string>;
	items: Signal<TocItem[]>;
	setItems: (newItems: TocItem[]) => void;
	init: () => void;
}

export const useScrollSpy = defineHook<
	ScrollSpyConfig,
	readonly [],
	ScrollSpyReturn
>({
	name: 'useScrollSpy',
	setup: ({ config, signal, effect }): ScrollSpyReturn => {
		const activeId = signal('');
		const items = signal<TocItem[]>([]);
		const initialized = signal(false);

		effect(() => {
			if (!initialized.value) return undefined;

			const container = document.querySelector(config.containerSelector);
			if (!container) return undefined;

			const handleScroll = () => {
				const tocItems = items.value;
				if (tocItems.length === 0) return;

				let foundId = '';
				for (const item of tocItems) {
					let el = document.getElementById(item.id);
					if (!el) {
						const headings = document.querySelectorAll('h1, h2, h3');
						for (const h of headings) {
							if (h.textContent?.trim() === item.title) {
								el = h as HTMLElement;
								break;
							}
						}
					}
					if (el) {
						const rect = el.getBoundingClientRect();
						if (rect.top < config.threshold) {
							foundId = item.id;
						}
					}
				}
				activeId.value = foundId || tocItems[0]?.id || '';
			};

			container.addEventListener('scroll', handleScroll, { passive: true });
			window.addEventListener('scroll', handleScroll, { passive: true });

			requestAnimationFrame(() => {
				const tocItems = items.value;
				if (tocItems.length > 0) {
					activeId.value = tocItems[0].id;
				}
				handleScroll();
			});

			return () => {
				container.removeEventListener('scroll', handleScroll);
				window.removeEventListener('scroll', handleScroll);
			};
		});

		return {
			activeId,
			items,
			setItems: (newItems: TocItem[]) => {
				items.value = newItems;
			},
			init: () => {
				initialized.value = true;
			},
		};
	},
});
