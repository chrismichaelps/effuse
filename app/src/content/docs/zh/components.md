---
title: 组件
---

# 组件

Effuse 中的组件以类型安全的结构组合逻辑和 UI。

## 基本结构

每个组件都有 `script` 和 `template`：

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

组件从父组件接收 props。使用泛型实现类型安全：

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

## 生命周期钩子

组件通过脚本上下文访问生命周期钩子：

```tsx
import { define, signal } from '@effuse/core';

const Timer = define({
	script: ({ onMount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// 返回清理函数
			return () => clearInterval(interval);
		});

		return { seconds };
	},
	template: ({ seconds }) => <p>Timer: {seconds} seconds</p>,
});
```

## 使用 useCallback 获取稳定引用

对于需要稳定引用的事件处理程序，使用脚本上下文中的 `useCallback`：

```tsx
import { define, signal } from '@effuse/core';

const Form = define({
	script: ({ useCallback }) => {
		const inputValue = signal('');

		// 事件处理程序的稳定引用
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

## 子元素

传递子元素以创建包装组件：

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

## 使用 For 进行列表渲染

使用 `For` 组件进行高效的列表渲染：

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
