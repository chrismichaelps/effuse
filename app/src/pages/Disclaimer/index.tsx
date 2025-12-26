import { define, useHead, computed, effect } from '@effuse/core';
import { i18nStore } from '../../store/appI18n.js';
import '../Legal/styles.css';

export const DisclaimerPage = define({
	script: () => {
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
					<h1 class="legal-title">
						{computed(() => t.value?.title as string)}
					</h1>
				</header>

				<div class="legal-content">
					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.experimental.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.experimental.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.competitor.title as string)}
						</h2>
						<p class="legal-text">
							<span
								innerHTML={computed(
									() => t.value?.sections.competitor.content1 as string
								)}
							/>
						</p>
						<p class="legal-text">
							{computed(() => t.value?.sections.competitor.content2 as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.risk.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.risk.content as string)}
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});
