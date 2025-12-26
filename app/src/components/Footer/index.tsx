import { define } from '@effuse/core';
import { Link } from '@effuse/router';

interface FooterLink {
	label: string;
	href: string;
	external?: boolean;
}

interface FooterColumn {
	title: string;
	links: FooterLink[];
}

const footerColumns: FooterColumn[] = [
	{
		title: 'Resources',
		links: [
			{ label: 'Documentation', href: '/docs/getting-started' },
			{ label: 'Quick Start', href: '/docs/quick-start' },
			{ label: 'API Reference', href: '/docs/signals' },
		],
	},
	{
		title: 'Community',
		links: [
			{
				label: 'GitHub',
				href: 'https://github.com/chrismichaelps/effuse',
				external: true,
			},
		],
	},
	{
		title: 'More',
		links: [
			{ label: 'Examples', href: '/props' },
			{ label: 'Changelog', href: '#' },
		],
	},
	{
		title: 'Legal',
		links: [
			{ label: 'Terms & Conditions', href: '/terms' },
			{ label: 'Privacy Policy', href: '/privacy' },
			{ label: 'Disclaimer', href: '/disclaimer' },
			{ label: 'Contact', href: '/contact' },
		],
	},
];

import './styles.css';

export const Footer = define({
	script: () => {
		const year = new Date().getFullYear();
		return { year, columns: footerColumns };
	},
	template: ({ year, columns }) => (
		<footer
			class="footer-section"
			style="background-color: #000000; color: #ffffff;"
		>
			<div class="separator-line"></div>
			<div class="max-w-6xl mx-auto px-6 py-12">
				<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">
					<div class="space-y-4">
						<Link to="/" class="flex items-center gap-3">
							<img
								src="/logo/logo-white.svg"
								alt="Effuse Logo"
								class="h-8 w-8"
							/>
							<span class="text-xl font-semibold text-white">Effuse</span>
						</Link>
						<p
							class="footer-brand-text text-sm leading-relaxed"
							style="color: #a1a1aa !important;"
						>
							A modern, signal-based UI framework.
						</p>

						<div class="flex items-center gap-4 pt-2">
							<a
								href="https://github.com/chrismichaelps/effuse"
								target="_blank"
								rel="noopener noreferrer"
								class="social-icon"
								aria-label="GitHub"
							>
								<img
									src="/icons/github.svg"
									class="w-5 h-5 opacity-70 hover:opacity-100 transition-opacity"
									alt="GitHub"
								/>
							</a>
						</div>
					</div>

					{columns.map((column: FooterColumn) => (
						<div>
							<h4 class="footer-heading mb-4">{column.title}</h4>
							<ul class="space-y-3">
								{column.links.map((link: FooterLink) => (
									<li>
										{link.external ? (
											<a
												href={link.href}
												target="_blank"
												rel="noopener noreferrer"
												class="footer-link flex items-center gap-2"
											>
												<img
													src="/logo/github.svg"
													alt="GitHub"
													class="w-4 h-4 opacity-70 group-hover:opacity-100 transition-opacity"
												/>
												{link.label}
											</a>
										) : (
											<Link to={link.href} class="footer-link">
												{link.label}
											</Link>
										)}
									</li>
								))}
							</ul>
						</div>
					))}
				</div>

				<div class="mt-12 pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
					<p class="text-sm footer-bottom-text font-medium text-zinc-500">
						MIT Licensed · © {year} Effuse
					</p>
					<p class="text-xs footer-bottom-text font-medium text-zinc-500">
						Built with Effuse
					</p>
				</div>
			</div>
		</footer>
	),
});
