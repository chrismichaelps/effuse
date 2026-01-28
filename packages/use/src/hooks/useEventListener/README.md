# useEventListener

Reactive hook for attaching DOM event listeners with automatic cleanup.

## Usage

```typescript
import { useEventListener } from '@effuse/use';

// Listen to window clicks
useEventListener({
	event: 'click',
	handler: (e) => console.log('Clicked!', e),
});
```

## Configuration

| Option    | Type                               | Default             | Description      |
| :-------- | :--------------------------------- | :------------------ | :--------------- |
| `target`  | `EventTarget \| () => EventTarget` | `window`            | Target element   |
| `event`   | `keyof WindowEventMap`             | _required_          | Event name       |
| `handler` | `(event) => void`                  | _required_          | Event handler    |
| `options` | `AddEventListenerOptions`          | `{ passive: true }` | Listener options |

## Returns

| Property   | Type         | Description                  |
| :--------- | :----------- | :--------------------------- |
| `isActive` | `boolean`    | Whether listener is attached |
| `stop`     | `() => void` | Manually remove listener     |

## Examples

### Window Events

```typescript
useEventListener({
	event: 'resize',
	handler: () => console.log('Window resized'),
});
```

### Element Events

```typescript
const buttonRef = ref<HTMLButtonElement>();

useEventListener({
	target: () => buttonRef.value,
	event: 'click',
	handler: () => console.log('Button clicked'),
});
```

### Keyboard Events

```typescript
useEventListener({
	event: 'keydown',
	handler: (e) => {
		if (e.key === 'Escape') closeModal();
	},
});
```

### Capture Phase

```typescript
useEventListener({
	event: 'click',
	handler: (e) => e.stopPropagation(),
	options: { capture: true },
});
```

## Edge Cases

- **SSR:** No-op when window is unavailable
- **Null Target:** Gracefully handles null targets
- **Cleanup:** Listener is automatically removed on dispose
