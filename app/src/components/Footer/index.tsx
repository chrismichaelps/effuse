import { define, For } from '@effuse/core';
import { Link } from '@effuse/router';
import './styles.css';

interface FooterLink {
	label: string;
	href: string;
	external?: boolean;
	icon?: string;
}

interface FooterSection {
	title: string;
	links: FooterLink[];
}

const footerSections: FooterSection[] = [
	{
		title: 'Site',
		links: [
			{ label: 'Docs', href: '/docs' },
			{ label: 'About', href: '/about' },
		],
	},
	{
		title: 'Getting Started',
		links: [
			{ label: 'Introduction', href: '/docs/getting-started' },
			{ label: 'Installation', href: '/docs/installation' },
			{ label: 'Quick Start', href: '/docs/quick-start' },
		],
	},
	{
		title: 'Social',
		links: [
			{
				label: 'GitHub',
				href: 'https://github.com/chrismichaelps/effuse',
				external: true,
				icon: '/icons/github.svg',
			},
		],
	},
	{
		title: 'Legal',
		links: [
			{ label: 'Terms', href: '/terms' },
			{ label: 'Privacy', href: '/privacy' },
			{ label: 'Disclaimer', href: '/disclaimer' },
			{ label: 'Contact', href: '/contact' },
		],
	},
];

export const Footer = define({
	script: () => {
		const version = (globalThis as any).__APP_VERSION__;
		return { sections: footerSections, version };
	},
	template: ({ sections, version }) => (
		<footer class="footer-motion">
			<div class="footer-content">
				<nav class="footer-nav">
					<For
						each={() => sections}
						children={(section) => (
							<section class="footer-section">
								<h2 class="footer-section-title">{section.value.title}</h2>
								<ul class="footer-section-links">
									<For
										each={() => section.value.links}
										children={(link) => (
											<li>
												{link.value.external ? (
													<a
														href={link.value.href}
														target="_blank"
														rel="noopener noreferrer"
														class="footer-link footer-link-external"
													>
														{link.value.icon && (
															<img
																src={link.value.icon}
																alt=""
																class="footer-social-icon"
															/>
														)}
														<span>{link.value.label}</span>
													</a>
												) : (
													<Link to={link.value.href} class="footer-link">
														{link.value.label}
													</Link>
												)}
											</li>
										)}
									/>
								</ul>
							</section>
						)}
					/>
				</nav>

				<div class="footer-bottom">
					<div class="footer-version">
						<img src="/logo/logo-white.svg" alt="Effuse" class="footer-logo" />
						<span class="footer-version-label">Latest version:</span>
						<Link to="/docs/changelog" class="footer-version-badge">
							{version}
						</Link>
					</div>

					<div class="footer-effuse-badge">
						<div class="footer-badge-left">
							<img
								src="/logo/logo-mint.svg"
								alt="Effuse"
								class="footer-badge-logo"
							/>
							<span class="footer-badge-label">Effuse</span>
						</div>
						<div class="footer-badge-copyright">
							© {new Date().getFullYear()} Effuse. MIT License.
						</div>
					</div>
				</div>
			</div>
		</footer>
	),
});
