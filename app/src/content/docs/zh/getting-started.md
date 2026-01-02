---
title: Effuse 快速入门
---

# Effuse 快速入门

欢迎使用 **Effuse**，这是一个基于 TypeScript 和 [Effect](https://effect.website) 构建的现代响应式 UI 框架。

## 什么是 Effuse？

Effuse 是一个基于信号的 UI 框架，结合了现代前端开发的最佳实践：

- **细粒度响应式** — 只有依赖于已更改数据的 DOM 节点才会更新
- **类型安全组件** — 完整的 TypeScript 支持和类型推断
- **Effect 驱动** — 构建于 Effect 之上，提供健壮的异步和错误处理
- **可组合架构** — 通过层和插件实现可扩展性

## 快速示例

这是一个简单的计数器组件：

```tsx
import { define, signal } from '@effuse/core';

const Counter = define({
	script: () => {
		const count = signal(0);
		const increment = () => count.value++;
		return { count, increment };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>Clicked {count} times</button>
	),
});
```

## 框架配置

以下是如何配置应用程序的根目录，包括路由和层：

### 1. App 组件 (src/App.tsx)

```tsx
import { define } from '@effuse/core';
import { RouterView } from '@effuse/router';
import { AppLayout } from './layers/AppLayout';
import { SmoothScroll } from './components/SmoothScroll';

export const App = define({
	script: ({}) => ({}),
	template: () => (
		<AppLayout>
			<SmoothScroll />
			<RouterView />
		</AppLayout>
	),
});
```

### 2. 入口文件 (src/main.ts)

```typescript
import { createApp } from '@effuse/core';
import { InkLayer } from '@effuse/ink';
import { App } from './App';
import { router, installRouter } from './router';

import './styles.css';

// 在创建应用之前安装路由
installRouter(router);

// 创建并挂载应用
createApp(App)
	.useLayers([InkLayer])
	.then((app) => app.mount('#app'));
```

### 3. 路由配置 (src/router/index.ts)

```typescript
import {
	createRouter,
	createWebHistory,
	installRouter,
	type RouteRecord,
} from '@effuse/router';
import { HomePage } from '../pages/Home';
import { DocsPage } from '../pages/Docs';
import { ContactPage } from '../pages/Contact';

const routes: RouteRecord[] = [
	{ path: '/', name: 'home', component: HomePage },
	{ path: '/docs', name: 'docs', component: DocsPage },
	{ path: '/docs/:slug', name: 'docs-page', component: DocsPage },
	{ path: '/contact', name: 'contact', component: ContactPage },
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

export { installRouter };
```

## 组件定义

组件使用 `define` 函数创建，它接受一个包含 `script` 和 `template` 的配置对象：

- **script**: 包含组件的逻辑、状态和事件处理程序
- **template**: 返回渲染组件的 JSX

## 脚本上下文

`script` 函数接收一个带有实用工具的 `ScriptContext` 对象：

| 属性              | 类型                         | 描述                               |
| ----------------- | ---------------------------- | ---------------------------------- |
| `props`           | `Readonly<P>`                | 传递给组件的属性。只读且冻结。     |
| `expose`          | `(values: object) => void`   | 手动向模板公开值。                 |
| `signal`          | `<T>(value: T) => Signal<T>` | 创建新的响应式信号。               |
| `store`           | `<T>(name: string) => T`     | 按名称访问全局存储。               |
| `router`          | `Router`                     | 访问路由器实例。                   |
| `onMount`         | `(cb) => void`               | 组件挂载后的回调。可返回清理函数。 |
| `onUnmount`       | `(cb) => void`               | 组件移除时的回调。                 |
| `onBeforeMount`   | `(cb) => void`               | 组件挂载前的回调。                 |
| `onBeforeUnmount` | `(cb) => void`               | 组件卸载前的回调。                 |
| `watch`           | `(source, cb) => void`       | 监视信号并在变化时运行回调。       |
| `useCallback`     | `(fn, deps?) => fn`          | 使用稳定标识记忆回调。             |
| `useMemo`         | `(fn, deps?) => getter`      | 记忆计算值。                       |

## 下一步

准备好深入了解了吗？接下来：

- **[安装](/docs/installation)** — 在项目中设置 Effuse
- **[快速开始](/docs/quick-start)** — 构建你的第一个应用
- **[信号](/docs/signals)** — 掌握响应式系统
