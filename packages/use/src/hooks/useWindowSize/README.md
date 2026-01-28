# useWindowSize

Reactive hook for tracking window dimensions with automatic cleanup.

## Usage

```typescript
import { useWindowSize } from '@effuse/use';

const { width, height, isAvailable } = useWindowSize();

// Use in reactive context
console.log(`Window: ${width.value}x${height.value}`);
```

## Configuration

| Option              | Type      | Default | Description                         |
| :------------------ | :-------- | :------ | :---------------------------------- |
| `initialWidth`      | `number`  | `0`     | Width to use during SSR             |
| `initialHeight`     | `number`  | `0`     | Height to use during SSR            |
| `listenOrientation` | `boolean` | `true`  | Listen to orientation changes       |
| `includeScrollbar`  | `boolean` | `true`  | Include scrollbar in measurements   |
| `debounce`          | `number`  | `0`     | Debounce delay in ms (0 = disabled) |

## Returns

| Property      | Type                      | Description           |
| :------------ | :------------------------ | :-------------------- |
| `width`       | `ReadonlySignal<number>`  | Current window width  |
| `height`      | `ReadonlySignal<number>`  | Current window height |
| `isAvailable` | `ReadonlySignal<boolean>` | `false` during SSR    |

## Examples

### Basic Usage

```typescript
const { width, height } = useWindowSize();

// Reactive: updates automatically on resize
effect(() => {
	console.log(`Window resized to ${width.value}x${height.value}`);
});
```

### With Debouncing

```typescript
const { width, height } = useWindowSize({
	debounce: 100, // 100ms debounce
});
```

### SSR-Safe Initial Values

```typescript
const { width, height } = useWindowSize({
	initialWidth: 1920,
	initialHeight: 1080,
});
```

### Excluding Scrollbar

```typescript
const { width, height } = useWindowSize({
	includeScrollbar: false,
});
```

## Edge Cases

- **SSR:** Returns `initialWidth` and `initialHeight` with `isAvailable = false`
- **Orientation Change:** Automatically updates on mobile orientation changes
- **Cleanup:** Event listeners are automatically removed on dispose
