---
title: 快速开始
---

# 组件 API

Effuse 组件使用 `define` 函数创建，它为定义逻辑和渲染提供类型安全的模式。

## 1. define

`define` 函数是创建组件的入口点：

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

`script` 函数包含组件的逻辑。它接收 `ScriptContext` 并返回模板的值。

### ScriptContext 属性

| 属性              | 类型                    | 描述                             |
| ----------------- | ----------------------- | -------------------------------- |
| `props`           | `Readonly<P>`           | 从父组件传递的属性。只读且冻结。 |
| `expose`          | `(values) => void`      | 手动向模板公开值。               |
| `signal`          | `(initial) => Signal`   | 创建新的响应式信号。             |
| `store`           | `(name) => T`           | 按名称访问全局存储。             |
| `router`          | `Router`                | 访问路由器实例。                 |
| `onMount`         | `(cb) => void`          | 挂载后的回调。可返回清理函数。   |
| `onUnmount`       | `(cb) => void`          | 从 DOM 移除时的回调。            |
| `onBeforeMount`   | `(cb) => void`          | 挂载前的回调。                   |
| `onBeforeUnmount` | `(cb) => void`          | 卸载前的回调。                   |
| `watch`           | `(source, cb) => void`  | 监视信号并在更改时运行回调。     |
| `useCallback`     | `(fn, deps?) => fn`     | 具有稳定标识的记忆化回调。       |
| `useMemo`         | `(fn, deps?) => getter` | 记忆化计算值。                   |

## 3. template

`template` 函数返回 JSX 结构。它接收公开的值和 props：

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

## 4. 事件处理程序的 useCallback

使用脚本上下文中的 `useCallback` 获取稳定的事件处理程序引用：

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

## 5. 生命周期示例

```tsx
const Timer = define({
	script: ({ onMount, onUnmount }) => {
		const seconds = signal(0);

		onMount(() => {
			const interval = setInterval(() => {
				seconds.value++;
			}, 1000);

			// 返回清理函数
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

## 6. 响应式类和样式

对动态类名使用函数：

```tsx
<button class={() => (isActive.value ? 'btn btn-active' : 'btn btn-inactive')}>
	Toggle
</button>
```

## 7. 条件渲染

使用 `computed` 进行响应式条件渲染：

```tsx
{
	computed(() =>
		isLoading.value ? <div>Loading...</div> : <div>Content</div>
	);
}
```
