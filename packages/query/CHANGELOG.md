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
