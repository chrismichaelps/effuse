import { createStore, connectDevTools } from '@effuse/store';

export type Locale = 'en' | 'es';

interface Translations {
  nav: {
    home: string;
    docs: string;
    about: string;
    examples: string;
    github: string;
  };
  sidebar: {
    gettingStarted: string;
    introduction: string;
    quickStart: string;
    installation: string;
    coreConceptsTitle: string;
    components: string;
    reactivity: string;
    lifecycle: string;
    advancedTitle: string;
    routing: string;
    stateManagement: string;
    seoHead: string;
    internationalization: string;
    examplesTitle: string;
    form: string;
    todos: string;
    props: string;
    i18n: string;
  };
  toc: {
    onThisPage: string;
  };
  footer: {
    builtWith: string;
  };
  about: {
    title: string;
    description: string;
    sections: {
      title: string;
      description: string;
    }[];
    sponsor: string;
    name: string;
    role: string;
    location: string;
    languages: string;
    projects: string[];
    focusTitle: string;
  };
  language: {
    selectLanguage: string;
    english: string;
    spanish: string;
  };
}

const STORAGE_KEY = 'effuse-locale';

const getInitialLocale = (): Locale => {
  if (typeof window === 'undefined') return 'en';
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'en' || stored === 'es') return stored;
  const browserLang = navigator.language.slice(0, 2);
  return browserLang === 'es' ? 'es' : 'en';
};

interface I18nState {
  locale: Locale;
  translations: Translations | null;
  isLoading: boolean;
}

export const i18nStore = createStore<
  I18nState & {
    setLocale: (loc: Locale) => void;
    init: () => void;
  }
>(
  'i18n',
  {
    locale: getInitialLocale(),
    translations: null,
    isLoading: true,

    setLocale(loc: Locale) {
      this.locale.value = loc;
      localStorage.setItem(STORAGE_KEY, loc);
      this.isLoading.value = true;

      fetch(`/locales/${loc}.json`)
        .then((response) => response.json())
        .then((data: Translations) => {
          this.translations.value = data;
        })
        .catch(() => {
          console.error(`Failed to load translations for ${loc}`);
        })
        .finally(() => {
          this.isLoading.value = false;
        });
    },

    init() {
      this.isLoading.value = true;
      const currentLocale = this.locale.value;

      fetch(`/locales/${currentLocale}.json`)
        .then((response) => response.json())
        .then((data: Translations) => {
          this.translations.value = data;
        })
        .catch(() => {
          console.error(`Failed to load translations for ${currentLocale}`);
        })
        .finally(() => {
          this.isLoading.value = false;
        });
    },
  },
  { devtools: true }
);

connectDevTools(i18nStore);

export type { Translations };
