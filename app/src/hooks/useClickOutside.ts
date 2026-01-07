import { defineHook, type Signal } from '@effuse/core';

interface ClickOutsideConfig {
	selector: string;
}

interface ClickOutsideReturn {
	active: Signal<boolean>;
	onClickOutside: (callback: () => void) => void;
	init: () => void;
}

export const useClickOutside = defineHook<
	ClickOutsideConfig,
	ClickOutsideReturn
>({
	name: 'useClickOutside',
	setup: ({ config, signal, effect }): ClickOutsideReturn => {
		const active = signal(false);
		const initialized = signal(false);
		let callback: (() => void) | null = null;

		effect(() => {
			if (!initialized.value) return undefined;

			const handleClick = (e: Event) => {
				const target = e.target as HTMLElement;
				if (!target.closest(config.selector)) {
					callback?.();
				}
			};

			document.addEventListener('click', handleClick);

			return () => {
				document.removeEventListener('click', handleClick);
			};
		});

		return {
			active,
			onClickOutside: (cb: () => void) => {
				callback = cb;
			},
			init: () => {
				initialized.value = true;
			},
		};
	},
});
