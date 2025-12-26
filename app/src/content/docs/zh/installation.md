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

Effuse 包尚未发布到 npm。框架目前正在开发中。您可以克隆仓库并通过工作区链接在本地使用。

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
