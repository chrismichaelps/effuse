## @effuse/store [1.0.4](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.3...@effuse/store@1.0.4) (2026-02-19)


### Dependencies

* **@effuse/core:** upgraded to 1.2.0

## @effuse/store [1.0.3](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.2...@effuse/store@1.0.3) (2026-01-14)

### Code Refactoring

- **store:** migrate core logic to internal handler architecture ([92c83be](https://github.com/chrismichaelps/effuse/commit/92c83beac9233552604a0380dfe8d5b5f4498139))

### Tests

- **core:** add integration suites for store and query ([31aeb1a](https://github.com/chrismichaelps/effuse/commit/31aeb1ac271fc97cee6eb7f99e217717c502ef2d))

### Dependencies

- **@effuse/core:** upgraded to 1.1.0

## @effuse/store [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.1...@effuse/store@1.0.2) (2026-01-08)

### Dependencies

- **@effuse/core:** upgraded to 1.0.3

## @effuse/store [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.0...@effuse/store@1.0.1) (2026-01-08)

### Bug Fixes

- restore workspace:\* references for core to resolve deadlock ([da8fce4](https://github.com/chrismichaelps/effuse/commit/da8fce440254b0ec41cbd0524fd8a97b66d5c739))

### Dependencies

- **@effuse/core:** upgraded to 1.0.2

## @effuse/store 1.0.0 (2026-01-08)

### Features

- add cancellable, timeout, retry, and debounced/throttled actions, along with async reactivity features. ([16a7347](https://github.com/chrismichaelps/effuse/commit/16a73471bb07ac4c4a320b885de83e9f44dc581e))
- **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
- improve store devtools logging. ([27f0f85](https://github.com/chrismichaelps/effuse/commit/27f0f85fd8cfedad05a1a5c3a7aca843aa843073))
- introduce new @effuse/query package for data fetching and update related dependencies. ([51c9380](https://github.com/chrismichaelps/effuse/commit/51c938043dede6fc21186888595a12aa18441e90))
- **store:** add RaceEmptyError and HydrationError tagged errors ([c05e7bf](https://github.com/chrismichaelps/effuse/commit/c05e7bfc62728b377235aa5d965fa1c6a2159840))

### Bug Fixes

- add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))
- sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

### Documentation

- add basic comments to store services, actions, and utilities. ([17560b5](https://github.com/chrismichaelps/effuse/commit/17560b54e1680ed90cc6a65b531b112d25b58da7))

### Code Refactoring

- add custom tagged error types across core, router, and store packages for improved error handling. ([c4175c9](https://github.com/chrismichaelps/effuse/commit/c4175c923f79497001838ca1f96ec4f45d1f5629))
- remove unused services, no-op implementations, and simplify store persistence utilities. ([dfabafd](https://github.com/chrismichaelps/effuse/commit/dfabafdc0993ed02647eb9e4e36def9b171ea4a2))
- standardize error classes to extend Data.TaggedError and centralize their definitions. ([e7f80c1](https://github.com/chrismichaelps/effuse/commit/e7f80c1c3bb52a8fad13366b16eeca6c69f48aca))
- **store:** apply Effect patterns in store, connector, schema ([60f37d8](https://github.com/chrismichaelps/effuse/commit/60f37d854af8790530449d489216f5c006266db1))
- unexport internal Effect utilities and clean up API surface ([945a9e0](https://github.com/chrismichaelps/effuse/commit/945a9e077e1cd21b30fa7d31b516b12f4384863c))
