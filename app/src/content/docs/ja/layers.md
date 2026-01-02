---
title: レイヤー
---

# レイヤー

レイヤーは、アプリケーション全体で依存性注入と共有状態を提供します。コンポーネントがpropsのバケツリレーなしにグローバルサービスとリアクティブなpropsにアクセスできるようにします。

## レイヤーの作成

`@effuse/core` の `defineLayer` を使用してレイヤーを作成します：

```typescript
import { defineLayer, signal, computed } from '@effuse/core';

export const ThemeLayer = defineLayer({
	name: 'theme',

	// コンポーネントに公開されるprops
	props: {
		mode: signal<'light' | 'dark'>('dark'),
		accentColor: signal('#8df0cc'),
	},

	// 派生props（自動的にcomputed）
	derived: {
		isDark: (props) => computed(() => props.mode.value === 'dark'),
	},

	// providerを通じて公開されるサービス
	provides: {
		theme: {
			setMode: (mode: 'light' | 'dark') => {
				/* ... */
			},
			toggleMode: () => {
				/* ... */
			},
		},
	},

	// 初期化ロジック
	setup: (ctx) => {
		// ctx.storeはpropsへの型付きアクセスを含む
		const savedTheme = localStorage.getItem('theme');
		if (savedTheme) {
			ctx.store.mode.value = savedTheme as 'light' | 'dark';
		}
	},
});
```

## コンポーネントでのレイヤーの使用

コンポーネントのscriptでレイヤーのpropsとproviderにアクセスします：

```tsx
import { define, computed } from '@effuse/core';

const ThemeToggle = define({
	script: ({ useLayerProps, useLayerProvider }) => {
		// レイヤーからリアクティブなpropsを取得
		const themeProps = useLayerProps('theme')!;

		// レイヤーからサービスを取得
		const themeProvider = useLayerProvider('theme')!;

		const buttonText = computed(() =>
			themeProps.mode.value === 'dark' ? 'ライト' : 'ダーク'
		);

		const toggle = () => {
			themeProvider.theme.toggleMode();
		};

		return { buttonText, toggle };
	},
	template: ({ buttonText, toggle }) => (
		<button onClick={toggle}>{buttonText}</button>
	),
});
```

## レイヤーProps vs Provider

| 概念         | 目的                 | アクセス方法               |
| ------------ | -------------------- | -------------------------- |
| **Props**    | リアクティブな状態値 | `useLayerProps('名前')`    |
| **Provider** | サービスとアクション | `useLayerProvider('名前')` |

**Props** は読み取りと購読を行うシグナルです。**Providers** はメソッドとサービスを公開します。

## 型付きストアアクセス

レイヤーはsetup関数でストアへの型付きアクセスを持ちます：

```typescript
setup: (ctx) => {
	// ctx.storeはprops定義に基づいて型付けされています
	ctx.store.mode.value = 'dark'; // 完全な型安全性
	ctx.store.init(); // メソッドがある場合
};
```

## Propsの派生

`derived` を使用してpropsに依存する計算値を作成します：

```typescript
derived: {
  // modeが変更されると自動的に更新
  backgroundColor: (props) => computed(() =>
    props.mode.value === 'dark' ? '#0a0f12' : '#ffffff'
  ),

  // 複数のpropsに依存可能
  theme: (props) => computed(() => ({
    mode: props.mode.value,
    accent: props.accentColor.value,
  })),
}
```

## レイヤーレジストリ

レイヤーは自動的に登録されます。型システムは登録されたすべてのレイヤーを認識します：

```typescript
// これらはレイヤー定義に基づいて完全に型付けされています
const i18nProps = useLayerProps('i18n'); // i18nレイヤーのpropsを認識
const themeProvider = useLayerProvider('theme'); // themeサービスを認識
```

## 型レジストリ（Module Augmentation）

レイヤーのpropsとprovidesへの型安全なアクセスを有効にするには、TypeScriptのmodule augmentationを使用して `EffuseLayerRegistry` インターフェースを拡張します。

> **なぜ手動?** コード生成はビルドを複雑にし、レイヤー変更時にスクリプト再実行が必要。Module augmentationはIDEで即座に動作し、TSエコシステムの標準パターンです。

プロジェクトに `.d.ts` ファイルを作成します（例：`src/layers/effuse.d.ts`）：

```typescript
import type { Signal, ReadonlySignal } from '@effuse/core';

// プロバイダーの型を定義
interface ThemeProvider {
	setMode: (mode: 'light' | 'dark') => void;
	toggleMode: () => void;
}

interface I18nProvider {
	setLocale: (locale: string) => Promise<void>;
	t: (key: string) => string;
}

declare module '@effuse/core' {
	interface EffuseLayerRegistry {
		theme: {
			props: {
				mode: Signal<'light' | 'dark'>;
				accentColor: Signal<string>;
			};
			provides: { theme: ThemeProvider };
		};
		i18n: {
			props: {
				locale: Signal<string>;
				translations: Signal<Record<string, string> | null>;
			};
			provides: { i18n: I18nProvider };
		};
	}
}

export {};
```

これにより、`useLayerProps` と `useLayerProvider` を使用する際に完全な型推論が有効になります：

```typescript
// TypeScriptがこれらの型を自動的に認識します！
const themeProps = useLayerProps('theme');
// ^? { mode: Signal<'light' | 'dark'>; accentColor: Signal<string> }

const i18n = useLayerProvider('i18n');
// ^? { i18n: I18nProvider }
```

> **注意**: 最後の `export {}` はファイルがモジュールとして扱われることを保証し、これはmodule augmentationが機能するために必要です。

## ベストプラクティス

1. **ドメインごとに1つのレイヤー**: 焦点を絞ったレイヤーを作成（auth、i18n、themeなど）
2. **状態にはProps**: コンポーネントが購読するリアクティブな値には `props` を使用
3. **アクションにはProvider**: メソッドとサービスには `provides` を使用
4. **計算にはDerived**: コンポーネントで計算する代わりに `derived` を使用
5. **初期化にはSetup**: 初期化ロジック（localStorage、API呼び出し）には `setup` を使用
