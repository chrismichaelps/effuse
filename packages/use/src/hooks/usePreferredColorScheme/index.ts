import { defineHook, type ReadonlySignal } from '@effuse/core';
import { isClient } from '../../internal/utils.js';
import { PreferredColorSchemeError } from './errors.js';
import { tracePreferredColorScheme } from './telemetry.js';

export { PreferredColorSchemeError } from './errors.js';

export type PreferredColorScheme =
	| 'light'
	| 'dark'
	| 'no-preference'
	| 'unknown';

export interface UsePreferredColorSchemeConfig {
	readonly ssrScheme?: PreferredColorScheme;
}

export interface UsePreferredColorSchemeReturn {
	readonly scheme: ReadonlySignal<PreferredColorScheme>;
	readonly isDark: ReadonlySignal<boolean>;
	readonly isLight: ReadonlySignal<boolean>;
	readonly hasPreference: ReadonlySignal<boolean>;
	readonly isSupported: ReadonlySignal<boolean>;
	readonly error: ReadonlySignal<PreferredColorSchemeError | null>;
}

const DARK_QUERY = '(prefers-color-scheme: dark)';
const LIGHT_QUERY = '(prefers-color-scheme: light)';

export const usePreferredColorScheme = defineHook<
	UsePreferredColorSchemeConfig | undefined,
	UsePreferredColorSchemeReturn
>({
	name: 'usePreferredColorScheme',
	setup: (ctx) => {
		const initialScheme = ctx.config?.ssrScheme ?? 'unknown';
		const scheme = ctx.signal<PreferredColorScheme>(initialScheme);
		const supported = ctx.signal(false);
		const error = ctx.signal<PreferredColorSchemeError | null>(null);
		const dark = ctx.computed(() => scheme.value === 'dark');
		const light = ctx.computed(() => scheme.value === 'light');
		const preferred = ctx.computed(
			() => scheme.value === 'dark' || scheme.value === 'light'
		);

		tracePreferredColorScheme('init', initialScheme);

		ctx.onMount(() => {
			if (!isClient()) return undefined;
			if (typeof window.matchMedia !== 'function') {
				scheme.value = 'unknown';
				supported.value = false;
				tracePreferredColorScheme('unsupported');
				return undefined;
			}

			try {
				const darkQuery = window.matchMedia(DARK_QUERY);
				const lightQuery = window.matchMedia(LIGHT_QUERY);
				const synchronize = (): void => {
					scheme.value = darkQuery.matches
						? 'dark'
						: lightQuery.matches
							? 'light'
							: 'no-preference';
					supported.value = true;
					tracePreferredColorScheme('change', scheme.value);
				};

				synchronize();
				darkQuery.addEventListener('change', synchronize);
				lightQuery.addEventListener('change', synchronize);

				return () => {
					darkQuery.removeEventListener('change', synchronize);
					lightQuery.removeEventListener('change', synchronize);
				};
			} catch (cause) {
				error.value = new PreferredColorSchemeError(cause);
				scheme.value = 'unknown';
				supported.value = false;
				tracePreferredColorScheme('error');
				return undefined;
			}
		});

		return {
			scheme,
			isDark: dark,
			isLight: light,
			hasPreference: preferred,
			isSupported: supported,
			error,
		};
	},
});
