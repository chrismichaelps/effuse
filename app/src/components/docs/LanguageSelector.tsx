import {
	define,
	signal,
	computed,
	type Signal,
	type ReadonlySignal,
	For,
} from '@effuse/core';
import type { i18nStore as I18nStoreType, Locale } from '../../store/appI18n';

interface LanguageSelectorProps {
	isMobile?: boolean;
}

interface LanguageOption {
	locale: Locale;
	label: string;
	flag: string;
}

interface LanguageSelectorExposed {
	isOpen: Signal<boolean>;
	currentLocale: ReadonlySignal<Locale>;
	handleToggle: (e: MouseEvent) => void;
	handleSelect: (e: MouseEvent, loc: Locale) => void;
	availableLanguages: ReadonlySignal<LanguageOption[]>;
	dropdownClass: () => string;
}

export const LanguageSelector = define<
	LanguageSelectorProps,
	LanguageSelectorExposed
>({
	script: ({ useCallback, props, useStore }) => {
		// Access store via layer bridge
		const i18nStore = useStore('i18n') as typeof I18nStoreType;

		const isOpen = signal(false);
		const currentLocale = i18nStore.locale;

		const availableLanguages = computed<LanguageOption[]>(() => {
			const trans = i18nStore.translations.value;
			if (!trans) return [];

			return [
				{
					locale: 'en',
					label: trans.language.english as string,
					flag: '🇺🇸',
				},
				{
					locale: 'ja',
					label: trans.language.japanese as string,
					flag: '🇯🇵',
				},
				{
					locale: 'zh',
					label: trans.language.mandarin as string,
					flag: '🇨🇳',
				},
				{
					locale: 'es',
					label: trans.language.spanish as string,
					flag: '🇪🇸',
				},
			];
		});

		const handleToggle = useCallback((e: MouseEvent) => {
			e.stopPropagation();
			isOpen.value = !isOpen.value;
		});

		const handleSelect = useCallback((e: MouseEvent, loc: Locale) => {
			e.stopPropagation();
			i18nStore.setLocale(loc);
			isOpen.value = false;
		});

		const dropdownClass = () =>
			`lang-dropdown ${isOpen.value ? 'open' : ''} ${props.isMobile ? 'is-mobile' : ''}`;

		return {
			isOpen,
			currentLocale,
			handleToggle,
			handleSelect,
			availableLanguages,
			dropdownClass,
		};
	},
	template: ({
		currentLocale,
		handleToggle,
		handleSelect,
		availableLanguages,
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
				<For
					each={availableLanguages}
					keyExtractor={(item: LanguageOption) =>
						`${item.locale}-${item.label}`
					}
				>
					{(itemSignal: ReadonlySignal<LanguageOption>) => (
						<button
							type="button"
							onClick={(e: MouseEvent) =>
								handleSelect(e, itemSignal.value.locale)
							}
							class={() =>
								`lang-option ${currentLocale.value === itemSignal.value.locale ? 'active' : ''}`
							}
						>
							<span class="lang-flag">{itemSignal.value.flag}</span>
							<span class="lang-label">{itemSignal.value.label}</span>
						</button>
					)}
				</For>
			</div>
		</div>
	),
});
