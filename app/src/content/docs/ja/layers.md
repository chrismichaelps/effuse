---
title: レイヤー
---

# レイヤー

レイヤーは、アプリケーション全体で依存性注入、共有状態、およびライフサイクル管理を提供します。コンポーネントとフックがpropsのバケツリレーなしにグローバルサービスにアクセスできるようにします。

## 概要

レイヤーシステムは3つの主要な概念で構成されています:

| 概念            | 目的                                     | コンポーネントでのアクセス                     |
| --------------- | ---------------------------------------- | ---------------------------------------------- |
| **store**       | リアクティブな状態コンテナ（signals）    | `deriveProps` 経由 → `useLayerProps`           |
| **deriveProps** | storeからコンポーネント用のsignalsを抽出 | `useLayerProps('名前')`                        |
| **provides**    | 依存性注入用のサービス/ファクトリー      | `useStore('キー')` または `useService('キー')` |

## レイヤーの作成

`@effuse/core` の `defineLayer` を使用:

```typescript
import { defineLayer, signal } from '@effuse/core';
import { createStore } from '@effuse/store';

// リアクティブな状態を持つstoreを作成
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

	// 他のレイヤーへの依存関係（先に読み込まれる）
	dependencies: ['layout'],

	// このレイヤーのstoreインスタンス
	store: themeStore,

	// コンポーネント用にstoreからリアクティブなpropsを抽出
	deriveProps: (store) => ({
		mode: store.mode,
		accentColor: store.accentColor,
	}),

	// 依存性注入を通じて公開されるサービス
	provides: {
		theme: () => themeStore,
	},

	// ライフサイクルフック
	onMount: (ctx) => {
		// ctx.store, ctx.deps, ctx.getService が利用可能
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme) ctx.store.mode.value = savedTheme as 'light' | 'dark';
	},

	onUnmount: (ctx) => {
		// アンマウント前に状態を保存
		localStorage.setItem('theme', ctx.store.mode.value);
	},

	onError: (error, ctx) => {
		// コンテキストアクセスによる高度なリカバリ
		console.error('[ThemeLayer] エラー:', error.message);
		ctx.store.mode.value = 'dark'; // フォールバック
	},

	onReady: (ctx, allLayers) => {
		// すべてのレイヤーが初期化された後に呼び出されます
		console.log(`[ThemeLayer] ${allLayers.length}個のレイヤーで準備完了`);
	},

	// storeと依存関係にアクセスできるsetup関数
	setup: (ctx) => {
		// ctx.storeは完全な型安全性を持つthemeStore
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme === 'light' || savedTheme === 'dark') {
			ctx.store.mode.value = savedTheme;
		}

		// クリーンアップ関数を返す（オプション）
		return () => {
			console.log('[ThemeLayer] クリーンアップ');
		};
	},
});
```

## レイヤースキーマ

`defineLayer` の完全なオプション:

```typescript
interface EffuseLayer<P, D, S> {
	// 必須
	name: string; // 一意の識別子

	// 状態管理
	store?: S; // Storeインスタンス（createStore）
	deriveProps?: (store: S) => P; // storeからpropsを抽出

	// 依存性注入
	dependencies?: D; // 先に読み込むレイヤー名の配列
	provides?: Record<string, () => unknown>; // サービスファクトリー

	// ライフサイクル
	setup?: (ctx: SetupContext<P, D, S>) => CleanupFn | void;
	onMount?: (ctx: SetupContext<P, D, S>) => void;
	onUnmount?: (ctx: SetupContext<P, D, S>) => void;
	onError?: (error: Error, ctx: SetupContext<P, D, S>) => void;
	onReady?: (ctx: SetupContext<P, D, S>, allLayers: ResolvedLayer[]) => void;

	// 上級
	components?: Record<string, Component>; // スコープ付きコンポーネント
	routes?: RouteConfig[]; // レイヤー固有のルート
	plugins?: PluginFn[]; // レイヤープラグイン
}
```

## store vs provides

| 側面                 | `store`                      | `provides`                            |
| -------------------- | ---------------------------- | ------------------------------------- |
| **目的**             | レイヤーのリアクティブ状態   | 依存性注入サービス                    |
| **保持するもの**     | `createStore()` インスタンス | ファクトリー関数 `{ キー: () => 値 }` |
| **使用場所**         | `deriveProps(store)` → props | コンポーネントで `useStore('キー')`   |
| **リアクティビティ** | 組み込みのsignals            | 返すもの次第                          |

### store

**store** は `@effuse/store` で作成されるレイヤーの内部リアクティブ状態です:

```typescript
const i18nStore = createStore('i18n', {
	locale: 'en',
	translations: null as Record<string, string> | null,

	setLocale(loc: string) {
		this.locale.value = loc;
		// 翻訳を読み込む...
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

**provides** は依存性注入用のサービスを公開します:

```typescript
defineLayer({
	name: 'router',
	provides: {
		router: () => routerInstance, // ファクトリー関数
	},
});

// コンポーネント内:
script: ({ useStore }) => {
	const router = useStore('router'); // routerを取得
};
```

## コンポーネントでのレイヤーの使用

コンポーネントスクリプトでレイヤーのデータとサービスにアクセス:

```tsx
import { define, computed } from '@effuse/core';

const ThemeToggle = define({
	script: ({ useLayerProps, useStore }) => {
		// derivePropからリアクティブなpropsを取得
		const themeProps = useLayerProps('theme');

		// providesからサービスを取得
		const themeStore = useStore('theme');

		const buttonText = computed(() =>
			themeProps?.mode.value === 'dark' ? 'ライト' : 'ダーク'
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

## フックでのレイヤーの使用

`defineHook` を使用してレイヤーアクセスを持つ再利用可能なフックを作成:

```typescript
import { defineHook, signal } from '@effuse/core';

export const useTheme = defineHook<
	undefined, // 設定なし
	{ mode: Signal<string>; toggle: () => void }
>({
	name: 'useTheme',
	deps: ['theme'] as const,
	setup: ({ layer }) => {
		// layer() は deriveProps の結果を返す
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

## レイヤー依存関係

レイヤーは依存関係を明示的に宣言します:

```typescript
defineLayer({
	name: 'todos',
	dependencies: ['i18n', 'router'], // ← 先に読み込む必要がある
	setup: (ctx) => {
		// 依存レイヤーにアクセス
		const i18n = ctx.deps.i18n;
		const router = ctx.deps.router;
	},
});
```

レイヤーランタイムは依存関係が正しい順序で初期化されることを保証します。

## 型レジストリ

完全な型安全性のため、module augmentationで `EffuseLayerRegistry` を拡張:

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

これにより型推論が有効になります:

```typescript
const { mode } = useLayerProps('theme')!;
//      ^? Signal<'light' | 'dark'>
```

## 実践例: I18nレイヤー

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
		ctx.store.setLocale('en'); // フォールバック
	},

	onReady: (ctx, allLayers) => {
		console.log(`[I18nLayer] ${allLayers.length}個のレイヤーで準備完了`);
	},

	setup: (ctx) => {
		ctx.store.init(); // 初期翻訳をできるだけ早く読み込む
	},
});
```

## ベストプラクティス

1. **ドメインごとに1つのレイヤー** - 焦点を絞ったレイヤーを作成（auth、i18n、theme、todos）
2. **状態にはStore** - リアクティブな値には `store` + `deriveProps` を使用
3. **サービスにはProvides** - メソッド、store、サービスには `provides` を使用
4. **依存関係を宣言** - 必要なすべてのレイヤーを `dependencies` にリスト
5. **初期化にはSetup** - 初期化には `setup` を使用（localStorage、API呼び出し）
6. **Setupでクリーンアップ** - 必要に応じて `setup` からクリーンアップ関数を返す
7. **型レジストリ** - 型安全なレイヤーアクセスにはmodule augmentationを使用
