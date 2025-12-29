import { define, useHead, computed, effect } from '@effuse/core';
import { Link } from '@effuse/router';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import './styles.css';

export const NotFoundPage = define({
	script: ({ useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
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
				<div class="error-code">{t.value?.code}</div>
				<h1 class="error-title">{t.value?.title}</h1>
				<p class="error-message">
					{t.value?.description}
					<br />
					{t.value?.track}
				</p>
				<Link to="/" class="cta-primary">
					{t.value?.goHome}
					<img src="/icons/home.svg" alt="Home" class="w-5 h-5 text-zinc-950" />
				</Link>
			</div>
		</div>
	),
});
