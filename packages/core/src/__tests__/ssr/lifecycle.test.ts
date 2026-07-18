import { afterEach, describe, expect, it, vi } from 'vitest';
import { define } from '../../blueprint/define.js';
import { clearGlobalLayerContext } from '../../layers/context.js';
import { clearGlobalTracing } from '../../layers/tracing/index.js';
import { renderToString } from '../../ssr/render.js';
import { createSSRRuntime } from '../../ssr/runtime.js';

afterEach(() => {
	clearGlobalLayerContext();
	clearGlobalTracing();
});

describe('SSR component lifecycle', () => {
	it('skips browser mount hooks and disposes setup resources', async () => {
		const onMount = vi.fn();
		const onUnmount = vi.fn();
		const effectCleanup = vi.fn();
		const App = define({
			script: ({
				onMount: registerMount,
				onUnmount: registerUnmount,
				watchEffect,
			}) => {
				registerMount(onMount);
				registerUnmount(onUnmount);
				watchEffect((onCleanup) => onCleanup(effectCleanup));
				return {};
			},
			template: () => 'server output',
		});
		const runtime = await createSSRRuntime([]);

		const result = runtime.run(() => renderToString(App, '/', runtime));

		expect(result.html).toContain('server output');
		expect(onMount).not.toHaveBeenCalled();
		expect(onUnmount).toHaveBeenCalledOnce();
		expect(effectCleanup).toHaveBeenCalledOnce();
		await runtime.dispose();
	});
});
