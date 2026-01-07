---
title: 信号
---

# 信号

信号是 Effuse 响应式系统的基础。它们直接从 `@effuse/core` 导入。

## 创建信号

从 `@effuse/core` 导入 `signal` 来创建响应式状态：

```tsx
import { define, signal, computed } from '@effuse/core';

export const Counter = define({
	script: () => {
		// 创建带有初始值的信号
		const count = signal(0);

		// 创建 computed 派生状态
		const doubleCount = computed(() => count.value * 2);

		// 定义修改信号的操作
		const increment = () => count.value++;
		const decrement = () => count.value--;

		// 将信号和操作返回给模板
		return { count, doubleCount, increment, decrement };
	},
	template: ({ count, doubleCount, increment, decrement }) => (
		<div>
			<p>计数: {count}</p>
			<p>双倍: {doubleCount}</p>
			<button onClick={decrement}>-</button>
			<button onClick={increment}>+</button>
		</div>
	),
});
```

## 响应式类型

### 1. 可写信号

基本的 `signal()` 创建可写引用。通过 `.value` 属性访问和修改。

```tsx
import { define, signal } from '@effuse/core';

const ColorPicker = define({
	script: () => {
		// 原始值
		const color = signal('blue');
		// 对象/数组
		const palette = signal(['red', 'blue', 'green']);

		const updateColor = (newColor: string) => {
			color.value = newColor; // 触发更新
		};

		return { color, palette, updateColor };
	},
	template: ({ color, updateColor }) => (
		<button onClick={() => updateColor('red')}>当前: {color}</button>
	),
});
```

### 2. Computed 信号

Computed 信号从其他信号派生其值。当依赖项更改时自动更新。

```tsx
import { define, signal, computed } from '@effuse/core';

const GradientBox = define({
	script: () => {
		const startColor = signal('red');
		const endColor = signal('blue');

		// 自动跟踪依赖项
		const gradient = computed(
			() => `linear-gradient(${startColor.value}, ${endColor.value})`
		);

		return { gradient };
	},
	template: ({ gradient }) => (
		<div style={`background: ${gradient.value}`}>渐变</div>
	),
});
```

### 3. 监视信号

使用 script 上下文中的 `watch` 辅助函数在信号更改时执行副作用。

```tsx
import { define, signal } from '@effuse/core';

const Logger = define({
	script: ({ watch }) => {
		const count = signal(0);

		// 每当 count 更改时运行
		watch(count, (value) => {
			console.log(`Count 已更改为: ${value}`);
		});

		return { count, increment: () => count.value++ };
	},
	template: ({ count, increment }) => (
		<button onClick={increment}>{count}</button>
	),
});
```

## 在模板中使用信号

信号可以直接在 JSX 中使用 - 它们会自动更新 DOM：

```tsx
// 直接插值 - 自动更新
<p>计数: {count}</p>

// 使用函数的动态类
<button class={() => isActive.value ? 'active' : 'inactive'}>
  切换
</button>

// 使用 computed 的条件渲染
{computed(() => isLoading.value ? <Spinner /> : <Content />)}
```

## 最佳实践

1. **直接导入**: 直接从 `@effuse/core` 导入 `signal` 和 `computed`
2. **暴露信号**: 从 `script` 返回信号对象本身，而不仅仅是值
3. **在处理程序中修改**: 将状态修改逻辑保持在函数处理程序内
4. **需要时使用 Computed**: 优先使用派生状态而非手动同步

## 编译器优化

Effuse 编译器自动处理许多响应式场景：

### 模板中的自动包装

当你在模板中使用表达式时，编译器会自动将它们包装在 computed 信号中。你不需要手动包装每个派生值：

```tsx
// 编译器自动处理这个
template: ({ firstName, lastName }) => (
	<p>
		全名: {firstName} {lastName}
	</p>
);

// 简单情况下不需要显式 computed()
// 编译器将优化绑定
```

### 何时使用显式 `computed()`

在以下情况使用显式 `computed()`：

1. **复杂派生状态** - 多个信号与逻辑组合
2. **从 script 返回** - 暴露给多个消费者的值
3. **性能优化** - 缓存昂贵的计算

```tsx
script: () => {
	const items = signal<Item[]>([]);
	const filter = signal('all');

	// 返回给模板的复杂逻辑使用显式 computed
	const filteredItems = computed(() => {
		const f = filter.value;
		return items.value.filter((item) =>
			f === 'all' ? true : item.status === f
		);
	});

	return { filteredItems, filter };
};
```
