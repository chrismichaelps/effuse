---
title: Effuse をはじめる
---

# Effuse を始める

**Effuse** へようこそ。TypeScript で構築された最新のリアクティブ UI フレームワークです。

## Effuse とは？

Effuse は、最新のフロントエンド開発の優れたアイデアを組み合わせた、シグナルベースの UI フレームワークです。

- **微細な反応性（Fine-grained reactivity）** — 変更されたデータに依存する DOM ノードのみが更新されます
- **型安全なコンポーネント** — 型推論を備えた完全な TypeScript サポート
- **堅牢性** — 信頼性の高い非同期処理とエラーハンドリングを実現
- **構成可能なアーキテクチャ** — 拡張性のためのレイヤーとプラグイン
  システム

## クイックサンプル

シンプルなカウンターコンポーネントの例：

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

## フレームワークの設定

ルーティングとレイヤーを含む、アプリケーションのルート設定方法：

### 1. App コンポーネント (src/App.tsx)

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

### 2. エントリーポイント (src/main.ts)

```typescript
import { createApp } from '@effuse/core';
import { InkLayer } from '@effuse/ink';
import { App } from './App';
import { router, installRouter } from './router';

import './styles.css';

// アプリ作成前にルーターをインストール
installRouter(router);

// アプリケーションを作成してマウント
createApp(App)
	.useLayers([InkLayer])
	.then((app) => app.mount('#app'));
```

### 3. ルーター設定 (src/router/index.ts)

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

## コンポーネントの定義

コンポーネントは `define` 関数を使用して作成し、`script` と `template` を含む設定オブジェクトを受け取ります：

- **script**: コンポーネントのロジック、状態、イベントハンドラを含む
- **template**: コンポーネントをレンダリングする JSX を返す

## スクリプトコンテキスト

`script` 関数は便利なユーティリティを持つ `ScriptContext` オブジェクトを受け取ります：

| プロパティ        | 型                           | 説明                                                   |
| ----------------- | ---------------------------- | ------------------------------------------------------ |
| `props`           | `Readonly<P>`                | コンポーネントに渡されるプロパティ。読み取り専用。     |
| `expose`          | `(values: object) => void`   | テンプレートに値を手動で公開する。                     |
| `signal`          | `<T>(value: T) => Signal<T>` | 新しいリアクティブシグナルを作成する。                 |
| `store`           | `<T>(name: string) => T`     | 名前でグローバルストアにアクセスする。                 |
| `router`          | `Router`                     | ルーターインスタンスにアクセスする。                   |
| `onMount`         | `(cb) => void`               | マウント後のコールバック。クリーンアップ関数を返せる。 |
| `onUnmount`       | `(cb) => void`               | コンポーネント削除時のコールバック。                   |
| `onBeforeMount`   | `(cb) => void`               | マウント前のコールバック。                             |
| `onBeforeUnmount` | `(cb) => void`               | アンマウント前のコールバック。                         |
| `watch`           | `(source, cb) => void`       | シグナルを監視し変更時にコールバックを実行。           |
| `useCallback`     | `(fn, deps?) => fn`          | 安定したアイデンティティでコールバックをメモ化。       |
| `useMemo`         | `(fn, deps?) => getter`      | 計算値をメモ化する。                                   |

## 次のステップ

準備はできましたか？次に進みましょう：

- **[インストール](/docs/installation)** — プロジェクトに Effuse をセットアップ
- **[クイックスタート](/docs/quick-start)** — 最初のアプリを構築
- **[シグナル](/docs/signals)** — リアクティビティシステムをマスター
