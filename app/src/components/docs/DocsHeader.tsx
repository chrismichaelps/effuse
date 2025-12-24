import {
	define,
	computed,
	signal,
	type Signal,
	type ReadonlySignal,
	For,
} from '@effuse/core';
import { docsStore } from '../../store/docsUIStore.js';
import { SidebarToggle } from './SidebarToggle.js';

export interface TocItem {
	id: string;
	title: string;
	level?: number;
}

interface DocsHeaderProps {
	pageTitle?: string;
	tocItems?: TocItem[];
	activeId?: Signal<string>;
}

interface DocsHeaderExposed {
	pageTitle: ReadonlySignal<string>;
	tocItems: ReadonlySignal<TocItem[]>;
	dropdownOpen: Signal<boolean>;
	toggleDropdown: () => void;
	scrollProgress: Signal<number>;
	activeSectionId: Signal<string>;
	activeSectionTitle: ReadonlySignal<string>;
	docsStore: typeof docsStore;
}

const ProgressRing = define<
	{ progress: Signal<number> },
	{ strokeOffset: () => string }
>({
	script: ({ props }) => {
		const circumference = 2 * Math.PI * 11;
		return {
			strokeOffset: () => {
				const offset =
					circumference - (props.progress.value / 100) * circumference;
				return `${offset}`;
			},
		};
	},
	template: ({ strokeOffset }) => (
		<svg
			xmlns="http://www.w3.org/2000/svg"
			role="progressbar"
			viewBox="0 0 24 24"
			aria-valuenow="0"
			aria-valuemin="0"
			aria-valuemax="100"
			class="toc-progress-ring shrink-0 text-orange-600"
			width="16"
			height="16"
		>
			<circle
				cx="12"
				cy="12"
				r="11"
				fill="none"
				stroke-width="2"
				class="stroke-current/25"
			></circle>
			<circle
				cx="12"
				cy="12"
				r="11"
				fill="none"
				stroke-width="2"
				stroke="currentColor"
				stroke-dasharray="69.11503837897544"
				stroke-dashoffset={strokeOffset}
				stroke-linecap="round"
				transform="rotate(-90 12 12)"
				class="transition-all"
			></circle>
		</svg>
	),
});

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
	script: ({ props, useCallback }) => {
		const pageTitle = computed(() => props.pageTitle ?? 'Documentation');
		const tocItems = computed<TocItem[]>(() => props.tocItems ?? []);
		const dropdownOpen = signal(false);
		const scrollProgress = signal(0);
		const activeSectionId = props.activeId ?? signal('');
		const activeSectionTitle = computed(() => {
			const items = tocItems.value;
			const activeId = activeSectionId.value;
			const found = items.find((item) => item.id === activeId);
			return found?.title ?? pageTitle.value;
		});
		const toggleDropdown = useCallback(() => {
			dropdownOpen.value = !dropdownOpen.value;
		});
		return {
			pageTitle,
			tocItems,
			dropdownOpen,
			toggleDropdown,
			scrollProgress,
			activeSectionId,
			activeSectionTitle,
			docsStore,
		};
	},
	template: ({
		tocItems,
		dropdownOpen,
		toggleDropdown,
		scrollProgress,
		activeSectionId,
		activeSectionTitle,
		docsStore,
	}) => (
		<header class="toc-nav shadow-lg" id="nd-tocnav">
			<div class="flex items-center w-full h-full relative px-4">
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
						<ProgressRing progress={scrollProgress} />
						<div class="toc-text-container">
							<span class="toc-text">{activeSectionTitle}</span>
						</div>
						<TocChevron isOpen={dropdownOpen} />
					</button>
				</div>
				<div class="w-9 flex-shrink-0 md:hidden"></div>
			</div>
			<div class={() => `toc-dropdown ${dropdownOpen.value ? 'open' : ''}`}>
				<nav class="toc-dropdown-nav">
					<div class="toc-dropdown-header">
						<img src="/icons/list.svg" width="14" height="14" alt="List" />
						On this page
					</div>
					<div class="toc-items">
						<For each={tocItems} keyExtractor={(item: TocItem) => item.id}>
							{(itemSignal: ReadonlySignal<TocItem>) => (
								<a
									href={`#${itemSignal.value.id}`}
									class={() =>
										`toc-item ${activeSectionId.value === itemSignal.value.id ? 'active' : ''}`
									}
									onClick={(e: Event) => {
										e.preventDefault();
										dropdownOpen.value = false;
										const id = itemSignal.value.id;
										const title = itemSignal.value.title;
										let el = document.getElementById(id);
										if (!el) {
											const headings = document.querySelectorAll('h1, h2, h3');
											for (const h of headings) {
												if (h.textContent?.trim() === title) {
													el = h as HTMLElement;
													break;
												}
											}
										}
										if (el) {
											const scrollContainer =
												document.querySelector('.docs-main');
											if (scrollContainer) {
												const rect = el.getBoundingClientRect();
												const containerRect =
													scrollContainer.getBoundingClientRect();
												const offsetTop =
													rect.top -
													containerRect.top +
													scrollContainer.scrollTop;
												scrollContainer.scrollTo({
													top: offsetTop - 60,
													behavior: 'smooth',
												});
											}
										}
									}}
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
