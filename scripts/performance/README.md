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
