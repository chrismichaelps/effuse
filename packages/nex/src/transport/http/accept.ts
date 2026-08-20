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
 * Whether a caller said it could read what we are about to send.
 *
 * `Accept` is a list of what the caller understands, and sending it something
 * else is worse than sending nothing: a browser shows a download prompt, a
 * typed client throws where it parses. Reading the header costs a split and a
 * comparison, and it is the difference between a caller that can act on the
 * answer and one that cannot.
 *
 * A caller that says nothing is taken to accept anything, which is what the
 * absence of the header means. A weight of zero is a caller ruling something
 * out, and is honoured; the rest of the weights order preferences we do not
 * have, since each kind of request has exactly one thing to send.
 */
export const accepts = (header: string | undefined, media: string): boolean => {
	if (header === undefined || header.trim() === '') return true;

	const [type, subtype] = media.split('/');

	for (const entry of header.split(',')) {
		const [candidate, ...parameters] = entry.split(';');
		const offered = candidate?.trim().toLowerCase();
		if (offered === undefined || offered === '') continue;

		const [offeredType, offeredSubtype] = offered.split('/');
		const matches =
			offered === '*/*' ||
			(offeredType === type &&
				(offeredSubtype === '*' || offeredSubtype === subtype));

		if (!matches) continue;

		// "q=0" is the one weight that changes an answer rather than ordering
		// several: it is a caller saying it cannot read this at all.
		const refused = parameters.some((parameter) => {
			const [name, value] = parameter.split('=');
			return name?.trim().toLowerCase() === 'q' && Number(value?.trim()) === 0;
		});

		if (!refused) return true;
	}

	// Nothing the caller listed covers this. Whether it ruled the type out or
	// simply never mentioned it, the answer is the same: it cannot read this.
	return false;
};
