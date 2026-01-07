import { define } from '@effuse/core';
import Lenis from 'lenis';

declare global {
	interface Window {
		__lenis?: Lenis;
	}
}

export const SmoothScroll = define({
	script: ({ onMount }) => {
		onMount(() => {
			const lenis = new Lenis({
				duration: 1.2,
				easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
				orientation: 'vertical',
				gestureOrientation: 'vertical',
				smoothWheel: true,
			});

			window.__lenis = lenis;

			function raf(time: number) {
				lenis.raf(time);
				requestAnimationFrame(raf);
			}

			requestAnimationFrame(raf);

			return () => {
				lenis.destroy();
				window.__lenis = undefined;
			};
		});

		return {};
	},
	template: () => null,
});
