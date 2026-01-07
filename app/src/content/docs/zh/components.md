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

### For 的 Props

| Prop           | 类型                                           | 描述                     |
| -------------- | ---------------------------------------------- | ------------------------ |
| `each`         | `Signal<T[]>`                                  | 包含要迭代数组的信号     |
| `keyExtractor` | `(item: T, index: number) => string or number` | 提取唯一键的函数         |
| `fallback`     | `JSX.Element`                                  | 数组为空时显示的可选元素 |

## 使用 Show 进行条件渲染

使用 `Show` 组件基于信号值进行条件渲染：

```tsx
import { define, signal, Show } from '@effuse/core';

const UserProfile = define({
	script: () => {
		const user = signal<{ name: string } | null>(null);
		const login = () => {
			user.value = { name: '小明' };
		};
		const logout = () => {
			user.value = null;
		};

		return { user, login, logout };
	},
	template: ({ user, login, logout }) => (
		<div>
			<Show when={user} fallback={<button onClick={login}>登录</button>}>
				{(u) => (
					<div>
						<p>欢迎，{u.name}！</p>
						<button onClick={logout}>退出登录</button>
					</div>
				)}
			</Show>
		</div>
	),
});
```

### Show 的 Props

| Prop       | 类型                        | 描述                 |
| ---------- | --------------------------- | -------------------- |
| `when`     | `Signal<T>` 或 `() => T`    | 要评估的条件         |
| `fallback` | `JSX.Element`               | 条件为假时显示的元素 |
| `children` | `(value: T) => JSX.Element` | 接收真值的渲染函数   |

## Dynamic 组件

`Dynamic` 组件允许您基于信号动态渲染不同的组件：

```tsx
import { define, signal, Dynamic } from '@effuse/core';

const TabPanel = define({
	script: () => {
		const tabs = { home: HomeTab, settings: SettingsTab, profile: ProfileTab };
		const activeTab = signal<keyof typeof tabs>('home');

		const currentComponent = computed(() => tabs[activeTab.value]);

		return { activeTab, currentComponent };
	},
	template: ({ activeTab, currentComponent }) => (
		<div>
			<nav>
				<button
					onClick={() => {
						activeTab.value = 'home';
					}}
				>
					首页
				</button>
				<button
					onClick={() => {
						activeTab.value = 'settings';
					}}
				>
					设置
				</button>
				<button
					onClick={() => {
						activeTab.value = 'profile';
					}}
				>
					个人资料
				</button>
			</nav>
			<Dynamic component={currentComponent} fallback={<p>加载中...</p>} />
		</div>
	),
});
```

### Dynamic 的 Props

| Prop        | 类型                                     | 描述                     |
| ----------- | ---------------------------------------- | ------------------------ |
| `component` | `Signal<Component>` 或 `() => Component` | 动态渲染的组件           |
| `props`     | `P`                                      | 传递给渲染组件的 Props   |
| `fallback`  | `JSX.Element`                            | 组件为 null 时显示的元素 |
| `portals`   | `Portals`                                | 渲染组件的门户配置       |

## 动态样式

使用响应式函数实现动态样式和类：

```tsx
import { define, signal, computed } from '@effuse/core';

const ColorBox = define({
	script: () => {
		const colors = ['mint', 'purple', 'cyan'];
		const index = signal(0);
		const currentColor = computed(() => colors[index.value]);
		const nextColor = () => {
			index.value = (index.value + 1) % colors.length;
		};

		return { currentColor, nextColor };
	},
	template: ({ currentColor, nextColor }) => (
		<div>
			<button onClick={nextColor}>更换颜色</button>
			<div
				style={() => ({
					backgroundColor: `var(--accent-${currentColor.value})`,
					padding: '2rem',
					transition: 'background-color 0.3s ease',
				})}
			>
				当前: {currentColor.value}
			</div>
		</div>
	),
});
```

### 动态类

```tsx
<div class={() => `card ${isActive.value ? 'active' : ''}`}>内容</div>
```
