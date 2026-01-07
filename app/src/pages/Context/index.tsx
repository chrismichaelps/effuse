import {
	define,
	signal,
	computed,
	useHead,
	effect,
	type ReadonlySignal,
} from '@effuse/core';
import { Ink } from '@effuse/ink';
import { DocsLayout } from '../../components/docs/DocsLayout';
import { triggerHaptic } from '../../components/Haptics';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import '../../styles/examples.css';

type ThemeMode = 'light' | 'dark' | 'ocean' | 'forest';

interface ThemeConfig {
	mode: ThemeMode;
	primary: string;
	background: string;
	text: string;
}

const themes: Record<ThemeMode, ThemeConfig> = {
	light: {
		mode: 'light',
		primary: '#6366f1',
		background: '#ffffff',
		text: '#1a1a2e',
	},
	dark: {
		mode: 'dark',
		primary: '#818cf8',
		background: '#0f0f0f',
		text: '#f8fafc',
	},
	ocean: {
		mode: 'ocean',
		primary: '#06b6d4',
		background: '#0c4a6e',
		text: '#e0f2fe',
	},
	forest: {
		mode: 'forest',
		primary: '#22c55e',
		background: '#14532d',
		text: '#dcfce7',
	},
};

interface ThemeCardProps {
	label: string | undefined;
	theme: ReadonlySignal<ThemeConfig>;
}

interface ThemeCardExposed {
	label: string | undefined;
	theme: ReadonlySignal<ThemeConfig>;
}

const ThemeCard = define<ThemeCardProps, ThemeCardExposed>({
	script: ({ props }) => {
		return { label: props.label, theme: props.theme };
	},
	template: ({ label, theme }) => (
		<div
			class="context-theme-card"
			style={() => ({
				background: theme.value.background,
				color: theme.value.text,
				borderColor: theme.value.primary,
				padding: '1.5rem',
				borderRadius: '0.75rem',
				border: '2px solid',
				display: 'flex',
				flexDirection: 'column',
				gap: '0.75rem',
			})}
		>
			<div style={{ fontWeight: '600' }}>{label}</div>
			<div
				style={() => ({
					background: theme.value.primary,
					height: '2rem',
					borderRadius: '0.375rem',
				})}
			/>
			<div style={{ fontSize: '0.875rem', opacity: '0.8' }}>
				{theme.value.mode}
			</div>
		</div>
	),
});

export const ContextPage = define({
	script: ({ onMount, useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;

		const t = computed(() => i18nStore.translations.value?.examples?.context);

		const currentTheme = signal<ThemeMode>('dark');
		const nestedTheme = signal<ThemeMode>('ocean');

		const themeConfig = computed(() => themes[currentTheme.value]);
		const nestedThemeConfig = computed(() => themes[nestedTheme.value]);

		effect(() => {
			useHead({
				title: `${t.value?.title} - Effuse Playground`,
				description: t.value?.description,
			});
		});

		onMount(() => undefined);

		const cycleTheme = () => {
			const modes: ThemeMode[] = ['light', 'dark', 'ocean', 'forest'];
			const idx = modes.indexOf(currentTheme.value);
			currentTheme.value = modes[(idx + 1) % modes.length];
		};

		const cycleNestedTheme = () => {
			const modes: ThemeMode[] = ['light', 'dark', 'ocean', 'forest'];
			const idx = modes.indexOf(nestedTheme.value);
			nestedTheme.value = modes[(idx + 1) % modes.length];
		};

		return {
			t,
			currentTheme,
			nestedTheme,
			themeConfig,
			nestedThemeConfig,
			cycleTheme,
			cycleNestedTheme,
		};
	},
	template: ({
		t,
		currentTheme,
		nestedTheme,
		themeConfig,
		nestedThemeConfig,
		cycleTheme,
		cycleNestedTheme,
	}) => (
		<DocsLayout currentPath="/context">
			<div class="example-container animate-water-drop">
				<header class="example-header">
					<h1 class="example-title">{t.value?.title}</h1>
					<p class="example-description">{t.value?.description}</p>
				</header>

				<div class="example-card">
					<h2 class="example-card-title">{t.value?.themeSwitcher}</h2>
					<p class="stat-label" style={{ marginBottom: '1rem' }}>
						{t.value?.themeSwitcherDesc}
					</p>
					<div class="flex flex-wrap gap-4" style={{ marginBottom: '1.5rem' }}>
						<button
							onClick={() => {
								triggerHaptic('light');
								cycleTheme();
							}}
							class="btn-premium"
						>
							{t.value?.changeTheme}: {currentTheme.value}
						</button>
						<button
							onClick={() => {
								triggerHaptic('light');
								cycleNestedTheme();
								document
									.getElementById('nested-provider-section')
									?.scrollIntoView({ behavior: 'smooth', block: 'center' });
							}}
							class="btn-secondary"
						>
							{t.value?.nestedOverride}: {nestedTheme.value}
						</button>
					</div>

					<div class="stat-grid">
						<ThemeCard label={t.value?.card1} theme={themeConfig} />
						<ThemeCard label={t.value?.card2} theme={themeConfig} />
						<ThemeCard label={t.value?.card3} theme={themeConfig} />
						<ThemeCard label={t.value?.card4} theme={themeConfig} />
					</div>
				</div>

				<div class="example-card" id="nested-provider-section">
					<h2 class="example-card-title">{t.value?.nestedProviderTitle}</h2>
					<p class="stat-label" style={{ marginBottom: '1rem' }}>
						{t.value?.nestedProviderDesc}
					</p>
					<div
						class="context-nested-demo"
						style={() => ({
							padding: '1rem',
							background: themeConfig.value.background,
							borderRadius: '0.75rem',
							border: `2px solid ${themeConfig.value.primary}`,
						})}
					>
						<div
							style={() => ({
								color: themeConfig.value.text,
								marginBottom: '1rem',
							})}
						>
							{t.value?.root}: {currentTheme.value}
						</div>
						<div
							style={() => ({
								padding: '1rem',
								background: nestedThemeConfig.value.background,
								borderRadius: '0.5rem',
								border: `2px solid ${nestedThemeConfig.value.primary}`,
							})}
						>
							<div
								style={() => ({
									color: nestedThemeConfig.value.text,
									marginBottom: '0.5rem',
								})}
							>
								{t.value?.nested}: {nestedTheme.value}
							</div>
							<div
								style={() => ({
									background: nestedThemeConfig.value.primary,
									width: '100%',
									height: '2rem',
									borderRadius: '0.25rem',
								})}
							/>
						</div>
					</div>
				</div>

				<div class="example-card" style={{ padding: '1.5rem' }}>
					<p class="stat-label" style={{ marginBottom: '1rem' }}>
						{t.value?.howItWorks}
					</p>
					<Ink content={computed(() => t.value?.codeSnippet ?? '')} />
				</div>
			</div>
		</DocsLayout>
	),
});
