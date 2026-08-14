## @effuse/compiler [1.0.6](https://github.com/chrismichaelps/effuse/compare/@effuse/compiler@1.0.5...@effuse/compiler@1.0.6) (2026-08-14)

### Bug Fixes

* **compiler:** detect signal access by walking children, not a type list ([#580](https://github.com/chrismichaelps/effuse/issues/580)) ([1579ab4](https://github.com/chrismichaelps/effuse/commit/1579ab462aa8be6af3947bfb0e9ad34f8e2fe8e2)), closes [#579](https://github.com/chrismichaelps/effuse/issues/579)
* **compiler:** stop treating on* and handle* props as event handlers ([#575](https://github.com/chrismichaelps/effuse/issues/575)) ([0137a9c](https://github.com/chrismichaelps/effuse/commit/0137a9c5cf05cdb59bab89957ed92804ba790f0a)), closes [#574](https://github.com/chrismichaelps/effuse/issues/574)

### Documentation

* **packages:** strengthen ecosystem references refs [#598](https://github.com/chrismichaelps/effuse/issues/598) ([#600](https://github.com/chrismichaelps/effuse/issues/600)) ([d0db27e](https://github.com/chrismichaelps/effuse/commit/d0db27efcca337be2aa99584b97454913b11577e))

### Tests

* **compiler:** refresh the runtime-agreement replica and cover its gap ([#585](https://github.com/chrismichaelps/effuse/issues/585)) ([404ce06](https://github.com/chrismichaelps/effuse/commit/404ce0617d748340cd806b62808e76f84e3d4bca)), closes [#583](https://github.com/chrismichaelps/effuse/issues/583) [#584](https://github.com/chrismichaelps/effuse/issues/584)

## @effuse/compiler [1.0.5](https://github.com/chrismichaelps/effuse/compare/@effuse/compiler@1.0.4...@effuse/compiler@1.0.5) (2026-07-26)

### Bug Fixes

* **compiler:** add missing AST node coverage in containsSignalAccess ([#82](https://github.com/chrismichaelps/effuse/issues/82)) ([#92](https://github.com/chrismichaelps/effuse/issues/92)) ([1cc0b64](https://github.com/chrismichaelps/effuse/commit/1cc0b6426eb35696b45ec4ceb8a1ce07ca3cabb8))
* **compiler:** add tests and fix signal/event/attr bugs ([#81](https://github.com/chrismichaelps/effuse/issues/81), [#86](https://github.com/chrismichaelps/effuse/issues/86), [#87](https://github.com/chrismichaelps/effuse/issues/87), [#88](https://github.com/chrismichaelps/effuse/issues/88)) ([#90](https://github.com/chrismichaelps/effuse/issues/90)) ([d5a064d](https://github.com/chrismichaelps/effuse/commit/d5a064dc149dfb0fed7a8ff8d49d0ee7b0364fab))
* **compiler:** include config in cache key and bound cache size ([#83](https://github.com/chrismichaelps/effuse/issues/83), [#84](https://github.com/chrismichaelps/effuse/issues/84)) ([#91](https://github.com/chrismichaelps/effuse/issues/91)) ([33c5d0a](https://github.com/chrismichaelps/effuse/commit/33c5d0aa8e352293b9818a58b71a2adf0f7056ff))
* **framework:** harden async and build boundaries refs [#364](https://github.com/chrismichaelps/effuse/issues/364) ([#370](https://github.com/chrismichaelps/effuse/issues/370)) ([9c51801](https://github.com/chrismichaelps/effuse/commit/9c518010e78ade992062cbd665b3baaf09165f68))

### Code Refactoring

* **compiler:** remove Effect-TS wrappers ([#89](https://github.com/chrismichaelps/effuse/issues/89)) ([#93](https://github.com/chrismichaelps/effuse/issues/93)) ([e110069](https://github.com/chrismichaelps/effuse/commit/e110069c6b30af7e1bb4eb56418908f4ac6dc723))

### Tests

* **repo:** enforce package-wide test execution refs [#363](https://github.com/chrismichaelps/effuse/issues/363) ([#368](https://github.com/chrismichaelps/effuse/issues/368)) ([99feb53](https://github.com/chrismichaelps/effuse/commit/99feb5301b82bcaeec5ff90bc9f01f88b19a7edd))

## @effuse/compiler [1.0.4](https://github.com/chrismichaelps/effuse/compare/@effuse/compiler@1.0.3...@effuse/compiler@1.0.4) (2026-03-18)

### Build System

* **deps:** update dependencies and pnpm version ([fd5e0c5](https://github.com/chrismichaelps/effuse/commit/fd5e0c57b883a4c5946c38d1e073218b8dd62120))

## @effuse/compiler [1.0.3](https://github.com/chrismichaelps/effuse/compare/@effuse/compiler@1.0.2...@effuse/compiler@1.0.3) (2026-01-08)

### Bug Fixes

- trigger release for core and compiler ([e35df2f](https://github.com/chrismichaelps/effuse/commit/e35df2f65a199f7458fa50b3433a391f4d4bdd93))

## @effuse/compiler [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/compiler@1.0.1...@effuse/compiler@1.0.2) (2026-01-08)

### Bug Fixes

- add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))

## @effuse/compiler [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/compiler@1.0.0...@effuse/compiler@1.0.1) (2026-01-08)

### Bug Fixes

- sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

## @effuse/compiler 1.0.0 (2026-01-07)

### Features

- **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
- compiler package ([9f23e0f](https://github.com/chrismichaelps/effuse/commit/9f23e0fd57b56af06e9a2bb4de8b09a3c7b40efa))

### Bug Fixes

- **ci:** fix typecheck for monorepo with downlevelIteration ([2ec980f](https://github.com/chrismichaelps/effuse/commit/2ec980f03bed2a15444bfd4331e56a66de8117c5))

### Code Refactoring

- **compiler:** refine transformer error handling and unexport internal layers ([5a6b0b8](https://github.com/chrismichaelps/effuse/commit/5a6b0b8fc2f7db9013cc62dd5db5bd285092c2c6))
