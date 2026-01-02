---
title: Hooks
---

# 钩子

Effuse 中的钩子提供可重用、可组合的逻辑，并内置生命周期管理。使用 `@effuse/core` 中的 `defineHook` 创建自定义钩子。

## 创建钩子

使用 `defineHook` 创建类型化的可重用钩子：

```typescript
import { defineHook, type Signal } from '@effuse/core';

interface ToggleConfig {
	initial?: boolean;
}

interface ToggleReturn {
	isOpen: Signal<boolean>;
	toggle: () => void;
	open: () => void;
	close: () => void;
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
		};
	},
});
```

## 钩子上下文

`setup` 函数接收一个包含以下工具的上下文对象：

| 属性            | 描述                 |
| --------------- | -------------------- |
| `config`        | 调用钩子时传递的配置 |
| `signal`        | 创建响应式信号       |
| `computed`      | 创建派生计算值       |
| `effect`        | 运行跟踪依赖的副作用 |
| `onMount`       | 注册钩子挂载时的回调 |
| `layer`         | 按名称访问层的 props |
| `layerProvider` | 访问层服务           |
| `scope`         | 管理清理和终结器     |

## 在组件中使用钩子

在组件的 `script` 函数中调用钩子：

```tsx
import { define } from '@effuse/core';
import { useToggle } from '../hooks';

const Dropdown = define({
	script: ({ onMount }) => {
		const menu = useToggle({ initial: false });

		return {
			isOpen: menu.isOpen,
			toggle: menu.toggle,
		};
	},
	template: ({ isOpen, toggle }) => (
		<div>
			<button onClick={toggle}>{isOpen.value ? '关闭' : '打开'}</button>
			{isOpen.value && <div class="menu">菜单内容</div>}
		</div>
	),
});
```

## DOM 依赖钩子

对于需要 DOM 访问的钩子，使用延迟初始化模式：

```typescript
import { defineHook, type Signal } from '@effuse/core';

interface ClickOutsideConfig {
	selector: string;
}

interface ClickOutsideReturn {
	onClickOutside: (callback: () => void) => void;
	init: () => void;
}

export const useClickOutside = defineHook<
	ClickOutsideConfig,
	readonly [],
	ClickOutsideReturn
>({
	name: 'useClickOutside',
	setup: ({ config, signal, effect }): ClickOutsideReturn => {
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
			return () => document.removeEventListener('click', handleClick);
		});

		return {
			onClickOutside: (cb) => {
				callback = cb;
			},
			init: () => {
				initialized.value = true;
			},
		};
	},
});
```

## 从钩子访问层

钩子可以访问层的状态和服务：

```typescript
import { defineHook } from '@effuse/core';

export const useTranslation = defineHook<
	undefined,
	readonly ['i18n'],
	{ t: (key: string) => string }
>({
	name: 'useTranslation',
	deps: ['i18n'],
	setup: ({ layer }) => {
		const i18n = layer('i18n');
		const translations = i18n.translations;

		return {
			t: (key: string) => translations.value?.[key] ?? key,
		};
	},
});
```

## 清理

当组件卸载时，效果会自动清理。从 `effect` 返回清理函数：

```typescript
effect(() => {
	const handler = () => {
		/* ... */
	};
	window.addEventListener('resize', handler);

	// 清理在效果重新运行或组件卸载时执行
	return () => window.removeEventListener('resize', handler);
});
```
