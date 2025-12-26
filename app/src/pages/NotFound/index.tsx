import { define, useHead, computed, effect } from '@effuse/core';
import { Link } from '@effuse/router';
import { i18nStore } from '../../store/appI18n';
import './styles.css';

export const NotFoundPage = define({
	script: () => {
		const t = computed(() => i18nStore.translations.value?.notFound);

		effect(() => {
			useHead({
				title: t.value?.meta.title as string,
				description: t.value?.meta.description as string,
			});
		});

		return { t };
	},
	template: ({ t }) => (
		<div class="not-found-page">
			<div class="vibrant-bg">
				<div class="aurora-blob blob-1"></div>
				<div class="aurora-blob blob-2"></div>
				<div class="aurora-blob blob-3"></div>
			</div>

			<div class="not-found-content">
				<div class="error-code">{computed(() => t.value?.code as string)}</div>
				<h1 class="error-title">{computed(() => t.value?.title as string)}</h1>
				<p class="error-message">
					{computed(() => t.value?.description as string)}
					<br />
					{computed(() => t.value?.track as string)}
				</p>
				<Link to="/" class="cta-primary">
					{computed(() => t.value?.goHome as string)}
					<img src="/icons/home.svg" alt="Home" class="w-5 h-5 text-zinc-950" />
				</Link>
			</div>
		</div>
	),
});
