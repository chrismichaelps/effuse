import { defineHook, type ReadonlySignal } from '@effuse/core';
import { isClient } from '../../internal/utils.js';
import { DocumentVisibilityError } from './errors.js';
import { traceDocumentVisibility } from './telemetry.js';

export { DocumentVisibilityError } from './errors.js';

export type VisibilityState = DocumentVisibilityState | 'unknown';

export interface UseDocumentVisibilityConfig {
	readonly ssrState?: VisibilityState;
}

export interface UseDocumentVisibilityReturn {
	readonly state: ReadonlySignal<VisibilityState>;
	readonly isVisible: ReadonlySignal<boolean>;
	readonly isHidden: ReadonlySignal<boolean>;
	readonly isSupported: ReadonlySignal<boolean>;
	readonly error: ReadonlySignal<DocumentVisibilityError | null>;
}

export const useDocumentVisibility = defineHook<
	UseDocumentVisibilityConfig | undefined,
	UseDocumentVisibilityReturn
>({
	name: 'useDocumentVisibility',
	setup: (ctx) => {
		const initialState = ctx.config?.ssrState ?? 'unknown';
		const state = ctx.signal<VisibilityState>(initialState);
		const supported = ctx.signal(false);
		const error = ctx.signal<DocumentVisibilityError | null>(null);
		const visible = ctx.computed(() => state.value === 'visible');
		const hidden = ctx.computed(() => state.value === 'hidden');

		traceDocumentVisibility('init', initialState);

		ctx.onMount(() => {
			if (!isClient()) return undefined;
			if (
				!('visibilityState' in document) ||
				typeof document.addEventListener !== 'function'
			) {
				state.value = 'unknown';
				supported.value = false;
				traceDocumentVisibility('unsupported');
				return undefined;
			}

			const synchronize = (): void => {
				state.value = document.visibilityState;
				supported.value = true;
				traceDocumentVisibility('change', document.visibilityState);
			};

			try {
				synchronize();
				document.addEventListener('visibilitychange', synchronize);
			} catch (cause) {
				error.value = new DocumentVisibilityError(cause);
				supported.value = false;
				traceDocumentVisibility('error');
				return undefined;
			}

			return () => {
				document.removeEventListener('visibilitychange', synchronize);
			};
		});

		return {
			state,
			isVisible: visible,
			isHidden: hidden,
			isSupported: supported,
			error,
		};
	},
});
