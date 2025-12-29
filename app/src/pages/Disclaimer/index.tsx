import { define, useHead, computed, effect } from '@effuse/core';
import type { i18nStore as I18nStoreType } from '../../store/appI18n.js';
import '../Legal/styles.css';

export const DisclaimerPage = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(() => i18nStore.translations.value?.legal?.disclaimer);

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
					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.experimental.title}
						</h2>
						<p class="legal-text">{t.value?.sections.experimental.content}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{t.value?.sections.competitor.title}
						</h2>
						<p class="legal-text">
							<span innerHTML={t.value?.sections.competitor.content1} />
						</p>
						<p class="legal-text">{t.value?.sections.competitor.content2}</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">{t.value?.sections.risk.title}</h2>
						<p class="legal-text">{t.value?.sections.risk.content}</p>
					</section>
				</div>
			</div>
		</main>
	),
});
