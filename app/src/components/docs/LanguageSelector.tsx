import {
	define,
	signal,
	computed,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';
import { i18nStore, type Locale } from '../../store/appI18n';

interface LanguageSelectorProps {
	isMobile?: boolean;
}

interface LanguageSelectorExposed {
	isOpen: Signal<boolean>;
	currentLocale: ReadonlySignal<Locale>;
	handleToggle: (e: MouseEvent) => void;
	handleSelectEn: (e: MouseEvent) => void;
	handleSelectEs: (e: MouseEvent) => void;
	languageLabels: ReadonlySignal<{ english: string; spanish: string }>;
	dropdownClass: () => string;
}

export const LanguageSelector = define<
	LanguageSelectorProps,
	LanguageSelectorExposed
>({
	script: ({ useCallback, props }) => {
		const isOpen = signal(false);
		const currentLocale = i18nStore.locale;

		const languageLabels = computed(() => {
			const trans = i18nStore.translations.value;
			return {
				english: trans?.language?.english as string,
				spanish: trans?.language?.spanish as string,
			};
		});

		const handleToggle = useCallback((e: MouseEvent) => {
			e.stopPropagation();
			isOpen.value = !isOpen.value;
		});

		const handleSelectEn = useCallback((e: MouseEvent) => {
			e.stopPropagation();
			i18nStore.setLocale('en');
			isOpen.value = false;
		});

		const handleSelectEs = useCallback((e: MouseEvent) => {
			e.stopPropagation();
			i18nStore.setLocale('es');
			isOpen.value = false;
		});

		const dropdownClass = () =>
			`lang-dropdown ${isOpen.value ? 'open' : ''} ${props.isMobile ? 'is-mobile' : ''}`;

		return {
			isOpen,
			currentLocale,
			handleToggle,
			handleSelectEn,
			handleSelectEs,
			languageLabels,
			dropdownClass,
		};
	},
	template: ({
		currentLocale,
		handleToggle,
		handleSelectEn,
		handleSelectEs,
		languageLabels,
		dropdownClass,
	}) => (
		<div class="lang-selector relative">
			<button
				type="button"
				onClick={handleToggle}
				class="flex items-center justify-center w-9 h-9 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
				aria-label="Select language"
			>
				<img
					src="/icons/international.svg"
					width="20"
					height="20"
					alt="Language"
					class="opacity-70"
				/>
			</button>
			<div class={dropdownClass}>
				<button
					type="button"
					onClick={handleSelectEn}
					class={() =>
						`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 ${currentLocale.value === 'en' ? 'text-orange-600 font-medium' : 'text-slate-700 dark:text-slate-300'}`
					}
				>
					<span class="text-base">🇺🇸</span>
					{languageLabels.value.english}
				</button>
				<button
					type="button"
					onClick={handleSelectEs}
					class={() =>
						`w-full px-4 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors flex items-center gap-2 ${currentLocale.value === 'es' ? 'text-orange-600 font-medium' : 'text-slate-700 dark:text-slate-300'}`
					}
				>
					<span class="text-base">🇪🇸</span>
					{languageLabels.value.spanish}
				</button>
			</div>
		</div>
	),
});
