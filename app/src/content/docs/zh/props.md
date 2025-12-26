---
title: Props
---

# Props

Props 是从父组件向子组件传递数据的方式。在 Effuse 中，props 是完全类型化且响应式的。

## 定义 Props

要定义 props，需要将 TypeScript 接口作为第一个泛型参数传递给 `define` 函数。`define` 函数实际上接受两个泛型参数：

1.  **Props 类型 (`P`)**: 定义传递给组件的 props 的形状。
2.  **公开值 (`E`)**: 定义由 `script` 函数返回并在 `template` 中可用的对象形状。

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

## Props 的响应式

在 `script` 函数中，`props` 是一个响应式对象。如果父组件传递一个信号作为 prop，在脚本中访问该 prop（例如在 `computed` 或 `effect` 中）会进行追踪。

```tsx
import { define, computed, unref } from '@effuse/core';

interface CounterProps {
	count: number; // 可以作为数字或 Signal<number> 传递
}

const DoubleCounter = define<CounterProps>({
	script: ({ props }) => {
		// 当父组件的 'count' 信号更改时，此 computed 将更新
		const double = computed(() => unref(props.count) * 2);

		return { double };
	},
	template: ({ double }) => <div>Double count: {double}</div>,
});
```

## 默认值

可以使用标准 JavaScript 模式或使用 `computed` 处理响应式默认值。

```tsx
import { define, computed, unref } from '@effuse/core';

interface ButtonProps {
	variant?: 'primary' | 'secondary';
}

const Button = define<ButtonProps>({
	script: ({ props }) => {
		// 响应式默认值
		const safeVariant = computed(() => unref(props.variant) ?? 'primary');

		return { safeVariant };
	},
	template: ({ safeVariant, children }) => (
		<button class={`btn btn-${safeVariant.value}`}>{children}</button>
	),
});
```

## 传递 Props

像标准 HTML 属性一样将 props 传递给组件。

```tsx
// 使用静态值
<UserCard name="Alice" age={30} isAdmin />;

// 使用信号
const age = signal(25);
<UserCard name="Bob" age={age} />;
```

注意，当传递信号（如 `age={age}`）时，Effuse 会在 DOM 中自动解包，但保持组件逻辑的响应式连接。

## children Prop

`children` prop 是特殊的。它包含在组件标签内传递的内容。

```tsx
const Container = define({
	script: () => ({}),
	template: ({ children }) => <div class="container">{children}</div>,
});

// 用法
<Container>
	<h1>Hello</h1>
</Container>;
```
