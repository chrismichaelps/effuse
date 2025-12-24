import { define, useHead } from '@effuse/core';
import '../Legal/styles.css';

export const ContactPage = define({
	script: () => {
		useHead({
			title: 'Contact - Effuse',
			description: 'Get in touch with the creator of Effuse.',
		});
		return {};
	},
	template: () => (
		<main class="legal-page">
			<div class="vibrant-bg">
				<div class="aurora-blob blob-1"></div>
				<div class="aurora-blob blob-2"></div>
				<div class="aurora-blob blob-3"></div>
			</div>
			<div class="legal-container">
				<header class="legal-header">
					<h1 class="legal-title">Contact</h1>
				</header>

				<div class="legal-content">
					<section class="legal-section" style={{ textAlign: 'center' }}>
						<p class="legal-text">
							You can reach out to me directly via email:
						</p>
						<p class="legal-text" style={{ fontSize: '1.25rem' }}>
							<a href="mailto:chrisperezsantiago1@gmail.com" class="legal-link">
								chrisperezsantiago1@gmail.com
							</a>
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});
