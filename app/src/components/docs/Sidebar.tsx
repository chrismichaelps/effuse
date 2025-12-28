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
import { i18nStore } from '../../store/appI18n';

interface NavItem {
	label: string;
	href: string;
}

interface NavSection {
	key: string;
	titleKey: keyof typeof sectionTitleKeys;
	items: { labelKey: string; href: string }[];
	isOpen?: boolean;
}

interface SectionState {
	key: string;
	title: ReadonlySignal<string>;
	items: ReadonlySignal<NavItem[]>;
	isOpen: ReadonlySignal<boolean>;
	toggle: () => void;
}

interface SidebarProps {
	currentPath?: string;
}

interface SidebarExposed {
	sectionStates: SectionState[];
	docsStore: typeof docsStore;
	isSidebarOpen: Signal<boolean>;
	toggleSidebar: () => void;
}

const sectionTitleKeys = {
	gettingStarted: 'gettingStarted',
	coreConcepts: 'coreConceptsTitle',
	advanced: 'advancedTitle',
	examples: 'examplesTitle',
} as const;

const sectionsConfig: NavSection[] = [
	{
		key: 'Getting Started',
		titleKey: 'gettingStarted',
		items: [
			{ labelKey: 'introduction', href: '/docs/getting-started' },
			{ labelKey: 'installation', href: '/docs/installation' },
			{ labelKey: 'quickStart', href: '/docs/quick-start' },
		],
		isOpen: true,
	},
	{
		key: 'Core Concepts',
		titleKey: 'coreConcepts',
		items: [
			{ labelKey: 'components', href: '/docs/components' },
			{ labelKey: 'reactivity', href: '/docs/signals' },
			{ labelKey: 'lifecycle', href: '/docs/effects' },
			{ labelKey: 'form', href: '/docs/use-form' },
			{ labelKey: 'events', href: '/docs/emit' },
		],
		isOpen: true,
	},
	{
		key: 'Advanced',
		titleKey: 'advanced',
		items: [
			{ labelKey: 'routing', href: '/docs/routing' },
			{ labelKey: 'stateManagement', href: '/docs/state' },
			{ labelKey: 'seoHead', href: '/docs/seo' },
			{ labelKey: 'internationalization', href: '/docs/i18n' },
		],
		isOpen: false,
	},
	{
		key: 'Examples',
		titleKey: 'examples',
		items: [
			{ labelKey: 'form', href: '/form' },
			{ labelKey: 'todos', href: '/todos' },
			{ labelKey: 'props', href: '/props' },
			{ labelKey: 'i18n', href: '/i18n' },
			{ labelKey: 'emit', href: '/emit' },
		],
		isOpen: false,
	},
];

const ChevronIcon = define<
	{ isOpen: ReadonlySignal<boolean> },
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

const createStableSectionStates = (): SectionState[] => {
	return sectionsConfig.map((section) => {
		const title = computed(() => {
			const sidebar = i18nStore.translations.value?.sidebar;
			const titleKeyMapping: Record<string, string | undefined> = {
				gettingStarted: sidebar?.gettingStarted,
				coreConcepts: sidebar?.coreConceptsTitle,
				advanced: sidebar?.advancedTitle,
				examples: sidebar?.examplesTitle,
			};
			return titleKeyMapping[section.titleKey] ?? section.key;
		});

		const items = computed(() => {
			const sidebar = i18nStore.translations.value?.sidebar;
			const labelMapping: Record<string, string | undefined> = {
				introduction: sidebar?.introduction,
				installation: sidebar?.installation,
				quickStart: sidebar?.quickStart,
				components: sidebar?.components,
				reactivity: sidebar?.reactivity,
				lifecycle: sidebar?.lifecycle,
				form: sidebar?.form,
				routing: sidebar?.routing,
				stateManagement: sidebar?.stateManagement,
				seoHead: sidebar?.seoHead,
				internationalization: sidebar?.internationalization,
				todos: sidebar?.todos,
				props: sidebar?.props,
				i18n: sidebar?.i18n,
				emit: sidebar?.emit,
				events: sidebar?.events,
			};
			return section.items.map((item) => ({
				label: labelMapping[item.labelKey] ?? item.labelKey,
				href: item.href,
			}));
		});

		const isOpen = computed(() => docsStore.isSectionOpen(section.key));
		const toggle = () => docsStore.toggleSection(section.key);

		return { key: section.key, title, items, isOpen, toggle };
	});
};

const stableSectionStates = createStableSectionStates();

export const Sidebar = define<SidebarProps, SidebarExposed>({
	script: () => {
		return {
			sectionStates: stableSectionStates,
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
				{sectionStates.map((section) => (
					<div class="sidebar-section">
						<button
							class="sidebar-section-header"
							onClick={() => section.toggle()}
						>
							<span class="sidebar-title">{section.title.value}</span>
							<ChevronIcon isOpen={section.isOpen} />
						</button>

						<div
							class={() =>
								`sidebar-items ${section.isOpen.value ? 'open' : ''}`
							}
						>
							<For
								each={section.items}
								keyExtractor={(item: NavItem) => item.href}
							>
								{(itemSignal: ReadonlySignal<NavItem>) => (
									<Link
										to={itemSignal.value.href}
										class="sidebar-link"
										activeClass="router-link-exact-active"
										exactActiveClass="router-link-exact-active"
									>
										{itemSignal.value.label}
									</Link>
								)}
							</For>
						</div>
					</div>
				))}
			</nav>
		</aside>
	),
});
