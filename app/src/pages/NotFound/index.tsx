import { define, useHead, effect } from '@effuse/core';
import { Link } from '@effuse/router';
import { useTranslation } from '../../hooks';
import './styles.css';

export const NotFoundPage = define({
	script: () => {
		const { t } = useTranslation();

		effect(() => {
			useHead({
				title: t('notFound.meta.title', ''),
				description: t(
					'notFound.meta.description',
					'The page you are looking for does not exist'
				),
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
				<div class="error-code">{t('notFound.code', '')}</div>
				<h1 class="error-title">{t('notFound.title', '')}</h1>
				<p class="error-message">
					{t(
						'notFound.description',
						'The page you are looking for does not exist.'
					)}
					<br />
					{t('notFound.track', '')}
				</p>
				<Link to="/" class="cta-primary">
					{t('notFound.goHome', '')}
					<img src="/icons/home.svg" alt="Home" class="w-5 h-5 text-zinc-950" />
				</Link>
			</div>
		</div>
	),
});
