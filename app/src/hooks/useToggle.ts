import { defineHook, type Signal } from '@effuse/core';

interface ToggleConfig {
	initial?: boolean;
}

interface ToggleReturn {
	isOpen: Signal<boolean>;
	toggle: () => void;
	open: () => void;
	close: () => void;
	set: (value: boolean) => void;
}

export const useToggle = defineHook<ToggleConfig, readonly [], ToggleReturn>({
	name: 'useToggle',
	setup: ({ config, signal }): ToggleReturn => {
		const isOpen = signal(config.initial ?? false);

		return {
			isOpen,
			toggle: () => {
				isOpen.value = !isOpen.value;
			},
			open: () => {
				isOpen.value = true;
			},
			close: () => {
				isOpen.value = false;
			},
			set: (value: boolean) => {
				isOpen.value = value;
			},
		};
	},
});
