# useInterval

Reactive hook for auto-disposing intervals with pause/resume support.

## Usage

```typescript
import { useInterval } from '@effuse/use';

const { count, isRunning, pause, stop } = useInterval({
	callback: () => console.log('Tick!'),
	delay: 1000,
});
```

## Configuration

| Option      | Type         | Default    | Description          |
| :---------- | :----------- | :--------- | :------------------- |
| `callback`  | `() => void` | _required_ | Function to call     |
| `delay`     | `number`     | `1000`     | Interval delay in ms |
| `immediate` | `boolean`    | `true`     | Start immediately    |

## Returns

| Property    | Type                      | Description           |
| :---------- | :------------------------ | :-------------------- |
| `count`     | `ReadonlySignal<number>`  | Invocation count      |
| `isRunning` | `ReadonlySignal<boolean>` | Whether running       |
| `start`     | `() => void`              | Start/resume interval |
| `pause`     | `() => void`              | Pause (keeps count)   |
| `stop`      | `() => void`              | Stop and reset        |

## Examples

### Polling

```typescript
const { count } = useInterval({
	callback: () => fetchLatestData(),
	delay: 5000,
});
```

### Manual Start

```typescript
const { start, stop } = useInterval({
	callback: () => tick(),
	delay: 100,
	immediate: false,
});

// Start later
onButtonClick(() => start());
```

### Pause/Resume

```typescript
const { pause, start, isRunning } = useInterval({
	callback: () => updateTimer(),
	delay: 1000,
});

const toggleTimer = () => {
	isRunning.value ? pause() : start();
};
```

## Edge Cases

- **SSR:** No-op when window is unavailable
- **Minimum Delay:** Clamped to 4ms minimum
- **Cleanup:** Interval is automatically cleared on dispose
