## @effuse/use [1.2.2](https://github.com/chrismichaelps/effuse/compare/@effuse/use@1.2.1...@effuse/use@1.2.2) (2026-07-28)

### Bug Fixes

* **use:** defer timing hooks until mount refs [#420](https://github.com/chrismichaelps/effuse/issues/420) ([#421](https://github.com/chrismichaelps/effuse/issues/421)) ([b88d8f4](https://github.com/chrismichaelps/effuse/commit/b88d8f439c44e588e7f783f6ed825d90592a0f17))
* **use:** separate media fallback from support refs [#422](https://github.com/chrismichaelps/effuse/issues/422) ([#423](https://github.com/chrismichaelps/effuse/issues/423)) ([d19d082](https://github.com/chrismichaelps/effuse/commit/d19d082e87f9f2578e8b828c76e402e848d58f01))
* **use:** stabilize SSR hydration lifecycle refs [#407](https://github.com/chrismichaelps/effuse/issues/407) ([3b21330](https://github.com/chrismichaelps/effuse/commit/3b2133068c537e098616311be90bb69b2b94230b))


### Dependencies

* **@effuse/core:** upgraded to 2.0.2

## @effuse/use [1.2.1](https://github.com/chrismichaelps/effuse/compare/@effuse/use@1.2.0...@effuse/use@1.2.1) (2026-07-26)

### Bug Fixes

* **core:** restore downstream JSX contracts ([#380](https://github.com/chrismichaelps/effuse/issues/380)) ([0839a89](https://github.com/chrismichaelps/effuse/commit/0839a893a9c8852743dfdf35fb71b82f32dad956)), closes [#379](https://github.com/chrismichaelps/effuse/issues/379)


### Dependencies

* **@effuse/core:** upgraded to 2.0.1

## @effuse/use [1.2.0](https://github.com/chrismichaelps/effuse/compare/@effuse/use@1.1.4...@effuse/use@1.2.0) (2026-07-26)

### Features

* **use:** add document visibility hook refs [#284](https://github.com/chrismichaelps/effuse/issues/284) ([#290](https://github.com/chrismichaelps/effuse/issues/290)) ([35bc897](https://github.com/chrismichaelps/effuse/commit/35bc897c6f13c685d7f6c2653f8fea7fa3ac1b6f))
* **use:** add lifecycle-owned timeout hook refs [#284](https://github.com/chrismichaelps/effuse/issues/284) ([#289](https://github.com/chrismichaelps/effuse/issues/289)) ([b94c56d](https://github.com/chrismichaelps/effuse/commit/b94c56dfd1ea54b6d04da41a89729cbc2f64d5cb))
* **use:** add lifecycle-safe async task hook refs [#307](https://github.com/chrismichaelps/effuse/issues/307) ([#309](https://github.com/chrismichaelps/effuse/issues/309)) ([6275a6c](https://github.com/chrismichaelps/effuse/commit/6275a6c35db115cfade38886aed1aea7b66419c3))
* **use:** add permission-aware clipboard hook refs [#284](https://github.com/chrismichaelps/effuse/issues/284) ([#291](https://github.com/chrismichaelps/effuse/issues/291)) ([463fa7f](https://github.com/chrismichaelps/effuse/commit/463fa7fc67eb2b45d345e79494868934e598aaea))
* **use:** add preferred color scheme hook refs [#284](https://github.com/chrismichaelps/effuse/issues/284) ([#292](https://github.com/chrismichaelps/effuse/issues/292)) ([c0c16c1](https://github.com/chrismichaelps/effuse/commit/c0c16c11709fe7e9703e1820d1c1cd3274449bec))
* **use:** expose interval paused state refs [#308](https://github.com/chrismichaelps/effuse/issues/308) ([#310](https://github.com/chrismichaelps/effuse/issues/310)) ([48f8f82](https://github.com/chrismichaelps/effuse/commit/48f8f82fb7e2efad869e17096f04a566387ef702))

### Bug Fixes

* **build:** declare lint config dependencies refs [#180](https://github.com/chrismichaelps/effuse/issues/180) ([e0fbf46](https://github.com/chrismichaelps/effuse/commit/e0fbf46866aac2452e0a2799b2efbe38e38977a3))
* **hooks:** own hook resources through lifecycle refs [#283](https://github.com/chrismichaelps/effuse/issues/283) ([#286](https://github.com/chrismichaelps/effuse/issues/286)) ([8f66384](https://github.com/chrismichaelps/effuse/commit/8f6638462b5528b2d7375859c0dc8960c0de2008))
* **use:** add package lint gate refs [#191](https://github.com/chrismichaelps/effuse/issues/191) ([4ff4e7b](https://github.com/chrismichaelps/effuse/commit/4ff4e7beefff6937ea21b4849f925f0d575d294f))
* **use:** preserve public hook inference refs [#285](https://github.com/chrismichaelps/effuse/issues/285) ([#287](https://github.com/chrismichaelps/effuse/issues/287)) ([636b305](https://github.com/chrismichaelps/effuse/commit/636b305526162966784be72467c449613acbed5b))


### Dependencies

* **@effuse/core:** upgraded to 2.0.0

## @effuse/use [1.1.4](https://github.com/chrismichaelps/effuse/compare/@effuse/use@1.1.3...@effuse/use@1.1.4) (2026-03-18)


### Dependencies

* **@effuse/core:** upgraded to 1.2.4

## @effuse/use [1.1.3](https://github.com/chrismichaelps/effuse/compare/@effuse/use@1.1.2...@effuse/use@1.1.3) (2026-03-18)

### Code Refactoring

* **core:** finalize watchEffect standardization across back-end packages ([c43a851](https://github.com/chrismichaelps/effuse/commit/c43a851cd745f969beab6a0273443164d85964fb))


### Dependencies

* **@effuse/core:** upgraded to 1.2.3

## @effuse/use [1.1.2](https://github.com/chrismichaelps/effuse/compare/@effuse/use@1.1.1...@effuse/use@1.1.2) (2026-03-18)

### Build System

* **deps:** update dependencies and pnpm version ([fd5e0c5](https://github.com/chrismichaelps/effuse/commit/fd5e0c57b883a4c5946c38d1e073218b8dd62120))


### Dependencies

* **@effuse/core:** upgraded to 1.2.2

## @effuse/use [1.1.1](https://github.com/chrismichaelps/effuse/compare/@effuse/use@1.1.0...@effuse/use@1.1.1) (2026-02-21)

### Bug Fixes

* **core:** restore publishConfig to @effuse/use and refine mount logic for release ([292c2cf](https://github.com/chrismichaelps/effuse/commit/292c2cfda960968501675fc1e4366920fdf87619))


### Dependencies

* **@effuse/core:** upgraded to 1.2.1

## @effuse/use [1.1.0](https://github.com/chrismichaelps/effuse/compare/@effuse/use@1.0.0...@effuse/use@1.1.0) (2026-02-19)

### Features

* add .releaserc.json to extend base release configuration ([34ebd38](https://github.com/chrismichaelps/effuse/commit/34ebd38451bcf39dbda3f40868f8763b22f2b709))

## @effuse/use 1.0.0 (2026-02-19)

### Features

* **use:** add internal utilities and shared telemetry system for hook lifecycle tracking. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([1fbc584](https://github.com/chrismichaelps/effuse/commit/1fbc5840a937e0bc83ebe89979628f9be555b045))
* **use:** add useDebounce hook for debouncing signal values with configurable delay and cancel/flush controls. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([cae496a](https://github.com/chrismichaelps/effuse/commit/cae496a46c6f95d430be0bd0933d2b22123cd22a))
* **use:** add useEventListener hook for safely attaching and cleaning up DOM event listeners. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([4ece1b3](https://github.com/chrismichaelps/effuse/commit/4ece1b35313463eb1755c1844e163f7d8dc4e2df))
* **use:** add useInterval hook for running callbacks at fixed intervals with start/stop controls. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([6e09071](https://github.com/chrismichaelps/effuse/commit/6e09071c8e9531f3decdaedf3c42a0208ed5d8f0))
* **use:** add useLocalStorage hook for persisting state across browser sessions with JSON support. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([d93a0c8](https://github.com/chrismichaelps/effuse/commit/d93a0c815fd6aa7091f15639ac58b2c061c959bc))
* **use:** add useMediaQuery hook for reactively tracking CSS media query matches. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([59cced6](https://github.com/chrismichaelps/effuse/commit/59cced69e8a80e55fbdf43abe09be4183b69bf76))
* **use:** add useOnline hook for tracking browser connectivity status. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([8b6edac](https://github.com/chrismichaelps/effuse/commit/8b6edac44e5e18124b3282ff5896071ce0223e5b))
* **use:** add useThrottle hook for throttling signal values with leading/trailing edge support. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([7e1695e](https://github.com/chrismichaelps/effuse/commit/7e1695e4ff553c5bd302b8d36d174fdf658b9ba9))
* **use:** add useWindowSize hook for tracking viewport dimensions with debounced updates. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([0b23400](https://github.com/chrismichaelps/effuse/commit/0b23400976dbadd34b530093de4aee31eb14d825))
* **use:** integrate telemetry calls into useMediaQuery for lifecycle tracking. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([25f99e0](https://github.com/chrismichaelps/effuse/commit/25f99e024620e81260911a436560258b9bf5c417))
* **use:** refactor telemetry to use global tracing service from @effuse/core. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([e361f75](https://github.com/chrismichaelps/effuse/commit/e361f75c26b607a80494838c3cc7185b2622e1b4))

### Bug Fixes

* **use:** make getTargetName compatible with Node.js test environment by using property detection. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([945dfdb](https://github.com/chrismichaelps/effuse/commit/945dfdba29064ac712d556d0e80dfa578899aaac))
* **use:** prevent useEventListener effect from re-attaching after stop. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([652ec39](https://github.com/chrismichaelps/effuse/commit/652ec3988bc32856dfe4b78eb28efd2d719b9b62))
* **use:** prevent useInterval effect from re-triggering start after pause/stop. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([edbc7fa](https://github.com/chrismichaelps/effuse/commit/edbc7faa226654ce7e832163675a2c8db756939d))
* **use:** resolve effect re-run race condition in useDebounce by updating lastSourceValue before state changes. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([e1e8666](https://github.com/chrismichaelps/effuse/commit/e1e866634600dfa7f1fbbde7f78fc699f7a1f753))
* **use:** resolve writeEffect/syncEffect race condition in useLocalStorage. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([e8e5d52](https://github.com/chrismichaelps/effuse/commit/e8e5d52a1321e481c229eb0e1e474849fd7833d9))

### Documentation

* update README to include new @effuse/use package entry. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([dc68d85](https://github.com/chrismichaelps/effuse/commit/dc68d8523cbe22f8fc12d24691b2805724324371))

### Code Refactoring

* **use:** apply formatting to useThrottle hook. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([c347d7a](https://github.com/chrismichaelps/effuse/commit/c347d7a60d1b54124c4dd73ea06b8e35a434d6f4))

### Tests

* **use:** add behavioral tests for hook state transitions and event handling. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([c3affbc](https://github.com/chrismichaelps/effuse/commit/c3affbc4c599ec0e69af8134338fda4ca83c0726))
* **use:** update telemetry tests to use @effuse/core global tracing API. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([faeb644](https://github.com/chrismichaelps/effuse/commit/faeb644f8f7df9955e3117a85c43190be2cb653e))


### Dependencies

* **@effuse/core:** upgraded to 1.2.0
