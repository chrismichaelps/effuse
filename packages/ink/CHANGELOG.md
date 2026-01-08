## @effuse/ink [1.0.3](https://github.com/chrismichaelps/effuse/compare/@effuse/ink@1.0.2...@effuse/ink@1.0.3) (2026-01-08)


### Dependencies

* **@effuse/core:** upgraded to 1.0.3

## @effuse/ink [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/ink@1.0.1...@effuse/ink@1.0.2) (2026-01-08)

### Bug Fixes

* restore workspace:* references for core to resolve deadlock ([da8fce4](https://github.com/chrismichaelps/effuse/commit/da8fce440254b0ec41cbd0524fd8a97b66d5c739))


### Dependencies

* **@effuse/core:** upgraded to 1.0.2

## @effuse/ink [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/ink@1.0.0...@effuse/ink@1.0.1) (2026-01-08)

### Bug Fixes

* add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))
* restore workspace:* references in i18n and ink packages ([6463206](https://github.com/chrismichaelps/effuse/commit/6463206ed6e5fcbec4de16471798bc545df4f612))

## @effuse/ink 1.0.0 (2026-01-08)

### Features

* add cancellable, timeout, retry, and debounced/throttled actions, along with async reactivity features. ([16a7347](https://github.com/chrismichaelps/effuse/commit/16a73471bb07ac4c4a320b885de83e9f44dc581e))
* **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
* **ink:** add auto-generated ids for headings ([4add62f](https://github.com/chrismichaelps/effuse/commit/4add62f5ecad755278f037aae74d88507e3ffa9d))
* **ink:** enable reactive markdown rendering via signals. ([a1d979f](https://github.com/chrismichaelps/effuse/commit/a1d979f393ca5bb4797e58046ab736db0b0691dc))
* introduce new @effuse/query package for data fetching and update related dependencies. ([51c9380](https://github.com/chrismichaelps/effuse/commit/51c938043dede6fc21186888595a12aa18441e90))

### Bug Fixes

* sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

### Documentation

* Add explanatory comments to (core/ink/router) reactivity, router, and utility functions. ([4e33bc6](https://github.com/chrismichaelps/effuse/commit/4e33bc6324c1e233edaf6e0003f5bef38c3f0bbb))

### Code Refactoring

* remove core style management and service, shifting style injection responsibility to individual packages. ([5d2f891](https://github.com/chrismichaelps/effuse/commit/5d2f891353afdd7b7bdfbc797cdc8dc7958f4b4d))
* remove unused services, no-op implementations, and simplify store persistence utilities. ([dfabafd](https://github.com/chrismichaelps/effuse/commit/dfabafdc0993ed02647eb9e4e36def9b171ea4a2))
* unexport internal Effect utilities and clean up API surface ([945a9e0](https://github.com/chrismichaelps/effuse/commit/945a9e077e1cd21b30fa7d31b516b12f4384863c))
