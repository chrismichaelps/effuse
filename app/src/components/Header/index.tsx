import { define, signal, computed, type ReadonlySignal } from '@effuse/core';
import { Link, useRoute } from '@effuse/router';
import { HamburgerButton } from '../HamburgerButton';
import { LanguageSelector } from '../docs/LanguageSelector';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import './styles.css';

interface HeaderExposed {
	mobileMenuOpen: ReturnType<typeof signal<boolean>>;
	toggleMenu: () => void;
	isDocsPath: ReadonlySignal<boolean>;
	docsLabel: ReadonlySignal<string>;
	aboutLabel: ReadonlySignal<string>;
}

const LOCALIZED_SECTIONS = [
	'/docs',
	'/form',
	'/todos',
	'/props',
	'/emit',
	'/i18n',
	'/about',
] as const;

export const Header = define<Record<string, never>, HeaderExposed>({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;

		const mobileMenuOpen = signal(false);
		const toggleMenu = () => {
			mobileMenuOpen.value = !mobileMenuOpen.value;
		};

		const route = useRoute();

		const isDocsPath = computed(() => {
			const path = route.path;
			return LOCALIZED_SECTIONS.some((section) => path.startsWith(section));
		});

		const docsLabel = computed(() => {
			return i18nStore.translations.value?.nav?.docs as string;
		});
		const aboutLabel = computed(() => {
			return i18nStore.translations.value?.nav?.about as string;
		});

		return { mobileMenuOpen, toggleMenu, isDocsPath, docsLabel, aboutLabel };
	},
	template: ({
		mobileMenuOpen,
		toggleMenu,
		isDocsPath,
		docsLabel,
		aboutLabel,
	}) => (
		<header class="header-main">
			<div
				class={() => `header-container ${isDocsPath.value ? 'docs-mode' : ''}`}
			>
				<div class="header-inner">
					<div class="header-left">
						<Link to="/" class="header-brand">
							<img
								src="/logo/logo-white.svg"
								alt="Effuse Logo"
								class="header-brand-logo"
							/>
							<span class="header-brand-text">Effuse</span>
						</Link>
					</div>

					<div class="header-right">
						<nav class="header-nav">
							<Link
								to="/docs"
								class="header-nav-link"
								activeClass="header-nav-link-active"
								exactActiveClass="header-nav-link-active"
							>
								{docsLabel}
							</Link>
							<Link
								to="/about"
								class="header-nav-link"
								activeClass="header-nav-link-active"
								exactActiveClass="header-nav-link-active"
							>
								{aboutLabel}
							</Link>
						</nav>

						<div
							class={() =>
								`header-desktop-actions ${isDocsPath.value ? 'visible' : 'hidden'}`
							}
						>
							<div class="header-divider"></div>
							<div class="header-lang-wrapper">
								<LanguageSelector />
							</div>
							<div class="header-divider"></div>
						</div>

						<div class="md:hidden">
							<HamburgerButton isOpen={mobileMenuOpen} onToggle={toggleMenu} />
						</div>
					</div>
				</div>

				<nav
					class={() =>
						`header-mobile-menu ${mobileMenuOpen.value ? 'open' : 'closed'}`
					}
				>
					<div class="header-mobile-row">
						<Link
							to="/docs"
							class="header-mobile-link"
							activeClass="header-mobile-link-active"
							exactActiveClass="header-mobile-link-active"
							onClick={toggleMenu}
						>
							{docsLabel}
						</Link>
						<Link
							to="/about"
							class="header-mobile-link"
							activeClass="header-mobile-link-active"
							exactActiveClass="header-mobile-link-active"
							onClick={toggleMenu}
						>
							{aboutLabel}
						</Link>
						<div
							class={() =>
								`header-lang-mobile ${isDocsPath.value ? 'visible' : 'hidden'}`
							}
						>
							<LanguageSelector isMobile />
						</div>
					</div>
				</nav>
			</div>
		</header>
	),
});
