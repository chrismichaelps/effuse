import { define, useHead, effect } from '@effuse/core';
import { useTranslation } from '../../hooks';
import '../Legal/styles.css';

export const TermsPage = define({
	script: () => {
		const { t } = useTranslation();

		effect(() => {
			useHead({
				title: t('legal.terms.meta.title', ''),
				description: t('legal.terms.meta.description', ''),
			});
		});

		return { t };
	},
	template: ({ t }) => (
		<main class="legal-page">
			<div class="vibrant-bg">
				<div class="aurora-blob blob-1"></div>
				<div class="aurora-blob blob-2"></div>
				<div class="aurora-blob blob-3"></div>
			</div>
			<div class="legal-container">
				<header class="legal-header">
					<h1 class="legal-title">{t('legal.terms.title', '')}</h1>
					<p class="legal-subtitle">{t('legal.terms.lastUpdated', '')}</p>
				</header>

				<div class="legal-content">
					<section class="legal-section">
						<h2 class="legal-section-title">
							{t(
								'legal.terms.sections.acceptance.title',
								'Acceptance of Terms'
							)}
						</h2>
						<p class="legal-text">
							{t('legal.terms.sections.acceptance.content', '')}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t('legal.terms.sections.license.title', '')}
						</h2>
						<p class="legal-text">
							{t('legal.terms.sections.license.content', '')}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t('legal.terms.sections.usage.title', '')}
						</h2>
						<p class="legal-text">
							{t('legal.terms.sections.usage.content', '')}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t('legal.terms.sections.disclaimer.title', '')}
						</h2>
						<p class="legal-text">
							{t('legal.terms.sections.disclaimer.content', '')}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t(
								'legal.terms.sections.liability.title',
								'Limitation of Liability'
							)}
						</h2>
						<p class="legal-text">
							{t('legal.terms.sections.liability.content', '')}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t('legal.terms.sections.changes.title', '')}
						</h2>
						<p class="legal-text">
							{t('legal.terms.sections.changes.content', '')}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t('legal.terms.sections.contact.title', '')}
						</h2>
						<p class="legal-text">
							{t(
								'legal.terms.sections.contact.content',
								'For questions, please visit our'
							)}{' '}
							<a href="/contact" class="legal-link">
								{t('legal.contact.title', '')}
							</a>
							.
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});
