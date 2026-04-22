/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 */

import { describe, it, expect } from 'vitest';
import { createApp } from '../../app/createApp.js';
import { define } from '../../blueprint/define.js';

describe('createApp', () => {
	it('should create an app instance', () => {
		const App = define({
			props: {},
			script: () => ({ title: 'Hello' }),
			template: ({ title }) => title,
		});

		const app = createApp(App);
		expect(app).toBeDefined();
		expect(typeof app.useLayers).toBe('function');
		expect(typeof app.mount).toBe('function');
		expect(typeof app.renderToString).toBe('function');
		expect(typeof app.renderToHtml).toBe('function');
		expect(typeof app.renderToStream).toBe('function');
	});

	it('should create a ServerApp via getServerApp', () => {
		const App = define({
			props: {},
			script: () => ({ title: 'Hello' }),
			template: ({ title }) => title,
		});

		const app = createApp(App);
		const serverApp = app.getServerApp();
		expect(serverApp).toBeDefined();
		expect(typeof serverApp.renderToString).toBe('function');
		expect(typeof serverApp.renderToHtml).toBe('function');
		expect(typeof serverApp.renderToStream).toBe('function');
	});
});
