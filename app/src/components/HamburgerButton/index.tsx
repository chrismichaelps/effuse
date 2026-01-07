import { define, computed, type Signal } from '@effuse/core';

interface HamburgerButtonProps {
	isOpen: Signal<boolean>;
	onToggle: () => void;
}

interface HamburgerButtonExposed extends HamburgerButtonProps {
	topBarStyle: Signal<Record<string, string>>;
	middleBarStyle: Signal<Record<string, string>>;
	bottomBarStyle: Signal<Record<string, string>>;
}

export const HamburgerButton = define<
	HamburgerButtonProps,
	HamburgerButtonExposed
>({
	script: ({ props }) => {
		const topBarStyle = computed(() => ({
			display: 'block',
			width: '20px',
			height: '2px',
			backgroundColor: '#475569',
			transition: 'all 0.3s ease-in-out',
			transformOrigin: 'center',
			transform: props.isOpen.value ? 'translateY(6px) rotate(45deg)' : 'none',
		}));
		const middleBarStyle = computed(() => ({
			display: 'block',
			width: '20px',
			height: '2px',
			backgroundColor: '#475569',
			margin: '4px 0',
			transition: 'all 0.3s ease-in-out',
			transformOrigin: 'center',
			opacity: props.isOpen.value ? '0' : '1',
			transform: props.isOpen.value ? 'scale(0)' : 'none',
		}));
		const bottomBarStyle = computed(() => ({
			display: 'block',
			width: '20px',
			height: '2px',
			backgroundColor: '#475569',
			transition: 'all 0.3s ease-in-out',
			transformOrigin: 'center',
			transform: props.isOpen.value
				? 'translateY(-6px) rotate(-45deg)'
				: 'none',
		}));
		return {
			isOpen: props.isOpen,
			onToggle: props.onToggle,
			topBarStyle,
			middleBarStyle,
			bottomBarStyle,
		};
	},
	template: ({
		onToggle,
		isOpen,
		topBarStyle,
		middleBarStyle,
		bottomBarStyle,
	}) => (
		<button
			onClick={onToggle}
			class="md:hidden flex flex-col justify-center items-center w-10 h-10 rounded-lg hover:bg-slate-100 transition-colors"
			aria-label="Toggle menu"
			aria-expanded={isOpen}
			style={{
				cursor: 'pointer',
				border: 'none',
				backgroundColor: 'transparent',
				padding: '0',
				outline: 'none',
			}}
		>
			<span style={() => topBarStyle.value} />
			<span style={() => middleBarStyle.value} />
			<span style={() => bottomBarStyle.value} />
		</button>
	),
});
