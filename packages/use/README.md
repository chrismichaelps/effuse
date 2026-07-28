<p align="center">
  <img src="../../public/logo/logo.svg" alt="logo" width="150px" />
</p>

<p align="center">
  Lifecycle-owned reactive hooks for Effuse applications.
</p>

## Install

```bash
pnpm add @effuse/use
```

Effect is an internal implementation detail. Application code imports Effuse
signals, tagged states, and errors without learning or installing Effect APIs.

## Hooks

| Group | Hooks |
| --- | --- |
| Browser state | `useWindowSize`, `useMediaQuery`, `useOnline`, `useDocumentVisibility`, `usePreferredColorScheme` |
| Browser capabilities | `useLocalStorage`, `useClipboard`, `useEventListener` |
| Scheduling | `useInterval`, `useTimeout`, `useDebounce`, `useThrottle` |
| Async work | `useAsyncTask` |

```ts
import { useMediaQuery, useOnline } from '@effuse/use';

export const script = () => {
  const viewport = useMediaQuery({
    query: '(min-width: 64rem)',
    initialValue: false,
  });
  const network = useOnline({ initialValue: true });

  return { viewport, network };
};
```

Each hook exposes Effuse-owned signals or typed state. Component ownership
automatically releases listeners, timers, permission observers, and in-flight
work during unmount.

## SSR And Hydration

Browser-backed hooks use deterministic fallback state during server rendering
and the browser's pre-mount hydration pass. They inspect live browser state and
install listeners only after mount.

Configure fallbacks from request data when it is available:

```ts
const viewport = useWindowSize({
  initialWidth: 1280,
  initialHeight: 720,
});

const colorScheme = usePreferredColorScheme({
  ssrScheme: 'dark',
});
```

This contract prevents hydration from starting with different markup solely
because the browser has a viewport, media-query result, network status, or
storage value that the server cannot observe. After mount, the same reactive
values synchronize to live browser state.

`useLocalStorage` never reads or writes storage during component setup. It loads
the existing value after mount, synchronizes later changes, and keeps `remove()`
from recreating the key with its default value.

When a hook is called outside a component, mount work starts immediately for
source compatibility. Prefer component ownership when automatic lifecycle
cleanup is required; use hook-specific controls such as `stop()` where exposed.
