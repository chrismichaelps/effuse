## @effuse/core [1.1.0](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.0.3...@effuse/core@1.1.0) (2026-01-14)

### Features

* **core:** Add comprehensive DOM event handlers Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([6321247](https://github.com/chrismichaelps/effuse/commit/6321247db5b08021919f080d816eb4ec071642e5))
* **core:** Add element-specific attribute interfaces Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([0ed70a1](https://github.com/chrismichaelps/effuse/commit/0ed70a1ea7d5c68bf227e26047effc0be82b10da))
* **core:** Add strict HTMLAttributes interface Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([2207453](https://github.com/chrismichaelps/effuse/commit/220745335e1bc420a9eb04dcd1134fe8d53187ed))
* **core:** Add strict JSX type unions Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([258ec5d](https://github.com/chrismichaelps/effuse/commit/258ec5d9a166cf152a563623f0097815bfb1eed3))
* **core:** Add WAI-ARIA 1.2 attribute types Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([809ffd8](https://github.com/chrismichaelps/effuse/commit/809ffd8069b298e3d1bd49f440664b273b93be52))
* **core:** Define IntrinsicElements interface Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([28cfa88](https://github.com/chrismichaelps/effuse/commit/28cfa880ebaaf52cd8ebfb0f984039256ed7a3f7))
* **core:** Export modular JSX type system Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([76be321](https://github.com/chrismichaelps/effuse/commit/76be32181ef6be5cdc1fc2f35141a575d11ed095))
* **core:** implement reactive refs and directives module ([cff6c2d](https://github.com/chrismichaelps/effuse/commit/cff6c2dbbc7a5e7929232be5bf3c13eb4796303c))
* **core:** integrate refs system into renderer ([4d191c9](https://github.com/chrismichaelps/effuse/commit/4d191c9321a0f006b29d0749418147ee9c751109))

### Bug Fixes

* **core:** explicitly re-export CreateElementNode from render/index ([fc03143](https://github.com/chrismichaelps/effuse/commit/fc03143463f46e3d27dc7c0944156099b44c82e7))
* **core:** refactor Fragment to callable function ([60662c1](https://github.com/chrismichaelps/effuse/commit/60662c13434919f49ab170833941e5430b5d9835))
* **core:** restore isEffuseNode export ([f2a1a63](https://github.com/chrismichaelps/effuse/commit/f2a1a63d07c61d848b5f6a1a43b2a982f44df2eb))

### Code Refactoring

* **core/blueprint:** replace manual type guards with Predicate ([bda20b1](https://github.com/chrismichaelps/effuse/commit/bda20b1f9753972b72c526c89b222a956372499d))
* **core/infra:** replace manual type guards with Predicate ([6d5d745](https://github.com/chrismichaelps/effuse/commit/6d5d745534acc63c5d3296d640a471132b1bb950))
* **core/reactivity:** replace manual type guards with Predicate ([fc1b0ee](https://github.com/chrismichaelps/effuse/commit/fc1b0ee62cd3559c0c40b4cd47820b0d121d7d71))
* **core/render:** replace manual type guards with Predicate ([3f20c56](https://github.com/chrismichaelps/effuse/commit/3f20c5610ea0dd358a9cdcb5d426bd58fe38b7fd))
* **core:** audit and consolidate suspense module and remove dead code ([a47dd08](https://github.com/chrismichaelps/effuse/commit/a47dd08af5d085d6d94cc665de6f81ba3666ca62))
* **core:** consolidate scattered constants into constants.ts ([dc97342](https://github.com/chrismichaelps/effuse/commit/dc97342178775eb42874c5e936d01f70ce700144))
* **core:** Migrate runtime to modular bindings Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([79a4325](https://github.com/chrismichaelps/effuse/commit/79a4325b2d9afe8a339429e0ab86f6cde9551292))
* **core:** remove dead internal services and devtools module ([e2b896e](https://github.com/chrismichaelps/effuse/commit/e2b896efb957417bbb5b0082e255690708fd1fb9))
* **core:** use tagged enums for node types and mount logic ([3a2c5fd](https://github.com/chrismichaelps/effuse/commit/3a2c5fd9646e3ae9a5ea844dbcf692fdf775964b))

### Tests

* **core:** add refs system comprehensive tests ([60ee23e](https://github.com/chrismichaelps/effuse/commit/60ee23ed8a7281b2e7e37300c4582fdd3e2a67a8))

## @effuse/core [1.0.3](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.0.2...@effuse/core@1.0.3) (2026-01-08)

### Bug Fixes

* **core:** export EffuseLayerRegistry to support module augmentation ([1050c3a](https://github.com/chrismichaelps/effuse/commit/1050c3a520c20d9925a7a31e2c23e743f8edf02a))

## @effuse/core [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.0.1...@effuse/core@1.0.2) (2026-01-08)

### Bug Fixes

* trigger release for core and compiler ([e35df2f](https://github.com/chrismichaelps/effuse/commit/e35df2f65a199f7458fa50b3433a391f4d4bdd93))

## @effuse/core [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.0.0...@effuse/core@1.0.1) (2026-01-08)

### Bug Fixes

* add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))

## @effuse/core 1.0.0 (2026-01-08)

### Features

*  implement a new  event demo page with i18n support ([1d1325f](https://github.com/chrismichaelps/effuse/commit/1d1325fd791cbffbea73d5f9c907c2f597cd3a40)), closes [#4](https://github.com/chrismichaelps/effuse/issues/4)
* add cancellable, timeout, retry, and debounced/throttled actions, along with async reactivity features. ([16a7347](https://github.com/chrismichaelps/effuse/commit/16a73471bb07ac4c4a320b885de83e9f44dc581e))
* add children support to blueprints ([dbe91ac](https://github.com/chrismichaelps/effuse/commit/dbe91ac5f840f1f960d7ff928f109d624b92601f))
* add flush option to effects ([84c5cca](https://github.com/chrismichaelps/effuse/commit/84c5cca05b7473bc3b60d767101737bcb26ad7d6))
* Add prop schema validation to blueprints and introduce named portal outlets. ([ef6044b](https://github.com/chrismichaelps/effuse/commit/ef6044bb1ded936adf241df0a9bf95afe1e3b3a4))
* add support for functional children in render nodes. ([827c976](https://github.com/chrismichaelps/effuse/commit/827c976b223906e323eaebd687366a0545161d06))
* **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
* **core, router:** implement support for compiler-generated function getters ([b833e1f](https://github.com/chrismichaelps/effuse/commit/b833e1f3b21a61cd71fd7f15dd5af5fd8ef5a93f))
* **core:** add layer registry auto-generator using Effect ([f1cdd3f](https://github.com/chrismichaelps/effuse/commit/f1cdd3f6e36b74828d41784bb82444116a92c647))
* **core:** add performance tracing and debug categories for hooks ([437527d](https://github.com/chrismichaelps/effuse/commit/437527d38f240066f46c30c1de91e58822b6da9b))
* **core:** add Repeat and Await components ([7a3ed33](https://github.com/chrismichaelps/effuse/commit/7a3ed33cc541f9bd0e5ddb6142ef91a245dca8b3))
* **core:** add ResourceFetchError and LayerExecutionError tagged errors ([e252549](https://github.com/chrismichaelps/effuse/commit/e252549469d939574e00d2f518321896d5a5afdc))
* **core:** add TaggedError utilities and guards ([72cd0c8](https://github.com/chrismichaelps/effuse/commit/72cd0c82fe6aacb22a5960d3fe3406ff2758abcf))
* **core:** add useCallback and useMemo hooks with automatic dependency tracking ([6c43c02](https://github.com/chrismichaelps/effuse/commit/6c43c02daf248b923d073e0ee6178e7c4ae9928a))
* **core:** detect circular dependencies in layer topology ([7837b26](https://github.com/chrismichaelps/effuse/commit/7837b260f519564861be44b7a808c1b5a1f7558f))
* **core:** export Context API utilities ([ad2ac44](https://github.com/chrismichaelps/effuse/commit/ad2ac449e512b67bc5647395dff569190dde56a6))
* **core:** implement category-based tracing and parallel layer initialization ([9578788](https://github.com/chrismichaelps/effuse/commit/957878874bf061487870bf95716ffec94aa096e6))
* **core:** implement category-based tracing system with logging ([cb7e925](https://github.com/chrismichaelps/effuse/commit/cb7e9251242b4097c211b4b987594092b6cddd75))
* **core:** implement Context API for dependency injection ([cea333a](https://github.com/chrismichaelps/effuse/commit/cea333a01ba566ad20e740d5e84d51eab0714dad))
* **core:** implement lifecycle hooks, props validation, and portal system ([9e4f9cc](https://github.com/chrismichaelps/effuse/commit/9e4f9ccab64b2d4c3201b7c539f5f0ccc7f70615))
* **core:** inject SetupContext into lifecycle hooks and add onReady ([d3c3354](https://github.com/chrismichaelps/effuse/commit/d3c33541ef9d68c9c03dfe8a3ebfaf224d6a2e0c))
* **emit:** add tracing for event emission and subscriptions ([b580da1](https://github.com/chrismichaelps/effuse/commit/b580da173f2559c3d289b5e35e373f59aec763a0))
* Fixed Double Proxying Bug and  Fixed Effect Tracking on Throw. ([d21ad2b](https://github.com/chrismichaelps/effuse/commit/d21ad2be23102e10ff1032b3f96d851a84594278))
* implement useForm hook, configuration, and  field validators. ([5a1a884](https://github.com/chrismichaelps/effuse/commit/5a1a884cba2469af689666a568cfe99ee3edd584))
* implement useStyles hook and CSS loading service, integrated into the define blueprint. ([b18fa91](https://github.com/chrismichaelps/effuse/commit/b18fa916c787eaaec689f6e05837d919bb42a3b2))
* introduce core emit module for reactive event signaling with hooks, modifiers. ([b277916](https://github.com/chrismichaelps/effuse/commit/b277916fbfef6236b74f0a6c610b42985e864d20)), closes [#4](https://github.com/chrismichaelps/effuse/issues/4)
* introduce new @effuse/query package for data fetching and update related dependencies. ([51c9380](https://github.com/chrismichaelps/effuse/commit/51c938043dede6fc21186888595a12aa18441e90))
* Introduce ReadonlySignal ([2524be8](https://github.com/chrismichaelps/effuse/commit/2524be8997bd8cc4f4ebea29288f6cf1cd5b2883))
* **reactivity:** add support for batched updates and array mutation methods ([5289079](https://github.com/chrismichaelps/effuse/commit/5289079a56e890feb34caf7e77ccc5443fd0e8a1))
* **reactivity:** add tracing for signal creation and updates ([c229422](https://github.com/chrismichaelps/effuse/commit/c229422f99c8d33bf7710b0865f7239ae97ed916))
* refactor i18n to use useTranslation hook with core error handling ([2aedfa0](https://github.com/chrismichaelps/effuse/commit/2aedfa0ce3539c25a932e116d4f59a487e89bbb2))
* refine reactivity core, including new proxy-utils and computed initialization. ([3466f2f](https://github.com/chrismichaelps/effuse/commit/3466f2fb3da640faed598498d6ba8215ebba7404))
* Replace generated layer registry with TypeScript module augmentation for layer type safety and add ref to docs md files. ([83118b3](https://github.com/chrismichaelps/effuse/commit/83118b38b090b7dbca35deea56d94b19eb2f92b5))
* **scripts:** support store property type inference in gen-layers ([f3fa29e](https://github.com/chrismichaelps/effuse/commit/f3fa29ec14737e2fbd62e7cc3d2937e5e6d33dce))
* **search:** integrate search into app header and add multi-language support ([96e6b9e](https://github.com/chrismichaelps/effuse/commit/96e6b9ece5f0192fc52a49148483e6b5803df99f))
* Simplify router API by removing Effect returns and introduce type safe router injection via EffuseRegistry. ([ae05e01](https://github.com/chrismichaelps/effuse/commit/ae05e012d9c9b3447f58f7d7bed637529cbd7493)), closes [#1](https://github.com/chrismichaelps/effuse/issues/1)
* update JSX style prop type to accept Partial<CSSStyleDeclaration> and a function returning string | Partial<CSSStyleDeclaration>. ([d351024](https://github.com/chrismichaelps/effuse/commit/d351024469566c3b9ca6205bb564aa3af381dfb6))

### Bug Fixes

* Attribute Name Injection (XSS & Path Normalization Bypass ([4f499d3](https://github.com/chrismichaelps/effuse/commit/4f499d373b386b0378331386da60ac3981d426d5))
* **core:** strict type cast for router fallback proxy ([58cc7da](https://github.com/chrismichaelps/effuse/commit/58cc7daac427dcb7070d8e1ddb38a17efcb3e468))
* **emit:** change EventMap to Record<string, any> for interface compat ([055ad6f](https://github.com/chrismichaelps/effuse/commit/055ad6f1f62c2fa553817e2bd59de80d1c3e8a1e))
* **framework:** implement reactive function props and router signal fix ([386583b](https://github.com/chrismichaelps/effuse/commit/386583b4629c32df191d0ea35f6c76e3f7b35daa))
* **reactivity:** handle frozen objects and fix self-modifying effect scheduling. ([fdd2576](https://github.com/chrismichaelps/effuse/commit/fdd2576c3830ae87a0da619734592fcbd0bde904))
* sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

### Documentation

* Add explanatory comments to (core/ink/router) reactivity, router, and utility functions. ([4e33bc6](https://github.com/chrismichaelps/effuse/commit/4e33bc6324c1e233edaf6e0003f5bef38c3f0bbb))

### Code Refactoring

*  Portal and PortalOutlet components and update SearchModal to use them ([c98a3b3](https://github.com/chrismichaelps/effuse/commit/c98a3b3702fc2b44ddb5e1b8c2008ceec0a8c888))
* add custom tagged error types across core, router, and store packages for improved error handling. ([c4175c9](https://github.com/chrismichaelps/effuse/commit/c4175c923f79497001838ca1f96ec4f45d1f5629))
* **blueprint:** adopt Effect patterns with Predicate and Option ([a9366f8](https://github.com/chrismichaelps/effuse/commit/a9366f82be8b56595ea306a632fc3c9ec5b18e01))
* **core:** add store derivation and context providers to layers ([9d0bcfd](https://github.com/chrismichaelps/effuse/commit/9d0bcfd9ff8319c6af4e2143e0a22f0a320a8367))
* **core:** allow void return in onMount callback ([1732d15](https://github.com/chrismichaelps/effuse/commit/1732d150f2508a0e5cac8b4ab022167979f44581))
* **core:** fix tracing registration timing and integrate into layer runtime ([be2cf92](https://github.com/chrismichaelps/effuse/commit/be2cf927cdf002fc123f18638741535741e4a8e0))
* **core:** implement scoped defineHook api with effect-based lifecycle ([2a2579f](https://github.com/chrismichaelps/effuse/commit/2a2579ffd716ce7dffb05f27b2ef1e395de46d05))
* **core:** modernize control flow components with Effect patterns ([74d0d1a](https://github.com/chrismichaelps/effuse/commit/74d0d1a1d91f25316131d59e5208bfed7f1032ee))
* **core:** move error definitions to internal and cleanup legacy files ([4016a91](https://github.com/chrismichaelps/effuse/commit/4016a910b0ae68df409c6ae5d06f4dbe7a5a45fa))
* **core:** refine internal layer builder and topology patterns ([a16e059](https://github.com/chrismichaelps/effuse/commit/a16e059f2cf53f022f1d459a84777054e6f55f1f))
* **core:** update exports and add tagged error support ([86882b3](https://github.com/chrismichaelps/effuse/commit/86882b3ff89417167ac3f09ee6b8402c45c46326))
* **core:** update services to use consolidated error system ([90dab0b](https://github.com/chrismichaelps/effuse/commit/90dab0b496dc20722c9306e03001c413684537b0))
* **dom:** apply Effect patterns in mount service ([1a33426](https://github.com/chrismichaelps/effuse/commit/1a33426b946a2ded33667a15b8fdeb0cbaa0f2fa))
* **emit:** apply Effect patterns in emit hooks and services ([42962a1](https://github.com/chrismichaelps/effuse/commit/42962a1a0f1da1d2b63accb97b3a8bcc473a5c1d))
* **form:** adopt Effect patterns in useForm hook ([7f0e43b](https://github.com/chrismichaelps/effuse/commit/7f0e43b44905d1b4272f1c2f8706a1d80b8d46e1))
* **hooks:** simplify defineHook to 2-param generic <Config, Return> ([ee36610](https://github.com/chrismichaelps/effuse/commit/ee36610a318fbe74a908d64640de357182c90db2))
* **layers:** remove deprecated layer files ([529e4a9](https://github.com/chrismichaelps/effuse/commit/529e4a98fb55e1da71b8eabcda67ba1f8bd7a86c))
* **layers:** split layer system into modular architecture ([3dffba6](https://github.com/chrismichaelps/effuse/commit/3dffba608e2d0915349d3ffaad24d3432cdc68f4))
* **layers:** use Effect patterns in context and builder ([b8f0abf](https://github.com/chrismichaelps/effuse/commit/b8f0abf8cff70f045367356de5a49068cbe6a76b))
* modularize app error definitions into dedicated files and update import paths ([1ee8061](https://github.com/chrismichaelps/effuse/commit/1ee80612bfb38b87b3a6c196aea03730406b6bfa))
* **reactivity:** use Effect patterns in watch and proxy utils ([e7e3149](https://github.com/chrismichaelps/effuse/commit/e7e314960f734739289fd4f8f0da6a0de672763e))
* remove core style management and service, shifting style injection responsibility to individual packages. ([5d2f891](https://github.com/chrismichaelps/effuse/commit/5d2f891353afdd7b7bdfbc797cdc8dc7958f4b4d))
* remove unused services, no-op implementations, and simplify store persistence utilities. ([dfabafd](https://github.com/chrismichaelps/effuse/commit/dfabafdc0993ed02647eb9e4e36def9b171ea4a2))
* **render:** apply Effect patterns in element creation ([aaf0aa6](https://github.com/chrismichaelps/effuse/commit/aaf0aa6251a0394e40db693f4ea1a4d9bad6baef))
* **ssr:** adopt Effect patterns in head registry ([3c06861](https://github.com/chrismichaelps/effuse/commit/3c06861bc251af6831a9e5c484423cb740dc15d9))
* **suspense:** use Effect patterns in suspense utilities ([d426e7a](https://github.com/chrismichaelps/effuse/commit/d426e7a1947cf2eee93e995d88f88701f04eb539))
* **tracing:** apply Effect patterns across all tracing modules ([b2c0630](https://github.com/chrismichaelps/effuse/commit/b2c0630d842c69791497dcb803f614a39e75bbde))
* unexport internal Effect utilities and clean up API surface ([945a9e0](https://github.com/chrismichaelps/effuse/commit/945a9e077e1cd21b30fa7d31b516b12f4384863c))
