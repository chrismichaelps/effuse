---
title: インストール
---

# インストール

数分で Effuse をプロジェクトにセットアップできます。

## 必要条件

- **Node.js** v23.0.0 以降
- **npm**、**yarn**、または **pnpm**
- TypeScript 5.0 以上（推奨）

## パッケージインストール

Effuse パッケージはまだ npm に公開されていません。フレームワークは現在開発中です。リポジトリをクローンして、ワークスペースリンク経由でローカルで使用できます。

## 手動セットアップ

### 1. エントリーポイントを作成

```typescript
// src/main.tsx
import { createApp } from '@effuse/core';
import { installRouter, router } from './router';
import { App } from './App';

installRouter(router);

const app = createApp(App);
app.mount('#app');
```

### 2. App コンポーネントを作成

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

### 3. ルーターを設定

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

## TypeScript 設定

現時点では利用できません。

## Vite 設定

現時点では利用できません。
