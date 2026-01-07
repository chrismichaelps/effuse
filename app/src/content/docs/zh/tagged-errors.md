---
title: 错误处理
---

# 错误处理

Effuse 提供了一套强大的错误处理系统。该系统利用 **带有标签的错误 (Tagged Errors)** 在整个应用中提供类型安全、可辨识的错误处理。

## TaggedError

`TaggedError` 是一个特殊的类，包含一个 `_tag` 属性。这使得代码可以进行整洁的详尽模式匹配，并确保错误在序列化后依然能保持其身份。

### 定义

```typescript
import { TaggedError } from '@effuse/core';

export class NetworkError extends TaggedError('NetworkError')<{
	readonly url: string;
	readonly status: number;
	readonly message: string;
}> {}
```

### 使用方法

当错误被抛出时，你可以捕获它并使用类型守卫 (Type Guards) 来缩小特定错误类型的范围。

```typescript
import { isTaggedError, hasTag } from '@effuse/core';

try {
	// ... 可能抛出错误的代码
} catch (error) {
	if (hasTag(error, 'NetworkError')) {
		// TypeScript 知道 error 是 NetworkError 类型
		console.error(`状态码 ${error.status}: ${error.message}`);
	} else if (isTaggedError(error)) {
		// 任何其他带有标签的错误
		console.error(`带有标签的错误: ${error._tag}`);
	}
}
```

## 类型守卫

Effuse 导出了两个主要的工具函数来处理带有标签的错误：

### `isTaggedError(value)`

如果值为包含 `string` 类型 `_tag` 属性的 `Error` 对象，则返回 `true`。

### `hasTag(value, tag)`

如果值为具有指定标签的 `TaggedError`，则返回 `true`。这是在 `catch` 块中缩小错误范围最常用的方法。

## 为什么使用 Tagged Errors?

1. **类型安全**: 在 `if` 或 `switch` 块中自动缩小错误属性范围。
2. **序列化支持**: 标准的 JavaScript `instanceof` 在 `JSON.parse()` 后会失效，但 `_tag` 只是一个普通的字符串，在序列化过程中可以保留。
3. **开发体验**: 明确定义了函数可能返回的错误“契约”。
