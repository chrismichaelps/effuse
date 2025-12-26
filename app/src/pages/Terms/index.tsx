import { define, useHead, computed, effect } from '@effuse/core';
import { i18nStore } from '../../store/appI18n.js';
import '../Legal/styles.css';

export const TermsPage = define({
	script: () => {
		const t = computed(() => i18nStore.translations.value?.legal?.terms);

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
							{computed(() => t.value?.sections.acceptance.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.acceptance.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.license.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.license.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.usage.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.usage.content as string)}
						</p>
						<ul class="legal-list">
							{computed(() =>
								t.value?.sections.usage.list.map((item: string) => (
									<li>{item}</li>
								))
							)}
						</ul>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.disclaimer.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.disclaimer.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.liability.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.liability.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.changes.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.changes.content as string)}
						</p>
					</section>

					<section class="legal-section">
						<h2 class="legal-section-title">
							{computed(() => t.value?.sections.contact.title as string)}
						</h2>
						<p class="legal-text">
							{computed(() => t.value?.sections.contact.content as string)}{' '}
							<a href="/contact" class="legal-link">
								{computed(
									() =>
										i18nStore.translations.value?.legal?.contact.title as string
								)}
							</a>
							.
						</p>
					</section>
				</div>
			</div>
		</main>
	),
});
