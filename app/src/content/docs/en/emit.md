---
title: Event Emission (useEmits)
---

# Event Emission (useEmits)

Effuse provides a powerful, type-safe event emission system through the `useEmits` hook. It enables components to communicate via events while maintaining full reactivity with Effuse's signal system.

## Core Concepts

The emit system is built around three main ideas:

1. **Type-Safe Events**: Define your event types in an interface for full TypeScript inference
2. **Reactive Signals**: Every emitted event is also stored in a reactive signal for UI binding
3. **Subscription Pattern**: Subscribe and unsubscribe to events with automatic cleanup

## Basic Usage

### Defining Event Types

Start by defining an interface that describes your events:

```typescript
interface ChatEvents {
	message: { text: string; author: string; timestamp: number };
	userJoined: { userId: string; name: string };
	userLeft: { userId: string };
}
```

### Creating an Emitter

Use the `useEmits` hook to create a typed event emitter:

```typescript
import { define, useEmits } from '@effuse/core';

const ChatRoom = define({
  script: () => {
    const { emit, on, off, context } = useEmits<ChatEvents>({
      // Optional: register initial handlers
      message: (msg) => console.log('New message:', msg.text),
    });

    // Emit an event
    const sendMessage = (text: string) => {
      emit('message', {
        text,
        author: 'User',
        timestamp: Date.now(),
      });
    };

    return { sendMessage };
  },
  template: ({ sendMessage }) => (
    <button onClick={() => sendMessage('Hello!')}>Send</button>
  ),
});
```

## API Reference

### useEmits<T>

Creates a typed event emitter with subscription support.

```typescript
function useEmits<T extends EventMap>(
	initialHandlers?: Partial<{ [K in keyof T]: EmitHandler<T[K]> }>
): {
	emit: EmitFn<T>;
	emitAsync: EmitFnAsync<T>;
	on: SubscribeFn<T>;
	off: (event: K, handler: EmitHandler<T[K]>) => void;
	context: EmitContextData<T>;
};
```

#### Return Values

| Property    | Type                       | Description                                    |
| ----------- | -------------------------- | ---------------------------------------------- |
| `emit`      | `EmitFn<T>`                | Synchronously emit an event with a payload     |
| `emitAsync` | `EmitFnAsync<T>`           | Asynchronously emit an event (next microtask)  |
| `on`        | `SubscribeFn<T>`           | Subscribe to an event, returns unsubscribe fn  |
| `off`       | `(event, handler) => void` | Manually unsubscribe a handler                 |
| `context`   | `EmitContextData<T>`       | Internal context for use with `useEventSignal` |

### useEventSignal<T, P>

Creates a reactive signal that updates whenever a specific event is emitted.

```typescript
function useEventSignal<T extends EventMap, P>(
	ctx: EmitContextData<T>,
	event: string,
	options?: EmitOptions
): EventSignal<P>;
```

#### Options

| Option     | Type                         | Description                             |
| ---------- | ---------------------------- | --------------------------------------- |
| `debounce` | `number`                     | Delay updates by specified milliseconds |
| `throttle` | `number`                     | Limit updates to once per interval      |
| `once`     | `boolean`                    | Only update once, then stop             |
| `filter`   | `(payload: unknown) => bool` | Only update if predicate returns true   |

#### Example

```typescript
const { emit, context } = useEmits<ChatEvents>();

// Create a reactive signal for the last message
const lastMessage = useEventSignal<ChatEvents, ChatEvents['message']>(
  context,
  'message',
  { debounce: 100 }
);

// Use in template - updates automatically!
<p>Last: {lastMessage.value?.text}</p>
```

## Event Modifiers

Effuse provides utility functions for controlling how events are processed:

### createDebounce

Delays callback execution until a period of inactivity:

```typescript
import { createDebounce } from '@effuse/core';

const debounce = createDebounce<string>(300); // 300ms delay

debounce.apply('search term', (value) => {
	performSearch(value);
});

// Cancel pending execution
debounce.cancel();
```

### createThrottle

Limits callback execution to once per interval:

```typescript
import { createThrottle } from '@effuse/core';

const throttle = createThrottle<MouseEvent>(100); // Max once per 100ms

document.addEventListener('mousemove', (e) => {
	throttle.apply(e, (event) => {
		updatePosition(event.clientX, event.clientY);
	});
});

// Reset throttle state
throttle.reset();
```

### createOnce

Ensures the callback is only executed once:

```typescript
import { createOnce } from '@effuse/core';

const once = createOnce<void>();

button.addEventListener('click', () => {
	once.apply(undefined, () => {
		initializeApp();
	});
});

// Check if already fired
console.log(once.hasFired()); // true after first click

// Reset to allow firing again
once.reset();
```

### createFilter

Conditionally processes events based on a predicate:

```typescript
import { createFilter } from '@effuse/core';

const filter = createFilter<number>((n) => n > 10);

filter.apply(5, (n) => console.log(n)); // Skipped
filter.apply(15, (n) => console.log(n)); // Logs: 15
```

## Service API

For advanced use cases, you can access the underlying emit service:

```typescript
import { getEmitService } from '@effuse/core';

const service = getEmitService();

// Create a standalone context
const ctx = service.createContext<MyEvents>();

// Register handlers
const unsubscribe = service.registerHandler(ctx, 'eventName', handler);

// Emit events
service.emit(ctx, 'eventName', payload);

// Get reactive signal for an event
const signal = service.getSignal(ctx, 'eventName');
```

## Type Definitions

```typescript
// Base event map constraint
type EventMap = Record<string, any>;

// Handler function type
type EmitHandler<P> = (payload: P) => void;

// Emit function type
type EmitFn<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	payload: T[K]
) => void;

// Async emit function type
type EmitFnAsync<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	payload: T[K]
) => Promise<void>;

// Subscribe function type
type SubscribeFn<T extends EventMap> = <K extends keyof T & string>(
	event: K,
	handler: EmitHandler<T[K]>
) => () => void;

// Event signal (readonly)
type EventSignal<P> = ReadonlySignal<P | undefined>;
```

## Best Practices

1. **Define Types First**: Always create an interface for your events
2. **Use Unsubscribe Functions**: Store and call the function returned by `on()` during cleanup
3. **Prefer Reactive Signals**: Use `useEventSignal` for UI bindings instead of subscribing in effects
4. **Apply Modifiers**: Use debounce/throttle for high-frequency events like mouse moves or typing
5. **Batch Related Events**: Multiple synchronous emits are batched automatically for performance
