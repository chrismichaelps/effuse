---
title: 层
---

# 层

层为您的应用程序提供依赖注入、共享状态和生命周期管理。它们使组件和钩子能够在不进行属性透传的情况下访问全局服务。

## 概述

层系统由三个关键概念组成:

| 概念            | 目的                               | 组件中的访问方式                       |
| --------------- | ---------------------------------- | -------------------------------------- |
| **store**       | 响应式状态容器（signals）          | 通过 `deriveProps` → `useLayerProps`   |
| **deriveProps** | 从 store 中提取 signals 供组件使用 | `useLayerProps('名称')`                |
| **provides**    | 用于依赖注入的服务/工厂            | `useStore('键')` 或 `useService('键')` |

## 创建层

使用 `@effuse/core` 中的 `defineLayer`:

```typescript
import { defineLayer, signal } from '@effuse/core';
import { createStore } from '@effuse/store';

// 创建具有响应式状态的 store
const themeStore = createStore('theme', {
	mode: 'dark' as 'light' | 'dark',
	accentColor: '#8df0cc',

	setMode(mode: 'light' | 'dark') {
		this.mode.value = mode;
	},

	toggleMode() {
		this.mode.value = this.mode.value === 'dark' ? 'light' : 'dark';
	},
});

export const ThemeLayer = defineLayer({
	name: 'theme',

	// 对其他层的依赖（先加载）
	dependencies: ['layout'],

	// 该层的 store 实例
	store: themeStore,

	// 从 store 中提取响应式 props 供组件使用
	deriveProps: (store) => ({
		mode: store.mode,
		accentColor: store.accentColor,
	}),

	// 通过依赖注入暴露的服务
	provides: {
		theme: () => themeStore,
	},

	// 生命周期钩子
	onMount: (ctx) => {
		// ctx.store, ctx.deps, ctx.getService 可用
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme) ctx.store.mode.value = savedTheme as 'light' | 'dark';
	},

	onUnmount: (ctx) => {
		// 卸载前持久化状态
		localStorage.setItem('theme', ctx.store.mode.value);
	},

	onError: (error, ctx) => {
		// 具有上下文访问权限的智能恢复
		console.error('[ThemeLayer] 错误:', error.message);
		ctx.store.mode.value = 'dark'; // 回退
	},

	onReady: (ctx, allLayers) => {
		// 在所有层初始化后调用
		console.log(`[ThemeLayer] 准备就绪，包含 ${allLayers.length} 个层`);
	},

	// 可访问 store 和依赖项的 setup 函数
	setup: (ctx) => {
		// ctx.store 是具有完整类型安全性的 themeStore
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'light' || savedTheme === 'dark') {
			ctx.store.mode.value = savedTheme;
		}

		// 返回清理函数（可选）
		return () => {
			console.log('[ThemeLayer] 清理');
		};
	},
});
```

## 层模式

`defineLayer` 的完整选项:

```typescript
interface EffuseLayer<P, D, S> {
	// 必需
	name: string; // 唯一标识符

	// 状态管理
	store?: S; // Store 实例（createStore）
	deriveProps?: (store: S) => P; // 从 store 提取 props

	// 依赖注入
	dependencies?: D; // 需要先加载的层名称数组
	provides?: Record<string, () => unknown>; // 服务工厂

	// 生命周期
	setup?: (ctx: SetupContext<P, D, S>) => CleanupFn | void;
	onMount?: (ctx: SetupContext<P, D, S>) => void;
	onUnmount?: (ctx: SetupContext<P, D, S>) => void;
	onError?: (error: Error, ctx: SetupContext<P, D, S>) => void;
	onReady?: (ctx: SetupContext<P, D, S>, allLayers: ResolvedLayer[]) => void;

	// 高级
	components?: Record<string, Component>; // 作用域组件
	routes?: RouteConfig[]; // 层专属路由
	plugins?: PluginFn[]; // 层插件
}
```

## store vs provides

| 方面         | `store`                      | `provides`                  |
| ------------ | ---------------------------- | --------------------------- |
| **目的**     | 层的响应式状态               | 依赖注入服务                |
| **包含内容** | `createStore()` 实例         | 工厂函数 `{ 键: () => 值 }` |
| **使用位置** | `deriveProps(store)` → props | 组件中通过 `useStore('键')` |
| **响应性**   | 内置 signals                 | 取决于返回的内容            |

### store

**store** 是通过 `@effuse/store` 创建的层的内部响应式状态:

```typescript
const i18nStore = createStore('i18n', {
	locale: 'en',
	translations: null as Record<string, string> | null,

	setLocale(loc: string) {
		this.locale.value = loc;
		// 加载翻译...
	},
});

defineLayer({
	name: 'i18n',
	store: i18nStore,
	deriveProps: (store) => ({
		locale: store.locale,
		translations: store.translations,
	}),
});
```

### provides

**provides** 为依赖注入暴露服务:

```typescript
defineLayer({
	name: 'router',
	provides: {
		router: () => routerInstance, // 工厂函数
	},
});

// 在组件中:
script: ({ useStore }) => {
	const router = useStore('router'); // 获取 router
};
```

## 在组件中使用层

在组件脚本中访问层数据和服务:

```tsx
import { define, computed } from '@effuse/core';

const ThemeToggle = define({
	script: ({ useLayerProps, useStore }) => {
		// 从 deriveProps 获取响应式 props
		const themeProps = useLayerProps('theme');

		// 从 provides 获取服务
		const themeStore = useStore('theme');

		const buttonText = computed(() =>
			themeProps?.mode.value === 'dark' ? '浅色' : '深色'
		);

		const toggle = () => {
			themeStore?.toggleMode();
		};

		return { buttonText, toggle };
	},
	template: ({ buttonText, toggle }) => (
		<button onClick={toggle}>{buttonText}</button>
	),
});
```

## 在钩子中使用层

使用 `defineHook` 创建具有层访问权限的可复用钩子:

```typescript
import { defineHook, signal } from '@effuse/core';

export const useTheme = defineHook<
	undefined, // No config
	{ mode: Signal<string>; toggle: () => void }
>({
	name: 'useTheme',
	deps: ['theme'] as const,
	setup: ({ layer }) => {
		// layer() 返回 deriveProps 的结果
		const themeProps = layer('theme');

		return {
			mode: themeProps.mode,
			toggle: () => {
				themeProps.mode.value =
					themeProps.mode.value === 'dark' ? 'light' : 'dark';
			},
		};
	},
});
```

## 层依赖

层显式声明其依赖项:

```typescript
defineLayer({
	name: 'todos',
	dependencies: ['i18n', 'router'], // ← 必须先加载
	setup: (ctx) => {
		// 访问依赖层
		const i18n = ctx.deps.i18n;
		const router = ctx.deps.router;
	},
});
```

层运行时确保依赖项按正确顺序初始化。

## 类型注册表

为了完整的类型安全，通过 module augmentation 扩展 `EffuseLayerRegistry`:

```typescript
// src/layers/effuse.d.ts
import type { Signal } from '@effuse/core';

declare module '@effuse/core' {
	interface EffuseLayerRegistry {
		theme: {
			props: {
				mode: Signal<'light' | 'dark'>;
				accentColor: Signal<string>;
			};
			provides: { theme: typeof themeStore };
		};
		i18n: {
			props: {
				locale: Signal<string>;
				translations: Signal<Record<string, string> | null>;
			};
			provides: { i18n: typeof i18nStore };
		};
	}
}

export {};
```

这启用类型推断:

```typescript
const { mode } = useLayerProps('theme')!;
//      ^? Signal<'light' | 'dark'>
```

## 实际示例: I18n 层

```typescript
import { defineLayer } from '@effuse/core';
import { i18nStore } from '../store/appI18n';

export const I18nLayer = defineLayer({
	name: 'i18n',
	dependencies: ['router'],

	store: i18nStore,

	deriveProps: (store) => ({
		locale: store.locale,
		isLoading: store.isLoading,
		translations: store.translations,
	}),

	provides: {
		i18n: () => i18nStore,
	},

	onMount: (ctx) => {
		const saved = localStorage.getItem('effuse:locale');
		if (saved) ctx.store.setLocale(saved);
	},

	onUnmount: (ctx) => {
		localStorage.setItem('effuse:locale', ctx.store.locale.value);
	},

	onError: (_, ctx) => {
		ctx.store.setLocale('en'); // 回退
	},

	onReady: (ctx, allLayers) => {
		console.log(`[I18nLayer] 准备就绪，包含 ${allLayers.length} 个层`);
	},

	setup: (ctx) => {
		ctx.store.init(); // 尽快加载初始翻译
	},
});
```

## 最佳实践

1. **每个领域一个层** - 创建专注的层（auth、i18n、theme、todos）
2. **Store 用于状态** - 对响应式值使用 `store` + `deriveProps`
3. **Provides 用于服务** - 对方法、store 和服务使用 `provides`
4. **声明依赖项** - 在 `dependencies` 中列出所有必需的层
5. **Setup 用于初始化** - 使用 `setup` 进行初始化（localStorage、API 调用）
6. **在 Setup 中清理** - 需要时从 `setup` 返回清理函数
7. **类型注册表** - 使用 module augmentation 实现类型安全的层访问
