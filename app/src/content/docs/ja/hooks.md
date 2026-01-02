---
title: Hooks
---

# フック

Effuse のフックは、ライフサイクル管理が組み込まれた再利用可能で組み合わせ可能なロジックを提供します。`@effuse/core` の `defineHook` を使用してカスタムフックを作成します。

## フックの作成

`defineHook` を使用して型付きの再利用可能なフックを作成します：

```typescript
import { defineHook, type Signal } from '@effuse/core';

interface ToggleConfig {
	initial?: boolean;
}

interface ToggleReturn {
	isOpen: Signal<boolean>;
	toggle: () => void;
	open: () => void;
	close: () => void;
}

export const useToggle = defineHook<ToggleConfig, readonly [], ToggleReturn>({
	name: 'useToggle',
	setup: ({ config, signal }): ToggleReturn => {
		const isOpen = signal(config.initial ?? false);

		return {
			isOpen,
			toggle: () => {
				isOpen.value = !isOpen.value;
			},
			open: () => {
				isOpen.value = true;
			},
			close: () => {
				isOpen.value = false;
			},
		};
	},
});
```

## フックコンテキスト

`setup` 関数は以下のユーティリティを持つコンテキストオブジェクトを受け取ります：

| プロパティ      | 説明                                           |
| --------------- | ---------------------------------------------- |
| `config`        | フック呼び出し時に渡された設定                 |
| `signal`        | リアクティブシグナルを作成                     |
| `computed`      | 派生計算値を作成                               |
| `effect`        | 依存関係を追跡する副作用を実行                 |
| `onMount`       | フックがマウントされたときのコールバックを登録 |
| `layer`         | 名前でレイヤーの props にアクセス              |
| `layerProvider` | レイヤーサービスにアクセス                     |
| `scope`         | クリーンアップとファイナライザーを管理         |

## コンポーネントでのフックの使用

コンポーネントの `script` 関数でフックを呼び出します：

```tsx
import { define } from '@effuse/core';
import { useToggle } from '../hooks';

const Dropdown = define({
	script: ({ onMount }) => {
		const menu = useToggle({ initial: false });

		return {
			isOpen: menu.isOpen,
			toggle: menu.toggle,
		};
	},
	template: ({ isOpen, toggle }) => (
		<div>
			<button onClick={toggle}>{isOpen.value ? '閉じる' : '開く'}</button>
			{isOpen.value && <div class="menu">メニューコンテンツ</div>}
		</div>
	),
});
```

## DOM依存フック

DOMアクセスが必要なフックには、遅延初期化パターンを使用します：

```typescript
import { defineHook, type Signal } from '@effuse/core';

interface ClickOutsideConfig {
	selector: string;
}

interface ClickOutsideReturn {
	onClickOutside: (callback: () => void) => void;
	init: () => void;
}

export const useClickOutside = defineHook<
	ClickOutsideConfig,
	readonly [],
	ClickOutsideReturn
>({
	name: 'useClickOutside',
	setup: ({ config, signal, effect }): ClickOutsideReturn => {
		const initialized = signal(false);
		let callback: (() => void) | null = null;

		effect(() => {
			if (!initialized.value) return undefined;

			const handleClick = (e: Event) => {
				const target = e.target as HTMLElement;
				if (!target.closest(config.selector)) {
					callback?.();
				}
			};

			document.addEventListener('click', handleClick);
			return () => document.removeEventListener('click', handleClick);
		});

		return {
			onClickOutside: (cb) => {
				callback = cb;
			},
			init: () => {
				initialized.value = true;
			},
		};
	},
});
```

## フックからレイヤーへのアクセス

フックはレイヤーの状態とサービスにアクセスできます：

```typescript
import { defineHook } from '@effuse/core';

export const useTranslation = defineHook<
	undefined,
	readonly ['i18n'],
	{ t: (key: string) => string }
>({
	name: 'useTranslation',
	deps: ['i18n'],
	setup: ({ layer }) => {
		const i18n = layer('i18n');
		const translations = i18n.translations;

		return {
			t: (key: string) => translations.value?.[key] ?? key,
		};
	},
});
```

## クリーンアップ

エフェクトはコンポーネントがアンマウントされると自動的にクリーンアップされます。`effect` からクリーンアップ関数を返します：

```typescript
effect(() => {
	const handler = () => {
		/* ... */
	};
	window.addEventListener('resize', handler);

	// クリーンアップはエフェクトが再実行されるかコンポーネントがアンマウントされるときに実行
	return () => window.removeEventListener('resize', handler);
});
```
