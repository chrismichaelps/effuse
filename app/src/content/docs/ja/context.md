---
title: コンテキスト
---

# コンテキスト API

Effuse のコンテキスト API は、プロップドリリングなしでコンポーネント間で状態を共有する強力な方法を提供します。適切なネスティングサポートのために、内部的にスタックベースのレジストリを使用しています。

## コンテキストの作成

`createContext` を使用して、オプションのデフォルト値を持つ新しいコンテキストを定義します：

```typescript
import { createContext } from '@effuse/core';

interface ThemeConfig {
	mode: 'light' | 'dark';
	primaryColor: string;
}

const ThemeContext = createContext<ThemeConfig>({
	id: 'theme',
	defaultValue: {
		mode: 'dark',
		primaryColor: '#6366f1',
	},
	displayName: 'Theme',
});
```

### コンテキストオプション

| プロパティ     | 型             | 説明                                         |
| -------------- | -------------- | -------------------------------------------- |
| `id`           | `string`       | コンテキストの一意の識別子                   |
| `defaultValue` | `T \| () => T` | オプションのデフォルト値またはファクトリ関数 |
| `displayName`  | `string`       | デバッグ用の人間が読める名前                 |

## コンテキスト値の使用

`useContext` を使用して、任意のコンポーネントでコンテキスト値を消費します：

```tsx
import { define, useContext } from '@effuse/core';
import { ThemeContext } from './contexts';

const ThemedButton = define({
	script: () => {
		const theme = useContext(ThemeContext);

		return { theme };
	},
	template: ({ theme }) => (
		<button
			style={{
				backgroundColor: theme.primaryColor,
				color: theme.mode === 'dark' ? '#fff' : '#000',
			}}
		>
			テーマ付きボタン
		</button>
	),
});
```

## コンテキスト値の提供

自動生成された `Provider` コンポーネントを使用して値を提供します：

```tsx
import { define } from '@effuse/core';
import { ThemeContext } from './contexts';

const App = define({
	script: () => {
		const customTheme = {
			mode: 'light' as const,
			primaryColor: '#22c55e',
		};

		return { customTheme };
	},
	template: ({ customTheme }) => (
		<ThemeContext.Provider value={customTheme}>
			<ThemedButton />
			<NestedComponent />
		</ThemeContext.Provider>
	),
});
```

## ネストされたプロバイダー

コンテキスト値は適切にスタックされます。内側のプロバイダーは外側のものを上書きします：

```tsx
const NestedExample = define({
	template: () => (
		<ThemeContext.Provider value={{ mode: 'dark', primaryColor: '#6366f1' }}>
			{/* このコンポーネントはダークテーマを見ます */}
			<ThemedButton />

			<ThemeContext.Provider value={{ mode: 'light', primaryColor: '#22c55e' }}>
				{/* このコンポーネントはライトテーマを見ます */}
				<ThemedButton />
			</ThemeContext.Provider>
		</ThemeContext.Provider>
	),
});
```

## コンテキストの可用性の確認

`hasContextValue` を使用してコンテキスト値が存在するかどうかを確認します：

```typescript
import { hasContextValue } from '@effuse/core';

if (hasContextValue(ThemeContext)) {
	const theme = useContext(ThemeContext);
	// ...
}
```

## 型ガード

`isEffuseContext` を使用して、値が Effuse コンテキストかどうかを確認します：

```typescript
import { isEffuseContext } from '@effuse/core';

function processContext(maybeContext: unknown) {
	if (isEffuseContext(maybeContext)) {
		console.log('有効なコンテキスト:', maybeContext.id);
	}
}
```

## エラーハンドリング

コンテキストが見つからず、デフォルト値がない場合、`useContext` は `ContextNotFoundError` をスローします：

```typescript
import { useContext, ContextNotFoundError } from '@effuse/core';

try {
	const auth = useContext(AuthContext);
} catch (error) {
	if (error instanceof ContextNotFoundError) {
		console.error(`コンテキスト "${error.contextId}" が見つかりません`);
	}
}
```

## ベストプラクティス

1. **説明的な ID を使用する**: コンテキストにユニークで説明的な ID を選択
2. **可能な場合はデフォルト値を提供する**: コンポーネントをより堅牢にします
3. **コンテキストを焦点を絞る**: 懸念事項ごとに1つのコンテキスト（テーマ、認証、i18n）
4. **コンテキストを型付けする**: 型安全性のために常に TypeScript ジェネリックを使用
5. **displayName を使用する**: デバッグと devtools に役立ちます
