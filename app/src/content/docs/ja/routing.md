---
title: ルーティング
---

# ルーティング

Effuse Router は型安全で宣言的なルーティングを提供します。

## セットアップ

```typescript
import {
	createRouter,
	createWebHistory,
	installRouter,
	type RouteRecord,
} from '@effuse/router';
import { HomePage } from './pages/Home';
import { DocsPage } from './pages/Docs';
import { ContactPage } from './pages/Contact';

const routes: RouteRecord[] = [
	{ path: '/', name: 'home', component: HomePage },
	{ path: '/docs/:slug', name: 'docs', component: DocsPage },
	{ path: '/contact', name: 'contact', component: ContactPage },
];

export const router = createRouter({
	history: createWebHistory(),
	routes,
});

// アプリ作成前にルーターをインストール
installRouter(router);
```

## Link によるナビゲーション

ナビゲーションには `Link` コンポーネントを使用します：

```tsx
import { define } from '@effuse/core';
import { Link } from '@effuse/router';

const Nav = define({
	script: () => ({}),
	template: () => (
		<nav>
			<Link to="/">Home</Link>
			<Link to="/docs/getting-started">Docs</Link>
			<Link to="/contact">Contact</Link>
		</nav>
	),
});
```

## RouterView

マッチしたコンポーネントをレンダリングするには `RouterView` を使用します：

```tsx
import { define } from '@effuse/core';
import { RouterView } from '@effuse/router';

const App = define({
	script: () => ({}),
	template: () => (
		<div class="app">
			<header>...</header>
			<main>
				<RouterView />
			</main>
			<footer>...</footer>
		</div>
	),
});
```

## 動的ルートパラメータ

`useRoute` フックを使用して、ルートパラメータ、クエリ文字列、ハッシュにアクセスします。まず、動的セグメントを持つルートを定義します：

```typescript
const routes: RouteRecord[] = [
	{
		path: '/user/:userId',
		name: 'user-profile',
		component: UserProfile,
	},
];
```

コンポーネントでパラメータにアクセス：

```tsx
import { define } from '@effuse/core';
import { useRoute } from '@effuse/router';

const UserProfile = define({
	script: () => {
		const route = useRoute();

		return {
			userId: route.params.userId, // パスの :userId にマッチ
			search: route.query.q, // URL の ?q=... にアクセス
		};
	},
	template: ({ userId, search }) => (
		<div class="user-profile">
			<h1>User Profile</h1>
			<p>User ID: {userId}</p>
			{search && <p>Searching for: {search}</p>}
		</div>
	),
});
```

## プログラムによるナビゲーション

`useRouter` フックを使用してプログラムでナビゲートします：

```tsx
import { define } from '@effuse/core';
import { useRouter } from '@effuse/router';

const DashboardButton = define({
	script: () => {
		const router = useRouter();

		return {
			goToSettings: () => {
				router.push('/settings');
			},
		};
	},
	template: ({ goToSettings }) => (
		<button onClick={goToSettings}>Go to Settings</button>
	),
});
```

## ルーターコンポーザブル

### `useRoute()`

現在のルートオブジェクトを返します。ナビゲーションが発生するたびに更新されるリアクティブなプロパティを含みます。

| プロパティ | 型                        | 説明                                                 |
| :--------- | :------------------------ | :--------------------------------------------------- |
| `path`     | `string`                  | ルートのパス名。                                     |
| `fullPath` | `string`                  | クエリとハッシュを含む完全な URL。                   |
| `params`   | `Record<string, string>`  | 動的セグメントのキーバリューペア。                   |
| `query`    | `Record<string, string>`  | クエリ文字列のキーバリューペア。                     |
| `hash`     | `string`                  | URL ハッシュフラグメント。                           |
| `matched`  | `NormalizedRouteRecord[]` | ネストルーティング用のマッチしたルートレコード配列。 |
| `name`     | `string or undefined`     | ルートレコードに付けられた名前。                     |
| `meta`     | `Record<string, any>`     | ルートまたは親に定義されたメタデータ。               |

### `useRouter()`

プログラム制御用のルーターインスタンスを返します。

| メンバー        | シグネチャ / 型                                     | 説明                                                       |
| :-------------- | :-------------------------------------------------- | :--------------------------------------------------------- |
| `currentRoute`  | `Signal<Route>`                                     | 現在のルートのリアクティブシグナル。                       |
| `routes`        | `NormalizedRouteRecord[]`                           | 登録されたすべてのルートの読み取り専用配列。               |
| `isReady`       | `boolean`                                           | ルーターの初期化が完了したかどうか。                       |
| `push`          | `(to: RouteLocation) => void`                       | 新しい URL にナビゲートし、履歴に新しいエントリを追加。    |
| `replace`       | `(to: RouteLocation) => void`                       | 現在のエントリを置き換えて新しい URL にナビゲート。        |
| `back`          | `() => void`                                        | 履歴を1ステップ戻る。                                      |
| `forward`       | `() => void`                                        | 履歴を1ステップ進む。                                      |
| `go`            | `(delta: number) => void`                           | n ステップ戻るまたは進む。                                 |
| `beforeEach`    | `(guard: NavigationGuard) => () => void`            | グローバルナビゲーションガードを追加。登録解除関数を返す。 |
| `beforeResolve` | `(guard: NavigationGuard) => () => void`            | ナビゲーション解決前に呼ばれるガードを追加。               |
| `afterEach`     | `(hook: NavigationHook) => () => void`              | ナビゲーション後に呼ばれるグローバルフックを追加。         |
| `resolve`       | `(to: RouteLocation) => ResolvedRoute`              | ルートロケーションを正規化されたルートオブジェクトに解決。 |
| `hasRoute`      | `(name: string) => boolean`                         | 指定された名前のルートが存在するか確認。                   |
| `addRoute`      | `(route: RouteRecord, parentName?: string) => void` | 新しいルートを動的に追加。                                 |
| `removeRoute`   | `(name: string) => void`                            | 名前でルートを動的に削除。                                 |
| `getRoutes`     | `() => NormalizedRouteRecord[]`                     | すべての正規化されたルートレコードを返す。                 |
