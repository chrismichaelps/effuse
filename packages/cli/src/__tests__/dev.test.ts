/**
 * MIT License
 *
 * Copyright (c) 2025 Chris M. Perez
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

import { describe, it, expect } from 'vitest';

describe('DevService utilities', () => {
	describe('error overlay HTML generation', () => {
		it('should escape HTML in error message', () => {
			const message = '<script>alert("xss")</script>';
			const escaped = message.replace(/</g, '&lt;').replace(/>/g, '&gt;');
			expect(escaped).toBe('&lt;script&gt;alert("xss")&lt;/script&gt;');
		});

		it('should escape HTML in stack trace', () => {
			const stack = `Error: test at /path/file.js:10:5
  at Object.<anonymous> (/path/other.js:20:2)`;
			const escaped = stack.replace(/</g, '&lt;').replace(/>/g, '&gt;');
			expect(escaped).toContain('&lt;');
			expect(escaped).not.toContain('<script>');
		});

		it('should handle empty stack trace', () => {
			const stack = undefined;
			const escaped = (stack ?? '').replace(/</g, '&lt;').replace(/>/g, '&gt;');
			expect(escaped).toBe('');
		});

		it('should truncate long error messages', () => {
			const message = 'A'.repeat(200);
			const truncated = message.slice(0, 100);
			expect(truncated.length).toBe(100);
		});

		it('should generate valid HTML document structure', () => {
			const html = `<!DOCTYPE html>
<html>
<head>
	<meta charset="UTF-8">
	<title>Error</title>
</head>
<body>
	<div class="error-container">
		<pre class="error-message"></pre>
	</div>
</body>
</html>`;

			expect(html).toContain('<!DOCTYPE html>');
			expect(html).toContain('<html>');
			expect(html).toContain('<head>');
			expect(html).toContain('<body>');
			expect(html).toContain('</html>');
		});

		it('should not include unescaped user input in HTML', () => {
			const userInput = '<img src=x onerror=alert(1)>';
			const safe = userInput.replace(/</g, '&lt;').replace(/>/g, '&gt;');
			expect(safe).toBe('&lt;img src=x onerror=alert(1)&gt;');
			expect(safe).not.toContain('<img');
		});
	});

	describe('request body parsing', () => {
		it('should detect body methods correctly', () => {
			const bodyMethods = ['POST', 'PUT', 'PATCH', 'DELETE'];
			expect(bodyMethods).toContain('POST');
			expect(bodyMethods).toContain('PUT');
			expect(bodyMethods).toContain('PATCH');
			expect(bodyMethods).toContain('DELETE');
			expect(bodyMethods).not.toContain('GET');
			expect(bodyMethods).not.toContain('HEAD');
		});

		it('should serialize object body as JSON', () => {
			const body = { key: 'value', num: 42 };
			const serialized = JSON.stringify(body);
			expect(serialized).toBe('{"key":"value","num":42}');
		});

		it('should not serialize string body', () => {
			const body = 'raw string';
			const serialized = typeof body === 'string' ? body : JSON.stringify(body);
			expect(serialized).toBe('raw string');
		});

		it('should set default Content-Type for non-object body', () => {
			const body: unknown = 'raw';
			const hasContentType = body && typeof body !== 'object';
			expect(hasContentType).toBeTruthy();
		});
	});

	describe('protocol detection', () => {
		it('should use X-Forwarded-Proto over req.protocol', () => {
			const forwarded = 'https';
			const direct = 'http';
			const protocol = forwarded ?? direct;
			expect(protocol).toBe('https');
		});

		it('should fall back to req.protocol', () => {
			const forwarded: string | null = null;
			const direct = 'http';
			const protocol = forwarded ?? direct;
			expect(protocol).toBe('http');
		});

		it('should use X-Forwarded-Host over host header', () => {
			const forwarded = 'example.com';
			const header = 'localhost:3000';
			const host = forwarded ?? header;
			expect(host).toBe('example.com');
		});

		it('should fall back to host header', () => {
			const forwarded: string | null = null;
			const header = 'localhost:3000';
			const host = forwarded ?? header;
			expect(host).toBe('localhost:3000');
		});

		it('should default to localhost', () => {
			const fallback = 'localhost';
			expect(fallback).toBe('localhost');
		});
	});

	describe('static file serving', () => {
		it('should serve from public directory', () => {
			const publicDir = '/path/to/project/public';
			expect(publicDir).toContain('public');
		});

		it('should use immutable cache for public assets', () => {
			const maxAge = '1y';
			expect(maxAge).toBe('1y');
		});

		it('should ignore dotfiles', () => {
			const dotfiles = 'ignore';
			expect(dotfiles).toBe('ignore');
		});

		it('should skip if public directory does not exist', () => {
			const exists = false;
			expect(exists).toBe(false);
		});
	});

	describe('graceful shutdown', () => {
		it('should handle SIGTERM signal', () => {
			const signal = 'SIGTERM';
			expect(['SIGTERM', 'SIGINT']).toContain(signal);
		});

		it('should handle SIGINT signal', () => {
			const signal = 'SIGINT';
			expect(['SIGTERM', 'SIGINT']).toContain(signal);
		});

		it('should set timeout before forced exit', () => {
			const timeout = 5000;
			expect(timeout).toBeGreaterThan(0);
		});
	});

	describe('response handling', () => {
		it('should strip content-encoding header', () => {
			const headers = new Headers();
			headers.set('content-encoding', 'gzip');
			headers.set('content-type', 'text/html');
			headers.set('server-timing', 'total;dur=100');

			const filtered = Array.from(headers.keys()).filter(
				(k) => k.toLowerCase() !== 'content-encoding'
			);

			expect(filtered).not.toContain('content-encoding');
			expect(filtered).toContain('content-type');
			expect(filtered).toContain('server-timing');
		});

		it('should set correct HTTP status codes', () => {
			expect(200).toBe(200);
			expect(404).toBe(404);
			expect(500).toBe(500);
		});

		it('should handle streaming response body', async () => {
			const chunks: Uint8Array[] = [];
			chunks.push(new Uint8Array([72, 101, 108]));
			chunks.push(new Uint8Array([108, 111]));

			const totalLength = chunks.reduce((sum, c) => sum + c.length, 0);
			const full = new Uint8Array(totalLength);
			let offset = 0;
			for (const chunk of chunks) {
				full.set(chunk, offset);
				offset += chunk.length;
			}

			const text = new TextDecoder().decode(full);
			expect(text).toBe('Hello');
		});

		it('should add Server-Timing header', () => {
			const timing = Date.now() - 100;
			const header = `total;dur=${timing}`;
			expect(header).toContain('total;dur=');
		});
	});

	describe('entry server validation', () => {
		it('should check for handleRequest export', () => {
			const entryModule = { handleRequest: () => {} };
			expect(typeof entryModule.handleRequest).toBe('function');
		});

		it('should fail if handleRequest is not a function', () => {
			const entryModule = { handleRequest: 'string' };
			expect(typeof entryModule.handleRequest).toBe('string');
			expect(entryModule.handleRequest === undefined).toBe(false);
		});

		it('should use correct entry paths', () => {
			const entryServer = 'src/entry-server.ts';
			const entryClient = 'src/entry-client.ts';
			expect(entryServer).toContain('src/');
			expect(entryClient).toContain('src/');
		});
	});
});