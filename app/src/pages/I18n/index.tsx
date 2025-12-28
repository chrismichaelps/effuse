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
import { i18nStore } from '../../store/appI18n';

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
	script: ({ useCallback }) => {
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
			return template.replace('{{name}}', userName.value);
		});

		const summaryText = computed(() => {
			const template = t.value?.summary as string;
			return template
				.replace('{{name}}', userName.value)
				.replace('{{project}}', 'Effuse')
				.replace('{{version}}', '0.1.0');
		});

		const itemsCountText = computed(() => {
			const template =
				itemCount.value === 1
					? (t.value?.itemsOne as string)
					: (t.value?.itemsOther as string);
			return template.replace('{{count}}', String(itemCount.value));
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
			<div class="min-h-screen py-12 px-4">
				<div class="max-w-2xl mx-auto">
					<header class="text-center mb-10">
						<h1 class="text-4xl font-bold text-slate-800 mb-3">
							{t.value?.title}
						</h1>
						<p class="text-slate-600 text-lg">{t.value?.description}</p>
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
							<h2 class="text-xl font-semibold text-white">
								{t.value?.welcome}
							</h2>
						</div>

						<div class="p-6 space-y-6">
							<div class="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200">
								<div>
									<span class="text-slate-500 text-sm">
										{t.value?.currentLocale}:
									</span>
									<span class="ml-2 text-lg font-bold text-slate-800 uppercase">
										{currentLocale.value}
									</span>
								</div>
								<button
									type="button"
									onClick={() => toggleLocale()}
									class="bg-green-600 text-white px-5 py-2.5 rounded-lg font-semibold hover:bg-green-700 transition-colors shadow-sm"
								>
									{t.value?.changeLocale}
								</button>
							</div>

							<div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
								<p class="text-lg text-slate-700 font-medium">
									{greetingText.value}
								</p>
								<p class="text-sm text-slate-500 mt-2">{summaryText.value}</p>
							</div>

							<div class="p-4 bg-white rounded-xl border border-slate-200">
								<h3 class="text-lg font-semibold text-slate-700 mb-4">
									{t.value?.featuresTitle}
								</h3>
								<ul class="space-y-2">
									<li class="flex items-start gap-2">
										<span class="text-green-600 mt-1">✓</span>
										<span class="text-slate-600">
											{t.value?.featuresTypeSafe ?? ''}
										</span>
									</li>
									<li class="flex items-start gap-2">
										<span class="text-green-600 mt-1">✓</span>
										<span class="text-slate-600">
											{t.value?.featuresInterpolation ?? ''}
										</span>
									</li>
									<li class="flex items-start gap-2">
										<span class="text-green-600 mt-1">✓</span>
										<span class="text-slate-600">
											{t.value?.featuresReactive ?? ''}
										</span>
									</li>
									<li class="flex items-start gap-2">
										<span class="text-green-600 mt-1">✓</span>
										<span class="text-slate-600">
											{t.value?.featuresNested ?? ''}
										</span>
									</li>
								</ul>
							</div>

							<div class="p-4 bg-slate-50 rounded-xl border border-slate-200">
								<div class="flex items-center justify-between">
									<span class="text-slate-700">{itemsCountText.value}</span>
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
									{yourNameLabel.value}
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
							<p class="text-center text-slate-500 text-sm">
								{t.value?.footer}
							</p>
						</div>
					</div>
				</div>
			</div>
		</DocsLayout>
	),
});
