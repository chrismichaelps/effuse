import { define } from '@effuse/core';

interface SidebarToggleProps {
	class?: string | (() => string);
	onToggle?: () => void;
}

interface SidebarToggleExposed {
	handleClick: (e: MouseEvent) => void;
}

export const SidebarToggle = define<SidebarToggleProps, SidebarToggleExposed>({
	script: ({ props, useCallback, useLayerProps }) => {
		const sidebarProps = useLayerProps('sidebar')!;

		const handleClick = useCallback((e: MouseEvent) => {
			e.stopPropagation();
			if (props.onToggle) {
				props.onToggle();
			} else {
				if (window.innerWidth < 768) {
					sidebarProps.isOpen.value = !sidebarProps.isOpen.value;
				} else {
					sidebarProps.isCollapsed.value = !sidebarProps.isCollapsed.value;
				}
			}
		});
		return { handleClick };
	},
	template: ({ handleClick }, props) => {
		const getClass = () => {
			const classValue =
				typeof props.class === 'function' ? props.class() : props.class;

			return `sidebar-toggle-btn ${classValue ?? ''}`;
		};
		return (
			<button
				class={getClass}
				onClick={handleClick}
				aria-label="Toggle Sidebar"
			>
				<img src="/icons/sidebar-toggle.svg" alt="Toggle" />
			</button>
		);
	},
});
