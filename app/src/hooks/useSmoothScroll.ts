import { defineHook, type Signal } from '@effuse/core';
import Lenis from 'lenis';

interface SmoothScrollConfig {
	wrapper?: string;
	content?: string;
	duration?: number;
}

interface SmoothScrollReturn {
	lenis: Signal<Lenis | null>;
	init: () => void;
	scrollTo: (target: string | number) => void;
}

export const useSmoothScroll = defineHook<
	SmoothScrollConfig,
	SmoothScrollReturn
>({
	name: 'useSmoothScroll',
	setup: ({ config, signal, effect }): SmoothScrollReturn => {
		const lenisRef = signal<Lenis | null>(null);
		const initialized = signal(false);

		effect(() => {
			if (!initialized.value) return undefined;

			const wrapper = config.wrapper
				? document.querySelector(config.wrapper)
				: undefined;
			const content = config.content
				? document.querySelector(config.content)
				: undefined;

			const lenis = new Lenis({
				wrapper: wrapper as HTMLElement | undefined,
				content: content as HTMLElement | undefined,
				duration: config.duration ?? 1.2,
				easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
				orientation: 'vertical',
				gestureOrientation: 'vertical',
				smoothWheel: true,
			});

			lenisRef.value = lenis;

			let rafId: number;
			function raf(time: number) {
				lenis.raf(time);
				rafId = requestAnimationFrame(raf);
			}
			rafId = requestAnimationFrame(raf);

			return () => {
				cancelAnimationFrame(rafId);
				lenis.destroy();
				lenisRef.value = null;
			};
		});

		return {
			lenis: lenisRef,
			init: () => {
				initialized.value = true;
			},
			scrollTo: (target: string | number) => {
				lenisRef.value?.scrollTo(target);
			},
		};
	},
});
