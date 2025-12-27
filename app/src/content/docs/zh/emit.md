---
title: 事件发送 (useEmits)
---

# 事件发送 (useEmits)

Effuse 通过 `useEmits` 钩子提供了一个强大且类型安全的事件发送系统。它使组件能够通过事件进行通信，同时保持与 Effuse 信号系统的完全响应性。

## 核心概念

发送系统围绕三个主要概念构建：

1. **类型安全事件**：在接口中定义您的事件类型，以获得完整的 TypeScript 推断
2. **响应式信号**：每个发送的事件也存储在响应式信号中，用于 UI 绑定
3. **订阅模式**：通过自动清理功能订阅和取消订阅事件

## 基本用法

### 定义事件类型

首先定义一个描述您的事件的接口：

```typescript
interface ChatEvents {
  message: { text: string; author: string; timestamp: number };
  userJoined: { userId: string; name: string };
  userLeft: { userId: string };
}
```

### 创建发送器

使用 `useEmits` 钩子创建一个类型化的事件发送器：

```typescript
import { define, useEmits } from '@effuse/core';

const ChatRoom = define({
  script: () => {
    const { emit, on, off, context } = useEmits<ChatEvents>({
      // 可选：注册初始处理函数
      message: (msg) => console.log('新消息:', msg.text),
    });

    // 发送事件
    const sendMessage = (text: string) => {
      emit('message', {
        text,
        author: '用户',
        timestamp: Date.now(),
      });
    };

    return { sendMessage };
  },
  template: ({ sendMessage }) => (
    <button onClick={() => sendMessage('你好！')}>发送</button>
  ),
});
```

## API 参考

### useEmits<T>

创建一个支持订阅的类型化事件发送器。

```typescript
function useEmits<T extends EventMap>(
  initialHandlers?: Partial<{ [K in keyof T]: EmitHandler<T[K]> }>
): {
  emit: EmitFn<T>;
  emitAsync: EmitFnAsync<T>;
  on: SubscribeFn<T>;
  off: (event: K, handler: EmitHandler<T[K]>) => void;
  context: EmitContextData<T>;
}
```

#### 返回值

| 属性        | 类型                           | 描述                                     |
| ----------- | ------------------------------ | ---------------------------------------- |
| `emit`      | `EmitFn<T>`                    | 同步发送带有负载的事件                   |
| `emitAsync` | `EmitFnAsync<T>`               | 异步发送事件（下一个微任务）             |
| `on`        | `SubscribeFn<T>`               | 订阅事件，返回取消订阅函数               |
| `off`       | `(event, handler) => void`     | 手动取消订阅处理程序                     |
| `context`   | `EmitContextData<T>`           | 内部上下文，用于 `useEventSignal`        |

### useEventSignal<T, P>

创建一个响应式信号，每当发送特定事件时更新。

```typescript
function useEventSignal<T extends EventMap, P>(
  ctx: EmitContextData<T>,
  event: string,
  options?: EmitOptions
): EventSignal<P>
```

#### 选项

| 选项       | 类型                          | 描述                                     |
| ---------- | ----------------------------- | ---------------------------------------- |
| `debounce` | `number`                      | 按指定的毫秒数延迟更新                   |
| `throttle` | `number`                      | 将更新限制为每个间隔一次                 |
| `once`     | `boolean`                     | 仅更新一次，然后停止                     |
| `filter`   | `(payload: unknown) => bool`  | 仅当谓词返回 true 时更新                 |

#### 示例

```typescript
const { emit, context } = useEmits<ChatEvents>();

// 为最后一条消息创建一个响应式信号
const lastMessage = useEventSignal<ChatEvents, ChatEvents['message']>(
  context,
  'message',
  { debounce: 100 }
);

// 在模板中使用 - 自动更新！
<p>最后消息: {lastMessage.value?.text}</p>
```

## 事件装饰器

Effuse 提供了用于控制事件处理方式的实用函数：

### createDebounce

延迟回调执行直到一段不活动期：

```typescript
import { createDebounce } from '@effuse/core';

const debounce = createDebounce<string>(300); // 300 毫秒延迟

debounce.apply('搜索词', (value) => {
  performSearch(value);
});

// 取消挂起的执行
debounce.cancel();
```

### createThrottle

将回调执行限制为每个间隔一次：

```typescript
import { createThrottle } from '@effuse/core';

const throttle = createThrottle<MouseEvent>(100); // 每 100 毫秒最多一次

document.addEventListener('mousemove', (e) => {
  throttle.apply(e, (event) => {
    updatePosition(event.clientX, event.clientY);
  });
});

// 重置限制状态
throttle.reset();
```

### createOnce

确保回调仅执行一次：

```typescript
import { createOnce } from '@effuse/core';

const once = createOnce<void>();

button.addEventListener('click', () => {
  once.apply(undefined, () => {
    initializeApp();
  });
});

// 检查是否已触发
console.log(once.hasFired()); // 第一次点击后为 true

// 重置以允许再次触发
once.reset();
```

### createFilter

根据谓词有条件地处理事件：

```typescript
import { createFilter } from '@effuse/core';

const filter = createFilter<number>((n) => n > 10);

filter.apply(5, (n) => console.log(n));   // 跳过
filter.apply(15, (n) => console.log(n));  // 打印: 15
```

## 服务 API

对于高级用例，您可以访问底层发送服务：

```typescript
import { getEmitService } from '@effuse/core';

const service = getEmitService();

// 创建一个独立上下文
const ctx = service.createContext<MyEvents>();

// 注册处理程序
const unsubscribe = service.registerHandler(ctx, 'eventName', handler);

// 发送事件
service.emit(ctx, 'eventName', payload);

// 获取事件的响应式信号
const signal = service.getSignal(ctx, 'eventName');
```

## 类型定义

```typescript
// 基础事件映射约束
type EventMap = Record<string, any>;

// 处理函数类型
type EmitHandler<P> = (payload: P) => void;

// 发送函数类型
type EmitFn<T extends EventMap> = <K extends keyof T & string>(
  event: K,
  payload: T[K]
) => void;

// 异步发送函数类型
type EmitFnAsync<T extends EventMap> = <K extends keyof T & string>(
  event: K,
  payload: T[K]
) => Promise<void>;

// 订阅函数类型
type SubscribeFn<T extends EventMap> = <K extends keyof T & string>(
  event: K,
  handler: EmitHandler<T[K]>
) => () => void;

// 事件信号 (只读)
type EventSignal<P> = ReadonlySignal<P | undefined>;
```

## 最佳实践

1. **先定义类型**：始终为您的事件创建一个接口
2. **使用取消订阅函数**：在清理过程中存储并调用 `on()` 返回的函数
3. **优先使用响应式信号**：在 UI 绑定中使用 `useEventSignal`，而不是在 effect 中订阅
4. **应用装饰器**：对高频事件（如鼠标移动或键入）使用防抖/节流
5. **批量处理相关事件**：多个同步发送会自动批量处理以提高性能
