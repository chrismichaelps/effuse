import {
	define,
	type Signal,
	For,
	computed,
	type ReadonlySignal,
} from '@effuse/core';
import { Sidebar } from './Sidebar.js';
import { DocsHeader, type TocItem } from './DocsHeader.js';
import { SidebarToggle } from './SidebarToggle.js';
import {
	useScrollSpy,
	useSmoothScroll,
	useTranslation,
} from '../../hooks/index.js';
import type { docsStore as DocsStoreType } from '../../store/docsUIStore.js';
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
	t: (key: string, fallback?: string) => string;
	isCollapsed: Signal<unknown>;
	isOpen: Signal<unknown>;
}

const unwrapTocItems = (
	items: TocItem[] | ReadonlySignal<TocItem[]> | undefined
): TocItem[] => {
	if (!items) return [];
	if (Array.isArray(items)) return items;
	return items.value;
};

export const DocsLayout = define<DocsLayoutProps, DocsLayoutExposed>({
	script: ({ props, onMount, useLayerProps, useLayerProvider }) => {
		const sidebarProps = useLayerProps('sidebar')!;
		const sidebarProvider = useLayerProvider('sidebar')!;
		const { t } = useTranslation();

		const docsStore = sidebarProvider.docsUI as typeof DocsStoreType;

		const normalizedTocItems = computed(() => unwrapTocItems(props.tocItems));

		const scrollSpy = useScrollSpy({
			containerSelector: '.docs-main',
			threshold: 150,
		});

		const smoothScroll = useSmoothScroll({
			wrapper: '.docs-main',
			content: '.docs-content',
			duration: 1.2,
		});

		onMount(() => {
			scrollSpy.setItems(normalizedTocItems.value);
			scrollSpy.init();
			smoothScroll.init();
			return undefined;
		});

		return {
			docsStore,
			activeSectionId: scrollSpy.activeId,
			normalizedTocItems,
			t,
			isCollapsed: sidebarProps.isCollapsed,
			isOpen: sidebarProps.isOpen,
		};
	},
	template: (
		{
			docsStore,
			activeSectionId,
			normalizedTocItems,
			t,
			children,
			isCollapsed,
			isOpen,
		},
		props
	) => (
		<div
			class={() =>
				`docs-layout ${isCollapsed.value ? 'sidebar-collapsed' : ''}`
			}
		>
			{(isOpen.value as boolean) && (
				<div
					class="md:hidden fixed inset-0 bg-black/20 z-30 backdrop-blur-sm"
					onClick={docsStore.toggleSidebar}
				/>
			)}

			<div
				class={() => `
					sidebar-desktop-wrapper
					${isOpen.value ? 'sidebar-mobile-open' : 'sidebar-mobile-closed'}
					${isCollapsed.value ? 'collapsed' : ''}
				`}
			>
				<Sidebar currentPath={props.currentPath} />
			</div>

			<main class="docs-main" data-lenis-prevent>
				<SidebarToggle
					class={() =>
						`collapsed-sidebar-trigger ${isCollapsed.value ? '' : 'trigger-hidden'}`
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
								{t('toc.onThisPage', '')}
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
