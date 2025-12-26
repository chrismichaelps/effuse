---
title: コンポーネント
---

# コンポーネント

Effuse のコンポーネントは、ロジックと UI を型安全な構造で組み合わせます。

## 基本構造

すべてのコンポーネントには `script` と `template` があります：

```tsx
import { define } from '@effuse/core';

const Greeting = define({
	script: () => {
		return { message: 'Hello, World!' };
	},
	template: ({ message }) => <h1>{message}</h1>,
});
```

## Props

コンポーネントは親から props を受け取ります。型安全性のためにジェネリクスを使用します：

```tsx
import { define, computed, unref, type Signal } from '@effuse/core';

interface ButtonProps {
	label: string;
	variant?: 'primary' | 'secondary';
	onClick?: () => void;
}

const Button = define<ButtonProps>({
	script: ({ props }) => ({
		label: props.label,
		variant: computed(() => unref(props.variant) ?? 'primary'),
		onClick: props.onClick,
	}),
	template: ({ label, variant, onClick }) => (
		<button class={`btn btn-${variant.value}`} onClick={onClick}>
			{label}
		</button>
	),
});

// 使用方法
<Button label="Click me" variant="primary" onClick={handleClick} />;
```

## ライフサイクルフック

コンポーネントはスクリプトコンテキストを通じてライフサイクルフックにアクセスできます：

```tsx
import { define, signal } from '@effuse/core';

const Timer = define({
	script: ({ onMount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// クリーンアップ関数を返す
			return () => clearInterval(interval);
		});

		return { seconds };
	},
	template: ({ seconds }) => <p>Timer: {seconds} seconds</p>,
});
```

## 安定した参照のための useCallback

安定した参照が必要なイベントハンドラには、スクリプトコンテキストの `useCallback` を使用します：

```tsx
import { define, signal } from '@effuse/core';

const Form = define({
	script: ({ useCallback }) => {
		const inputValue = signal('');

		// イベントハンドラの安定した参照
		const handleInputChange = useCallback((e: Event) => {
			inputValue.value = (e.target as HTMLInputElement).value;
		});

		const handleSubmit = useCallback(() => {
			console.log('Submitted:', inputValue.value);
			inputValue.value = '';
		});

		return { inputValue, handleInputChange, handleSubmit };
	},
	template: ({ inputValue, handleInputChange, handleSubmit }) => (
		<div>
			<input value={inputValue} onInput={handleInputChange} />
			<button onClick={handleSubmit}>Submit</button>
		</div>
	),
});
```

## 子要素

ラッパーコンポーネントを作成するために子要素を渡します：

```tsx
import { define } from '@effuse/core';

const Card = define({
	script: () => ({}),
	template: ({ children }) => <div class="card">{children}</div>,
});

// 使用方法
<Card>
	<h2>Title</h2>
	<p>Content goes here</p>
</Card>;
```

## For によるリストレンダリング

効率的なリストレンダリングには `For` コンポーネントを使用します：

```tsx
import { define, signal, For } from '@effuse/core';

const TodoList = define({
	script: () => {
		const todos = signal([
			{ id: 1, text: 'Learn Effuse' },
			{ id: 2, text: 'Build an app' },
		]);

		return { todos };
	},
	template: ({ todos }) => (
		<ul>
			<For each={todos} keyExtractor={(t) => t.id}>
				{(todoSignal) => <li>{todoSignal.value.text}</li>}
			</For>
		</ul>
	),
});
```
