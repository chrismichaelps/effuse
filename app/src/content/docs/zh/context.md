---
title: 上下文
---

# 上下文 API

Effuse 的上下文 API 提供了一种强大的方式在组件之间共享状态，无需进行 props 传递。它内部使用基于栈的注册表来支持适当的嵌套。

## 创建上下文

使用 `createContext` 定义一个带有可选默认值的新上下文：

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

### 上下文选项

| 属性           | 类型           | 描述                   |
| -------------- | -------------- | ---------------------- |
| `id`           | `string`       | 上下文的唯一标识符     |
| `defaultValue` | `T \| () => T` | 可选的默认值或工厂函数 |
| `displayName`  | `string`       | 用于调试的可读名称     |

## 使用上下文值

使用 `useContext` 在任何组件中消费上下文值：

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
			主题按钮
		</button>
	),
});
```

## 提供上下文值

使用自动生成的 `Provider` 组件来提供值：

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

## 嵌套提供者

上下文值正确地堆叠。内部提供者覆盖外部的：

```tsx
const NestedExample = define({
	template: () => (
		<ThemeContext.Provider value={{ mode: 'dark', primaryColor: '#6366f1' }}>
			{/* 此组件看到深色主题 */}
			<ThemedButton />

			<ThemeContext.Provider value={{ mode: 'light', primaryColor: '#22c55e' }}>
				{/* 此组件看到浅色主题 */}
				<ThemedButton />
			</ThemeContext.Provider>
		</ThemeContext.Provider>
	),
});
```

## 检查上下文可用性

使用 `hasContextValue` 检查上下文值是否存在：

```typescript
import { hasContextValue } from '@effuse/core';

if (hasContextValue(ThemeContext)) {
	const theme = useContext(ThemeContext);
	// ...
}
```

## 类型守卫

使用 `isEffuseContext` 验证值是否是 Effuse 上下文：

```typescript
import { isEffuseContext } from '@effuse/core';

function processContext(maybeContext: unknown) {
	if (isEffuseContext(maybeContext)) {
		console.log('有效的上下文:', maybeContext.id);
	}
}
```

## 错误处理

当上下文未找到且没有默认值时，`useContext` 会抛出 `ContextNotFoundError`：

```typescript
import { useContext, ContextNotFoundError } from '@effuse/core';

try {
	const auth = useContext(AuthContext);
} catch (error) {
	if (error instanceof ContextNotFoundError) {
		console.error(`上下文 "${error.contextId}" 未找到`);
	}
}
```

## 最佳实践

1. **使用描述性 ID**：为你的上下文选择唯一且描述性的 ID
2. **尽可能提供默认值**：使组件更具弹性
3. **保持上下文专注**：每个关注点一个上下文（主题、认证、i18n）
4. **为上下文添加类型**：始终使用 TypeScript 泛型以确保类型安全
5. **使用 displayName**：有助于调试和开发工具
