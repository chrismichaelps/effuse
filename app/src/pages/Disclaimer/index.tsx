import { define, useHead, effect } from '@effuse/core';
import { useTranslation } from '../../hooks';
import '../Legal/styles.css';

export const DisclaimerPage = define({
	script: () => {
		const { t } = useTranslation();

		effect(() => {
			useHead({
				title: t('legal.disclaimer.meta.title', ''),
				description: t('legal.disclaimer.meta.description', ''),
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
					<h1 class="legal-title">{t('legal.disclaimer.title', '')}</h1>
				</header>

				<div class="legal-content">
					<section class="legal-section">
						<h2 class="legal-section-title">
							{t(
								'legal.disclaimer.sections.experimental.title',
								'Experimental Software'
							)}
						</h2>
						<p class="legal-text">
							{t('legal.disclaimer.sections.experimental.content', '')}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t(
								'legal.disclaimer.sections.competitor.title',
								'Not a Competitor'
							)}
						</h2>
						<p class="legal-text">
							<span
								innerHTML={t(
									'legal.disclaimer.sections.competitor.content1',
									''
								)}
							/>
						</p>
						<p class="legal-text">
							{t('legal.disclaimer.sections.competitor.content2', '')}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t(
								'legal.disclaimer.sections.risk.title',
								'Use at Your Own Risk'
							)}
						</h2>
						<p class="legal-text">
							{t('legal.disclaimer.sections.risk.content', '')}
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});
