## @effuse/i18n [1.0.6](https://github.com/chrismichaelps/effuse/compare/@effuse/i18n@1.0.5...@effuse/i18n@1.0.6) (2026-02-21)


### Dependencies

* **@effuse/core:** upgraded to 1.2.1

## @effuse/i18n [1.0.5](https://github.com/chrismichaelps/effuse/compare/@effuse/i18n@1.0.4...@effuse/i18n@1.0.5) (2026-02-19)


### Dependencies

* **@effuse/core:** upgraded to 1.2.0

## @effuse/i18n [1.0.4](https://github.com/chrismichaelps/effuse/compare/@effuse/i18n@1.0.3...@effuse/i18n@1.0.4) (2026-01-14)

### Bug Fixes

- **i18n:** enable strict interface support and improved type inference. ([d440778](https://github.com/chrismichaelps/effuse/commit/d4407789f68b158c1ea91cdd83b9d44fce64624c)), closes [#19](https://github.com/chrismichaelps/effuse/issues/19)

### Code Refactoring

- **router|i18n:** replace manual type guards with Predicate ([75d7550](https://github.com/chrismichaelps/effuse/commit/75d755089fa29c9dd4a4d8149b1500f2405d243e))

### Dependencies

- **@effuse/core:** upgraded to 1.1.0

## @effuse/i18n [1.0.3](https://github.com/chrismichaelps/effuse/compare/@effuse/i18n@1.0.2...@effuse/i18n@1.0.3) (2026-01-08)

### Dependencies

- **@effuse/core:** upgraded to 1.0.3

## @effuse/i18n [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/i18n@1.0.1...@effuse/i18n@1.0.2) (2026-01-08)

### Bug Fixes

- restore workspace:\* references for core to resolve deadlock ([da8fce4](https://github.com/chrismichaelps/effuse/commit/da8fce440254b0ec41cbd0524fd8a97b66d5c739))

### Dependencies

- **@effuse/core:** upgraded to 1.0.2

## @effuse/i18n [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/i18n@1.0.0...@effuse/i18n@1.0.1) (2026-01-08)

### Bug Fixes

- add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))
- restore workspace:\* references in i18n and ink packages ([6463206](https://github.com/chrismichaelps/effuse/commit/6463206ed6e5fcbec4de16471798bc545df4f612))

## @effuse/i18n 1.0.0 (2026-01-08)

### Features

- **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
- i18n package for internationalization. ([7a1469f](https://github.com/chrismichaelps/effuse/commit/7a1469f39c413cabc5d70e7d2033afbb087a3615))

### Bug Fixes

- **i18n:** allow arbitrary params in translation helper type ([12afbae](https://github.com/chrismichaelps/effuse/commit/12afbae475faaeda3a747f676e12946dfa7eaadc))
- sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

### Code Refactoring

- **i18n:** adopt Effect patterns in translator and i18n ([780a3e4](https://github.com/chrismichaelps/effuse/commit/780a3e441cd4fb1a11185e111594582274aa30c0))
- remove unused services, no-op implementations, and simplify store persistence utilities. ([dfabafd](https://github.com/chrismichaelps/effuse/commit/dfabafdc0993ed02647eb9e4e36def9b171ea4a2))
- standardize error classes to extend Data.TaggedError and centralize their definitions. ([e7f80c1](https://github.com/chrismichaelps/effuse/commit/e7f80c1c3bb52a8fad13366b16eeca6c69f48aca))
