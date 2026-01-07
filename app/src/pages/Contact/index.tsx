import { define, useHead, effect } from '@effuse/core';
import { useTranslation } from '../../hooks';
import '../Legal/styles.css';

export const ContactPage = define({
	script: () => {
		const { t } = useTranslation();

		effect(() => {
			useHead({
				title: t('legal.contact.meta.title', ''),
				description: t(
					'legal.contact.meta.description',
					'Get in touch with us'
				),
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
					<h1 class="legal-title">{t('legal.contact.title', '')}</h1>
				</header>

				<div class="legal-content">
					<section class="legal-section" style={{ textAlign: 'center' }}>
						<p class="legal-text">
							{t(
								'legal.contact.content',
								'For any questions, please contact us at:'
							)}
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
