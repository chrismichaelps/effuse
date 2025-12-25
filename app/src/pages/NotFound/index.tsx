import { define, useHead } from '@effuse/core';
import { Link } from '@effuse/router';
import './styles.css';

export const NotFoundPage = define({
	script: () => {
		useHead({
			title: '404 - Page Not Found | Effuse',
			description: 'The page you are looking for does not exist.',
		});
		return {};
	},
	template: () => (
		<div class="not-found-page">
			<div class="vibrant-bg">
				<div class="aurora-blob blob-1"></div>
				<div class="aurora-blob blob-2"></div>
				<div class="aurora-blob blob-3"></div>
			</div>

			<div class="not-found-content">
				<div class="error-code">404</div>
				<h1 class="error-title">Page Not Found</h1>
				<p class="error-message">
					The page you are looking for doesn't exist or has been moved.
					<br />
					Let's get you back on track.
				</p>
				<Link to="/" class="cta-primary">
					Go Home
					<img src="/icons/home.svg" alt="Home" class="w-5 h-5 text-zinc-950" />
				</Link>
			</div>
		</div>
	),
});
