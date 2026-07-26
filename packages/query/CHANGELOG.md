## @effuse/query [2.0.0](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.8...@effuse/query@2.0.0) (2026-07-26)

### ⚠ BREAKING CHANGES

* **query:** Global singleton and convenience functions removed.
Users must now explicitly provide a QueryClient via provideQueryClient()
or pass client directly to hooks.

### Features

* **query:** DX improvements — queryOptions, keepPreviousData, Effect queryFn, initialData ([#147](https://github.com/chrismichaelps/effuse/issues/147)) ([#153](https://github.com/chrismichaelps/effuse/issues/153)) ([ed9c8d3](https://github.com/chrismichaelps/effuse/commit/ed9c8d3cf54793ce240d3d4201f87689e8c7c0e4))
* **query:** expose reactive cache snapshots refs [#189](https://github.com/chrismichaelps/effuse/issues/189) ([a1d389c](https://github.com/chrismichaelps/effuse/commit/a1d389c9d929f79d360fc35a6bdc688b72459986))
* **query:** full QueryFilters API — exact, predicate, stale, fetchStatus, refetchType, type ([#144](https://github.com/chrismichaelps/effuse/issues/144)) ([#151](https://github.com/chrismichaelps/effuse/issues/151)) ([2a86b67](https://github.com/chrismichaelps/effuse/commit/2a86b672cf3ecc2656d2ccaca7df38162bec1200))
* **query:** improve useInfiniteQuery and add comprehensive jsonplaceholder integration test ([#166](https://github.com/chrismichaelps/effuse/issues/166)) ([08cd38c](https://github.com/chrismichaelps/effuse/commit/08cd38c139294d3ad1995820fcdd6c4432e5148c))
* **query:** multi-key optimistic mutations with selective invalidation ([#160](https://github.com/chrismichaelps/effuse/issues/160)) ([#161](https://github.com/chrismichaelps/effuse/issues/161)) ([a3728c7](https://github.com/chrismichaelps/effuse/commit/a3728c7068f9df8737b3b3ac39d033024ee93e62))
* **query:** MutationCache architecture, Mutation state machine, and useIsMutating hook ([#164](https://github.com/chrismichaelps/effuse/issues/164)) ([19cebee](https://github.com/chrismichaelps/effuse/commit/19cebee4f6bc18b018785936c9e5dedf8865bf4d))
* **query:** production invalidation architecture — mark stale, prefix matching, imperative cache API ([#144](https://github.com/chrismichaelps/effuse/issues/144)) ([#150](https://github.com/chrismichaelps/effuse/issues/150)) ([13068e3](https://github.com/chrismichaelps/effuse/commit/13068e3b5bfefc3ac2b83cb3d9e4b6e2e1c1cd29))
* **query:** QueryClient Provider with Effuse native provide/inject ([#145](https://github.com/chrismichaelps/effuse/issues/145)) ([#149](https://github.com/chrismichaelps/effuse/issues/149)) ([eacc53e](https://github.com/chrismichaelps/effuse/commit/eacc53e4182e8e95976dc2f2245f6c4f417e6904))
* **query:** QueryObserver architecture — state machine, shared queries, memoized select, AbortSignal ([#154](https://github.com/chrismichaelps/effuse/issues/154)) ([#155](https://github.com/chrismichaelps/effuse/issues/155)) ([f46a951](https://github.com/chrismichaelps/effuse/commit/f46a95185a2d0ac7b50a1890c671fee7003a3ae9))
* **query:** SSR dehydrate / hydrate — serialize and restore cache state ([#158](https://github.com/chrismichaelps/effuse/issues/158)) ([#159](https://github.com/chrismichaelps/effuse/issues/159)) ([e23ccf3](https://github.com/chrismichaelps/effuse/commit/e23ccf3352e33cc1f2c4d2e6952da4b34aafedb1))
* **query:** useIsFetching hook and createQueryKeys type-safe factory ([#162](https://github.com/chrismichaelps/effuse/issues/162)) ([19d341f](https://github.com/chrismichaelps/effuse/commit/19d341f8f6e60bda53449f979ef6449c532575cf))

### Bug Fixes

* **query:** P0 hook bugs — falsy data, broken equality, silent errors, memory leaks ([#148](https://github.com/chrismichaelps/effuse/issues/148)) ([8802933](https://github.com/chrismichaelps/effuse/commit/880293346797fa7767fe2e2fe8c943729bf15a84))
* **query:** remove global singleton, fix inFlightRequests leak, enforce explicit QueryClient ([#154](https://github.com/chrismichaelps/effuse/issues/154)) ([#157](https://github.com/chrismichaelps/effuse/issues/157)) ([10921e2](https://github.com/chrismichaelps/effuse/commit/10921e2a3ea7cf04c3089458553b0f50ab47e780))

### Code Refactoring

* **query:** make type-only boundaries explicit refs [#182](https://github.com/chrismichaelps/effuse/issues/182) ([675f81a](https://github.com/chrismichaelps/effuse/commit/675f81abadef17f006a42c9fd3d30b388870c699))
* **query:** use computed() signals for derived state in hooks ([#146](https://github.com/chrismichaelps/effuse/issues/146)) ([#152](https://github.com/chrismichaelps/effuse/issues/152)) ([6066273](https://github.com/chrismichaelps/effuse/commit/60662736380cdb1bf35a731dd9f605a13b841b2f))

### Tests

* **query:** real-world integration tests with jsonplaceholder.typicode.com ([#154](https://github.com/chrismichaelps/effuse/issues/154)) ([#156](https://github.com/chrismichaelps/effuse/issues/156)) ([522d714](https://github.com/chrismichaelps/effuse/commit/522d71460c330f679c2209c2e38812d0af097201))
* **query:** remove network from root integration refs [#202](https://github.com/chrismichaelps/effuse/issues/202) ([5e091ad](https://github.com/chrismichaelps/effuse/commit/5e091aded2c077c0c825c4e4b673df5551026072))
* **query:** use 2026 dates in hydration tests ([0297a1b](https://github.com/chrismichaelps/effuse/commit/0297a1b6bb3f1c433f730d7f00a295ff2c89b6b3))
* **repo:** stabilize node test gates refs [#180](https://github.com/chrismichaelps/effuse/issues/180) ([bb1bbfb](https://github.com/chrismichaelps/effuse/commit/bb1bbfbd9edf12d535bcc1a6d4a9c73108eebb51))

### Build System

* **query:** make package lint executable refs [#182](https://github.com/chrismichaelps/effuse/issues/182) ([2630b84](https://github.com/chrismichaelps/effuse/commit/2630b84b44527146c30e58273703bc8e760cb9ff))


### Dependencies

* **@effuse/core:** upgraded to 2.0.0

## @effuse/query [1.0.8](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.7...@effuse/query@1.0.8) (2026-03-18)


### Dependencies

* **@effuse/core:** upgraded to 1.2.4

## @effuse/query [1.0.7](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.6...@effuse/query@1.0.7) (2026-03-18)


### Dependencies

* **@effuse/core:** upgraded to 1.2.3

## @effuse/query [1.0.6](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.5...@effuse/query@1.0.6) (2026-03-18)

### Build System

* **deps:** update dependencies and pnpm version ([fd5e0c5](https://github.com/chrismichaelps/effuse/commit/fd5e0c57b883a4c5946c38d1e073218b8dd62120))


### Dependencies

* **@effuse/core:** upgraded to 1.2.2

## @effuse/query [1.0.5](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.4...@effuse/query@1.0.5) (2026-02-21)


### Dependencies

* **@effuse/core:** upgraded to 1.2.1

## @effuse/query [1.0.4](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.3...@effuse/query@1.0.4) (2026-02-19)


### Dependencies

* **@effuse/core:** upgraded to 1.2.0

## @effuse/query [1.0.3](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.2...@effuse/query@1.0.3) (2026-01-14)

### Code Refactoring

- **query:** migrate client to internal handler architecture ([de0eb73](https://github.com/chrismichaelps/effuse/commit/de0eb73f5d25ddca548a06cc3a2a6bbf45fb8d0d))

### Dependencies

- **@effuse/core:** upgraded to 1.1.0

## @effuse/query [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.1...@effuse/query@1.0.2) (2026-01-08)

### Dependencies

- **@effuse/core:** upgraded to 1.0.3

## @effuse/query [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/query@1.0.0...@effuse/query@1.0.1) (2026-01-08)

### Bug Fixes

- restore workspace:\* references for core to resolve deadlock ([da8fce4](https://github.com/chrismichaelps/effuse/commit/da8fce440254b0ec41cbd0524fd8a97b66d5c739))

### Dependencies

- **@effuse/core:** upgraded to 1.0.2

## @effuse/query 1.0.0 (2026-01-08)

### Features

- **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
- introduce new @effuse/query package for data fetching and update related dependencies. ([51c9380](https://github.com/chrismichaelps/effuse/commit/51c938043dede6fc21186888595a12aa18441e90))
- **query:** add QueryFetchError and InfiniteQueryError tagged errors ([ce81829](https://github.com/chrismichaelps/effuse/commit/ce81829ba6ff5fd3536d9cccce8c73d28f6350c2))

### Bug Fixes

- add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))
- sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

### Documentation

- add package README and update description for @effuse/query ([27de504](https://github.com/chrismichaelps/effuse/commit/27de5048410c3463f121341b4128dc2b9342a51e))

### Code Refactoring

- **query:** apply Effect patterns in query hooks and client ([9fc25f1](https://github.com/chrismichaelps/effuse/commit/9fc25f1c624313ac81fa3b4f7c417e12d5f00f65))
- **query:** replace new Error with tagged errors in hooks ([19b0155](https://github.com/chrismichaelps/effuse/commit/19b01552c75f5cee89460f157e6e428bf367728c))
- unexport internal Effect utilities and clean up API surface ([945a9e0](https://github.com/chrismichaelps/effuse/commit/945a9e077e1cd21b30fa7d31b516b12f4384863c))
