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

/**
 * Stable, adapter-neutral response envelopes.
 *
 * These are the only responses an adapter itself produces; everything else
 * originates from the application handler. Keeping them here guarantees Node
 * and Bun return byte-identical error shapes.
 */

/** Marker so callers can recognize an adapter-generated envelope. */
export const ENVELOPE_MARKER = 'effuse.server';

interface EnvelopeBody {
	readonly error: string;
	readonly code: string;
	readonly source: typeof ENVELOPE_MARKER;
}

const jsonEnvelope = (status: number, code: string, error: string): Response =>
	new Response(
		JSON.stringify({ error, code, source: ENVELOPE_MARKER } satisfies EnvelopeBody),
		{
			status,
			headers: { 'Content-Type': 'application/json; charset=utf-8' },
		}
	);

/** 500 returned when the application handler throws. */
export const internalErrorResponse = (): Response =>
	jsonEnvelope(500, 'internal_error', 'Internal Server Error');

/** 413 returned when a request body exceeds the configured limit. */
export const payloadTooLargeResponse = (maxBodyBytes: number): Response =>
	jsonEnvelope(
		413,
		'payload_too_large',
		`Request body exceeds the ${String(maxBodyBytes)} byte limit`
	);

/** 503 returned for requests that arrive after `close()` has begun. */
export const shuttingDownResponse = (): Response =>
	jsonEnvelope(503, 'server_closing', 'Server is shutting down');
