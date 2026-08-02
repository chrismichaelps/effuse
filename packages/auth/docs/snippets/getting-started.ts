import { defineServerFileHandler } from '@effuse/core';
import { claim, defineAuth } from '@effuse/auth';
import {
	appendAuthCookies,
	createAuthServer,
	createOAuthClient,
	createPolicies,
	createPolicyGuard,
	createPolicyRegistry,
	createRedirectValidator,
	google,
	toSafeResponseInit,
} from '@effuse/auth/server';
import { createMemoryStorage } from '@effuse/server';

const origin = process.env['APP_ORIGIN'] ?? 'http://localhost:5173';
const production = process.env['NODE_ENV'] === 'production';

export const authClaims = {
	role: claim.enum(['admin', 'member']),
	displayName: claim.string(),
	email: claim.string({ expose: false }).optional(),
};

export const authConfig = defineAuth({
	secrets: [
		process.env['AUTH_SECRET'] ?? 'development-secret-must-be-32-characters',
	],
	claims: authClaims,
	cookie: { secure: production },
});

const storage = createMemoryStorage();
export const auth = createAuthServer(authConfig, { storage });

export const googleAuth = createOAuthClient({
	provider: google({
		clientId: process.env['GOOGLE_CLIENT_ID'] ?? 'development-client-id',
		clientSecret:
			process.env['GOOGLE_CLIENT_SECRET'] ?? 'development-client-secret',
	}),
	redirectUri: `${origin}/api/auth/callback`,
	storage,
	clock: { now: () => Date.now() },
	redirects: createRedirectValidator({ baseUrl: origin }),
	secureCookies: production,
});

const policy = createPolicies<typeof authClaims>();
export const policies = createPolicyRegistry<typeof authClaims>()
	.protect({ path: '/api/auth/*', policy: policy.public() })
	.protect({ path: '/api/*', policy: policy.authenticated() })
	.protect({ path: '/api/admin/*', policy: policy.claim('role', 'admin') });

export const authGuard = createPolicyGuard({
	registry: policies,
	resolveSession: auth.fromRequest,
});

export const signInRoute = defineServerFileHandler(
	'/api/auth/sign-in',
	async () => {
		const started = await googleAuth.start({ redirectTo: '/dashboard' });
		if (!started.ok) {
			const safe = toSafeResponseInit(started.error);
			return new Response(JSON.stringify(safe.body), safe);
		}

		return appendAuthCookies(
			Response.redirect(started.authorizationUrl, 302),
			started.setCookies
		);
	}
);

export const callbackRoute = defineServerFileHandler(
	'/api/auth/callback',
	async ({ request }) => {
		const callback = await googleAuth.callback(request);
		if (!callback.ok) {
			const safe = toSafeResponseInit(callback.error);
			return appendAuthCookies(
				new Response(JSON.stringify(safe.body), safe),
				callback.setCookies
			);
		}

		const signedIn = await auth.signIn({
			subject: `google:${callback.profile.providerAccountId}`,
			claims: {
				role: 'member',
				displayName: callback.profile.name ?? 'Member',
				...(callback.profile.email === undefined
					? {}
					: { email: callback.profile.email }),
			},
		});
		if (signedIn.error) {
			const safe = toSafeResponseInit(signedIn.error);
			return new Response(JSON.stringify(safe.body), safe);
		}

		return appendAuthCookies(
			Response.redirect(new URL(callback.redirectTo, request.url), 302),
			[...callback.setCookies, ...signedIn.setCookies]
		);
	}
);

export const adminReportRoute = defineServerFileHandler(
	'/api/admin/report',
	async ({ request, response }) => {
		const guarded = await authGuard.protect(request);
		if (guarded.response) {
			return appendAuthCookies(guarded.response, guarded.setCookies);
		}

		return appendAuthCookies(
			response.json({
				generatedFor: guarded.session?.claims.displayName,
			}),
			guarded.setCookies
		);
	}
);
