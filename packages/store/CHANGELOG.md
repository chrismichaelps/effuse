## @effuse/store [1.1.2](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.1.1...@effuse/store@1.1.2) (2026-07-28)

### Bug Fixes

* **store:** isolate async scopes per request refs [#392](https://github.com/chrismichaelps/effuse/issues/392) ([76d3282](https://github.com/chrismichaelps/effuse/commit/76d32824a514a16efbea6ab5e1ba3642e7459830))
* **store:** own concurrent action cleanup refs [#414](https://github.com/chrismichaelps/effuse/issues/414) ([#415](https://github.com/chrismichaelps/effuse/issues/415)) ([87fa811](https://github.com/chrismichaelps/effuse/commit/87fa8114764342fe2d647e4d0e091b0fcc2e4def))
* **store:** propagate async action cancellation refs [#416](https://github.com/chrismichaelps/effuse/issues/416) ([#417](https://github.com/chrismichaelps/effuse/issues/417)) ([3dd0e5f](https://github.com/chrismichaelps/effuse/commit/3dd0e5f25b27f7f1e807d381d5b7a472dc7135dc))
* **store:** wire registry to request scopes refs [#403](https://github.com/chrismichaelps/effuse/issues/403) ([eade2fb](https://github.com/chrismichaelps/effuse/commit/eade2fbddcda46c214ae3172b148ca856cb1bab3))


### Dependencies

* **@effuse/core:** upgraded to 2.0.2

## @effuse/store [1.1.1](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.1.0...@effuse/store@1.1.1) (2026-07-26)

### Bug Fixes

* **core:** restore downstream JSX contracts ([#380](https://github.com/chrismichaelps/effuse/issues/380)) ([0839a89](https://github.com/chrismichaelps/effuse/commit/0839a893a9c8852743dfdf35fb71b82f32dad956)), closes [#379](https://github.com/chrismichaelps/effuse/issues/379)


### Dependencies

* **@effuse/core:** upgraded to 2.0.1

## @effuse/store [1.1.0](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.8...@effuse/store@1.1.0) (2026-07-26)

### Features

* **store:** full audit — remove Effect from public API, fix leaks, fix batching, fix SSR, add regression tests ([#168](https://github.com/chrismichaelps/effuse/issues/168)) ([ed59018](https://github.com/chrismichaelps/effuse/commit/ed590182c54d6d656fe289b4419fd98f62d5d516))

### Tests

* **repo:** stabilize node test gates refs [#180](https://github.com/chrismichaelps/effuse/issues/180) ([bb1bbfb](https://github.com/chrismichaelps/effuse/commit/bb1bbfbd9edf12d535bcc1a6d4a9c73108eebb51))


### Dependencies

* **@effuse/core:** upgraded to 2.0.0

## @effuse/store [1.0.8](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.7...@effuse/store@1.0.8) (2026-03-18)


### Dependencies

* **@effuse/core:** upgraded to 1.2.4

## @effuse/store [1.0.7](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.6...@effuse/store@1.0.7) (2026-03-18)


### Dependencies

* **@effuse/core:** upgraded to 1.2.3

## @effuse/store [1.0.6](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.5...@effuse/store@1.0.6) (2026-03-18)

### Code Refactoring

* consolidate architectural improvements and error abstraction ([69af1b1](https://github.com/chrismichaelps/effuse/commit/69af1b1fe3efc8f5c2d74b51a6c2fb3b4b6ab30a)), closes [#23](https://github.com/chrismichaelps/effuse/issues/23) [#24](https://github.com/chrismichaelps/effuse/issues/24) [#25](https://github.com/chrismichaelps/effuse/issues/25)

### Build System

* **deps:** update dependencies and pnpm version ([fd5e0c5](https://github.com/chrismichaelps/effuse/commit/fd5e0c57b883a4c5946c38d1e073218b8dd62120))


### Dependencies

* **@effuse/core:** upgraded to 1.2.2

## @effuse/store [1.0.5](https://github.com/chrismichaelps/effuse/compare/@effuse/store@1.0.4...@effuse/store@1.0.5) (2026-02-21)


### Dependencies

* **@effuse/core:** upgraded to 1.2.1

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
