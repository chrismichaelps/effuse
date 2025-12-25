import {
	define,
	useHead,
	signal,
	computed,
	type ReadonlySignal,
	type Signal,
} from '@effuse/core';
import { createI18n, useTranslation } from '@effuse/i18n';
import { DocsLayout } from '../../components/docs/DocsLayout';

const enTranslations = {
	app: {
		title: 'Internationalization Demo',
		description:
			'This page demonstrates the @effuse/i18n package with reactive locale switching.',
	},
	greeting: 'Hello, {{name}}!',
	welcome: 'Welcome to the i18n demo',
	currentLocale: 'Current locale',
	changeLocale: 'Change language',
	features: {
		title: 'Features',
		typeSafe: 'Type-safe translation keys with autocomplete',
		interpolation: 'Variable interpolation with {{brackets}}',
		reactive: 'Reactive locale switching with signals',
		nested: 'Nested translation keys support',
	},
	items: {
		count_one: '{{count}} item',
		count_other: '{{count}} items',
	},
	summary:
		'Hi {{name}}, you are building {{project}} v{{version}} — an amazing journey into modern i18n!',
	footer: 'Built with Effuse and @effuse/i18n',
};

const esTranslations = {
	app: {
		title: 'Demo de Internacionalización',
		description:
			'Esta página demuestra el paquete @effuse/i18n con cambio de idioma reactivo.',
	},
	greeting: '¡Hola, {{name}}!',
	welcome: 'Bienvenido a la demo de i18n',
	currentLocale: 'Idioma actual',
	changeLocale: 'Cambiar idioma',
	features: {
		title: 'Características',
		typeSafe: 'Claves de traducción con autocompletado',
		interpolation: 'Interpolación de variables con {{llaves}}',
		reactive: 'Cambio de idioma reactivo con signals',
		nested: 'Soporte para claves anidadas',
	},
	items: {
		count_one: '{{count}} elemento',
		count_other: '{{count}} elementos',
	},
	summary:
		'Hola {{name}}, estás construyendo {{project}} v{{version}} — ¡un viaje increíble hacia la i18n moderna!',
	footer: 'Construido con Effuse y @effuse/i18n',
};

createI18n({
	defaultLocale: 'en',
	fallbackLocale: 'en',
	translations: {
		en: enTranslations,
		es: esTranslations,
	},
	detectLocale: false,
	persistLocale: true,
});

interface I18nPageExposed {
	currentLocale: ReadonlySignal<string>;
	toggleLocale: () => void;
	itemCount: Signal<number>;
	userName: Signal<string>;
	greetingText: ReadonlySignal<string>;
	appTitle: ReadonlySignal<string>;
	appDescription: ReadonlySignal<string>;
	welcomeText: ReadonlySignal<string>;
	currentLocaleLabel: ReadonlySignal<string>;
	changeLocaleLabel: ReadonlySignal<string>;
	featuresTitle: ReadonlySignal<string>;
	featuresTypeSafe: ReadonlySignal<string>;
	featuresInterpolation: ReadonlySignal<string>;
	featuresReactive: ReadonlySignal<string>;
	featuresNested: ReadonlySignal<string>;
	itemsCountText: ReadonlySignal<string>;
	summaryText: ReadonlySignal<string>;
	footerText: ReadonlySignal<string>;
}

export const I18nPage = define<object, I18nPageExposed>({
	script: ({ useCallback }) => {
		useHead({
			title: 'I18n Demo - Effuse Playground',
			description: 'Internationalization demo with @effuse/i18n package.',
		});

		const { t, locale, setLocale } = useTranslation();
		const itemCount = signal(3);
		const userName = signal('Developer');

		const currentLocale = computed(() => locale.value);

		const toggleLocale = useCallback(() => {
			const newLocale = locale.value === 'en' ? 'es' : 'en';
			void setLocale(newLocale);
		});

		const greetingText = computed(() =>
			t('greeting', { name: userName.value })
		);
		const appTitle = computed(() => t('app.title'));
		const appDescription = computed(() => t('app.description'));
		const welcomeText = computed(() => t('welcome'));
		const currentLocaleLabel = computed(() => t('currentLocale'));
		const changeLocaleLabel = computed(() => t('changeLocale'));
		const featuresTitle = computed(() => t('features.title'));
		const featuresTypeSafe = computed(() => t('features.typeSafe'));
		const featuresInterpolation = computed(() => t('features.interpolation'));
		const featuresReactive = computed(() => t('features.reactive'));
		const featuresNested = computed(() => t('features.nested'));
		const itemsCountText = computed(() =>
			t('items.count', { count: itemCount.value })
		);
		const summaryText = computed(() =>
			t('summary', {
				name: userName.value,
				project: 'Effuse',
				version: '0.1.0',
			})
		);
		const footerText = computed(() => t('footer'));

		return {
			currentLocale,
			toggleLocale,
			itemCount,
			userName,
			greetingText,
			appTitle,
			appDescription,
			welcomeText,
			currentLocaleLabel,
			changeLocaleLabel,
			featuresTitle,
			featuresTypeSafe,
			featuresInterpolation,
			featuresReactive,
			featuresNested,
			itemsCountText,
			summaryText,
			footerText,
		};
	},
	template: ({
		currentLocale,
		toggleLocale,
		itemCount,
		userName,
		greetingText,
		appTitle,
		appDescription,
		welcomeText,
		currentLocaleLabel,
		changeLocaleLabel,
		featuresTitle,
		featuresTypeSafe,
		featuresInterpolation,
		featuresReactive,
		featuresNested,
		itemsCountText,
		summaryText,
		footerText,
	}) => (
		<DocsLayout currentPath="/i18n">
			<div class="min-h-screen py-12 px-4">
				<div class="max-w-2xl mx-auto">
					<header class="text-center mb-10">
						<h1 class="text-4xl font-bold text-slate-800 mb-3">{appTitle}</h1>
						<p class="text-slate-600 text-lg">{appDescription}</p>
					</header>

					<div class="flex flex-wrap justify-center gap-3 mb-10">
						<span class="bg-green-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							@effuse/i18n
						</span>
						<span class="bg-blue-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							Type-Safe Keys
						</span>
						<span class="bg-purple-600 text-white px-4 py-1.5 rounded text-sm font-medium shadow-sm">
							Reactive Signals
						</span>
					</div>

					<div class="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden mb-8">
						<div class="bg-gradient-to-r from-slate-800 to-slate-700 px-6 py-4">
							<h2 class="text-xl font-semibold text-white">{welcomeText}</h2>
						</div>

						<div class="p-6 space-y-6">
							<div class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
								<div>
									<span class="text-slate-500 text-sm">
										{currentLocaleLabel}:
									</span>
									<span class="ml-2 text-lg font-bold text-slate-800 uppercase">
										{currentLocale}
									</span>
								</div>
								<button
									type="button"
									onClick={() => toggleLocale()}
									class="bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-sm"
								>
									{changeLocaleLabel}
								</button>
							</div>

							<div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
								<p class="text-lg text-slate-700 font-medium">{greetingText}</p>
								<p class="text-sm text-slate-500 mt-2">{summaryText}</p>
							</div>

							<div class="p-4 bg-white rounded-xl border border-slate-200">
								<h3 class="text-lg font-semibold text-slate-700 mb-4">
									{featuresTitle}
								</h3>
								<ul class="space-y-2">
									<li class="flex items-start gap-2">
										<span class="text-green-600 mt-1">✓</span>
										<span class="text-slate-600">{featuresTypeSafe}</span>
									</li>
									<li class="flex items-start gap-2">
										<span class="text-green-600 mt-1">✓</span>
										<span class="text-slate-600">{featuresInterpolation}</span>
									</li>
									<li class="flex items-start gap-2">
										<span class="text-green-600 mt-1">✓</span>
										<span class="text-slate-600">{featuresReactive}</span>
									</li>
									<li class="flex items-start gap-2">
										<span class="text-green-600 mt-1">✓</span>
										<span class="text-slate-600">{featuresNested}</span>
									</li>
								</ul>
							</div>

							<div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
								<div class="flex items-center justify-between">
									<span class="text-slate-700">{itemsCountText}</span>
									<div class="flex gap-2">
										<button
											type="button"
											onClick={() => {
												if (itemCount.value > 0) itemCount.value--;
											}}
											class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold hover:bg-slate-300"
										>
											-
										</button>
										<button
											type="button"
											onClick={() => {
												itemCount.value++;
											}}
											class="w-8 h-8 rounded-full bg-slate-200 text-slate-700 font-bold hover:bg-slate-300"
										>
											+
										</button>
									</div>
								</div>
							</div>

							<div class="flex items-center gap-4 p-4 bg-slate-100 rounded-xl">
								<label class="text-slate-600 text-sm font-medium">
									Your name:
								</label>
								<input
									type="text"
									value={userName.value}
									onInput={(e: Event) => {
										userName.value = (e.target as HTMLInputElement).value;
									}}
									class="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 outline-none"
								/>
							</div>
						</div>

						<div class="px-6 pb-6">
							<p class="text-center text-slate-500 text-sm">{footerText}</p>
						</div>
					</div>
				</div>
			</div>
		</DocsLayout>
	),
});
