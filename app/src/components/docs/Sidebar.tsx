import {
	define,
	computed,
	type ReadonlySignal,
	For,
	type Signal,
} from '@effuse/core';
import { Link } from '@effuse/router';
import { SidebarToggle } from './SidebarToggle.js';
import { docsStore } from '../../store/docsUIStore.js';

interface NavItem {
	label: string;
	href: string;
}

interface NavSection {
	title: string;
	items: NavItem[];
	isOpen?: boolean;
}

interface SectionState {
	title: string;
	items: NavItem[];
	isOpen: Signal<boolean>;
	toggle: () => void;
}

interface SidebarProps {
	currentPath?: string;
}

interface SidebarExposed {
	sectionStates: ReadonlySignal<SectionState[]>;
	docsStore: typeof docsStore;
	isSidebarOpen: Signal<boolean>;
	toggleSidebar: () => void;
}

const sectionsData: NavSection[] = [
	{
		title: 'Getting Started',
		items: [
			{ label: 'Introduction', href: '/docs/getting-started' },
			{ label: 'Installation', href: '/docs/installation' },
			{ label: 'Quick Start', href: '/docs/quick-start' },
		],
		isOpen: true,
	},
	{
		title: 'Core Concepts',
		items: [
			{ label: 'Signals', href: '/docs/signals' },
			{ label: 'Components', href: '/docs/components' },
			{ label: 'Props', href: '/docs/props' },
			{ label: 'Effects', href: '/docs/effects' },
			{ label: 'Form Management', href: '/docs/use-form' },
		],
		isOpen: true,
	},
	{
		title: 'Advanced',
		items: [
			{ label: 'Routing', href: '/docs/routing' },
			{ label: 'State Management', href: '/docs/state' },
			{ label: 'SEO & Head', href: '/docs/seo' },
		],
		isOpen: false,
	},
	{
		title: 'Examples',
		items: [
			{ label: 'Form', href: '/form' },
			{ label: 'Todos', href: '/todos' },
			{ label: 'Props', href: '/props' },
		],
		isOpen: false,
	},
];

const ChevronIcon = define<
	{ isOpen: Signal<boolean> },
	{ getClass: () => string }
>({
	script: ({ props }) => ({
		getClass: () => `sidebar-chevron ${props.isOpen.value ? 'open' : ''}`,
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

export const Sidebar = define<SidebarProps, SidebarExposed>({
	script: () => {
		const sectionStates = computed(() =>
			sectionsData.map((section) => ({
				title: section.title,
				items: section.items,
				isOpen: computed(() => docsStore.isSectionOpen(section.title)),
				toggle: () => docsStore.toggleSection(section.title),
			}))
		);

		return {
			sectionStates,
			docsStore,
			isSidebarOpen: docsStore.isSidebarOpen,
			toggleSidebar: () => docsStore.toggleSidebar(),
		};
	},
	template: ({ sectionStates }) => (
		<aside class="docs-sidebar" data-lenis-prevent>
			<div class="sidebar-header">
				<div class="sidebar-top-row">
					<div class="flex items-center gap-2">
						<img src="/logo/logo.svg" width="20" height="20" alt="Logo" />
						<span class="font-bold text-slate-800 tracking-tight">
							Documentation
						</span>
					</div>
					<SidebarToggle class="sidebar-brand-toggle" />
				</div>
			</div>
			<nav class="sidebar-nav">
				<For each={sectionStates} keyExtractor={(s: SectionState) => s.title}>
					{(sectionSignal: ReadonlySignal<SectionState>) => (
						<div class="sidebar-section">
							<button
								class="sidebar-section-header"
								onClick={() => sectionSignal.value.toggle()}
							>
								<span class="sidebar-title">{sectionSignal.value.title}</span>
								<ChevronIcon isOpen={sectionSignal.value.isOpen} />
							</button>

							<div
								class={() =>
									`sidebar-items ${sectionSignal.value.isOpen.value ? 'open' : ''}`
								}
							>
								<For
									each={computed(() => sectionSignal.value.items)}
									keyExtractor={(item: NavItem) => item.label}
								>
									{(itemSignal: ReadonlySignal<NavItem>) => (
										<Link
											to={itemSignal.value.href}
											class="sidebar-link"
											activeClass="active"
										>
											{itemSignal.value.label}
										</Link>
									)}
								</For>
							</div>
						</div>
					)}
				</For>
			</nav>
		</aside>
	),
});
