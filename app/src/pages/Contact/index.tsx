import { define, useHead, computed, effect } from '@effuse/core';
import { i18nStore } from '../../store/appI18n.js';
import '../Legal/styles.css';

export const ContactPage = define({
	script: () => {
		const t = computed(() => i18nStore.translations.value?.legal?.contact);

		effect(() => {
			useHead({
				title: t.value?.meta.title as string,
				description: t.value?.meta.description as string,
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
					<h1 class="legal-title">{t.value?.title}</h1>
				</header>

				<div class="legal-content">
					<section class="legal-section" style={{ textAlign: 'center' }}>
						<p class="legal-text">{t.value?.content}</p>
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
