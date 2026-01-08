---
title: 安装指南
---

# 安装指南

几分钟内即可在项目中设置 Effuse。

## 系统要求

- **Node.js** v23.0.0 或更高版本
- **npm**、**yarn** 或 **pnpm**
- TypeScript 5.0+（推荐）

## 包安装

安装核心包和您需要的任何其他包：

### 使用 pnpm（推荐）

```bash
# 核心包（必需）
pnpm add @effuse/core

# 其他包
pnpm add @effuse/router    # 路由
pnpm add @effuse/store     # 状态管理
pnpm add @effuse/i18n      # 国际化
pnpm add @effuse/query     # 数据获取
pnpm add @effuse/ink       # Markdown 渲染

# 开发依赖
pnpm add -D @effuse/compiler  # JSX 编译器插件
```

### 使用 npm

```bash
# 核心包（必需）
npm install @effuse/core

# 其他包
npm install @effuse/router @effuse/store @effuse/i18n @effuse/query @effuse/ink

# 开发依赖
npm install -D @effuse/compiler
```

### 使用 yarn

```bash
# 核心包（必需）
yarn add @effuse/core

# 其他包
yarn add @effuse/router @effuse/store @effuse/i18n @effuse/query @effuse/ink

# 开发依赖
yarn add -D @effuse/compiler
```

## 手动设置

### 1. 创建入口文件

```typescript
// src/main.tsx
import { createApp } from '@effuse/core';
import { installRouter, router } from './router';
import { App } from './App';

installRouter(router);

const app = createApp(App);
app.mount('#app');
```

### 2. 创建 App 组件

```tsx
// src/App.tsx
import { define } from '@effuse/core';
import { RouterView } from '@effuse/router';

export const App = define({
	script: () => ({}),
	template: () => (
		<div>
			<RouterView />
		</div>
	),
});
```

### 3. 配置路由

```typescript
// src/router/index.ts
import {
	createRouter,
	createWebHistory,
	installRouter,
	type RouteRecord,
} from '@effuse/router';
import { HomePage } from '../pages/Home';

const routes: RouteRecord[] = [
	{ path: '/', name: 'home', component: HomePage },
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

export { installRouter };
```

## TypeScript 配置

目前暂不可用。

## Vite 配置

目前暂不可用。
