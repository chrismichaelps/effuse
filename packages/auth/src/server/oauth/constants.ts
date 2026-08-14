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

export const OAUTH_PROVIDER_MODE = {
	OIDC: 'oidc',
	OAUTH: 'oauth',
} as const;

export const TOKEN_ENDPOINT_AUTH_METHOD = {
	BASIC: 'client_secret_basic',
	POST: 'client_secret_post',
} as const;

export const OAUTH_TOKEN_TYPE = {
	BEARER: 'bearer',
} as const;

export const PKCE_METHOD = {
	S256: 'S256',
} as const;

export const OIDC_DEFAULT_SCOPES = ['openid', 'email', 'profile'] as const;
export const GITHUB_DEFAULT_SCOPES = ['read:user', 'user:email'] as const;
export const SUPPORTED_ID_TOKEN_ALGORITHMS = [
	'RS256',
	'RS384',
	'RS512',
	'ES256',
	'ES384',
] as const;
export const DEFAULT_ID_TOKEN_ALGORITHMS = ['RS256'] as const;

export const GITHUB_ENDPOINTS = {
	ISSUER: 'https://github.com',
	AUTHORIZATION: 'https://github.com/login/oauth/authorize',
	TOKEN: 'https://github.com/login/oauth/access_token',
	USER: 'https://api.github.com/user',
	EMAILS: 'https://api.github.com/user/emails?per_page=100',
} as const;

export const GITHUB_API = {
	ACCEPT: 'application/vnd.github+json',
	VERSION: '2022-11-28',
} as const;
