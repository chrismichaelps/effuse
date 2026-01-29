# useMediaQuery

Reactive hook for CSS media query detection.

## Usage

```typescript
import { useMediaQuery } from '@effuse/use';

const { matches } = useMediaQuery({
	query: '(min-width: 768px)',
});

// Reactive: updates when viewport changes
if (matches.value) {
	console.log('Desktop layout');
} else {
	console.log('Mobile layout');
}
```

## Configuration

| Option         | Type      | Default    | Description            |
| :------------- | :-------- | :--------- | :--------------------- |
| `query`        | `string`  | _required_ | CSS media query string |
| `initialValue` | `boolean` | `false`    | Initial value for SSR  |

## Returns

| Property      | Type                      | Description                     |
| :------------ | :------------------------ | :------------------------------ |
| `matches`     | `ReadonlySignal<boolean>` | Whether query matches           |
| `isSupported` | `boolean`                 | Whether matchMedia is available |

## Examples

### Responsive Layout

```typescript
const { matches: isDesktop } = useMediaQuery({
	query: '(min-width: 1024px)',
});

const layout = computed(() => (isDesktop.value ? 'grid' : 'stack'));
```

### Dark Mode Detection

```typescript
const { matches: prefersDark } = useMediaQuery({
	query: '(prefers-color-scheme: dark)',
});
```

### Reduced Motion

```typescript
const { matches: prefersReducedMotion } = useMediaQuery({
	query: '(prefers-reduced-motion: reduce)',
});
```

### SSR with Initial Value

```typescript
const { matches } = useMediaQuery({
	query: '(min-width: 768px)',
	initialValue: true, // Assume desktop during SSR
});
```

## Common Breakpoints

```typescript
// Bootstrap-like breakpoints
const breakpoints = {
	xs: '(max-width: 575px)',
	sm: '(min-width: 576px)',
	md: '(min-width: 768px)',
	lg: '(min-width: 992px)',
	xl: '(min-width: 1200px)',
	xxl: '(min-width: 1400px)',
};

const { matches: isMobile } = useMediaQuery({ query: breakpoints.xs });
const { matches: isTablet } = useMediaQuery({ query: breakpoints.md });
```

## Edge Cases

- **SSR:** Returns `initialValue` (defaults to `false`)
- **Invalid Query:** Gracefully handles invalid queries
- **Cleanup:** Listener is automatically removed on dispose
