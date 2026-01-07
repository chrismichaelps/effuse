import {
	define,
	useHead,
	signal,
	computed,
	effect,
	type ReadonlySignal,
	type Signal,
} from '@effuse/core';
import { DocsLayout } from '../../components/docs/DocsLayout';
import type { i18nStore as I18nStoreType } from '../../store/appI18n';
import { triggerHaptic } from '../../components/Haptics';
import '../../styles/examples.css';

interface I18nPageExposed {
	t: ReadonlySignal<any>;
	currentLocale: ReadonlySignal<string>;
	toggleLocale: () => void;
	itemCount: Signal<number>;
	userName: Signal<string>;
	greetingText: ReadonlySignal<string>;
	summaryText: ReadonlySignal<string>;
	itemsCountText: ReadonlySignal<string>;
	yourNameLabel: ReadonlySignal<string>;
}

export const I18nPage = define<object, I18nPageExposed>({
	script: ({ useCallback, useStore }) => {
		const i18nStore = useStore('i18n') as typeof I18nStoreType;
		const t = computed(() => i18nStore.translations.value?.examples?.i18n);

		effect(() => {
			useHead({
				title: `${t.value?.title as string} - Effuse Playground`,
				description: t.value?.description as string,
			});
		});

		const currentLocale = i18nStore.locale;
		const itemCount = signal(3);
		const userName = signal('Developer');

		const toggleLocale = useCallback(() => {
			const locales = ['en', 'es', 'ja', 'zh'];
			const currentIdx = locales.indexOf(i18nStore.locale.value);
			const nextLocale = locales[(currentIdx + 1) % locales.length] as any;
			void i18nStore.setLocale(nextLocale);
		});

		const greetingText = computed(() => {
			const template = t.value?.greeting as string;
			return (template || '').replace('{{name}}', userName.value);
		});

		const summaryText = computed(() => {
			const template = t.value?.summary as string;
			return (template || '')
				.replace('{{name}}', userName.value)
				.replace('{{project}}', 'Effuse')
				.replace('{{version}}', '0.1.0');
		});

		const itemsCountText = computed(() => {
			const template =
				itemCount.value === 1
					? (t.value?.itemsOne as string)
					: (t.value?.itemsOther as string);
			return (template || '').replace('{{count}}', String(itemCount.value));
		});

		const yourNameLabel = computed(() => t.value?.yourName as string);

		return {
			t,
			currentLocale,
			toggleLocale,
			itemCount,
			userName,
			greetingText,
			summaryText,
			itemsCountText,
			yourNameLabel,
		};
	},
	template: ({
		t,
		currentLocale,
		toggleLocale,
		itemCount,
		userName,
		greetingText,
		summaryText,
		itemsCountText,
		yourNameLabel,
	}) => (
		<DocsLayout currentPath="/i18n">
			<div class="example-container animate-water-drop">
				<header class="example-header">
					<h1 class="example-title">{t.value?.title}</h1>
					<p class="example-description">{t.value?.description}</p>
				</header>

				<div class="flex flex-wrap justify-center gap-3 mb-10">
					<span class="example-badge">@effuse/i18n</span>
					<span class="example-badge">Type-Safe Keys</span>
					<span class="example-badge">Reactive Signals</span>
				</div>

				<div class="example-card" style="padding: 0; overflow: hidden;">
					<div class="bg-white/5 px-6 py-4">
						<h2 class="text-xl font-semibold text-white">{t.value?.welcome}</h2>
					</div>

					<div class="p-6 space-y-8">
						<div class="flex items-center justify-between p-5 bg-white/5 rounded-2xl">
							<div>
								<span class="text-slate-500 text-xs uppercase font-bold tracking-wider">
									{t.value?.currentLocale}:
								</span>
								<span
									class="ml-3 text-xl font-black text-mint uppercase"
									style="color: var(--accent-mint);"
								>
									{currentLocale.value}
								</span>
							</div>
							<button
								type="button"
								onClick={() => {
									triggerHaptic('light');
									toggleLocale();
								}}
								class="btn-premium"
							>
								{t.value?.changeLocale}
							</button>
						</div>

						<div class="p-5 bg-white/5 rounded-2xl space-y-2">
							<p class="text-xl text-slate-200 font-medium">
								{greetingText.value}
							</p>
							<p class="text-slate-400 leading-relaxed">{summaryText.value}</p>
						</div>

						<div class="p-5 bg-white/5 rounded-2xl">
							<h3 class="text-sm font-bold text-slate-500 uppercase tracking-widest mb-4">
								{t.value?.featuresTitle}
							</h3>
							<ul class="space-y-3">
								{[
									t.value?.featuresTypeSafe,
									t.value?.featuresInterpolation,
									t.value?.featuresReactive,
									t.value?.featuresNested,
								].map(
									(feature) =>
										feature && (
											<li class="flex items-center gap-3 text-slate-300">
												<span
													class="text-mint"
													style="color: var(--accent-mint);"
												>
													✦
												</span>
												<span>{feature}</span>
											</li>
										)
								)}
							</ul>
						</div>

						<div class="p-5 bg-white/5 rounded-2xl flex items-center justify-between">
							<span class="text-slate-200 font-medium">
								{itemsCountText.value}
							</span>
							<div class="flex gap-3">
								<button
									type="button"
									onClick={() => {
										if (itemCount.value > 0) itemCount.value--;
									}}
									class="w-10 h-10 rounded-xl bg-white/5 text-slate-300 font-bold hover:bg-white/10 hover:text-white transition-all"
								>
									-
								</button>
								<button
									type="button"
									onClick={() => {
										itemCount.value++;
									}}
									class="w-10 h-10 rounded-xl bg-white/5 text-slate-300 font-bold hover:bg-white/10 hover:text-white transition-all"
								>
									+
								</button>
							</div>
						</div>

						<div class="flex items-center gap-6 p-5 bg-white/5 rounded-2xl">
							<label class="text-slate-400 text-sm font-semibold flex-shrink-0">
								{yourNameLabel.value}
							</label>
							<input
								type="text"
								value={userName.value}
								onInput={(e: Event) => {
									userName.value = (e.target as HTMLInputElement).value;
								}}
								class="example-input"
							/>
						</div>
					</div>

					<div class="px-6 pb-6 mt-4">
						<p class="text-center text-slate-500 text-sm italic">
							{t.value?.footer}
						</p>
					</div>
				</div>
			</div>
		</DocsLayout>
	),
});
