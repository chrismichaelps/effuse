import { createRuntimeContext } from '../context/runtime-context.js';

/**
 * State owned by one server render.
 *
 * `url` exists so a router can resolve the request during SSR. Without it
 * `createWebHistory` had no way to learn the path off-browser and fell back to
 * `'/'`, so every server-rendered request resolved the root route — invisible
 * in a browser, because hydration then swapped in the correct one.
 */
interface ServerRenderState {
	readonly url?: string;
}

const serverRenderContext = createRuntimeContext<ServerRenderState>();

export const runWithServerRenderContext = <T>(
	render: () => T,
	url?: string
): T => serverRenderContext.run({ url }, render);

export const isServerRendering = (): boolean =>
	serverRenderContext.current() !== undefined;

/**
 * The URL of the render in progress, or null outside one.
 *
 * AsyncLocalStorage-scoped, so concurrent renders never observe each other's.
 * Null during `renderToFragment`, which is handed no URL.
 */
export const getServerRenderUrl = (): string | null =>
	serverRenderContext.current()?.url ?? null;
