## @effuse/router [1.2.4](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.2.3...@effuse/router@1.2.4) (2026-08-14)

### Documentation

* **packages:** strengthen ecosystem references refs [#598](https://github.com/chrismichaelps/effuse/issues/598) ([#600](https://github.com/chrismichaelps/effuse/issues/600)) ([d0db27e](https://github.com/chrismichaelps/effuse/commit/d0db27efcca337be2aa99584b97454913b11577e))


### Dependencies

* **@effuse/core:** upgraded to 2.1.0

## @effuse/router [1.2.3](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.2.2...@effuse/router@1.2.3) (2026-07-29)


### Dependencies

* **@effuse/core:** upgraded to 2.0.3

## @effuse/router [1.2.2](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.2.1...@effuse/router@1.2.2) (2026-07-28)

### Bug Fixes

* **router:** expose SSR-safe histories refs [#387](https://github.com/chrismichaelps/effuse/issues/387) ([6a16bdd](https://github.com/chrismichaelps/effuse/commit/6a16bdd0c7463e1ffd99bba6c9de8c666b253787))
* **router:** isolate SSR router context refs [#405](https://github.com/chrismichaelps/effuse/issues/405) ([4a25ecf](https://github.com/chrismichaelps/effuse/commit/4a25ecff97f0a4e8b82c98923d45b1f98d5764cb))


### Dependencies

* **@effuse/core:** upgraded to 2.0.2

## @effuse/router [1.2.1](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.2.0...@effuse/router@1.2.1) (2026-07-26)

### Bug Fixes

* **core:** restore downstream JSX contracts ([#380](https://github.com/chrismichaelps/effuse/issues/380)) ([0839a89](https://github.com/chrismichaelps/effuse/commit/0839a893a9c8852743dfdf35fb71b82f32dad956)), closes [#379](https://github.com/chrismichaelps/effuse/issues/379)


### Dependencies

* **@effuse/core:** upgraded to 2.0.1

## @effuse/router [1.2.0](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.1.5...@effuse/router@1.2.0) (2026-07-26)

### Features

* **core:** infer file handler route params refs [#278](https://github.com/chrismichaelps/effuse/issues/278) ([#280](https://github.com/chrismichaelps/effuse/issues/280)) ([cda6d22](https://github.com/chrismichaelps/effuse/commit/cda6d221bba2a9afc6daeaf7fecde565af6361e4))
* **core:** make template ownership explicit refs [#233](https://github.com/chrismichaelps/effuse/issues/233) ([#239](https://github.com/chrismichaelps/effuse/issues/239)) ([cd89615](https://github.com/chrismichaelps/effuse/commit/cd89615687061a5dd19178d1226691c77361a979))
* **layers:** enforce runtime binding registration refs [#188](https://github.com/chrismichaelps/effuse/issues/188) ([#227](https://github.com/chrismichaelps/effuse/issues/227)) ([2295cd7](https://github.com/chrismichaelps/effuse/commit/2295cd75a9af940626b042d38f13135f3df8b351))
* **router:** add cached lazy route helpers refs [#207](https://github.com/chrismichaelps/effuse/issues/207) ([8c1b840](https://github.com/chrismichaelps/effuse/commit/8c1b8403f05888196983066e19754fc7ae88c007))
* **router:** canonicalize nested aliases refs [#221](https://github.com/chrismichaelps/effuse/issues/221) ([430c1c8](https://github.com/chrismichaelps/effuse/commit/430c1c81dfa080e1d0254a61116f07331918d8bb))
* **router:** expose RouterView outlet states refs [#208](https://github.com/chrismichaelps/effuse/issues/208) ([75367dc](https://github.com/chrismichaelps/effuse/commit/75367dca9a30ac81da3f5f0b1e07a855645dfc7e))
* **router:** make route props the single source of truth refs [#253](https://github.com/chrismichaelps/effuse/issues/253) ([#262](https://github.com/chrismichaelps/effuse/issues/262)) ([b80a860](https://github.com/chrismichaelps/effuse/commit/b80a860d9b7e0703d6f4b916dd411f5c4fe74399))
* **router:** support grouped bracket routes refs [#219](https://github.com/chrismichaelps/effuse/issues/219) ([c58521c](https://github.com/chrismichaelps/effuse/commit/c58521c066dc8111ffe28ec75e5d08ea978b29ad))

### Bug Fixes

* **build:** declare lint config dependencies refs [#180](https://github.com/chrismichaelps/effuse/issues/180) ([e0fbf46](https://github.com/chrismichaelps/effuse/commit/e0fbf46866aac2452e0a2799b2efbe38e38977a3))
* **router:** aliases, per-router context, start sync, cleanup, afterEach leak ([#108](https://github.com/chrismichaelps/effuse/issues/108), [#111](https://github.com/chrismichaelps/effuse/issues/111), [#113](https://github.com/chrismichaelps/effuse/issues/113), [#114](https://github.com/chrismichaelps/effuse/issues/114), [#115](https://github.com/chrismichaelps/effuse/issues/115)) ([#119](https://github.com/chrismichaelps/effuse/issues/119)) ([f2ad8a8](https://github.com/chrismichaelps/effuse/commit/f2ad8a80f471f2af875a191079cd5cacd1e07532))
* **router:** harden route-view rendering refs [#186](https://github.com/chrismichaelps/effuse/issues/186) ([f3dd7d3](https://github.com/chrismichaelps/effuse/commit/f3dd7d34e45d370b9315813721edd18f4f33ee95))
* **router:** lazy route resolution, granular useRoute reactivity, beforeEnter guards ([#106](https://github.com/chrismichaelps/effuse/issues/106), [#107](https://github.com/chrismichaelps/effuse/issues/107), [#109](https://github.com/chrismichaelps/effuse/issues/109)) ([#118](https://github.com/chrismichaelps/effuse/issues/118)) ([2020986](https://github.com/chrismichaelps/effuse/commit/20209865beeec7c24f42bc24ede89cdd49abef9c))
* **router:** Link template signature and history browser safety ([#94](https://github.com/chrismichaelps/effuse/issues/94), [#95](https://github.com/chrismichaelps/effuse/issues/95)) ([#97](https://github.com/chrismichaelps/effuse/issues/97)) ([0a7e7e0](https://github.com/chrismichaelps/effuse/commit/0a7e7e0f37a9e5f5c4143f2976a650e1976a4ae7))
* **router:** mark lazy route components refs [#209](https://github.com/chrismichaelps/effuse/issues/209) ([4efde38](https://github.com/chrismichaelps/effuse/commit/4efde38dcee2c216e40c37f025bad17478f6d44a))
* **router:** normalize alias route groups refs [#225](https://github.com/chrismichaelps/effuse/issues/225) ([2417504](https://github.com/chrismichaelps/effuse/commit/241750459ce2fd95cd68af5bee960a53475feb84))
* **router:** preserve installs across HMR refs [#240](https://github.com/chrismichaelps/effuse/issues/240) ([#242](https://github.com/chrismichaelps/effuse/issues/242)) ([b9a6ec4](https://github.com/chrismichaelps/effuse/commit/b9a6ec47bf3987f3cc51f78f30611d19d86291f7))
* **router:** preserve native link attributes refs [#243](https://github.com/chrismichaelps/effuse/issues/243) ([#244](https://github.com/chrismichaelps/effuse/issues/244)) ([53d9e42](https://github.com/chrismichaelps/effuse/commit/53d9e42f108ce62ac098fb1eb8259b9d85b651ca))
* **router:** preserve parent route layouts refs [#224](https://github.com/chrismichaelps/effuse/issues/224) ([0d61cec](https://github.com/chrismichaelps/effuse/commit/0d61cecb09437b4330b131ce67487c3b1bb1960b))
* **router:** ranked matching, multi-value query, trailing slashes, tests ([#105](https://github.com/chrismichaelps/effuse/issues/105), [#110](https://github.com/chrismichaelps/effuse/issues/110), [#112](https://github.com/chrismichaelps/effuse/issues/112), [#116](https://github.com/chrismichaelps/effuse/issues/116)) ([#117](https://github.com/chrismichaelps/effuse/issues/117)) ([6b3506e](https://github.com/chrismichaelps/effuse/commit/6b3506e890228600f4c479ff803fe2c9159829d6)), closes [#109](https://github.com/chrismichaelps/effuse/issues/109)
* **router:** reject malformed bracket routes refs [#219](https://github.com/chrismichaelps/effuse/issues/219) ([215e48a](https://github.com/chrismichaelps/effuse/commit/215e48a1c7245d905030cd0b8cfcd0ba7bd5bec3))
* **router:** scope installation cleanup refs [#229](https://github.com/chrismichaelps/effuse/issues/229) ([cfdf49f](https://github.com/chrismichaelps/effuse/commit/cfdf49fc572e868f47b6b2781692ef9979f427db))
* **router:** scope nested outlet depth refs [#222](https://github.com/chrismichaelps/effuse/issues/222) ([369a597](https://github.com/chrismichaelps/effuse/commit/369a59743eb3653e4f7b349d65537eccd89fa6d4))
* **router:** unify async guard contracts refs [#223](https://github.com/chrismichaelps/effuse/issues/223) ([f8689a7](https://github.com/chrismichaelps/effuse/commit/f8689a7b5c315762d91847d0c1aef5b9f517d2e3))
* **ssr:** restore app layer context after server calls refs [#203](https://github.com/chrismichaelps/effuse/issues/203) ([a253699](https://github.com/chrismichaelps/effuse/commit/a2536997364b3a71ac641c80bf5bf98e7f2197a9))

### Code Refactoring

* **router:** adopt shared route patterns refs [#246](https://github.com/chrismichaelps/effuse/issues/246) ([#248](https://github.com/chrismichaelps/effuse/issues/248)) ([5eeed64](https://github.com/chrismichaelps/effuse/commit/5eeed64e49dc588e6edf06e5c1b419fb70f6a25f))

### Tests

* **repo:** enforce package-wide test execution refs [#363](https://github.com/chrismichaelps/effuse/issues/363) ([#368](https://github.com/chrismichaelps/effuse/issues/368)) ([99feb53](https://github.com/chrismichaelps/effuse/commit/99feb5301b82bcaeec5ff90bc9f01f88b19a7edd))
* **router:** cover grouped bracket routes refs [#219](https://github.com/chrismichaelps/effuse/issues/219) ([041053c](https://github.com/chrismichaelps/effuse/commit/041053cb652a18cb7fa9e6b482a972862bc871e6))


### Dependencies

* **@effuse/core:** upgraded to 2.0.0

## @effuse/router [1.1.5](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.1.4...@effuse/router@1.1.5) (2026-03-18)

### Bug Fixes

* resolve RouterNotInstalledError and preserve layer metadata ([#36](https://github.com/chrismichaelps/effuse/issues/36)) ([4c1383e](https://github.com/chrismichaelps/effuse/commit/4c1383e9f21b78351356c77107c0ac5259b9a64b))


### Dependencies

* **@effuse/core:** upgraded to 1.2.4

## @effuse/router [1.1.4](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.1.3...@effuse/router@1.1.4) (2026-03-18)

### Code Refactoring

* **core:** finalize watchEffect standardization across back-end packages ([c43a851](https://github.com/chrismichaelps/effuse/commit/c43a851cd745f969beab6a0273443164d85964fb))


### Dependencies

* **@effuse/core:** upgraded to 1.2.3

## @effuse/router [1.1.3](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.1.2...@effuse/router@1.1.3) (2026-03-18)

### Build System

* **deps:** update dependencies and pnpm version ([fd5e0c5](https://github.com/chrismichaelps/effuse/commit/fd5e0c57b883a4c5946c38d1e073218b8dd62120))


### Dependencies

* **@effuse/core:** upgraded to 1.2.2

## @effuse/router [1.1.2](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.1.1...@effuse/router@1.1.2) (2026-02-21)


### Dependencies

* **@effuse/core:** upgraded to 1.2.1

## @effuse/router [1.1.1](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.1.0...@effuse/router@1.1.1) (2026-02-19)


### Dependencies

* **@effuse/core:** upgraded to 1.2.0

## @effuse/router [1.1.0](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.0.2...@effuse/router@1.1.0) (2026-01-14)

### Features

- **router:** update navigation and view components to new patterns ([9241583](https://github.com/chrismichaelps/effuse/commit/92415833afc877af1e3add72f0db3acd634b020d))

### Code Refactoring

- **router|i18n:** replace manual type guards with Predicate ([75d7550](https://github.com/chrismichaelps/effuse/commit/75d755089fa29c9dd4a4d8149b1500f2405d243e))

### Dependencies

- **@effuse/core:** upgraded to 1.1.0

## @effuse/router [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.0.1...@effuse/router@1.0.2) (2026-01-08)

### Dependencies

- **@effuse/core:** upgraded to 1.0.3

## @effuse/router [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/router@1.0.0...@effuse/router@1.0.1) (2026-01-08)

### Bug Fixes

- restore workspace:\* references for core to resolve deadlock ([da8fce4](https://github.com/chrismichaelps/effuse/commit/da8fce440254b0ec41cbd0524fd8a97b66d5c739))

### Dependencies

- **@effuse/core:** upgraded to 1.0.2

## @effuse/router 1.0.0 (2026-01-08)

### Features

- **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
- **core, router:** implement support for compiler-generated function getters ([b833e1f](https://github.com/chrismichaelps/effuse/commit/b833e1f3b21a61cd71fd7f15dd5af5fd8ef5a93f))
- **core:** implement lifecycle hooks, props validation, and portal system ([9e4f9cc](https://github.com/chrismichaelps/effuse/commit/9e4f9ccab64b2d4c3201b7c539f5f0ccc7f70615))
- introduce new @effuse/query package for data fetching and update related dependencies. ([51c9380](https://github.com/chrismichaelps/effuse/commit/51c938043dede6fc21186888595a12aa18441e90))
- Simplify router API by removing Effect returns and introduce type safe router injection via EffuseRegistry. ([ae05e01](https://github.com/chrismichaelps/effuse/commit/ae05e012d9c9b3447f58f7d7bed637529cbd7493)), closes [#1](https://github.com/chrismichaelps/effuse/issues/1)

### Bug Fixes

- add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))
- Attribute Name Injection (XSS & Path Normalization Bypass ([4f499d3](https://github.com/chrismichaelps/effuse/commit/4f499d373b386b0378331386da60ac3981d426d5))
- **framework:** implement reactive function props and router signal fix ([386583b](https://github.com/chrismichaelps/effuse/commit/386583b4629c32df191d0ea35f6c76e3f7b35daa))
- sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

### Documentation

- Add explanatory comments to (core/ink/router) reactivity, router, and utility functions. ([4e33bc6](https://github.com/chrismichaelps/effuse/commit/4e33bc6324c1e233edaf6e0003f5bef38c3f0bbb))

### Code Refactoring

- add custom tagged error types across core, router, and store packages for improved error handling. ([c4175c9](https://github.com/chrismichaelps/effuse/commit/c4175c923f79497001838ca1f96ec4f45d1f5629))
- remove unused services, no-op implementations, and simplify store persistence utilities. ([dfabafd](https://github.com/chrismichaelps/effuse/commit/dfabafdc0993ed02647eb9e4e36def9b171ea4a2))
- **router:** adopt Effect patterns across router package ([9297614](https://github.com/chrismichaelps/effuse/commit/9297614d7d4350dfd7b344b1a1446e0ff3ab511e))
