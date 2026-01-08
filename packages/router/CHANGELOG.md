## @effuse/router 1.0.0 (2026-01-08)

### Features

* **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
* **core, router:** implement support for compiler-generated function getters ([b833e1f](https://github.com/chrismichaelps/effuse/commit/b833e1f3b21a61cd71fd7f15dd5af5fd8ef5a93f))
* **core:** implement lifecycle hooks, props validation, and portal system ([9e4f9cc](https://github.com/chrismichaelps/effuse/commit/9e4f9ccab64b2d4c3201b7c539f5f0ccc7f70615))
* introduce new @effuse/query package for data fetching and update related dependencies. ([51c9380](https://github.com/chrismichaelps/effuse/commit/51c938043dede6fc21186888595a12aa18441e90))
* Simplify router API by removing Effect returns and introduce type safe router injection via EffuseRegistry. ([ae05e01](https://github.com/chrismichaelps/effuse/commit/ae05e012d9c9b3447f58f7d7bed637529cbd7493)), closes [#1](https://github.com/chrismichaelps/effuse/issues/1)

### Bug Fixes

* add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))
* Attribute Name Injection (XSS & Path Normalization Bypass ([4f499d3](https://github.com/chrismichaelps/effuse/commit/4f499d373b386b0378331386da60ac3981d426d5))
* **framework:** implement reactive function props and router signal fix ([386583b](https://github.com/chrismichaelps/effuse/commit/386583b4629c32df191d0ea35f6c76e3f7b35daa))
* sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

### Documentation

* Add explanatory comments to (core/ink/router) reactivity, router, and utility functions. ([4e33bc6](https://github.com/chrismichaelps/effuse/commit/4e33bc6324c1e233edaf6e0003f5bef38c3f0bbb))

### Code Refactoring

* add custom tagged error types across core, router, and store packages for improved error handling. ([c4175c9](https://github.com/chrismichaelps/effuse/commit/c4175c923f79497001838ca1f96ec4f45d1f5629))
* remove unused services, no-op implementations, and simplify store persistence utilities. ([dfabafd](https://github.com/chrismichaelps/effuse/commit/dfabafdc0993ed02647eb9e4e36def9b171ea4a2))
* **router:** adopt Effect patterns across router package ([9297614](https://github.com/chrismichaelps/effuse/commit/9297614d7d4350dfd7b344b1a1446e0ff3ab511e))
