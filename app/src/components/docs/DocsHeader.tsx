import {
	define,
	computed,
	signal,
	effect,
	type Signal,
	type ReadonlySignal,
	For,
} from '@effuse/core';
import {
	animateDropdownOpen,
	animateDropdownClose,
	animateStaggerChildren,
} from '../../utils/motion';
import type { docsStore as DocsStoreType } from '../../store/docsUIStore.js';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import { SidebarToggle } from './SidebarToggle.js';

export interface TocItem {
	id: string;
	title: string;
	level?: number;
}

interface DocsHeaderProps {
	pageTitle?: string;
	tocItems?: TocItem[] | ReadonlySignal<TocItem[]>;
	activeId?: Signal<string>;
	class?: string;
}

interface DocsHeaderExposed {
	pageTitle: ReadonlySignal<string>;
	tocItems: ReadonlySignal<TocItem[]>;
	dropdownOpen: Signal<boolean>;
	toggleDropdown: () => void;
	activeSectionId: Signal<string>;
	activeSectionTitle: ReadonlySignal<string>;
	docsStore: typeof DocsStoreType;
	handleTocItemClick: (e: Event, id: string, title: string) => void;
	onThisPageText: ReadonlySignal<string>;
	dropdownRef: Signal<HTMLElement | null>;
}

const TocChevron = define<
	{ isOpen: Signal<boolean> },
	{ getClass: () => string }
>({
	script: ({ props }) => ({
		getClass: () => `toc-chevron ${props.isOpen.value ? 'open' : ''}`,
	}),
	template: ({ getClass }) => (
		<img
			src="/icons/chevron-down.svg"
			class={getClass}
			width="16"
			height="16"
			alt="Chevron"
		/>
	),
});

export const DocsHeader = define<DocsHeaderProps, DocsHeaderExposed>({
	script: ({ props, useCallback, useStore }) => {
		const docsStore = useStore('docsUI') as typeof DocsStoreType;
		const i18nStore = useStore('i18n') as typeof I18nStoreType;

		const pageTitle = computed(() => props.pageTitle as string);
		const dropdownRef = signal<HTMLElement | null>(null);

		const tocItems = computed<TocItem[]>(() => {
			const items = props.tocItems;
			if (!items) return [];
			if (Array.isArray(items)) return items;
			return items.value;
		});

		const dropdownOpen = signal(false);
		const activeSectionId = props.activeId ?? signal('');

		const activeSectionTitle = computed(() => {
			const items = tocItems.value;
			const activeId = activeSectionId.value;
			const found = items.find((item) => item.id === activeId);
			return found?.title ?? pageTitle.value;
		});

		const onThisPageText = computed(() => {
			const trans = i18nStore.translations.value;
			return trans?.toc?.onThisPage as string;
		});

		let previousDropdownState: boolean | null = null;

		effect(() => {
			const dropdown = dropdownRef.value;
			if (!dropdown) return;

			const currentOpen = dropdownOpen.value;

			if (previousDropdownState === null) {
				previousDropdownState = currentOpen;
				if (!currentOpen) {
					dropdown.style.display = 'none';
					dropdown.style.opacity = '0';
				}
				return;
			}

			if (currentOpen !== previousDropdownState) {
				previousDropdownState = currentOpen;
				if (currentOpen) {
					animateDropdownOpen(dropdown);
					requestAnimationFrame(() => {
						animateStaggerChildren(dropdown, '.toc-item', 0.03);
					});
				} else {
					animateDropdownClose(dropdown);
				}
			}
		});

		const toggleDropdown = useCallback(() => {
			dropdownOpen.value = !dropdownOpen.value;
		});

		const handleTocItemClick = useCallback(
			(e: Event, id: string, title: string) => {
				e.preventDefault();
				dropdownOpen.value = false;

				let el: HTMLElement | null = null;
				try {
					el = document.querySelector(`#${CSS.escape(id)}`);
				} catch {
					el = document.getElementById(id);
				}

				if (!el) {
					const headings = document.querySelectorAll('h1, h2, h3');
					for (const h of headings) {
						if (h.textContent?.trim() === title) {
							el = h as HTMLElement;
							break;
						}
					}
				}

				if (!el) return;

				const scrollContainer = document.querySelector('.docs-main');
				const isContainerScrollable =
					scrollContainer &&
					scrollContainer.scrollHeight > scrollContainer.clientHeight;

				if (isContainerScrollable) {
					const rect = el.getBoundingClientRect();
					const containerRect = scrollContainer.getBoundingClientRect();
					const offsetTop =
						rect.top - containerRect.top + scrollContainer.scrollTop;
					scrollContainer.scrollTo({
						top: offsetTop - 80,
						behavior: 'smooth',
					});
				} else {
					const rect = el.getBoundingClientRect();
					const scrollTop =
						window.pageYOffset || document.documentElement.scrollTop;
					window.scrollTo({
						top: rect.top + scrollTop - 100,
						behavior: 'smooth',
					});
				}
			}
		);

		return {
			pageTitle,
			tocItems,
			dropdownOpen,
			toggleDropdown,
			activeSectionId,
			activeSectionTitle,
			docsStore,
			handleTocItemClick,
			onThisPageText,
			dropdownRef,
		};
	},
	template: (
		{
			tocItems,
			dropdownOpen,
			toggleDropdown,
			activeSectionId,
			activeSectionTitle,
			docsStore,
			handleTocItemClick,
			onThisPageText,
			dropdownRef,
		},
		props
	) => (
		<header
			class={() => `toc-nav shadow-lg ${props.class || ''}`}
			id="nd-tocnav"
		>
			<div class="flex items-center w-full h-full relative px-2">
				<div class="w-9 flex-shrink-0">
					{!docsStore.isSidebarOpen.value && (
						<SidebarToggle
							class="md:hidden"
							onToggle={docsStore.toggleSidebar}
						/>
					)}
				</div>
				<div class="flex-1 flex justify-center overflow-hidden">
					<button
						class="toc-nav-trigger"
						onClick={toggleDropdown}
						aria-expanded={() => dropdownOpen.value}
					>
						<div class="toc-text-container">
							<span class="toc-text">{activeSectionTitle}</span>
						</div>
						<TocChevron isOpen={dropdownOpen} />
					</button>
				</div>
			</div>
			<div
				class={() => `toc-dropdown ${dropdownOpen.value ? 'open' : ''}`}
				ref={(el: unknown) => {
					dropdownRef.value = el as HTMLElement;
				}}
				style="display: none;"
			>
				<nav class="toc-dropdown-nav">
					<div class="toc-dropdown-header">
						<img src="/icons/list.svg" width="14" height="14" alt="List" />
						{onThisPageText}
					</div>
					<div class="toc-items">
						<For each={tocItems} keyExtractor={(item: TocItem) => item.id}>
							{(itemSignal: ReadonlySignal<TocItem>) => (
								<a
									href={`#${itemSignal.value.id}`}
									class={() =>
										`toc-item ${activeSectionId.value === itemSignal.value.id ? 'active' : ''}`
									}
									onClick={(e: Event) =>
										handleTocItemClick(
											e,
											itemSignal.value.id,
											itemSignal.value.title
										)
									}
								>
									{itemSignal.value.title}
								</a>
							)}
						</For>
					</div>
				</nav>
			</div>
		</header>
	),
});
