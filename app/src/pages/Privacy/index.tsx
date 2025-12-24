import { define, useHead } from '@effuse/core';
import '../Legal/styles.css';

export const PrivacyPage = define({
	script: () => {
		useHead({
			title: 'Privacy Policy - Effuse',
			description:
				'Privacy Policy for the Effuse framework - documentation website.',
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
					<h1 class="legal-title">Privacy Policy</h1>
					<p class="legal-subtitle">Last updated: December 2025</p>
				</header>

				<div class="legal-content">
					<section class="legal-section">
						<h2 class="legal-section-title">1. Overview</h2>
						<p class="legal-text">
							This is a documentation website for the Effuse framework. Its sole
							purpose is to provide information and examples to developers.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">2. Data Collection</h2>
						<p class="legal-text">
							I do not collect any personal information from visitors. You can
							browse the documentation freely without providing any data.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">3. Cookies</h2>
						<p class="legal-text">
							This website does not use cookies or any local storage tracking
							mechanisms.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">4. Third-Party Services</h2>
						<p class="legal-text">
							The documentation and examples are hosted statically. No
							third-party analytics or tracking services are used.
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">5. Contact</h2>
						<p class="legal-text">
							If you have any questions, you can reach me at{' '}
							<a href="mailto:chrisperezsantiago1@gmail.com" class="legal-link">
								chrisperezsantiago1@gmail.com
							</a>
							.
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});
