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
	englishLabel: ReadonlySignal<string>;
	spanishLabel: ReadonlySignal<string>;
	dropdownClass: () => string;
}

export const LanguageSelector = define<
	LanguageSelectorProps,
	LanguageSelectorExposed
>({
	script: ({ useCallback, props }) => {
		const isOpen = signal(false);
		const currentLocale = i18nStore.locale;

		const englishLabel = computed(() => {
			return i18nStore.translations.value?.language?.english as string;
		});

		const spanishLabel = computed(() => {
			return i18nStore.translations.value?.language?.spanish as string;
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
			englishLabel,
			spanishLabel,
			dropdownClass,
		};
	},
	template: ({
		currentLocale,
		handleToggle,
		handleSelectEn,
		handleSelectEs,
		englishLabel,
		spanishLabel,
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
						`lang-option ${currentLocale.value === 'en' ? 'active' : ''}`
					}
				>
					<span class="lang-flag">🇺🇸</span>
					<span class="lang-label">{englishLabel}</span>
				</button>
				<button
					type="button"
					onClick={handleSelectEs}
					class={() =>
						`lang-option ${currentLocale.value === 'es' ? 'active' : ''}`
					}
				>
					<span class="lang-flag">🇪🇸</span>
					<span class="lang-label">{spanishLabel}</span>
				</button>
			</div>
		</div>
	),
});
