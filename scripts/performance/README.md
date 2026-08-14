# Effuse Performance Lab

Performance claims must come from repeatable measurements. This directory owns
the benchmark runner, scenarios, and conservative regression guardrails used by
Effuse.

## Route Pattern Benchmark

Build core and run the route benchmark with Node:

```sh
pnpm bench:routes
```

Run the same benchmark with Bun:

```sh
pnpm bench:routes:bun
```

Pass `--json` directly to `route-pattern.mjs` for a machine-readable report, or
`--quick` for local harness checks. The package scripts run the full sample set
and enforce `route-pattern-budgets.json`.

## SSR Runtime Benchmark

Measure fresh-process startup plus warm runtime creation, full rendering, and
request handling with Node or Bun:

```sh
pnpm bench:ssr
pnpm bench:ssr:bun
```

The cold worker starts a new runtime for every sample, so module initialization
is not hidden by the import cache. The Node entry bundles Effuse's internal
Effect runtime to avoid loading its broad barrel at startup; the browser entry
remains separate and has an uncompressed build budget enforced by the core
package-entry check. Node source maps retain mappings but omit embedded source
text to keep the published package proportionate; Effuse's `src` directory
remains part of the package for debugging.

## Method

- Build the production core entry before measuring.
- Warm each operation before collecting samples.
- Measure multiple batches and report median, p95, range, mean, and standard
  deviation in nanoseconds per operation.
- Consume every operation result so calls cannot be trivially discarded.
- Record the runtime, runtime version, operating system, architecture, sample
  count, and iterations in JSON reports.
- Keep budgets loose enough for CI hardware variance. They are regression
  guardrails, not competitive claims.

Cross-framework results must use equivalent features, payloads, production
builds, warmup, sample counts, and runtime constraints. Publish losses and
unmeasured areas alongside wins.

`server.router-compile` measures full layer resolution, pattern compilation,
specificity sorting, and action indexing for a 49-route graph.
`server.router-match` reuses that compiled graph and measures steady-state
request matching. Keeping these cases separate prevents cold graph construction
from hiding request-path regressions. Both Node and Bun scripts enforce the same
conservative budgets until runtime-specific CI baselines justify narrower
limits.

`server.files-compile` and `server.files-match` apply the same split to a
49-entry lazy file registry. The match case stops before dynamic import, so its
budget isolates route selection from user module initialization and I/O.
