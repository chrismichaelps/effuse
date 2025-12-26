---
title: クイックスタート
---

# コンポーネント API

Effuse コンポーネントは `define` 関数を使用して作成され、ロジックとレンダリングを定義するための型安全なスキーマを提供します。

## 1. define

`define` 関数はコンポーネント作成のエントリーポイントです：

```tsx
import {
	define,
	signal,
	computed,
	type Signal,
	type ReadonlySignal,
} from '@effuse/core';

interface Props {
	title: string;
}

interface Exposed {
	count: Signal<number>;
	doubleCount: ReadonlySignal<number>;
	increment: () => void;
}

export const Counter = define<Props, Exposed>({
	script: ({ props }) => {
		const count = signal(0);
		const doubleCount = computed(() => count.value * 2);
		const increment = () => count.value++;

		return { count, doubleCount, increment };
	},
	template: ({ count, doubleCount, increment }, props) => (
		<div>
			<h1>{props.title}</h1>
			<p>Count: {count}</p>
			<p>Double: {doubleCount}</p>
			<button onClick={increment}>+</button>
		</div>
	),
});
```

## 2. script

`script` 関数はコンポーネントのロジックを含みます。`ScriptContext` を受け取り、テンプレート用の値を返します。

### ScriptContext プロパティ

| プロパティ        | 型                      | 説明                                               |
| ----------------- | ----------------------- | -------------------------------------------------- |
| `props`           | `Readonly<P>`           | 親から渡されたプロパティ。読み取り専用で凍結。     |
| `expose`          | `(values) => void`      | テンプレートに値を手動で公開。                     |
| `signal`          | `(initial) => Signal`   | 新しいリアクティブシグナルを作成。                 |
| `store`           | `(name) => T`           | 名前でグローバルストアにアクセス。                 |
| `router`          | `Router`                | ルーターインスタンスにアクセス。                   |
| `onMount`         | `(cb) => void`          | マウント後のコールバック。クリーンアップを返せる。 |
| `onUnmount`       | `(cb) => void`          | DOM から削除されたときのコールバック。             |
| `onBeforeMount`   | `(cb) => void`          | マウント前のコールバック。                         |
| `onBeforeUnmount` | `(cb) => void`          | アンマウント前のコールバック。                     |
| `watch`           | `(source, cb) => void`  | シグナルを監視し変更時にコールバック実行。         |
| `useCallback`     | `(fn, deps?) => fn`     | 安定したアイデンティティのメモ化コールバック。     |
| `useMemo`         | `(fn, deps?) => getter` | 計算値をメモ化。                                   |

## 3. template

`template` 関数は JSX 構造を返します。公開された値と props を受け取ります：

```tsx
template: ({ count, increment, children }, props) => (
	<div class="counter">
		<h1>{props.title}</h1>
		<p>Count: {count}</p>
		<button onClick={increment}>+</button>
		{children}
	</div>
);
```

## 4. イベントハンドラ用の useCallback

安定したイベントハンドラ参照のためにスクリプトコンテキストから `useCallback` を使用：

```tsx
const Form = define({
	script: ({ useCallback }) => {
		const value = signal('');

		const handleChange = useCallback((e: Event) => {
			value.value = (e.target as HTMLInputElement).value;
		});

		const handleSubmit = useCallback(() => {
			console.log('Submitted:', value.value);
			value.value = '';
		});

		return { value, handleChange, handleSubmit };
	},
	template: ({ value, handleChange, handleSubmit }) => (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				handleSubmit();
			}}
		>
			<input value={value} onInput={handleChange} />
			<button type="submit">Submit</button>
		</form>
	),
});
```

## 5. ライフサイクルの例

```tsx
const Timer = define({
	script: ({ onMount, onUnmount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// クリーンアップ関数を返す
			return () => clearInterval(interval);
		});

		onUnmount(() => {
			console.log('Timer component removed');
		});

		return { seconds };
	},
	template: ({ seconds }) => <p>Elapsed: {seconds} seconds</p>,
});
```

## 6. リアクティブなクラスとスタイル

動的クラス名には関数を使用：

```tsx
<button class={() => (isActive.value ? 'btn btn-active' : 'btn btn-inactive')}>
	Toggle
</button>
```

## 7. 条件付きレンダリング

リアクティブな条件付きレンダリングには `computed` を使用：

```tsx
{
	computed(() =>
		isLoading.value ? <div>Loading...</div> : <div>Content</div>
	);
}
```
