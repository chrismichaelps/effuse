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
