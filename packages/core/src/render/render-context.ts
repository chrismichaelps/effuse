import { createRuntimeContext } from '../context/runtime-context.js';

const serverRenderContext = createRuntimeContext<true>();

export const runWithServerRenderContext = <T>(render: () => T): T =>
	serverRenderContext.run(true, render);

export const isServerRendering = (): boolean =>
	serverRenderContext.current() === true;
