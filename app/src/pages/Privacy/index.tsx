import { define, useHead, computed, effect } from '@effuse/core';
import { i18nStore } from '../../store/appI18n.js';
import '../Legal/styles.css';

export const PrivacyPage = define({
	script: () => {
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
					<h1 class="legal-title">
						{computed(() => t.value?.title as string)}
					</h1>
					<p class="legal-subtitle">
						{computed(() => t.value?.lastUpdated as string)}
					</p>
				</header>

				<div class="legal-content">
					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.overview.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.overview.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.collection.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.collection.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.cookies.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.cookies.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.services.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.services.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.contact.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.contact.content as string)}{' '}
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
