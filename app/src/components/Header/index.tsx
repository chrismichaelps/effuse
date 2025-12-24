import { define, signal } from '@effuse/core';
import { Link } from '@effuse/router';
import { HamburgerButton } from '../HamburgerButton';
import './styles.css';

interface HeaderExposed {
	mobileMenuOpen: ReturnType<typeof signal<boolean>>;
	toggleMenu: () => void;
}

export const Header = define<Record<string, never>, HeaderExposed>({
	script: () => {
		const mobileMenuOpen = signal(false);
		const toggleMenu = () => {
			mobileMenuOpen.value = !mobileMenuOpen.value;
		};
		return { mobileMenuOpen, toggleMenu };
	},
	template: ({ mobileMenuOpen, toggleMenu }) => (
		<header class="header-main">
			<div class="header-container">
				<div class="header-inner">
					<Link to="/" class="header-brand">
						<img
							src="/logo/logo.svg"
							alt="Effuse Logo"
							class="header-brand-logo"
						/>
						<span class="header-brand-text">Effuse</span>
					</Link>

					<nav class="header-nav">
						<Link
							to="/docs"
							class="header-nav-link"
							activeClass="header-nav-link-active"
							exactActiveClass="header-nav-link-active"
						>
							Docs
						</Link>
					</nav>

					<div class="md:hidden">
						<HamburgerButton isOpen={mobileMenuOpen} onToggle={toggleMenu} />
					</div>
				</div>

				<nav
					class={() =>
						`header-mobile-menu ${mobileMenuOpen.value ? 'open' : 'closed'}`
					}
				>
					<Link
						to="/docs"
						class="header-mobile-link"
						activeClass="header-mobile-link-active"
						exactActiveClass="header-mobile-link-active"
						onClick={toggleMenu}
					>
						Docs
					</Link>
				</nav>
			</div>
		</header>
	),
});
