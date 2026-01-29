# useThrottle

Reactive hook for throttling signal values with leading and trailing edge support.

## Usage

```typescript
import { useThrottle } from '@effuse/use';
import { signal } from '@effuse/core';

const scrollPosition = signal(0);
const { value: throttledScroll, isThrottled } = useThrottle({
	value: scrollPosition,
	interval: 100,
});

// throttledScroll updates at most once every 100ms
```

## Configuration

| Option     | Type        | Default    | Description                         |
| :--------- | :---------- | :--------- | :---------------------------------- |
| `value`    | `Signal<T>` | _required_ | Signal to throttle                  |
| `interval` | `number`    | `200`      | Throttle interval in ms             |
| `leading`  | `boolean`   | `true`     | Update immediately on first change  |
| `trailing` | `boolean`   | `true`     | Apply last value after cooldown     |

## Returns

| Property      | Type                      | Description                      |
| :------------ | :------------------------ | :------------------------------- |
| `value`       | `ReadonlySignal<T>`       | Throttled value                  |
| `isThrottled` | `ReadonlySignal<boolean>` | Whether currently in cooldown    |

## Examples

### Scroll Position

```typescript
const scrollY = signal(0);
const { value: throttledY } = useThrottle({
	value: scrollY,
	interval: 100,
});

window.addEventListener('scroll', () => {
	scrollY.value = window.scrollY;
});
```

### Mouse Movement

```typescript
const mousePosition = signal({ x: 0, y: 0 });
const { value: throttledPosition } = useThrottle({
	value: mousePosition,
	interval: 50,
});

document.addEventListener('mousemove', (e) => {
	mousePosition.value = { x: e.clientX, y: e.clientY };
});
```

### Trailing Only

```typescript
const resize = signal({ width: 0, height: 0 });
const { value: throttledSize } = useThrottle({
	value: resize,
	interval: 200,
	leading: false,
	trailing: true,
});

// First change waits, then applies after 200ms
```

## Edge Cases

- **Rapid Changes:** Changes during cooldown are ignored (last one saved for trailing)
- **Leading Edge:** First change updates immediately by default
- **Trailing Edge:** Last ignored value applies after cooldown ends
- **Cleanup:** Timeout is automatically cleared on dispose
