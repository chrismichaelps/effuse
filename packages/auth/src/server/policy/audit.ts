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
 * Authorization coverage over the compiled route manifest.
 *
 * This is the part that turns "someone forgot a check" from a vulnerability into
 * a failed build.
 *
 * Scattered per-route conditionals cannot be audited: there is no list of routes
 * to compare against, so an unprotected endpoint is discovered when someone
 * exploits it. Because Effuse compiles routes into a manifest, every route and
 * its effective policy can be enumerated — and a route with nothing declared can
 * be made a build failure rather than a silent default-open.
 *
 * The manifest type is described structurally rather than imported from
 * `@effuse/core`, for the same reason `AuthStorage` is: this package should not
 * take a hard dependency on the server runtime to be useful, and anything shaped
 * like a manifest works.
 */

import type { ClaimsShape } from '../../claims.js';
import type { PolicyRegistry } from './registry.js';

/** The shape this audit needs from a compiled manifest. */
export interface AuditableRoute {
	readonly layer?: string;
	readonly path: string;
	readonly methods: readonly string[];
}

export interface AuditableManifest {
	readonly routes: readonly AuditableRoute[];
	readonly actions?: readonly {
		readonly layer?: string;
		readonly name?: string;
		readonly path: string;
		readonly method?: string;
	}[];
}

/** One route-and-method pair, with whatever guards it. */
export interface CoverageEntry {
	readonly path: string;
	readonly method: string;
	readonly layer: string | undefined;
	/** Names of the rules that applied, least specific first. */
	readonly rules: readonly string[];
	/** True when nothing matched. */
	readonly unprotected: boolean;
	/** True when the effective policy deliberately permits anonymous access. */
	readonly isPublic: boolean;
}

export interface CoverageReport {
	readonly entries: readonly CoverageEntry[];
	/** Entries with no matching rule at all. */
	readonly unprotected: readonly CoverageEntry[];
	/** Entries explicitly declared public. */
	readonly publicEntries: readonly CoverageEntry[];
	readonly totals: {
		readonly routes: number;
		readonly protected: number;
		readonly public: number;
		readonly unprotected: number;
	};
}

export interface AuditOptions {
	/**
	 * Paths exempt from `deny-by-default`, as registry-style patterns.
	 *
	 * For genuinely infrastructural endpoints — health checks, metrics. Kept as
	 * an explicit list so the exemptions are themselves reviewable, rather than
	 * inferred from a naming convention that drifts.
	 */
	readonly allowUnprotected?: readonly string[];
}

const matchesAny = (patterns: readonly string[], path: string): boolean =>
	patterns.some((pattern) => {
		if (pattern.endsWith('/*')) {
			return path.startsWith(pattern.slice(0, -1));
		}
		return pattern === path;
	});

/**
 * Enumerates every route and method with its effective policy.
 *
 * The output is the answer to "which routes are open?", which is a question
 * scattered conditionals cannot answer at all.
 */
export const auditPolicyCoverage = <Shape extends ClaimsShape>(
	manifest: AuditableManifest,
	registry: PolicyRegistry<Shape>,
	options: AuditOptions = {}
): CoverageReport => {
	const exempt = options.allowUnprotected ?? [];
	const entries: CoverageEntry[] = [];

	const record = (
		path: string,
		method: string,
		layer: string | undefined
	): void => {
		const match = registry.resolve(path, method);

		entries.push({
			path,
			method,
			layer,
			rules: match.rules.map((rule) => rule.policy.name),
			// An exempt path is reported as protected-by-decision rather than
			// unprotected, so the report does not nag about something already
			// signed off.
			unprotected: match.policy === undefined && !matchesAny(exempt, path),
			isPublic: match.policy?.isPublic ?? false,
		});
	};

	for (const route of manifest.routes) {
		// Every method separately. A route whose GET is guarded and whose POST is
		// not must show up as one covered entry and one hole, not as "covered".
		for (const method of route.methods) {
			record(route.path, method, route.layer);
		}
	}

	for (const action of manifest.actions ?? []) {
		// Actions are POST by definition, and are exactly the kind of
		// state-changing endpoint that must not slip through unaudited.
		record(action.path, action.method ?? 'POST', action.layer);
	}

	const unprotected = entries.filter((entry) => entry.unprotected);
	const publicEntries = entries.filter((entry) => entry.isPublic);

	return {
		entries,
		unprotected,
		publicEntries,
		totals: {
			routes: entries.length,
			protected: entries.length - unprotected.length - publicEntries.length,
			public: publicEntries.length,
			unprotected: unprotected.length,
		},
	};
};

export class PolicyCoverageError extends Error {
	readonly name = 'PolicyCoverageError';

	constructor(readonly uncovered: readonly CoverageEntry[]) {
		super(
			[
				`[@effuse/auth] ${String(uncovered.length)} route(s) have no authorization policy:`,
				...uncovered.map(
					(entry) => `  ${entry.method} ${entry.path}${entry.layer === undefined ? '' : ` (${entry.layer})`}`
				),
				'',
				'Declare a policy for each, or mark it public with `policies.public()`.',
				'Infrastructural endpoints can be listed in `allowUnprotected`.',
			].join('\n')
		);
	}
}

/**
 * Throws unless every route is covered.
 *
 * Intended for a build step or a test. This is the setting that converts a
 * forgotten check from something discovered in an incident into something
 * discovered in CI — which is the entire argument for compiling authorization
 * into the manifest rather than scattering it through handlers.
 */
export const assertPolicyCoverage = <Shape extends ClaimsShape>(
	manifest: AuditableManifest,
	registry: PolicyRegistry<Shape>,
	options: AuditOptions = {}
): CoverageReport => {
	const report = auditPolicyCoverage(manifest, registry, options);

	if (report.unprotected.length > 0) {
		throw new PolicyCoverageError(report.unprotected);
	}

	return report;
};

/** Renders a coverage report as a table, for CI output. */
export const formatCoverageReport = (report: CoverageReport): string => {
	const rows = report.entries.map((entry) => {
		const status = entry.unprotected
			? 'UNPROTECTED'
			: entry.isPublic
				? 'public'
				: 'protected';

		return `${entry.method.padEnd(7)} ${entry.path.padEnd(40)} ${status.padEnd(12)} ${entry.rules.join(' + ')}`;
	});

	return [
		...rows,
		'',
		`${String(report.totals.routes)} route(s): ${String(report.totals.protected)} protected, ${String(report.totals.public)} public, ${String(report.totals.unprotected)} unprotected.`,
	].join('\n');
};
