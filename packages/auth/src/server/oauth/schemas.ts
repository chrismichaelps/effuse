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

import { z } from 'zod';

export const nonEmptyStringSchema = z.string().min(1);

export const oauthTokenResponseSchema = z
	.object({
		access_token: nonEmptyStringSchema,
		token_type: nonEmptyStringSchema.optional().default('Bearer'),
		expires_in: z.number().nonnegative().optional(),
		refresh_token: nonEmptyStringSchema.optional(),
		id_token: nonEmptyStringSchema.optional(),
		scope: z.string().optional(),
	})
	.loose();

export const oauthResolvedIdentitySchema = z.object({
	profile: z.unknown(),
	claims: z.object({ sub: nonEmptyStringSchema }).loose(),
	emailVerified: z.boolean(),
});

export const githubUserSchema = z.object({
	id: z.union([z.number(), nonEmptyStringSchema]),
	login: nonEmptyStringSchema.optional(),
	name: nonEmptyStringSchema.nullish(),
	avatar_url: nonEmptyStringSchema.nullish(),
});

export const githubEmailsSchema = z.array(
	z.object({
		email: nonEmptyStringSchema,
		primary: z.boolean(),
		verified: z.boolean(),
	})
);

export const oidcDiscoveryDocumentSchema = z.object({
	issuer: nonEmptyStringSchema,
	authorization_endpoint: nonEmptyStringSchema,
	token_endpoint: nonEmptyStringSchema,
	jwks_uri: nonEmptyStringSchema,
	userinfo_endpoint: nonEmptyStringSchema.optional(),
	id_token_signing_alg_values_supported: z.array(z.string()).optional().default([]),
	code_challenge_methods_supported: z.array(z.string()).optional().default([]),
});
