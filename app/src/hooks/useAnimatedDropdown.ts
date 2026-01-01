import { defineHook, type Signal } from '@effuse/core';

type AnimateOpenFn = (el: HTMLElement) => void;
type AnimateCloseFn = (el: HTMLElement) => void;
type StaggerFn = (el: HTMLElement, selector: string, delay: number) => void;

interface AnimatedDropdownConfig {
	animateOpen: AnimateOpenFn;
	animateClose: AnimateCloseFn;
	staggerChildren?: StaggerFn;
	staggerSelector?: string;
	staggerDelay?: number;
}

interface AnimatedDropdownReturn {
	isOpen: Signal<boolean>;
	ref: Signal<HTMLElement | null>;
	toggle: () => void;
	open: () => void;
	close: () => void;
	init: () => void;
}

export const useAnimatedDropdown = defineHook<
	AnimatedDropdownConfig,
	readonly [],
	AnimatedDropdownReturn
>({
	name: 'useAnimatedDropdown',
	setup: ({ config, signal, effect }): AnimatedDropdownReturn => {
		const isOpen = signal(false);
		const ref = signal<HTMLElement | null>(null);
		const initialized = signal(false);
		let previousState: boolean | null = null;

		effect(() => {
			if (!initialized.value) return undefined;

			const el = ref.value;
			if (!el) return undefined;

			const currentOpen = isOpen.value;

			if (previousState === null) {
				previousState = currentOpen;
				if (!currentOpen) {
					el.style.display = 'none';
					el.style.opacity = '0';
				}
				return undefined;
			}

			if (currentOpen !== previousState) {
				previousState = currentOpen;
				if (currentOpen) {
					config.animateOpen(el);
					if (config.staggerChildren && config.staggerSelector) {
						requestAnimationFrame(() => {
							config.staggerChildren!(
								el,
								config.staggerSelector!,
								config.staggerDelay ?? 0.03
							);
						});
					}
				} else {
					config.animateClose(el);
				}
			}
		});

		return {
			isOpen,
			ref,
			toggle: () => {
				isOpen.value = !isOpen.value;
			},
			open: () => {
				isOpen.value = true;
			},
			close: () => {
				isOpen.value = false;
			},
			init: () => {
				initialized.value = true;
			},
		};
	},
});
