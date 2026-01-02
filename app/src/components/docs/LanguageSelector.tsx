import {
	define,
	computed,
	type Signal,
	type ReadonlySignal,
	For,
} from '@effuse/core';
import {
	useToggle,
	useClickOutside,
	useTranslation,
} from '../../hooks/index.js';
import type { Locale } from '../../store/appI18n';

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
	script: ({
		useCallback,
		props,
		useLayerProps,
		useLayerProvider,
		onMount,
	}) => {
		const i18nProps = useLayerProps('i18n')!;
		const i18nProvider = useLayerProvider('i18n')!;
		const { t } = useTranslation();

		const toggle = useToggle({ initial: false });
		const clickOutside = useClickOutside({
			selector: '.lang-selector',
		});

		const currentLocale = i18nProps.locale as Signal<Locale>;

		const availableLanguages = computed<LanguageOption[]>(() => [
			{ locale: 'en', label: t('language.english', ''), flag: '' },
			{ locale: 'ja', label: t('language.japanese', ''), flag: '' },
			{ locale: 'zh', label: t('language.mandarin', ''), flag: '' },
			{ locale: 'es', label: t('language.spanish', ''), flag: '' },
		]);

		const handleToggle = useCallback((e: MouseEvent) => {
			e.stopPropagation();
			toggle.toggle();
		});

		const handleSelect = useCallback((e: MouseEvent, loc: Locale) => {
			e.stopPropagation();
			(i18nProvider.i18n as { setLocale: (l: Locale) => void }).setLocale(loc);
			toggle.close();
		});

		const dropdownClass = () =>
			`lang-dropdown ${toggle.isOpen.value ? 'open' : ''} ${props.isMobile ? 'is-mobile' : ''}`;

		onMount(() => {
			clickOutside.onClickOutside(() => toggle.close());
			clickOutside.init();
			return undefined;
		});

		return {
			isOpen: toggle.isOpen,
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
				class="lang-trigger"
				aria-label="Select language"
			>
				<img
					src="/icons/international.svg"
					width="20"
					height="20"
					alt="Language"
					class="lang-icon"
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
