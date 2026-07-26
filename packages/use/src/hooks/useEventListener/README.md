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
| `target`  | `EventTarget \| null \| () => EventTarget \| null` | `window`            | Target object    |
| `event`   | Event name for the selected target                    | _required_          | Event name       |
| `handler` | Target-aware event handler                            | _required_          | Event handler    |
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

The target controls both the valid event names and the handler payload. A
`Document` target exposes document events, an `HTMLElement` target exposes DOM
element events, and a `MediaQueryList` target exposes `MediaQueryListEvent` for
its `change` event. Custom `EventTarget` implementations accept string event
names and receive `Event`.

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
