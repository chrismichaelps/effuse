import { define, type EffuseChild } from '@effuse/core';

type HapticIntensity = 'light' | 'medium' | 'heavy';

interface HapticsProps {
	intensity?: HapticIntensity;
	disabled?: boolean;
	children?: EffuseChild;
}

interface HapticsExposed {
	intensity: HapticIntensity;
	disabled: boolean;
	handleInteraction: () => void;
}

const vibrationPatterns: Record<HapticIntensity, number | number[]> = {
	light: 10,
	medium: 25,
	heavy: [30, 10, 30],
};

export function triggerHaptic(intensity: HapticIntensity = 'light'): void {
	if ('vibrate' in navigator) {
		navigator.vibrate(vibrationPatterns[intensity]);
	}
}

export const Haptics = define<HapticsProps, HapticsExposed>({
	script: ({ props, useCallback }) => {
		const intensity = props.intensity || 'light';
		const disabled = props.disabled || false;

		const handleInteraction = useCallback(() => {
			if (!disabled) {
				triggerHaptic(intensity);
			}
		});

		return {
			intensity,
			disabled,
			handleInteraction,
		};
	},
	template: (
		{ handleInteraction }: HapticsExposed,
		props: Readonly<HapticsProps>
	) => (
		<div onClick={() => handleInteraction()} style="display: contents;">
			{props.children}
		</div>
	),
});

export function useHapticFeedback(intensity: HapticIntensity = 'light') {
	return () => triggerHaptic(intensity);
}

export function applyHapticFeedback(
	element: HTMLElement,
	intensity: HapticIntensity = 'light'
): () => void {
	const handler = () => triggerHaptic(intensity);
	element.addEventListener('click', handler);
	element.addEventListener('touchstart', handler, { passive: true });

	return () => {
		element.removeEventListener('click', handler);
		element.removeEventListener('touchstart', handler);
	};
}
