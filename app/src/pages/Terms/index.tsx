import { define, useHead, computed, effect } from '@effuse/core';
import type { i18nStore as I18nStoreType } from '../../store/appI18n.js';
import '../Legal/styles.css';

export const TermsPage = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(() => i18nStore.translations.value?.legal?.terms);
		const contactTitle = computed(
			() => i18nStore.translations.value?.legal?.contact.title
		);

		effect(() => {
			useHead({
				title: t.value?.meta.title as string,
				description: t.value?.meta.description as string,
			});
		});

		return { t, contactTitle };
	},
	template: ({ t, contactTitle }) => (
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
							{t.value?.sections.acceptance.title}
						</h2>
						<p class="legal-text">{t.value?.sections.acceptance.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.license.title}
						</h2>
						<p class="legal-text">{t.value?.sections.license.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">{t.value?.sections.usage.title}</h2>
						<p class="legal-text">{t.value?.sections.usage.content}</p>
						<ul class="legal-list">
							{t.value?.sections.usage.list.map((item: string) => (
								<li>{item}</li>
							))}
						</ul>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.disclaimer.title}
						</h2>
						<p class="legal-text">{t.value?.sections.disclaimer.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.liability.title}
						</h2>
						<p class="legal-text">{t.value?.sections.liability.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.changes.title}
						</h2>
						<p class="legal-text">{t.value?.sections.changes.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.contact.title}
						</h2>
						<p class="legal-text">
							{t.value?.sections.contact.content}{' '}
							<a href="/contact" class="legal-link">
								{contactTitle.value}
							</a>
							.
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});
