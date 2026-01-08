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

コアパッケージと必要な追加パッケージをインストールします：

### pnpm を使用（推奨）

```bash
# コアパッケージ（必須）
pnpm add @effuse/core

# 追加パッケージ
pnpm add @effuse/router    # ルーティング
pnpm add @effuse/store     # 状態管理
pnpm add @effuse/i18n      # 国際化
pnpm add @effuse/query     # データフェッチ
pnpm add @effuse/ink       # Markdown レンダリング

# 開発用
pnpm add -D @effuse/compiler  # JSX コンパイラプラグイン
```

### npm を使用

```bash
# コアパッケージ（必須）
npm install @effuse/core

# 追加パッケージ
npm install @effuse/router @effuse/store @effuse/i18n @effuse/query @effuse/ink

# 開発用
npm install -D @effuse/compiler
```

### yarn を使用

```bash
# コアパッケージ（必須）
yarn add @effuse/core

# 追加パッケージ
yarn add @effuse/router @effuse/store @effuse/i18n @effuse/query @effuse/ink

# 開発用
yarn add -D @effuse/compiler
```

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
