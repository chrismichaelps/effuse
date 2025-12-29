import { define, useHead, computed, effect } from '@effuse/core';
import type { i18nStore as I18nStoreType } from '../../store/appI18n.js';
import '../Legal/styles.css';

export const PrivacyPage = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(() => i18nStore.translations.value?.legal?.privacy);

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
					<p class="legal-subtitle">{t.value?.lastUpdated}</p>
				</header>

				<div class="legal-content">
					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.overview.title}
						</h2>
						<p class="legal-text">{t.value?.sections.overview.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.collection.title}
						</h2>
						<p class="legal-text">{t.value?.sections.collection.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.cookies.title}
						</h2>
						<p class="legal-text">{t.value?.sections.cookies.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.services.title}
						</h2>
						<p class="legal-text">{t.value?.sections.services.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.contact.title}
						</h2>
						<p class="legal-text">
							{t.value?.sections.contact.content}{' '}
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
