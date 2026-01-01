import { define, computed, useHead, For, effect } from '@effuse/core';
import type { Translations } from '../../store/appI18n';
import './styles.css';

export const AboutPage = define({
	script: ({ useLayerProps }) => {
		const i18nProps = useLayerProps('i18n')!;
		const trans = computed(
			() => (i18nProps.translations.value as Translations | null)?.about
		);

		effect(() => {
			useHead({
				title: trans.value?.meta.title as string,
				description: trans.value?.meta.description as string,
			});
		});

		const title = computed(() => trans.value?.title ?? '');
		const description = computed(() => trans.value?.description ?? '');
		const sponsor = computed(() => trans.value?.sponsor ?? '');
		const name = computed(() => trans.value?.name ?? '');
		const role = computed(() => trans.value?.role ?? '');
		const location = computed(() => trans.value?.location ?? '');
		const languages = computed(() => trans.value?.languages ?? '');
		const projects = computed(() => trans.value?.projects ?? []);
		const sections = computed(() => trans.value?.sections ?? []);

		return {
			title,
			description,
			sponsor,
			name,
			role,
			location,
			languages,
			projects,
			sections,
		};
	},
	template: ({
		title,
		description,
		sponsor,
		name,
		role,
		location,
		languages,
		projects,
		sections,
	}) => (
		<main class="about-page">
			<div class="about-container">
				<header class="about-hero">
					<h1>{title.value}</h1>
					<p>{description.value}</p>
				</header>

				<For each={sections} keyExtractor={(s: any) => s.title}>
					{(sectionSignal: any) => (
						<section class="about-section">
							<div class="section-sidebar">
								<h2>{sectionSignal.value.title}</h2>
								<p>{sectionSignal.value.description}</p>
							</div>

							<div class="section-content">
								<div class="member-card">
									<a
										href="https://paypal.me/chrismperezsantiago"
										target="_blank"
										class="sponsor-btn"
									>
										<span class="sponsor-icon"></span>
										{sponsor.value}
									</a>

									<div class="member-header">
										<div class="member-avatar">
											<img
												src="https://avatars.githubusercontent.com/u/21962584?s=400&u=21d7c4d9337877bf8a53dbd4c2c868c6f8f67a90&v=4"
												alt={name.value}
											/>
										</div>
										<div class="member-info">
											<h3 class="member-name">{name.value}</h3>
											<p class="member-role">{role.value}</p>
										</div>
									</div>

									<div class="member-body">
										<div class="projects-list">
											<For each={projects} keyExtractor={(p: string) => p}>
												{(projectSignal) => (
													<a
														href={`https://github.com/chrismichaelps/effuse/tree/main/packages/${projectSignal.value}`}
														target="_blank"
														class="project-link"
													>
														<span class="project-icon"></span>
														{projectSignal.value}
													</a>
												)}
											</For>
										</div>

										<div class="member-meta">
											<div class="meta-item">
												<span class="meta-icon location"></span>
												{location.value}
											</div>
											<div class="meta-item">
												<span class="meta-icon languages"></span>
												{languages.value}
											</div>
										</div>

										<div class="social-links">
											<a
												href="https://github.com/chrismmichaelps"
												target="_blank"
												class="social-link"
											>
												<svg fill="currentColor" viewBox="0 0 24 24">
													<path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
												</svg>
											</a>
											<a href="#" target="_blank" class="social-link">
												<svg fill="currentColor" viewBox="0 0 24 24">
													<path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z" />
												</svg>
											</a>
										</div>
									</div>
								</div>
							</div>
						</section>
					)}
				</For>
			</div>
		</main>
	),
});
