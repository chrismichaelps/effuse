import {
	define,
	signal,
	effect,
	type Signal,
	For,
	computed,
	type ReadonlySignal,
} from '@effuse/core';
import { Sidebar } from './Sidebar.js';
import { DocsHeader, type TocItem } from './DocsHeader.js';
import { SidebarToggle } from './SidebarToggle.js';
import type { docsStore as DocsStoreType } from '../../store/docsUIStore.js';
import type { i18nStore as I18nStoreType } from '../../store/appI18n.js';
import './styles.css';

interface DocsLayoutProps {
	children: any;
	currentPath?: string;
	pageTitle?: string;
	tocItems?: TocItem[] | ReadonlySignal<TocItem[]>;
}

interface DocsLayoutExposed {
	docsStore: typeof DocsStoreType;
	activeSectionId: Signal<string>;
	normalizedTocItems: ReadonlySignal<TocItem[]>;
	t: ReadonlySignal<any>;
}

const unwrapTocItems = (
	items: TocItem[] | ReadonlySignal<TocItem[]> | undefined
): TocItem[] => {
	if (!items) return [];
	if (Array.isArray(items)) return items;
	return items.value;
};

export const DocsLayout = define<DocsLayoutProps, DocsLayoutExposed>({
	script: ({ props, onMount, useStore }) => {
		const docsStore = useStore('docsUI') as typeof DocsStoreType;
		const i18nStore = useStore('i18n') as typeof I18nStoreType;

		const activeSectionId = signal('');

		const normalizedTocItems = computed(() => unwrapTocItems(props.tocItems));

		effect(() => {
			const items = normalizedTocItems.value;
			if (items.length > 0) {
				activeSectionId.value = items[0].id;
			}
		});

		const t = computed(() => i18nStore.translations.value?.toc);

		onMount(() => {
			const scrollContainer = document.querySelector('.docs-main');
			if (!scrollContainer) return;

			const handleScroll = () => {
				const items = normalizedTocItems.value;
				if (items.length === 0) return;

				let activeId = '';
				for (const item of items) {
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
						if (rect.top < 150) {
							activeId = item.id;
						}
					}
				}
				activeSectionId.value = activeId || items[0]?.id || '';
			};

			scrollContainer.addEventListener('scroll', handleScroll, {
				passive: true,
			});
			window.addEventListener('scroll', handleScroll, {
				passive: true,
			});

			requestAnimationFrame(() => {
				const items = normalizedTocItems.value;
				if (items.length > 0) {
					activeSectionId.value = items[0].id;
				}
				handleScroll();
			});

			return () => {
				scrollContainer.removeEventListener('scroll', handleScroll);
				window.removeEventListener('scroll', handleScroll);
			};
		});

		return {
			docsStore,
			activeSectionId,
			normalizedTocItems,
			t,
		};
	},
	template: (
		{ docsStore, activeSectionId, normalizedTocItems, t, children },
		props
	) => (
		<div
			class={() =>
				`docs-layout ${docsStore.isSidebarCollapsed.value ? 'sidebar-collapsed' : ''}`
			}
		>
			{docsStore.isSidebarOpen.value && (
				<div
					class="md:hidden fixed inset-0 bg-black/20 z-30 backdrop-blur-sm"
					onClick={docsStore.toggleSidebar}
				/>
			)}

			<div
				class={() => `
					sidebar-desktop-wrapper
					${docsStore.isSidebarOpen.value ? 'sidebar-mobile-open' : 'sidebar-mobile-closed'}
					${docsStore.isSidebarCollapsed.value ? 'collapsed' : ''}
				`}
			>
				<Sidebar currentPath={props.currentPath} />
			</div>

			<main class="docs-main" data-lenis-prevent>
				<SidebarToggle
					class={() =>
						`collapsed-sidebar-trigger ${docsStore.isSidebarCollapsed.value ? '' : 'trigger-hidden'}`
					}
				/>

				<DocsHeader
					class="md:hidden"
					pageTitle={props.pageTitle}
					tocItems={normalizedTocItems}
					activeId={activeSectionId}
				/>
				<div class="docs-content-wrapper">
					<div class="docs-content">{children}</div>

					<aside class="docs-toc-sidebar lg:block hidden">
						<div class="toc-sidebar-container">
							<div class="toc-sidebar-title flex items-center gap-2">
								<img src="/icons/list.svg" width="14" height="14" alt="List" />
								{t.value?.onThisPage}
							</div>
							<nav class="toc-sidebar-nav">
								<For
									each={normalizedTocItems}
									keyExtractor={(item: TocItem) => item.id}
								>
									{(itemSignal: ReadonlySignal<TocItem>) => (
										<a
											href={`#${itemSignal.value.id}`}
											class={() =>
												`toc-sidebar-link ${activeSectionId.value === itemSignal.value.id ? 'active' : ''}`
											}
											onClick={(e: Event) => {
												e.preventDefault();
												const title = itemSignal.value.title;
												const id = itemSignal.value.id;
												let el: HTMLElement | null = null;
												try {
													el = document.querySelector(`#${CSS.escape(id)}`);
												} catch {
													el = document.getElementById(id);
												}
												if (!el) {
													const headings =
														document.querySelectorAll('h1, h2, h3');
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
							</nav>
						</div>
					</aside>
				</div>
			</main>
		</div>
	),
});
