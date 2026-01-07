import { createStore, connectDevTools } from '@effuse/store';

export const LOCALES = {
	EN: 'en',
	ES: 'es',
	JA: 'ja',
	ZH: 'zh',
} as const;

export type Locale = (typeof LOCALES)[keyof typeof LOCALES];

const STORAGE_KEY = 'effuse-locale';
const LOCALES_PATH = '/locales';
const STORE_NAME = 'i18n';
const DEFAULT_LOCALE = LOCALES.EN;

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
		emit: string;
		events: string;
		errorHandling: string;
		context: string;
		hooks: string;
		layers: string;
		controlFlow: string;
		repeat: string;
		await: string;
	};
	toc: {
		onThisPage: string;
	};
	footer: {
		builtWith: string;
	};
	search: {
		placeholder: string;
		startTyping: string;
		searchAcross: string;
		noResults: string;
		tryDifferent: string;
		toNavigate: string;
		toSelect: string;
		poweredBy: string;
		documentation: string;
		resultCode: string;
		resultTitle: string;
		resultSection: string;
		poweredByPrefix: string;
		poweredBySuffix: string;
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
		meta: {
			title: string;
			description: string;
		};
	};
	notFound: {
		code: string;
		title: string;
		description: string;
		track: string;
		goHome: string;
		meta: {
			title: string;
			description: string;
		};
	};
	language: {
		selectLanguage: string;
		english: string;
		spanish: string;
		japanese: string;
		mandarin: string;
	};
	examples: {
		form: {
			title: string;
			description: string;
			createPost: string;
			apiNote: string;
			titleLabel: string;
			emailLabel: string;
			bodyLabel: string;
			userIdLabel: string;
			enterTitlePlaceholder: string;
			emailPlaceholder: string;
			bodyPlaceholder: string;
			required: string;
			valid: string;
			invalid: string;
			state: string;
			modified: string;
			pristine: string;
			submitting: string;
			yes: string;
			no: string;
			createButton: string;
			submittingButton: string;
			reset: string;
			createdPosts: string;
			loadingPosts: string;
			noPosts: string;
			user: string;
		};
		todos: {
			title: string;
			description: string;
			enterTodoTitlePlaceholder: string;
			addPlaceholder: string;
			add: string;
			adding: string;
			total: string;
			completed: string;
			pending: string;
			all: string;
			edit: string;
			delete: string;
			editTodo: string;
			todoTitle: string;
			cancel: string;
			saveChanges: string;
			loadingTodos: string;
			noTodos: string;
			loadMore: string;
			loadingMore: string;
			refreshing: string;
			user: string;
		};
		props: {
			title: string;
			description: string;
			parentControls: string;
			incrementCount: string;
			changeColor: string;
			toggleStatus: string;
			reset: string;
			currentCount: string;
			derivedValue: string;
			currentColor: string;
			activeStatus: string;
			active: string;
			inactive: string;
			triggerUpdate: string;
			howItWorks: string;
		};
		i18n: {
			title: string;
			description: string;
			welcome: string;
			currentLocale: string;
			changeLocale: string;
			greeting: string;
			featuresTitle: string;
			featuresTypeSafe: string;
			featuresInterpolation: string;
			featuresReactive: string;
			featuresNested: string;
			itemsOne: string;
			itemsOther: string;
			summary: string;
			yourName: string;
			footer: string;
		};
		emit: {
			title: string;
			description: string;
			placeholder: string;
			send: string;
			actingAs: string;
			stats: {
				messages: string;
				emits: string;
				online: string;
			};
			reset: string;
			noMessages: string;
			howItWorks: string;
			mention: string;
			sessionStarted: string;
			switchedTo: string;
		};
		context: {
			title: string;
			description: string;
			themeSwitcher: string;
			themeSwitcherDesc: string;
			changeTheme: string;
			nestedOverride: string;
			nestedProviderTitle: string;
			nestedProviderDesc: string;
			root: string;
			nested: string;
			howItWorks: string;
			card1: string;
			card2: string;
			card3: string;
			card4: string;
			codeSnippet: string;
		};
		controlFlow: {
			title: string;
			description: string;
			show: {
				title: string;
				description: string;
				login: string;
				logout: string;
				pleaseLogin: string;
				welcome: string;
			};
			switch: {
				title: string;
				description: string;
				idle: string;
				loading: string;
				success: string;
				error: string;
			};
			for: {
				title: string;
				description: string;
				addPlaceholder: string;
				add: string;
				noItems: string;
			};
			dynamic: {
				title: string;
				description: string;
				changeColor: string;
				current: string;
			};
			repeat: {
				title: string;
				description: string;
				skeletonItems: string;
				currentCount: string;
				noItems: string;
				item: string;
			};
			await: {
				title: string;
				description: string;
				fetchUser: string;
				fetchNewUser: string;
				loading: string;
				errorMessage: string;
				retry: string;
				userName: string;
				userEmail: string;
				userId: string;
			};
		};
	};
	legal: {
		terms: {
			title: string;
			lastUpdated: string;
			sections: {
				acceptance: { title: string; content: string };
				license: { title: string; content: string };
				usage: {
					title: string;
					content: string;
					list: string[];
				};
				disclaimer: { title: string; content: string };
				liability: { title: string; content: string };
				changes: { title: string; content: string };
				contact: { title: string; content: string };
			};
			meta: { title: string; description: string };
		};
		privacy: {
			title: string;
			lastUpdated: string;
			sections: {
				overview: { title: string; content: string };
				collection: { title: string; content: string };
				cookies: { title: string; content: string };
				services: { title: string; content: string };
				contact: { title: string; content: string };
			};
			meta: { title: string; description: string };
		};
		disclaimer: {
			title: string;
			sections: {
				experimental: { title: string; content: string };
				competitor: {
					title: string;
					content1: string;
					content2: string;
				};
				risk: { title: string; content: string };
			};
			meta: { title: string; description: string };
		};
		contact: {
			title: string;
			content: string;
			meta: { title: string; description: string };
		};
	};
}

const isValidLocale = (value: string | null): value is Locale => {
	return (
		value === LOCALES.EN ||
		value === LOCALES.ES ||
		value === LOCALES.JA ||
		value === LOCALES.ZH
	);
};

const getInitialLocale = (): Locale => {
	if (typeof window === 'undefined') return DEFAULT_LOCALE;

	const stored = localStorage.getItem(STORAGE_KEY);
	if (isValidLocale(stored)) return stored;

	const browserLang = navigator.language.slice(0, 2);
	if (isValidLocale(browserLang)) return browserLang;

	return DEFAULT_LOCALE;
};

const buildLocaleUrl = (locale: Locale): string =>
	`${LOCALES_PATH}/${locale}.json`;

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
	STORE_NAME,
	{
		locale: getInitialLocale(),
		translations: null,
		isLoading: true,

		setLocale(loc: Locale) {
			this.locale.value = loc;
			localStorage.setItem(STORAGE_KEY, loc);
			this.isLoading.value = true;

			fetch(buildLocaleUrl(loc))
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

			fetch(buildLocaleUrl(currentLocale))
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
