---
title: Props
---

# Props

Props は親コンポーネントから子コンポーネントにデータを渡す方法です。Effuse では、props は完全に型付けされリアクティブです。

## Props の定義

Props を定義するには、`define` 関数の最初のジェネリック引数として TypeScript インターフェースを渡します。`define` 関数は実際には2つのジェネリック引数を受け取ります：

1.  **Props 型 (`P`)**: コンポーネントに渡される props の形状を定義。
2.  **公開値 (`E`)**: `script` 関数が返し、`template` で利用可能なオブジェクトの形状を定義。

```tsx
import { define, signal, type Signal } from '@effuse/core';

interface UserCardProps {
	name: string;
	age: number;
}

interface UserCardExposed {
	capitalizedName: Signal<string>;
}

const UserCard = define<UserCardProps, UserCardExposed>({
	script: ({ props }) => {
		const capitalizedName = signal(props.name.toUpperCase());
		return { capitalizedName };
	},
	template: ({ capitalizedName }, props) => (
		<div class="user-card">
			<h2>{capitalizedName}</h2>
			<p>Age: {props.age}</p>
		</div>
	),
});
```

## Props のリアクティビティ

`script` 関数では、`props` はリアクティブなオブジェクトです。親がシグナルを prop として渡した場合、スクリプト内でその prop にアクセスすると（例：`computed` や `effect` 内で）追跡されます。

```tsx
import { define, computed, unref } from '@effuse/core';

interface CounterProps {
	count: number; // 数値または Signal<number> として渡せる
}

const DoubleCounter = define<CounterProps>({
	script: ({ props }) => {
		// この computed は親の 'count' シグナルが変更されるたびに更新される
		const double = computed(() => unref(props.count) * 2);

		return { double };
	},
	template: ({ double }) => <div>Double count: {double}</div>,
});
```

## デフォルト値

標準的な JavaScript パターンまたはリアクティブなデフォルト用に `computed` を使用してデフォルト値を処理できます。

```tsx
import { define, computed, unref } from '@effuse/core';

interface ButtonProps {
	variant?: 'primary' | 'secondary';
}

const Button = define<ButtonProps>({
	script: ({ props }) => {
		// リアクティブなデフォルト値
		const safeVariant = computed(() => unref(props.variant) ?? 'primary');

		return { safeVariant };
	},
	template: ({ safeVariant, children }) => (
		<button class={`btn btn-${safeVariant.value}`}>{children}</button>
	),
});
```

## Props を渡す

標準的な HTML 属性と同様にコンポーネントに props を渡します。

```tsx
// 静的な値を使用
<UserCard name="Alice" age={30} isAdmin />;

// シグナルを使用
const age = signal(25);
<UserCard name="Bob" age={age} />;
```

シグナル（`age={age}` のように）を渡すと、Effuse は DOM で自動的にアンラップしますが、コンポーネントロジックのリアクティビティ接続は維持されます。

## children Prop

`children` prop は特別です。コンポーネントタグ内に渡されたコンテンツを含みます。

```tsx
const Container = define({
	script: () => ({}),
	template: ({ children }) => <div class="container">{children}</div>,
});

// 使用法
<Container>
	<h1>Hello</h1>
</Container>;
```
