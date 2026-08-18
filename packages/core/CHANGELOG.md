## @effuse/core [3.0.0](https://github.com/chrismichaelps/effuse/compare/@effuse/core@2.1.0...@effuse/core@3.0.0) (2026-08-18)

### ⚠ BREAKING CHANGES

* **core:** `timestamp` is removed from `HydrationData` and from the
serialized `__EFFUSE_DATA__` payload. Nothing in the workspace read it and it
was never surfaced through a documented API, but code inspecting the payload
directly will no longer find the field.
* **core:** `titleTemplate`, `htmlAttrs`, `bodyAttrs`, `noscript` and
`style` are removed from `HeadProps`. Passing any of them was already a no-op
in every code path, so no rendered output changes; only the type narrows.
Code that sets them will now fail to compile and can delete the property.
* **core:** `retry` and `timeout` are no longer accepted by
`EffectOptions` or `WatchOptions`, and the `RetryOptions` type is no
longer exported. Both options were no-ops, so code passing them only fails
to compile; no runtime behaviour changes. Remove them from any
`watchEffect` or `watch` call.

### Features

* **core:** give the SSR development error page a usable UI ([#667](https://github.com/chrismichaelps/effuse/issues/667)) ([bbdfee3](https://github.com/chrismichaelps/effuse/commit/bbdfee31f6fd69bb07a4fb5ea96a892920b7ce2a)), closes [#666](https://github.com/chrismichaelps/effuse/issues/666)

### Bug Fixes

* **core:** compare hydration state by content, not by serialisation ([#640](https://github.com/chrismichaelps/effuse/issues/640)) ([65b3170](https://github.com/chrismichaelps/effuse/commit/65b31704c95a0db686dd78c459204237617a1d17)), closes [#639](https://github.com/chrismichaelps/effuse/issues/639)
* **core:** debounce on the trailing edge of the burst, not the first trigger ([#634](https://github.com/chrismichaelps/effuse/issues/634)) ([95ca8d4](https://github.com/chrismichaelps/effuse/commit/95ca8d4b327372392470e588b1f8431a01cefcb9)), closes [#632](https://github.com/chrismichaelps/effuse/issues/632) [#633](https://github.com/chrismichaelps/effuse/issues/633)
* **core:** dedupe head meta tags by their kind, not by whichever field is set ([#643](https://github.com/chrismichaelps/effuse/issues/643)) ([377e80d](https://github.com/chrismichaelps/effuse/commit/377e80da2c530749b2a93177e22813deb505156c)), closes [#641](https://github.com/chrismichaelps/effuse/issues/641)
* **core:** keep the debounce timer handle cancellable across a reschedule ([#654](https://github.com/chrismichaelps/effuse/issues/654)) ([875c2bb](https://github.com/chrismichaelps/effuse/commit/875c2bb77799777076c4b88fb914d3fa8e52679e)), closes [#653](https://github.com/chrismichaelps/effuse/issues/653)
* **core:** keep the leading dash on vendor-prefixed style properties ([#652](https://github.com/chrismichaelps/effuse/issues/652)) ([cee89be](https://github.com/chrismichaelps/effuse/commit/cee89bef28ffd81a7bf1c8b66e1f49c1f3a14965)), closes [#651](https://github.com/chrismichaelps/effuse/issues/651)
* **core:** let createHandler express a CDN-cacheable Cache-Control ([#658](https://github.com/chrismichaelps/effuse/issues/658)) ([399bd60](https://github.com/chrismichaelps/effuse/commit/399bd60538f7f82bdf57ad5d1e2f991eb397f7b8)), closes [#657](https://github.com/chrismichaelps/effuse/issues/657)
* **core:** make readonly(signal) recognisable as a signal ([#638](https://github.com/chrismichaelps/effuse/issues/638)) ([40ff4b1](https://github.com/chrismichaelps/effuse/commit/40ff4b1ca957f8d0ef0f0fd01ff7c2c64672712c)), closes [#635](https://github.com/chrismichaelps/effuse/issues/635) [#637](https://github.com/chrismichaelps/effuse/issues/637)
* **core:** make SSR ETags deterministic and compare If-None-Match per RFC 7232 ([#664](https://github.com/chrismichaelps/effuse/issues/664)) ([be2a6fa](https://github.com/chrismichaelps/effuse/commit/be2a6fa67ca05e62106d28245b64fc1b20036a76)), closes [#658](https://github.com/chrismichaelps/effuse/issues/658) [#663](https://github.com/chrismichaelps/effuse/issues/663)
* **core:** make writableComputed recognisable as a signal ([#636](https://github.com/chrismichaelps/effuse/issues/636)) ([d0c9b99](https://github.com/chrismichaelps/effuse/commit/d0c9b9902ebc5d53693811e9930f996e5124c25e)), closes [#635](https://github.com/chrismichaelps/effuse/issues/635)
* **core:** merge SSR heads instead of spreading them over each other ([#660](https://github.com/chrismichaelps/effuse/issues/660)) ([c97ab8a](https://github.com/chrismichaelps/effuse/commit/c97ab8a5c7dc96184609ee176f55c5abf325257b)), closes [#643](https://github.com/chrismichaelps/effuse/issues/643) [#659](https://github.com/chrismichaelps/effuse/issues/659)
* **core:** reject a hydration payload that parses but has the wrong shape ([#656](https://github.com/chrismichaelps/effuse/issues/656)) ([38e1cf5](https://github.com/chrismichaelps/effuse/commit/38e1cf57e834da3c56454841c655fffef32a0c4a)), closes [#655](https://github.com/chrismichaelps/effuse/issues/655)
* **core:** remove the HeadProps keys that nothing renders ([#648](https://github.com/chrismichaelps/effuse/issues/648)) ([606fbc3](https://github.com/chrismichaelps/effuse/commit/606fbc36f17d3d1f08ce9d655444e8678cf90677)), closes [#642](https://github.com/chrismichaelps/effuse/issues/642)
* **core:** remove the inert retry and timeout effect options ([#632](https://github.com/chrismichaelps/effuse/issues/632)) ([a680c88](https://github.com/chrismichaelps/effuse/commit/a680c88f3717f2ee5af5f4c6c002709166edab69)), closes [#631](https://github.com/chrismichaelps/effuse/issues/631)
* **core:** send cache headers on every SSR response path, not just one ([#668](https://github.com/chrismichaelps/effuse/issues/668)) ([e7baf95](https://github.com/chrismichaelps/effuse/commit/e7baf95ed8e147116f274e3fd84edf2792a8e9d0)), closes [#631](https://github.com/chrismichaelps/effuse/issues/631) [#657](https://github.com/chrismichaelps/effuse/issues/657) [#664](https://github.com/chrismichaelps/effuse/issues/664) [#665](https://github.com/chrismichaelps/effuse/issues/665)
* **core:** stop SSR dropping on-prefixed props that are not event handlers ([#647](https://github.com/chrismichaelps/effuse/issues/647)) ([0c9a3c4](https://github.com/chrismichaelps/effuse/commit/0c9a3c441e66562f635e832406f4bced3a53fed1)), closes [#646](https://github.com/chrismichaelps/effuse/issues/646)
* **core:** stop SSR writing attribute values the client refuses to write ([#650](https://github.com/chrismichaelps/effuse/issues/650)) ([820ea31](https://github.com/chrismichaelps/effuse/commit/820ea314a2f92166228d09409a8061a0534dcdb5)), closes [#649](https://github.com/chrismichaelps/effuse/issues/649)
* **layers:** reject missing dependencies refs [#627](https://github.com/chrismichaelps/effuse/issues/627) ([#628](https://github.com/chrismichaelps/effuse/issues/628)) ([79ef249](https://github.com/chrismichaelps/effuse/commit/79ef2497450c6e1dfae505a05536fc9f6408fca8))
* **router:** resolve the requested route during SSR instead of always "/" ([#662](https://github.com/chrismichaelps/effuse/issues/662)) ([16a590d](https://github.com/chrismichaelps/effuse/commit/16a590da64299e51bb192993a4259f287fd2e435)), closes [#661](https://github.com/chrismichaelps/effuse/issues/661)
* **ssr:** trace final route cleanup outcome refs [#621](https://github.com/chrismichaelps/effuse/issues/621) ([#622](https://github.com/chrismichaelps/effuse/issues/622)) ([c4202e0](https://github.com/chrismichaelps/effuse/commit/c4202e0e6cf6a69a5e99964251a61be8daaa9deb))
* **ssr:** trace layer runtime setup refs [#619](https://github.com/chrismichaelps/effuse/issues/619) ([#620](https://github.com/chrismichaelps/effuse/issues/620)) ([d01348b](https://github.com/chrismichaelps/effuse/commit/d01348b09a72572e5fa8985a79cc4ea91a1fe650))

### Performance Improvements

* **ssr:** bypass empty server dispatch refs [#617](https://github.com/chrismichaelps/effuse/issues/617) ([#618](https://github.com/chrismichaelps/effuse/issues/618)) ([9816363](https://github.com/chrismichaelps/effuse/commit/9816363301ad769cadf3653147239dcfd6d5559f))
* **ssr:** bypass passive layer runtimes refs [#629](https://github.com/chrismichaelps/effuse/issues/629) ([#630](https://github.com/chrismichaelps/effuse/issues/630)) ([b049359](https://github.com/chrismichaelps/effuse/commit/b0493598efa6b50369a4f64fa02bfa355e8cbb1a))
* **ssr:** reuse app request handlers refs [#623](https://github.com/chrismichaelps/effuse/issues/623) ([#624](https://github.com/chrismichaelps/effuse/issues/624)) ([e16300e](https://github.com/chrismichaelps/effuse/commit/e16300e83f507999fd1ab9497301db592a9a837a))
* **ssr:** skip managed runtime for layerless renders refs [#614](https://github.com/chrismichaelps/effuse/issues/614) ([#615](https://github.com/chrismichaelps/effuse/issues/615)) ([859afdb](https://github.com/chrismichaelps/effuse/commit/859afdbbcf3dd9096b7da965f77c8cb12d3133d6))

## @effuse/core [2.1.0](https://github.com/chrismichaelps/effuse/compare/@effuse/core@2.0.3...@effuse/core@2.1.0) (2026-08-14)

### Features

* **core:** add asyncComputed with SSR collection and hydration ([f0451db](https://github.com/chrismichaelps/effuse/commit/f0451db8742bd712afbabf07c70c43109207f16c))
* **core:** add cross-tab coherence with leader election and synced signals ([722054d](https://github.com/chrismichaelps/effuse/commit/722054d4a4044582b6815eb409f4c6f3d231b2bd))
* **core:** add optimistic mutations with ordered rollback ([fb2e25f](https://github.com/chrismichaelps/effuse/commit/fb2e25f091369457c3f161dd64ea63bc3cc14ac7))

### Bug Fixes

* **core:** agree on which props never reach the DOM ([#548](https://github.com/chrismichaelps/effuse/issues/548)) ([56170ca](https://github.com/chrismichaelps/effuse/commit/56170ca62cecc4636962565369a5af4dde8d5bcf)), closes [#542](https://github.com/chrismichaelps/effuse/issues/542) [#547](https://github.com/chrismichaelps/effuse/issues/547)
* **core:** apply object and array class values on the client ([#544](https://github.com/chrismichaelps/effuse/issues/544)) ([cc51bc0](https://github.com/chrismichaelps/effuse/commit/cc51bc061f8a776f08ef503ee7bdc69013996401)), closes [#543](https://github.com/chrismichaelps/effuse/issues/543)
* **core:** apply string style values on the client ([#546](https://github.com/chrismichaelps/effuse/issues/546)) ([4ba2a83](https://github.com/chrismichaelps/effuse/commit/4ba2a834ebd9fc2b5307843663d81dc952d0ed74)), closes [#543](https://github.com/chrismichaelps/effuse/issues/543) [#545](https://github.com/chrismichaelps/effuse/issues/545)
* **core:** bind Await work to renderer ownership refs [#531](https://github.com/chrismichaelps/effuse/issues/531) ([#532](https://github.com/chrismichaelps/effuse/issues/532)) ([db09470](https://github.com/chrismichaelps/effuse/commit/db09470c8e2fdd4e3d1c102a881f93cc70ca772b))
* **core:** bind Suspense work to component lifetime refs [#511](https://github.com/chrismichaelps/effuse/issues/511) ([e705bef](https://github.com/chrismichaelps/effuse/commit/e705beffd1775fe1c55df8a8662de2fcc944fab9))
* **core:** contain a rejecting async watch callback ([#593](https://github.com/chrismichaelps/effuse/issues/593)) ([135806b](https://github.com/chrismichaelps/effuse/commit/135806ba7d438ee03af72811a0b2285264877d38)), closes [#590](https://github.com/chrismichaelps/effuse/issues/590) [#592](https://github.com/chrismichaelps/effuse/issues/592)
* **core:** count immediate callbacks toward once refs [#594](https://github.com/chrismichaelps/effuse/issues/594) ([#595](https://github.com/chrismichaelps/effuse/issues/595)) ([3c5f17c](https://github.com/chrismichaelps/effuse/commit/3c5f17cbefa7b37e580dbd3f2a09f65ab180f925))
* **core:** decide event handler props by one shared rule ([#583](https://github.com/chrismichaelps/effuse/issues/583)) ([c0e516b](https://github.com/chrismichaelps/effuse/commit/c0e516bd03cbeb34cfd87fa023c5d9ee6b02e602)), closes [#582](https://github.com/chrismichaelps/effuse/issues/582)
* **core:** dispose list node resources on teardown refs [#527](https://github.com/chrismichaelps/effuse/issues/527) ([#528](https://github.com/chrismichaelps/effuse/issues/528)) ([29bcef5](https://github.com/chrismichaelps/effuse/commit/29bcef5770eae36ce62b6576c8ecb12fc91856a8))
* **core:** drain dynamically registered Suspense work refs [#513](https://github.com/chrismichaelps/effuse/issues/513) ([3b32250](https://github.com/chrismichaelps/effuse/commit/3b32250f6cb26f7a2349f022bdd8ffd3aaf04010))
* **core:** drop server attributes hydration no longer renders ([#542](https://github.com/chrismichaelps/effuse/issues/542)) ([472852f](https://github.com/chrismichaelps/effuse/commit/472852f7f57b53abc4182f95d3b37f1e9ed8b5a9)), closes [#541](https://github.com/chrismichaelps/effuse/issues/541)
* **core:** enforce keyed portal ownership ([#508](https://github.com/chrismichaelps/effuse/issues/508)) ([b57ecf7](https://github.com/chrismichaelps/effuse/commit/b57ecf7e504a858189e52c8a18f84d8f7c95240f)), closes [#507](https://github.com/chrismichaelps/effuse/issues/507) [#507](https://github.com/chrismichaelps/effuse/issues/507)
* **core:** give distinct cache arguments distinct keys ([#568](https://github.com/chrismichaelps/effuse/issues/568)) ([753231e](https://github.com/chrismichaelps/effuse/commit/753231e48875d95a861ab0919801ff2048a50868)), closes [#567](https://github.com/chrismichaelps/effuse/issues/567)
* **core:** handle runtime disposal failure in renderToStream ([#558](https://github.com/chrismichaelps/effuse/issues/558)) ([2c26ef5](https://github.com/chrismichaelps/effuse/commit/2c26ef52fa8a7b9d29c420e97d0a35e9c99519cc)), closes [#557](https://github.com/chrismichaelps/effuse/issues/557)
* **core:** harden one-shot effect lifetime ([#502](https://github.com/chrismichaelps/effuse/issues/502)) ([efd0e2c](https://github.com/chrismichaelps/effuse/commit/efd0e2cf37665e80d26225e75f909e72e8eea8e6)), closes [#501](https://github.com/chrismichaelps/effuse/issues/501) [#501](https://github.com/chrismichaelps/effuse/issues/501)
* **core:** hold computed subscriptions only while observed ([#482](https://github.com/chrismichaelps/effuse/issues/482)) ([90604cd](https://github.com/chrismichaelps/effuse/commit/90604cd8e92ad022df71cad71eb56e51dfed1f8e)), closes [#480](https://github.com/chrismichaelps/effuse/issues/480)
* **core:** isolate async effect cleanup ownership refs [#503](https://github.com/chrismichaelps/effuse/issues/503) ([#504](https://github.com/chrismichaelps/effuse/issues/504)) ([3cfec36](https://github.com/chrismichaelps/effuse/commit/3cfec3688218afadd6698fcc983d39915c232cf5))
* **core:** isolate storage event synchronization refs [#505](https://github.com/chrismichaelps/effuse/issues/505) ([#506](https://github.com/chrismichaelps/effuse/issues/506)) ([f352b4c](https://github.com/chrismichaelps/effuse/commit/f352b4c6a65bad64be49d0bfcadc617b838d1c13))
* **core:** match click exclusions across event paths refs [#509](https://github.com/chrismichaelps/effuse/issues/509) ([#510](https://github.com/chrismichaelps/effuse/issues/510)) ([b4e238a](https://github.com/chrismichaelps/effuse/commit/b4e238af80512241bbbbeee1f9605ef92086d6c0))
* **core:** name route parameters from the route that matched ([#562](https://github.com/chrismichaelps/effuse/issues/562)) ([769d770](https://github.com/chrismichaelps/effuse/commit/769d7709bbc85e967b504c14ce627fb81bc60847)), closes [#559](https://github.com/chrismichaelps/effuse/issues/559)
* **core:** normalize htmlFor across renderers refs [#489](https://github.com/chrismichaelps/effuse/issues/489) ([#496](https://github.com/chrismichaelps/effuse/issues/496)) ([1c6dd81](https://github.com/chrismichaelps/effuse/commit/1c6dd8133e0d9c94a739c44f0877942831bb0841))
* **core:** notify observers when a prop appears or disappears ([#577](https://github.com/chrismichaelps/effuse/issues/577)) ([6221fc9](https://github.com/chrismichaelps/effuse/commit/6221fc9d3cb583d4051c6a39a724a9f1f9a0045b)), closes [#576](https://github.com/chrismichaelps/effuse/issues/576)
* **core:** own patched event listener lifetimes refs [#517](https://github.com/chrismichaelps/effuse/issues/517) ([86481cc](https://github.com/chrismichaelps/effuse/commit/86481cc53db9100660df7641094d93b7dbcca02d))
* **core:** preserve client DOM namespaces refs [#498](https://github.com/chrismichaelps/effuse/issues/498) ([#500](https://github.com/chrismichaelps/effuse/issues/500)) ([33d1c2c](https://github.com/chrismichaelps/effuse/commit/33d1c2c7d31c0fd97bdd3d802876d5dae13a5d3d))
* **core:** preserve DOM attribute namespaces refs [#497](https://github.com/chrismichaelps/effuse/issues/497) ([#499](https://github.com/chrismichaelps/effuse/issues/499)) ([9b1df31](https://github.com/chrismichaelps/effuse/commit/9b1df31613fa6df56d6dcb0e1154038519684067))
* **core:** prevent subscriptions after effect stop refs [#492](https://github.com/chrismichaelps/effuse/issues/492) ([#494](https://github.com/chrismichaelps/effuse/issues/494)) ([46a239b](https://github.com/chrismichaelps/effuse/commit/46a239bca88ee18500768715856cbd8ed6cd14c5))
* **core:** propagate ErrorBoundary failures refs [#487](https://github.com/chrismichaelps/effuse/issues/487) ([#493](https://github.com/chrismichaelps/effuse/issues/493)) ([ae337ae](https://github.com/chrismichaelps/effuse/commit/ae337ae42e979ab03e43332fb93ee98339d64f17))
* **core:** reconcile the client head instead of accumulating it ([#566](https://github.com/chrismichaelps/effuse/issues/566)) ([e3054fd](https://github.com/chrismichaelps/effuse/commit/e3054fd1a94daf66810a91187fd9372d7614aa8b)), closes [#565](https://github.com/chrismichaelps/effuse/issues/565)
* **core:** resolve trailing slashes the same in both server matchers ([#564](https://github.com/chrismichaelps/effuse/issues/564)) ([eda32ad](https://github.com/chrismichaelps/effuse/commit/eda32ade0cdb42509b5a8f8fb13cd757930c18ee)), closes [#563](https://github.com/chrismichaelps/effuse/issues/563)
* **core:** revoke component-owned emitters on unmount ([#540](https://github.com/chrismichaelps/effuse/issues/540)) ([3189bac](https://github.com/chrismichaelps/effuse/commit/3189bacb610b2dd26d26e0bba57225554d8d19b5)), closes [#539](https://github.com/chrismichaelps/effuse/issues/539)
* **core:** revoke ErrorBoundary state after teardown refs [#533](https://github.com/chrismichaelps/effuse/issues/533) ([#534](https://github.com/chrismichaelps/effuse/issues/534)) ([56612ad](https://github.com/chrismichaelps/effuse/commit/56612ad0dfa54b72476a42277ee1da107fbfb312))
* **core:** revoke observer delivery after teardown refs [#519](https://github.com/chrismichaelps/effuse/issues/519) ([6fcae38](https://github.com/chrismichaelps/effuse/commit/6fcae38f9554fe0576a687f087ab3ab485f4b707))
* **core:** route public unmount through cleanup refs [#529](https://github.com/chrismichaelps/effuse/issues/529) ([#530](https://github.com/chrismichaelps/effuse/issues/530)) ([66f689f](https://github.com/chrismichaelps/effuse/commit/66f689f0d6ff66dad80e9f12cdef892e4ce3a8bc))
* **core:** run watch cleanups untracked ([#591](https://github.com/chrismichaelps/effuse/issues/591)) ([80b3182](https://github.com/chrismichaelps/effuse/commit/80b3182006d05cf223e6c7d01fd227c414c45927)), closes [#590](https://github.com/chrismichaelps/effuse/issues/590)
* **core:** scope client useId render sequences refs [#488](https://github.com/chrismichaelps/effuse/issues/488) ([#490](https://github.com/chrismichaelps/effuse/issues/490)) ([a56dedf](https://github.com/chrismichaelps/effuse/commit/a56dedf5d7244359ec040f4fc300c14ac33ecb97))
* **core:** stabilize ref subscription ownership refs [#491](https://github.com/chrismichaelps/effuse/issues/491) ([#495](https://github.com/chrismichaelps/effuse/issues/495)) ([39de697](https://github.com/chrismichaelps/effuse/commit/39de69777c080be1fb4b72d3c72adc8ac69cfe85))
* **core:** stop a list from mounting after it unmounts ([#486](https://github.com/chrismichaelps/effuse/issues/486)) ([b70bf3a](https://github.com/chrismichaelps/effuse/commit/b70bf3aec0b6d4fac9a6373fa471e74fea8ceba8)), closes [#485](https://github.com/chrismichaelps/effuse/issues/485) [#484](https://github.com/chrismichaelps/effuse/issues/484) [#483](https://github.com/chrismichaelps/effuse/issues/483)
* **core:** stop event signal modifiers on unmount refs [#535](https://github.com/chrismichaelps/effuse/issues/535) ([#536](https://github.com/chrismichaelps/effuse/issues/536)) ([0356887](https://github.com/chrismichaelps/effuse/commit/0356887320f5a9348f75d942669e5362f101e937))
* **core:** stop form validation on teardown refs [#537](https://github.com/chrismichaelps/effuse/issues/537) ([#538](https://github.com/chrismichaelps/effuse/issues/538)) ([c24027d](https://github.com/chrismichaelps/effuse/commit/c24027d9061403129939445f61d227229dd9d6d3))
* **core:** transfer refs across reused DOM nodes refs [#515](https://github.com/chrismichaelps/effuse/issues/515) ([cb80b35](https://github.com/chrismichaelps/effuse/commit/cb80b35c77049a980e26c0bf8dd5f07d1a7173b9))
* **core:** unlearn a route's Vary when its responses stop sending one ([#556](https://github.com/chrismichaelps/effuse/issues/556)) ([2a7feea](https://github.com/chrismichaelps/effuse/commit/2a7feeac434bb3ae7bd68bfd1508fc91563bfb27)), closes [#553](https://github.com/chrismichaelps/effuse/issues/553)
* **ssr:** roll back failed runtime setup refs [#607](https://github.com/chrismichaelps/effuse/issues/607) ([#608](https://github.com/chrismichaelps/effuse/issues/608)) ([1c0480e](https://github.com/chrismichaelps/effuse/commit/1c0480e403f7db2db0673f160da161d76ee3cc71))

### Performance Improvements

* **core:** give signals and computeds a shared prototype shape ([#484](https://github.com/chrismichaelps/effuse/issues/484)) ([5924af7](https://github.com/chrismichaelps/effuse/commit/5924af71dd54aa8e7b24d3a36acdf0c5a5a60254)), closes [#483](https://github.com/chrismichaelps/effuse/issues/483)
* **core:** reduce SSR cold-start loading refs [#596](https://github.com/chrismichaelps/effuse/issues/596) ([#597](https://github.com/chrismichaelps/effuse/issues/597)) ([7dfd82d](https://github.com/chrismichaelps/effuse/commit/7dfd82de39c128f31093b4940f2b0b5a21ae094c))
* **core:** scan once when SSR escaping is needed ([#550](https://github.com/chrismichaelps/effuse/issues/550)) ([69b95bc](https://github.com/chrismichaelps/effuse/commit/69b95bc5c9f6b7ee97b809fd0f30d405b99306c4)), closes [#549](https://github.com/chrismichaelps/effuse/issues/549)
* **core:** take the Effect runtime off signal and ref hot paths, and detach refs on unmount ([#481](https://github.com/chrismichaelps/effuse/issues/481)) ([142b7fb](https://github.com/chrismichaelps/effuse/commit/142b7fb6991f21faabda4a386ff88e048f7f1953)), closes [#477](https://github.com/chrismichaelps/effuse/issues/477) [#478](https://github.com/chrismichaelps/effuse/issues/478) [#479](https://github.com/chrismichaelps/effuse/issues/479)

### Documentation

* **packages:** publish current framework contracts refs [#598](https://github.com/chrismichaelps/effuse/issues/598) ([#599](https://github.com/chrismichaelps/effuse/issues/599)) ([4c2b615](https://github.com/chrismichaelps/effuse/commit/4c2b615cbd11a702d92d6b1cd35132db0350de05))

### Tests

* **core:** assert the escaping strategy instead of timing it ([#581](https://github.com/chrismichaelps/effuse/issues/581)) ([41badba](https://github.com/chrismichaelps/effuse/commit/41badba028a8946d3fd8ef556c2ee6e31a45cdb6)), closes [#555](https://github.com/chrismichaelps/effuse/issues/555) [#573](https://github.com/chrismichaelps/effuse/issues/573)
* **core:** keep escaping cost comparisons out of the CI gate ([#573](https://github.com/chrismichaelps/effuse/issues/573)) ([4370a04](https://github.com/chrismichaelps/effuse/commit/4370a04baff617cc688d5fc396693751a0371bb0)), closes [#555](https://github.com/chrismichaelps/effuse/issues/555)
* **core:** pin that a resolved route always selects its middleware ([#572](https://github.com/chrismichaelps/effuse/issues/572)) ([6b6b9f9](https://github.com/chrismichaelps/effuse/commit/6b6b9f9709727d91d34b58fe331cdac6b97fa6d7)), closes [#564](https://github.com/chrismichaelps/effuse/issues/564) [pre-#564](https://github.com/chrismichaelps/pre-/issues/564) [#569](https://github.com/chrismichaelps/effuse/issues/569)
* **core:** sample escaping cost best-of-N instead of once ([#555](https://github.com/chrismichaelps/effuse/issues/555)) ([43f493d](https://github.com/chrismichaelps/effuse/commit/43f493d39a0ee0b4e5f5d970e51671c16a94af71)), closes [#554](https://github.com/chrismichaelps/effuse/issues/554)

## @effuse/core [2.0.3](https://github.com/chrismichaelps/effuse/compare/@effuse/core@2.0.2...@effuse/core@2.0.3) (2026-07-29)

### Bug Fixes

* **core:** adopt server markup during hydration refs [#432](https://github.com/chrismichaelps/effuse/issues/432) ([#433](https://github.com/chrismichaelps/effuse/issues/433)) ([5ddaa02](https://github.com/chrismichaelps/effuse/commit/5ddaa0237dbdef2bdeb3d9773f55e35f3350e81e))
* **ssr:** preserve executable client entries refs [#431](https://github.com/chrismichaelps/effuse/issues/431) ([#434](https://github.com/chrismichaelps/effuse/issues/434)) ([f0c7c01](https://github.com/chrismichaelps/effuse/commit/f0c7c015ade7ce6f7336de8190fe25b0080bf8f9))

## @effuse/core [2.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/core@2.0.1...@effuse/core@2.0.2) (2026-07-28)

### Bug Fixes

* **core:** defer browser hooks to mount refs [#409](https://github.com/chrismichaelps/effuse/issues/409) ([8682fd9](https://github.com/chrismichaelps/effuse/commit/8682fd911f2e8cc29fb85647178d49d96106335b))
* **core:** isolate SSR tracing per request refs [#398](https://github.com/chrismichaelps/effuse/issues/398) ([2449fe1](https://github.com/chrismichaelps/effuse/commit/2449fe18c8872237627991b66c6af45072cc6d56))
* **core:** make Deferred deterministic during SSR refs [#424](https://github.com/chrismichaelps/effuse/issues/424) ([#425](https://github.com/chrismichaelps/effuse/issues/425)) ([452044d](https://github.com/chrismichaelps/effuse/commit/452044d94684ef1ba327eb9e859b6b6db2d7b37b))
* **core:** prevent stale SSR context restoration refs [#400](https://github.com/chrismichaelps/effuse/issues/400) ([5d521a2](https://github.com/chrismichaelps/effuse/commit/5d521a26cabe10d219b1a319cc97a1930f272f03))
* **core:** scope generated IDs per SSR render refs [#390](https://github.com/chrismichaelps/effuse/issues/390) ([a568491](https://github.com/chrismichaelps/effuse/commit/a5684912410e3c2ba69721bca5dbbec1fab47ef6))
* **i18n:** preserve locale context across await refs [#391](https://github.com/chrismichaelps/effuse/issues/391) ([9faa718](https://github.com/chrismichaelps/effuse/commit/9faa7181c378dcfaaee836a9e44f83c2f410ea0f))
* **router:** isolate SSR router context refs [#405](https://github.com/chrismichaelps/effuse/issues/405) ([4a25ecf](https://github.com/chrismichaelps/effuse/commit/4a25ecff97f0a4e8b82c98923d45b1f98d5764cb))
* **ssr:** report serializable render failures refs [#388](https://github.com/chrismichaelps/effuse/issues/388) ([2623c51](https://github.com/chrismichaelps/effuse/commit/2623c51630499d53a468071a0c3eaa438631536c))

## @effuse/core [2.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/core@2.0.0...@effuse/core@2.0.1) (2026-07-26)

### Bug Fixes

* **core:** restore browser head exports ([#383](https://github.com/chrismichaelps/effuse/issues/383)) ([ba5c1cc](https://github.com/chrismichaelps/effuse/commit/ba5c1cc88b42f2c07fe9c8b5d6451b80262e6b07)), closes [#382](https://github.com/chrismichaelps/effuse/issues/382)
* **core:** restore downstream JSX contracts ([#380](https://github.com/chrismichaelps/effuse/issues/380)) ([0839a89](https://github.com/chrismichaelps/effuse/commit/0839a893a9c8852743dfdf35fb71b82f32dad956)), closes [#379](https://github.com/chrismichaelps/effuse/issues/379)

## @effuse/core [2.0.0](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.2.4...@effuse/core@2.0.0) (2026-07-26)

### ⚠ BREAKING CHANGES

* **core:** useMemo now returns ReadonlySignal<T> instead of () => T.
This aligns with signal.value and computed.value conventions.

- Update useMemo signature to return ReadonlySignal<T>
- Update define-props test to use .value accessor
- No other code in the repo uses useMemo, so impact is minimal

### Features

* **#41:** add LayersAccessor<L> type utility and runtime resolver ([1d75e2b](https://github.com/chrismichaelps/effuse/commit/1d75e2b20d0fffa7e3a92286d933b4183ad4c0d6)), closes [#41](https://github.com/chrismichaelps/effuse/issues/41)
* **#42:** rewrite HookContext — typed layers accessor, remove layer()/layerProvider() ([d779e60](https://github.com/chrismichaelps/effuse/commit/d779e60d38689c974638e4eac330536fb038ff13)), closes [#42](https://github.com/chrismichaelps/effuse/issues/42)
* **#43:** rewrite ScriptContext and define() — remove useLayer/useLayerProps/useLayerProvider/layer:string, add typed layers accessor ([c763b15](https://github.com/chrismichaelps/effuse/commit/c763b158a9d39a7ff437169471e7dc2fe0c65ea9)), closes [#43](https://github.com/chrismichaelps/effuse/issues/43)
* **#45:** delete EffuseLayerRegistry, EffuseServiceRegistry, EffuseComponentRegistry, LayerPropsOf, LayerProvidesOf, TypedLayerContext ([e62610c](https://github.com/chrismichaelps/effuse/commit/e62610c02b5971d48cc2fe24e7effdf2dcf63a45)), closes [#45](https://github.com/chrismichaelps/effuse/issues/45)
* **#46:** add typed LayersAccessor test coverage for defineHook and createHookContext ([6e42b2f](https://github.com/chrismichaelps/effuse/commit/6e42b2fa3c895889fd33d328464f38c7d069daa3)), closes [#46](https://github.com/chrismichaelps/effuse/issues/46)
* **#55:** fix LayersAccessor per-layer service types ([21670b8](https://github.com/chrismichaelps/effuse/commit/21670b803e37d53e19679e8fb52b2e8c9f549524))
* **#59:** Component-level HMR without page reloads ([#80](https://github.com/chrismichaelps/effuse/issues/80)) ([8d9b429](https://github.com/chrismichaelps/effuse/commit/8d9b429cf2a770d44ba777eda55919f831ba8e4b)), closes [#59](https://github.com/chrismichaelps/effuse/issues/59) [#59](https://github.com/chrismichaelps/effuse/issues/59)
* **#61:** eliminate global mutable state for concurrent SSR ([#68](https://github.com/chrismichaelps/effuse/issues/68)) ([88e88f5](https://github.com/chrismichaelps/effuse/commit/88e88f596fefd2a2f21e5f84a08f5e3716c0b608)), closes [#61](https://github.com/chrismichaelps/effuse/issues/61)
* **#67:** Add development warnings system ([#74](https://github.com/chrismichaelps/effuse/issues/74)) ([ef5e975](https://github.com/chrismichaelps/effuse/commit/ef5e97539547bd8cc21de0437494f87be09ba112)), closes [#67](https://github.com/chrismichaelps/effuse/issues/67)
* **#67:** Auto-generate layer hooks and cleaner template API ([#75](https://github.com/chrismichaelps/effuse/issues/75)) ([b167f9f](https://github.com/chrismichaelps/effuse/commit/b167f9f8789c48012db503de05a39851cbaa51cc)), closes [#67](https://github.com/chrismichaelps/effuse/issues/67)
* **cli:** generate manifest clients refs [#172](https://github.com/chrismichaelps/effuse/issues/172) ([8a96e21](https://github.com/chrismichaelps/effuse/commit/8a96e21af86e1fc7fd13e343cbe02dd72840b14f))
* **components:** add tracked View expressions refs [#211](https://github.com/chrismichaelps/effuse/issues/211) ([f7a248e](https://github.com/chrismichaelps/effuse/commit/f7a248edede4046b0fefd7aad1447645548dc52c))
* **core:** add component-level provide/inject ([#73](https://github.com/chrismichaelps/effuse/issues/73)) ([09cc06f](https://github.com/chrismichaelps/effuse/commit/09cc06f654647b38dfadc9d1ccd35a50d2cac877))
* **core:** add layer aliases and server service inference refs [#171](https://github.com/chrismichaelps/effuse/issues/171) ([bab8681](https://github.com/chrismichaelps/effuse/commit/bab8681f5e2fc7a3d372c3aa9cf1ac3876708ee3))
* **core:** add layer client error helpers refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([9b2c0b0](https://github.com/chrismichaelps/effuse/commit/9b2c0b094d6f524d3c73a719a4f082a07e270814))
* **core:** add layer server middleware metadata refs [#175](https://github.com/chrismichaelps/effuse/issues/175) ([2621eb7](https://github.com/chrismichaelps/effuse/commit/2621eb7270263a9474a5ce4782d76051101bbdb8))
* **core:** add native prop schema surface refs [#237](https://github.com/chrismichaelps/effuse/issues/237) ([#238](https://github.com/chrismichaelps/effuse/issues/238)) ([f3938ba](https://github.com/chrismichaelps/effuse/commit/f3938ba06da9f850581dacf9989c2747c21771a3))
* **core:** add reactive props proxy for automatic prop tracking ([#69](https://github.com/chrismichaelps/effuse/issues/69)) ([9e6ec45](https://github.com/chrismichaelps/effuse/commit/9e6ec453a142d0421a55d655404c1c46672596bf))
* **core:** add request-scoped locals and disposal to server handlers refs [#251](https://github.com/chrismichaelps/effuse/issues/251) ([#264](https://github.com/chrismichaelps/effuse/issues/264)) ([fbedc7c](https://github.com/chrismichaelps/effuse/commit/fbedc7c1237d4e03cdfbcc0da0b57dbf9df05e03))
* **core:** add scoped layer action clients refs [#171](https://github.com/chrismichaelps/effuse/issues/171) ([754260a](https://github.com/chrismichaelps/effuse/commit/754260a72f7f829d634febb7582eac10962c8d5b))
* **core:** add server observability hooks refs [#174](https://github.com/chrismichaelps/effuse/issues/174) ([5d58faf](https://github.com/chrismichaelps/effuse/commit/5d58faff6f2bf078413ede3c1f83f3dc7dfc8dda))
* **core:** add server request validation refs [#177](https://github.com/chrismichaelps/effuse/issues/177) ([ba2cc38](https://github.com/chrismichaelps/effuse/commit/ba2cc38880d7f515226ab079ff6f101255149ae6))
* **core:** add typed layer server errors refs [#177](https://github.com/chrismichaelps/effuse/issues/177) ([6e78391](https://github.com/chrismichaelps/effuse/commit/6e78391da8b2cc56a55b55e6fec39c80c6109be4))
* **core:** attach typed request contracts to server routes refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#267](https://github.com/chrismichaelps/effuse/issues/267)) ([c0e6530](https://github.com/chrismichaelps/effuse/commit/c0e6530eff134c8e5e618dc23d180d9e821915ef))
* **core:** compile declarative server policies across the layer hierarchy refs [#251](https://github.com/chrismichaelps/effuse/issues/251) ([#266](https://github.com/chrismichaelps/effuse/issues/266)) ([7287fe8](https://github.com/chrismichaelps/effuse/commit/7287fe872ba399d56db2a29eb566b2a9485898fe))
* **core:** diagnose server file routes refs [#173](https://github.com/chrismichaelps/effuse/issues/173) ([76c386b](https://github.com/chrismichaelps/effuse/commit/76c386b63b94208d93236d0cc86c98d165d88ff9))
* **core:** dispatch typed route clients in-process during SSR refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#270](https://github.com/chrismichaelps/effuse/issues/270)) ([ca17bd9](https://github.com/chrismichaelps/effuse/commit/ca17bd9f289bede0c1dd6e6965d8628224bdb7d8))
* **core:** enforce typed response contracts on server routes refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#268](https://github.com/chrismichaelps/effuse/issues/268)) ([7c3ed9f](https://github.com/chrismichaelps/effuse/commit/7c3ed9f8e78fd42bcde8159a756a61dc8f07c6d0))
* **core:** expose layer server manifests refs [#171](https://github.com/chrismichaelps/effuse/issues/171) ([f5ecfa1](https://github.com/chrismichaelps/effuse/commit/f5ecfa1e621afe413d02f1056f9e6f52dbb8ee15))
* **core:** generate OpenAPI 3.1 documents from route contracts refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#274](https://github.com/chrismichaelps/effuse/issues/274)) ([c94f3b2](https://github.com/chrismichaelps/effuse/commit/c94f3b297e5ff153d9b49bc526a73e15b27d06e1))
* **core:** generate typed manifest clients refs [#172](https://github.com/chrismichaelps/effuse/issues/172) ([16b682e](https://github.com/chrismichaelps/effuse/commit/16b682e690f5e8a25594f9706f662341cf1b647b))
* **core:** harden script context and prop contracts refs [#229](https://github.com/chrismichaelps/effuse/issues/229) ([45decaf](https://github.com/chrismichaelps/effuse/commit/45decaf65075bed28244b4e36c454f7637a90074))
* **core:** infer file handler contracts refs [#278](https://github.com/chrismichaelps/effuse/issues/278) ([#281](https://github.com/chrismichaelps/effuse/issues/281)) ([6437a37](https://github.com/chrismichaelps/effuse/commit/6437a371cfc31b9b4ae98dfcee6070b8ef432276))
* **core:** infer file handler response contracts refs [#278](https://github.com/chrismichaelps/effuse/issues/278) ([#282](https://github.com/chrismichaelps/effuse/issues/282)) ([7edbb00](https://github.com/chrismichaelps/effuse/commit/7edbb00dbc97718558237770f289843842729914))
* **core:** infer file handler route params refs [#278](https://github.com/chrismichaelps/effuse/issues/278) ([#280](https://github.com/chrismichaelps/effuse/issues/280)) ([cda6d22](https://github.com/chrismichaelps/effuse/commit/cda6d221bba2a9afc6daeaf7fecde565af6361e4))
* **core:** infer schema prop inputs refs [#232](https://github.com/chrismichaelps/effuse/issues/232) ([#236](https://github.com/chrismichaelps/effuse/issues/236)) ([e8eb57b](https://github.com/chrismichaelps/effuse/commit/e8eb57bd34e4611b33eade7f29749430730be9e2))
* **core:** make template ownership explicit refs [#233](https://github.com/chrismichaelps/effuse/issues/233) ([#239](https://github.com/chrismichaelps/effuse/issues/239)) ([cd89615](https://github.com/chrismichaelps/effuse/commit/cd89615687061a5dd19178d1226691c77361a979))
* **core:** map server files into layer APIs refs [#173](https://github.com/chrismichaelps/effuse/issues/173) ([622c2e8](https://github.com/chrismichaelps/effuse/commit/622c2e8e37707c84db87c3eea7214cdd9132794c))
* **core:** model streaming and binary responses as a route contract refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#271](https://github.com/chrismichaelps/effuse/issues/271)) ([4f92856](https://github.com/chrismichaelps/effuse/commit/4f928566221a00b0804b6bb0b0ce8bd87d92d050))
* **core:** propagate route contract types to a typed client refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#269](https://github.com/chrismichaelps/effuse/issues/269)) ([b6d08c9](https://github.com/chrismichaelps/effuse/commit/b6d08c9ec6852ac4109897de2743b2ab5e66bd77))
* **core:** propagate typed error contracts to the route client refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#273](https://github.com/chrismichaelps/effuse/issues/273)) ([dc37a24](https://github.com/chrismichaelps/effuse/commit/dc37a24e00f83925279a9c2713efdc491f2d6d77))
* **core:** type and validate multipart file uploads in request contracts refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#272](https://github.com/chrismichaelps/effuse/issues/272)) ([ea787df](https://github.com/chrismichaelps/effuse/commit/ea787dfb3257050c63c7f7154667360276706ae1))
* **core:** type JSX events with concrete targets refs [#311](https://github.com/chrismichaelps/effuse/issues/311) ([#312](https://github.com/chrismichaelps/effuse/issues/312)) ([9af3ea7](https://github.com/chrismichaelps/effuse/commit/9af3ea77f0492d65b4780aa510c16f9c0e431121))
* **core:** unify layer DX and server routes refs [#171](https://github.com/chrismichaelps/effuse/issues/171) ([46d98d8](https://github.com/chrismichaelps/effuse/commit/46d98d8c766242106d8622cac08a61d2f6486827))
* **core:** useId, useLocalStorage, useSessionStorage, useOnClickOutside, useResizeObserver, useIntersectionObserver, Await deferred ([#137](https://github.com/chrismichaelps/effuse/issues/137), [#138](https://github.com/chrismichaelps/effuse/issues/138), [#139](https://github.com/chrismichaelps/effuse/issues/139), [#140](https://github.com/chrismichaelps/effuse/issues/140)) ([#141](https://github.com/chrismichaelps/effuse/issues/141)) ([d6478d7](https://github.com/chrismichaelps/effuse/commit/d6478d774ceced85754ef0a0560c7ede013a8825))
* **core:** useMemo returns ReadonlySignal instead of getter ([#72](https://github.com/chrismichaelps/effuse/issues/72)) ([0e41f41](https://github.com/chrismichaelps/effuse/commit/0e41f418fd0a289bf4498c627968a54772361c68))
* **hooks:** own async lifecycle cancellation refs [#305](https://github.com/chrismichaelps/effuse/issues/305) ([#306](https://github.com/chrismichaelps/effuse/issues/306)) ([26c4f56](https://github.com/chrismichaelps/effuse/commit/26c4f564f9c7710cbd7130ade96ce7d51e4ed0b3))
* **ink:** make prose styles SSR-safe refs [#313](https://github.com/chrismichaelps/effuse/issues/313) ([#315](https://github.com/chrismichaelps/effuse/issues/315)) ([e159df6](https://github.com/chrismichaelps/effuse/commit/e159df6d03ba71770aa342aba3a68f665f1065c4))
* **layers:** add dependency-aware service factories refs [#196](https://github.com/chrismichaelps/effuse/issues/196) ([9018ee1](https://github.com/chrismichaelps/effuse/commit/9018ee1eb05431b57ef47e8dfbd2a20780abe305))
* **layers:** add typed entry helpers refs [#210](https://github.com/chrismichaelps/effuse/issues/210) ([29c53ef](https://github.com/chrismichaelps/effuse/commit/29c53ef0e3010d944c952f750ed35bad8f668cba))
* **layers:** enforce runtime binding registration refs [#188](https://github.com/chrismichaelps/effuse/issues/188) ([#227](https://github.com/chrismichaelps/effuse/issues/227)) ([2295cd7](https://github.com/chrismichaelps/effuse/commit/2295cd75a9af940626b042d38f13135f3df8b351))
* **layers:** expose object service helper refs [#199](https://github.com/chrismichaelps/effuse/issues/199) ([82350ae](https://github.com/chrismichaelps/effuse/commit/82350ae099cc05953c866a7fd4de8102049be3b0))
* **query:** QueryClient Provider with Effuse native provide/inject ([#145](https://github.com/chrismichaelps/effuse/issues/145)) ([#149](https://github.com/chrismichaelps/effuse/issues/149)) ([eacc53e](https://github.com/chrismichaelps/effuse/commit/eacc53e4182e8e95976dc2f2245f6c4f417e6904))
* **render:** track define template reads refs [#212](https://github.com/chrismichaelps/effuse/issues/212) ([29cd8d4](https://github.com/chrismichaelps/effuse/commit/29cd8d42c051ec6e00d6069a7add000a43b08ae9))
* **router:** make route props the single source of truth refs [#253](https://github.com/chrismichaelps/effuse/issues/253) ([#262](https://github.com/chrismichaelps/effuse/issues/262)) ([b80a860](https://github.com/chrismichaelps/effuse/commit/b80a860d9b7e0703d6f4b916dd411f5c4fe74399))
* **routing:** centralize server route grammar refs [#245](https://github.com/chrismichaelps/effuse/issues/245) ([#247](https://github.com/chrismichaelps/effuse/issues/247)) ([3fe73b2](https://github.com/chrismichaelps/effuse/commit/3fe73b2eb87f8c3ad4e10a24b7e36c8d41a39b27))
* **server:** add cached() typed data cache refs [#341](https://github.com/chrismichaelps/effuse/issues/341) ([#342](https://github.com/chrismichaelps/effuse/issues/342)) ([d3294a8](https://github.com/chrismichaelps/effuse/commit/d3294a8f53451cba8affb2115526cd144231d764))
* **server:** add native request schemas refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#255](https://github.com/chrismichaelps/effuse/issues/255)) ([a25b9bf](https://github.com/chrismichaelps/effuse/commit/a25b9bf768d30569e927698f4f76ab8e8f956c56))
* **server:** add response cache with single-flight and tag invalidation refs [#339](https://github.com/chrismichaelps/effuse/issues/339) ([#340](https://github.com/chrismichaelps/effuse/issues/340)) ([b21d6c3](https://github.com/chrismichaelps/effuse/commit/b21d6c3993a7a6c0575945267813ef237766f9c4))
* **server:** bound request rewrites and rematch refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#326](https://github.com/chrismichaelps/effuse/issues/326)) ([7df1588](https://github.com/chrismichaelps/effuse/commit/7df1588023ce7386c0cab40bf73db4c610dc1545))
* **server:** compile matched lazy file registries refs [#300](https://github.com/chrismichaelps/effuse/issues/300) ([#302](https://github.com/chrismichaelps/effuse/issues/302)) ([ab426bd](https://github.com/chrismichaelps/effuse/commit/ab426bd257990b224001208346a8035699ff4888))
* **server:** compile scoped middleware graph refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#321](https://github.com/chrismichaelps/effuse/issues/321)) ([adf9c0d](https://github.com/chrismichaelps/effuse/commit/adf9c0d31cc6c657e1f182900b33e95dcb3af238))
* **server:** compose typed request contracts refs [#256](https://github.com/chrismichaelps/effuse/issues/256) ([#257](https://github.com/chrismichaelps/effuse/issues/257)) ([0facbc5](https://github.com/chrismichaelps/effuse/commit/0facbc5f2021000ffe1c3cb153a3214e0ac5029a))
* **server:** define portable middleware descriptors refs [#303](https://github.com/chrismichaelps/effuse/issues/303) ([#304](https://github.com/chrismichaelps/effuse/issues/304)) ([57f2dc4](https://github.com/chrismichaelps/effuse/commit/57f2dc476a305d06be6c91116183c179303a353a))
* **server:** propagate aborts and guarantee cleanup refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#327](https://github.com/chrismichaelps/effuse/issues/327)) ([f42f11c](https://github.com/chrismichaelps/effuse/commit/f42f11caab73ece1ef77657faeea3a6487d84f8e))
* **server:** reserve the framework-internal path namespace refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#329](https://github.com/chrismichaelps/effuse/issues/329)) ([ae29147](https://github.com/chrismichaelps/effuse/commit/ae29147bddc3f34411f72bf6b4f46c0b4084603b))
* **server:** run request middleware as an onion refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#322](https://github.com/chrismichaelps/effuse/issues/322)) ([458c91c](https://github.com/chrismichaelps/effuse/commit/458c91c4269fade984226b25c77ca00e4d559d28))
* **server:** trace middleware execution refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#328](https://github.com/chrismichaelps/effuse/issues/328)) ([d73b17e](https://github.com/chrismichaelps/effuse/commit/d73b17e7482aa64e5d5d15ef7bb3b720d1b67705))
* **server:** wire the response cache into route dispatch refs [#343](https://github.com/chrismichaelps/effuse/issues/343) ([#344](https://github.com/chrismichaelps/effuse/issues/344)) ([9a7fad7](https://github.com/chrismichaelps/effuse/commit/9a7fad7e457301a2a0c00c16fdafe53b4dbaae9a))
* **ssr:** add manifest preload support and fix RenderError double-wrapping ([1fa33c3](https://github.com/chrismichaelps/effuse/commit/1fa33c33a677d97c6b52e9953109901fa494695f)), closes [#59](https://github.com/chrismichaelps/effuse/issues/59)
* **ssr:** add streaming SSR and concurrency safety ([#58](https://github.com/chrismichaelps/effuse/issues/58)) ([d4bd8f7](https://github.com/chrismichaelps/effuse/commit/d4bd8f7ccd3c1015123ecd5fed9268f9878b619e))
* **ssr:** deferred-head streaming for constant time-to-first-chunk refs [#336](https://github.com/chrismichaelps/effuse/issues/336) ([#337](https://github.com/chrismichaelps/effuse/issues/337)) ([58206cc](https://github.com/chrismichaelps/effuse/commit/58206cc904e50700cb8b72424fa35c0f35a51701))
* **ssr:** support grouped optional api routes refs [#200](https://github.com/chrismichaelps/effuse/issues/200) ([296003a](https://github.com/chrismichaelps/effuse/commit/296003a331e849ad345ecff3b99849958fedce9f))
* **ssr:** support next-style server file roots refs [#194](https://github.com/chrismichaelps/effuse/issues/194) ([f338f7a](https://github.com/chrismichaelps/effuse/commit/f338f7ad08b09a9dfc28bef451ab6bcb03d5d2be))
* **use:** add document visibility hook refs [#284](https://github.com/chrismichaelps/effuse/issues/284) ([#290](https://github.com/chrismichaelps/effuse/issues/290)) ([35bc897](https://github.com/chrismichaelps/effuse/commit/35bc897c6f13c685d7f6c2653f8fea7fa3ac1b6f))
* **use:** add lifecycle-owned timeout hook refs [#284](https://github.com/chrismichaelps/effuse/issues/284) ([#289](https://github.com/chrismichaelps/effuse/issues/289)) ([b94c56d](https://github.com/chrismichaelps/effuse/commit/b94c56dfd1ea54b6d04da41a89729cbc2f64d5cb))
* **use:** add lifecycle-safe async task hook refs [#307](https://github.com/chrismichaelps/effuse/issues/307) ([#309](https://github.com/chrismichaelps/effuse/issues/309)) ([6275a6c](https://github.com/chrismichaelps/effuse/commit/6275a6c35db115cfade38886aed1aea7b66419c3))
* **use:** add permission-aware clipboard hook refs [#284](https://github.com/chrismichaelps/effuse/issues/284) ([#291](https://github.com/chrismichaelps/effuse/issues/291)) ([463fa7f](https://github.com/chrismichaelps/effuse/commit/463fa7fc67eb2b45d345e79494868934e598aaea))
* **use:** add preferred color scheme hook refs [#284](https://github.com/chrismichaelps/effuse/issues/284) ([#292](https://github.com/chrismichaelps/effuse/issues/292)) ([c0c16c1](https://github.com/chrismichaelps/effuse/commit/c0c16c11709fe7e9703e1820d1c1cd3274449bec))

### Bug Fixes

* **#40:** wire hook onMount to active component lifecycle, remove Effect from public lifecycle API ([4f351b4](https://github.com/chrismichaelps/effuse/commit/4f351b4430d7a0837498592b931e641664287e59)), closes [#40](https://github.com/chrismichaelps/effuse/issues/40)
* **#47:** remove Effect.Effect<T> leaks from Canvas, PropSchemaBuilder, and EffuseContext public interfaces ([fde50d6](https://github.com/chrismichaelps/effuse/commit/fde50d6b72aab915decd3ee15a6debe13a7e4fab)), closes [#47](https://github.com/chrismichaelps/effuse/issues/47)
* **app:** dispose mounted canvas on unmount refs [#213](https://github.com/chrismichaelps/effuse/issues/213) ([603b838](https://github.com/chrismichaelps/effuse/commit/603b83854da520dd0641886b0e60d1a43ce4c077))
* **build:** declare lint config dependencies refs [#180](https://github.com/chrismichaelps/effuse/issues/180) ([e0fbf46](https://github.com/chrismichaelps/effuse/commit/e0fbf46866aac2452e0a2799b2efbe38e38977a3))
* **core:** AsyncBoundary error passing, For stale closure, emit isolation, builder typed errors, form input types ([#130](https://github.com/chrismichaelps/effuse/issues/130), [#131](https://github.com/chrismichaelps/effuse/issues/131), [#132](https://github.com/chrismichaelps/effuse/issues/132), [#133](https://github.com/chrismichaelps/effuse/issues/133), [#134](https://github.com/chrismichaelps/effuse/issues/134)) ([#136](https://github.com/chrismichaelps/effuse/issues/136)) ([6f8bbec](https://github.com/chrismichaelps/effuse/commit/6f8bbec657a18da95ca49f0708465f3d07ee61dc))
* **core:** cache direct layer entries refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([878dfe4](https://github.com/chrismichaelps/effuse/commit/878dfe4ade236f876981be7693750eca8e248c66))
* **core:** compose native object schemas refs [#275](https://github.com/chrismichaelps/effuse/issues/275) ([#277](https://github.com/chrismichaelps/effuse/issues/277)) ([4c0e62f](https://github.com/chrismichaelps/effuse/commit/4c0e62fe1def937c3777244ed644a10f48ad6202))
* **core:** context registry isolation, SSR error logging, hydration escaping, context deduplication ([#126](https://github.com/chrismichaelps/effuse/issues/126), [#127](https://github.com/chrismichaelps/effuse/issues/127), [#128](https://github.com/chrismichaelps/effuse/issues/128), [#129](https://github.com/chrismichaelps/effuse/issues/129)) ([#135](https://github.com/chrismichaelps/effuse/issues/135)) ([e42e9d3](https://github.com/chrismichaelps/effuse/commit/e42e9d3602a6882012f217d90faec1d6f5ac0319))
* **core:** define memo dependency semantics refs [#234](https://github.com/chrismichaelps/effuse/issues/234) ([#241](https://github.com/chrismichaelps/effuse/issues/241)) ([bb9d282](https://github.com/chrismichaelps/effuse/commit/bb9d28255955a64b3e68f7a908dabe4e91264486))
* **core:** enforce layer service boundaries refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([978c61c](https://github.com/chrismichaelps/effuse/commit/978c61cebbfa59ded0d729a34d4fe8650a3aa4a7))
* **core:** enforce zero-warning lint gate refs [#181](https://github.com/chrismichaelps/effuse/issues/181) ([#228](https://github.com/chrismichaelps/effuse/issues/228)) ([5006670](https://github.com/chrismichaelps/effuse/commit/50066706e1d13595beae7e5a621b750fb4738470))
* **core:** export server cache contracts refs [#357](https://github.com/chrismichaelps/effuse/issues/357) ([#360](https://github.com/chrismichaelps/effuse/issues/360)) ([5879398](https://github.com/chrismichaelps/effuse/commit/587939849db273f15ca1ca42cff158b05395cd3d))
* **core:** harden browser client entry refs [#171](https://github.com/chrismichaelps/effuse/issues/171) ([897eccf](https://github.com/chrismichaelps/effuse/commit/897eccfa25f582deebc86829f3961c38f22e5873))
* **core:** harden OpenAPI route contracts refs [#250](https://github.com/chrismichaelps/effuse/issues/250) ([#276](https://github.com/chrismichaelps/effuse/issues/276)) ([b3fdd8e](https://github.com/chrismichaelps/effuse/commit/b3fdd8e7de1078109eda6bca9aa06a2e149cbffc))
* **core:** isSignalChild, SSR errors, ReactiveProps leak, Suspense globals, Effect.runSync misuse ([#120](https://github.com/chrismichaelps/effuse/issues/120), [#121](https://github.com/chrismichaelps/effuse/issues/121), [#122](https://github.com/chrismichaelps/effuse/issues/122), [#123](https://github.com/chrismichaelps/effuse/issues/123), [#124](https://github.com/chrismichaelps/effuse/issues/124)) ([#125](https://github.com/chrismichaelps/effuse/issues/125)) ([f66ca61](https://github.com/chrismichaelps/effuse/commit/f66ca615e741bc21d67f038e3155001c3f0c6149))
* **core:** keep server handlers out of browser entry refs [#206](https://github.com/chrismichaelps/effuse/issues/206) ([9c66ee3](https://github.com/chrismichaelps/effuse/commit/9c66ee3b038140e77e3e2d7f06821d75a4136404))
* **core:** make server middleware ordering and propagation deterministic refs [#251](https://github.com/chrismichaelps/effuse/issues/251) ([#265](https://github.com/chrismichaelps/effuse/issues/265)) ([2c7c5f5](https://github.com/chrismichaelps/effuse/commit/2c7c5f56cfdf6d89be9a1c7f11849fc092799755))
* **core:** publish layer context after runtime init refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([9820b99](https://github.com/chrismichaelps/effuse/commit/9820b99592e1b114d69b3ac1e09da0126200fe08))
* **core:** quiet optional prop reads refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([1d8e5da](https://github.com/chrismichaelps/effuse/commit/1d8e5da6f268e079716f11194e0cd61292841fa1))
* **core:** reject duplicate layer accessors refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([2477029](https://github.com/chrismichaelps/effuse/commit/2477029301aa804e76634a14a1d9bb71a46f7ec7))
* **core:** reject duplicate layer definitions refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([b5ccdfb](https://github.com/chrismichaelps/effuse/commit/b5ccdfbd661eabfa33a0ab32cca2447eab103ec9))
* **core:** stabilize layer services bags refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([4759810](https://github.com/chrismichaelps/effuse/commit/47598109e7ede8165c000157e512b2cbbea9cb47))
* **core:** surface lifecycle teardown failures refs [#231](https://github.com/chrismichaelps/effuse/issues/231) ([#235](https://github.com/chrismichaelps/effuse/issues/235)) ([f23bff7](https://github.com/chrismichaelps/effuse/commit/f23bff77597777b14b84e2aee74a29d5476db76b))
* **core:** sync layer service helper boundaries refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([55fcd68](https://github.com/chrismichaelps/effuse/commit/55fcd68897a170c1815aeb8ed6d7f0abebb23f15))
* **core:** unify root and server runtime identity refs [#354](https://github.com/chrismichaelps/effuse/issues/354) ([#362](https://github.com/chrismichaelps/effuse/issues/362)) ([a071974](https://github.com/chrismichaelps/effuse/commit/a071974501c70b6d628b998f96f6958ec394db80))
* **framework:** harden async and build boundaries refs [#364](https://github.com/chrismichaelps/effuse/issues/364) ([#370](https://github.com/chrismichaelps/effuse/issues/370)) ([9c51801](https://github.com/chrismichaelps/effuse/commit/9c518010e78ade992062cbd665b3baaf09165f68))
* **hooks:** own hook resources through lifecycle refs [#283](https://github.com/chrismichaelps/effuse/issues/283) ([#286](https://github.com/chrismichaelps/effuse/issues/286)) ([8f66384](https://github.com/chrismichaelps/effuse/commit/8f6638462b5528b2d7375859c0dc8960c0de2008))
* **layers:** derive props once during runtime setup refs [#193](https://github.com/chrismichaelps/effuse/issues/193) ([218b93b](https://github.com/chrismichaelps/effuse/commit/218b93b336ff84c27fc893402b3a821d46a03b5a))
* **layers:** expose extended layers in list access refs [#217](https://github.com/chrismichaelps/effuse/issues/217) ([cd8edf6](https://github.com/chrismichaelps/effuse/commit/cd8edf6bb4eeb624cc79124db10d6d498539246e))
* **layers:** fail on missing runtime services refs [#188](https://github.com/chrismichaelps/effuse/issues/188) ([6b620a0](https://github.com/chrismichaelps/effuse/commit/6b620a0f426ceb663ee335afc6255a9ad9d5184e))
* **layers:** infer props in script accessors refs [#193](https://github.com/chrismichaelps/effuse/issues/193) ([1cb1e59](https://github.com/chrismichaelps/effuse/commit/1cb1e595370f0c15b21869f7d9876432d13d4c89))
* **layers:** isolate runtime registries refs [#204](https://github.com/chrismichaelps/effuse/issues/204) ([4d8a931](https://github.com/chrismichaelps/effuse/commit/4d8a93183cb9fb1f4143996aca5cbbf1a7294927))
* **layers:** restore nested app runtime owners refs [#205](https://github.com/chrismichaelps/effuse/issues/205) ([5c30960](https://github.com/chrismichaelps/effuse/commit/5c309603b1f3d360029f2bda1569335dacfd0c18))
* **layers:** treat extends as dependencies refs [#197](https://github.com/chrismichaelps/effuse/issues/197) ([4fd14af](https://github.com/chrismichaelps/effuse/commit/4fd14af035e16bef1bcaad0e5e9523d16db64cf4))
* **render:** preserve child state during template updates refs [#215](https://github.com/chrismichaelps/effuse/issues/215) ([7844bde](https://github.com/chrismichaelps/effuse/commit/7844bde483a4431205da03286906e552a6a34a56))
* **render:** reconcile child props without remount refs [#216](https://github.com/chrismichaelps/effuse/issues/216) ([80e51b9](https://github.com/chrismichaelps/effuse/commit/80e51b96b58371233502eba24471ffa9ec6d270a))
* **render:** settle nested dynamic mounts refs [#220](https://github.com/chrismichaelps/effuse/issues/220) ([ffb6536](https://github.com/chrismichaelps/effuse/commit/ffb6536088bf930a0b80f9f96e564b2a6494f012))
* **router:** preserve installs across HMR refs [#240](https://github.com/chrismichaelps/effuse/issues/240) ([#242](https://github.com/chrismichaelps/effuse/issues/242)) ([b9a6ec4](https://github.com/chrismichaelps/effuse/commit/b9a6ec47bf3987f3cc51f78f30611d19d86291f7))
* **router:** scope nested outlet depth refs [#222](https://github.com/chrismichaelps/effuse/issues/222) ([369a597](https://github.com/chrismichaelps/effuse/commit/369a59743eb3653e4f7b349d65537eccd89fa6d4))
* **ssr:** execute discovered middleware in dispatch refs [#356](https://github.com/chrismichaelps/effuse/issues/356) ([#359](https://github.com/chrismichaelps/effuse/issues/359)) ([42ed030](https://github.com/chrismichaelps/effuse/commit/42ed0306c821298a852e65aeaacaa67942c0d170))
* **ssr:** preserve typed errors across bundles refs [#258](https://github.com/chrismichaelps/effuse/issues/258) ([#259](https://github.com/chrismichaelps/effuse/issues/259)) ([c45f708](https://github.com/chrismichaelps/effuse/commit/c45f7089b9388c331c0e7d8fa6fca65131d1810f))
* **ssr:** rank exact routes before optional refs [#219](https://github.com/chrismichaelps/effuse/issues/219) ([b9e154b](https://github.com/chrismichaelps/effuse/commit/b9e154b4f15fe429ad0304a2a42b9cfc77cb5862))
* **ssr:** render children inside the provide scope, add typed context refs [#352](https://github.com/chrismichaelps/effuse/issues/352) ([#353](https://github.com/chrismichaelps/effuse/issues/353)) ([b0b0976](https://github.com/chrismichaelps/effuse/commit/b0b0976640e34019798d7633668aa3ab47d68901))
* **ssr:** require non-empty catch-all params refs [#219](https://github.com/chrismichaelps/effuse/issues/219) ([ea7befa](https://github.com/chrismichaelps/effuse/commit/ea7befad2de59b3402e6830e1ef4b644a77fd61f))
* **ssr:** restore app layer context after server calls refs [#203](https://github.com/chrismichaelps/effuse/issues/203) ([a253699](https://github.com/chrismichaelps/effuse/commit/a2536997364b3a71ac641c80bf5bf98e7f2197a9))
* **use:** preserve public hook inference refs [#285](https://github.com/chrismichaelps/effuse/issues/285) ([#287](https://github.com/chrismichaelps/effuse/issues/287)) ([636b305](https://github.com/chrismichaelps/effuse/commit/636b305526162966784be72467c449613acbed5b))

### Performance Improvements

* **core:** index server routes in a radix trie refs [#330](https://github.com/chrismichaelps/effuse/issues/330) ([#331](https://github.com/chrismichaelps/effuse/issues/331)) ([a1c1015](https://github.com/chrismichaelps/effuse/commit/a1c1015b6be81598ef525846b548f77663eb3bec))
* **core:** precompile layer server routing refs [#298](https://github.com/chrismichaelps/effuse/issues/298) ([#299](https://github.com/chrismichaelps/effuse/issues/299)) ([2402ddd](https://github.com/chrismichaelps/effuse/commit/2402ddd0346890a8b7e882a3cf2295555a9d7b4e))
* **ssr:** remove per-node allocations from the render loop refs [#334](https://github.com/chrismichaelps/effuse/issues/334) ([#335](https://github.com/chrismichaelps/effuse/issues/335)) ([e28df8c](https://github.com/chrismichaelps/effuse/commit/e28df8ce4c1d59b59965cc47ed613fde7bb9df43))
* **ssr:** skip escaping when nothing needs escaping refs [#332](https://github.com/chrismichaelps/effuse/issues/332) ([#333](https://github.com/chrismichaelps/effuse/issues/333)) ([c380bae](https://github.com/chrismichaelps/effuse/commit/c380baefbba253245580deb84e1ee6ceb93e5b08))

### Code Refactoring

* **core:** hide Effect-TS internals from public API ([#70](https://github.com/chrismichaelps/effuse/issues/70)) ([a35cbf7](https://github.com/chrismichaelps/effuse/commit/a35cbf76828f8f731b0fc8ef79ccbbae1a63bc3b))
* **core:** optimize JSX runtime, fix type errors, and add comprehensive tests ([#142](https://github.com/chrismichaelps/effuse/issues/142)) ([f3e949d](https://github.com/chrismichaelps/effuse/commit/f3e949d8dc986230d839f79e9f818b9673bd7ff1))
* **router:** adopt shared route patterns refs [#246](https://github.com/chrismichaelps/effuse/issues/246) ([#248](https://github.com/chrismichaelps/effuse/issues/248)) ([5eeed64](https://github.com/chrismichaelps/effuse/commit/5eeed64e49dc588e6edf06e5c1b419fb70f6a25f))
* **ssr:** production-ready SSR with layer runtime integration ([#57](https://github.com/chrismichaelps/effuse/issues/57)) ([5851919](https://github.com/chrismichaelps/effuse/commit/58519191495299c74717467c2e8cdd2d4d11e5f3))

### Tests

* **blueprint:** add define()+layers full integration test suite ([8dc7466](https://github.com/chrismichaelps/effuse/commit/8dc74663a0773244fb80fcdda2ea45e649fc17c8))
* **core:** add createApp abstraction tests ([#71](https://github.com/chrismichaelps/effuse/issues/71)) ([a9480bb](https://github.com/chrismichaelps/effuse/commit/a9480bbd74123452f4048850682e508abc3257a3))
* **core:** cover duplicate layer runtime boundaries refs [#179](https://github.com/chrismichaelps/effuse/issues/179) ([17aadc2](https://github.com/chrismichaelps/effuse/commit/17aadc20a70da1f346707c14d332d64312abc8e1))
* **layers:** add comprehensive layersAccessor regression test suite ([024fd96](https://github.com/chrismichaelps/effuse/commit/024fd9632426b2cc4c593f49a2cb0f69cb775c61))
* **repo:** stabilize node test gates refs [#180](https://github.com/chrismichaelps/effuse/issues/180) ([bb1bbfb](https://github.com/chrismichaelps/effuse/commit/bb1bbfbd9edf12d535bcc1a6d4a9c73108eebb51))
* **server:** add middleware conformance suite and benchmarks refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#345](https://github.com/chrismichaelps/effuse/issues/345)) ([24de5eb](https://github.com/chrismichaelps/effuse/commit/24de5eb90109660ad60b264b7714dd62b52a2975))
* **ssr:** cover dispatch edge cases refs [#358](https://github.com/chrismichaelps/effuse/issues/358) ([#361](https://github.com/chrismichaelps/effuse/issues/361)) ([95d0dde](https://github.com/chrismichaelps/effuse/commit/95d0dde9675060f54e5031902ded3f4cc2269060))

### Build System

* **core:** make lint usable as source gate refs [#181](https://github.com/chrismichaelps/effuse/issues/181) ([20c2eda](https://github.com/chrismichaelps/effuse/commit/20c2edacb83f6d90ad4cf7a22371cedb65e08855))

## @effuse/core [1.2.4](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.2.3...@effuse/core@1.2.4) (2026-03-18)

### Bug Fixes

* resolve RouterNotInstalledError and preserve layer metadata ([#36](https://github.com/chrismichaelps/effuse/issues/36)) ([4c1383e](https://github.com/chrismichaelps/effuse/commit/4c1383e9f21b78351356c77107c0ac5259b9a64b))

## @effuse/core [1.2.3](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.2.2...@effuse/core@1.2.3) (2026-03-18)

### Code Refactoring

* **core:** finalize watchEffect standardization across back-end packages ([c43a851](https://github.com/chrismichaelps/effuse/commit/c43a851cd745f969beab6a0273443164d85964fb))

## @effuse/core [1.2.2](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.2.1...@effuse/core@1.2.2) (2026-03-18)

### Code Refactoring

* consolidate architectural improvements and error abstraction ([69af1b1](https://github.com/chrismichaelps/effuse/commit/69af1b1fe3efc8f5c2d74b51a6c2fb3b4b6ab30a)), closes [#23](https://github.com/chrismichaelps/effuse/issues/23) [#24](https://github.com/chrismichaelps/effuse/issues/24) [#25](https://github.com/chrismichaelps/effuse/issues/25)
* **core:** internalize effect layer api and normalize runtime hooks ([2567c7a](https://github.com/chrismichaelps/effuse/commit/2567c7a99c39f502df7771699342f2b9935ab78d)), closes [#28](https://github.com/chrismichaelps/effuse/issues/28)

### Build System

* **deps:** update dependencies and pnpm version ([fd5e0c5](https://github.com/chrismichaelps/effuse/commit/fd5e0c57b883a4c5946c38d1e073218b8dd62120))

## @effuse/core [1.2.1](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.2.0...@effuse/core@1.2.1) (2026-02-21)

### Bug Fixes

* **core:** restore publishConfig to @effuse/use and refine mount logic for release ([292c2cf](https://github.com/chrismichaelps/effuse/commit/292c2cfda960968501675fc1e4366920fdf87619))

## @effuse/core [1.2.0](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.1.0...@effuse/core@1.2.0) (2026-02-19)

### Features

* apply minor formatting adjustments to core components. ([5fdd37f](https://github.com/chrismichaelps/effuse/commit/5fdd37f6dad1bd45f40aab97424542705cd12637))
* **codegen:** extract component names for registry augmentation ([8930e25](https://github.com/chrismichaelps/effuse/commit/8930e2590ad21aa67ae9d9ed03aafc0ac0df5a6c))
* **codegen:** infer precise provider types ([12e03b7](https://github.com/chrismichaelps/effuse/commit/12e03b750149e152f96854c7ad341a32a8d93ee6))
* **codegen:** support typed service registry ([7a4752a](https://github.com/chrismichaelps/effuse/commit/7a4752ac7dcfc2719f86bc64dfa3b96bcedbd800))
* **core:** add AsyncBoundary component ([e0b0a17](https://github.com/chrismichaelps/effuse/commit/e0b0a173cbd85a518a22ccf985af66e11690f1f0))
* **core:** add auto-scoped effect and watchMultiple to ScriptContext ([d0f3957](https://github.com/chrismichaelps/effuse/commit/d0f39579b4e0701341cb8ab875daa628260d502d))
* **core:** add component constants ([b5d55f1](https://github.com/chrismichaelps/effuse/commit/b5d55f1099557950696599413c576a2a049a76a2))
* **core:** add Deferred component ([62f573a](https://github.com/chrismichaelps/effuse/commit/62f573a5c5a45e627ddfe5a03f0660b036e69639))
* **core:** add KeepAlive with O(1) LRU cache ([52f3540](https://github.com/chrismichaelps/effuse/commit/52f3540b5250c660fe05de9ab3da41c057952614))
* **core:** add Transition component with effect-data ([01f4a77](https://github.com/chrismichaelps/effuse/commit/01f4a77015f1cee048295c3715c04d567f52252b))
* **core:** add TransitionGroup component ([88d7c15](https://github.com/chrismichaelps/effuse/commit/88d7c156b6712cbaffc390b23f77fdccbde23c80))
* **core:** add UseHooksCategories and global tracing exports for hook telemetry. Ref: [#21](https://github.com/chrismichaelps/effuse/issues/21) ([45f5bb2](https://github.com/chrismichaelps/effuse/commit/45f5bb2ce6f9e4ba2d65fdb0bd14af66e0528196))
* **core:** consolidate error exports in errors module ([0fda513](https://github.com/chrismichaelps/effuse/commit/0fda51320dc01f7c4b940859be7115467987fff9))
* **core:** export KeepAliveNode and CachedComponent types ([5dba437](https://github.com/chrismichaelps/effuse/commit/5dba43733f7d792664d763b78dd41932ae68d927))
* **core:** export new components from index ([ced3904](https://github.com/chrismichaelps/effuse/commit/ced3904208e39322b2aa00671f6101e27dd9f598))
* **core:** implement EffuseComponentRegistry and typed useComponent hook ([daaa31f](https://github.com/chrismichaelps/effuse/commit/daaa31f249fb6e0550268b1665291e37943e1c0b))
* **core:** improve hooks and service typing ([867c0d9](https://github.com/chrismichaelps/effuse/commit/867c0d97da2722b81950c85398e4b8f30004ee20))

### Bug Fixes

* **core:** retrieve cached services in HookContext layerProvider ([895dde2](https://github.com/chrismichaelps/effuse/commit/895dde20e37ae792979074eee0475fd2970cd7b0))
* **layers:** cache useLayerProvider singletons ([0d33255](https://github.com/chrismichaelps/effuse/commit/0d33255d81f41ab2836182d172721fb0159cf5c3))

### Code Refactoring

* **core:** adopt Effect TaggedEnum internally and resolve build issues ([fa72397](https://github.com/chrismichaelps/effuse/commit/fa72397d9c35573769a7b4fdb6eb4fe6e1fc2460))
* **core:** remove props schema and use direct inference ([ce31e46](https://github.com/chrismichaelps/effuse/commit/ce31e4630cf0ef3a6cd570322e0ceaa95da7ac31))
* **core:** senior-level KeepAlive with Effect.Cache and TaggedEnum ([f76df6d](https://github.com/chrismichaelps/effuse/commit/f76df6d2c24a3fec35838d7491cc59b1387ea484))

### Tests

* **core:** add 24 production-ready KeepAlive tests ([fd442a2](https://github.com/chrismichaelps/effuse/commit/fd442a24552309f63fe054c2d2ba17dc60e27bde))
* **core:** add comprehensive component tests ([49259cc](https://github.com/chrismichaelps/effuse/commit/49259ccfb5b6dc5e1b5e9720be39ad04385cc381))
* **core:** add comprehensive tests and fix tracing cleanup ([7889500](https://github.com/chrismichaelps/effuse/commit/7889500914ce7b9b751cf2e146a65cd532fc2cca))
* **core:** add coverage for component DI and auto-scoped reactivity ([986adb2](https://github.com/chrismichaelps/effuse/commit/986adb257831cfe8104690343b2d1d6f2fa0d219))

## @effuse/core [1.1.0](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.0.3...@effuse/core@1.1.0) (2026-01-14)

### Features

- **core:** Add comprehensive DOM event handlers Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([6321247](https://github.com/chrismichaelps/effuse/commit/6321247db5b08021919f080d816eb4ec071642e5))
- **core:** Add element-specific attribute interfaces Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([0ed70a1](https://github.com/chrismichaelps/effuse/commit/0ed70a1ea7d5c68bf227e26047effc0be82b10da))
- **core:** Add strict HTMLAttributes interface Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([2207453](https://github.com/chrismichaelps/effuse/commit/220745335e1bc420a9eb04dcd1134fe8d53187ed))
- **core:** Add strict JSX type unions Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([258ec5d](https://github.com/chrismichaelps/effuse/commit/258ec5d9a166cf152a563623f0097815bfb1eed3))
- **core:** Add WAI-ARIA 1.2 attribute types Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([809ffd8](https://github.com/chrismichaelps/effuse/commit/809ffd8069b298e3d1bd49f440664b273b93be52))
- **core:** Define IntrinsicElements interface Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([28cfa88](https://github.com/chrismichaelps/effuse/commit/28cfa880ebaaf52cd8ebfb0f984039256ed7a3f7))
- **core:** Export modular JSX type system Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([76be321](https://github.com/chrismichaelps/effuse/commit/76be32181ef6be5cdc1fc2f35141a575d11ed095))
- **core:** implement reactive refs and directives module ([cff6c2d](https://github.com/chrismichaelps/effuse/commit/cff6c2dbbc7a5e7929232be5bf3c13eb4796303c))
- **core:** integrate refs system into renderer ([4d191c9](https://github.com/chrismichaelps/effuse/commit/4d191c9321a0f006b29d0749418147ee9c751109))

### Bug Fixes

- **core:** explicitly re-export CreateElementNode from render/index ([fc03143](https://github.com/chrismichaelps/effuse/commit/fc03143463f46e3d27dc7c0944156099b44c82e7))
- **core:** refactor Fragment to callable function ([60662c1](https://github.com/chrismichaelps/effuse/commit/60662c13434919f49ab170833941e5430b5d9835))
- **core:** restore isEffuseNode export ([f2a1a63](https://github.com/chrismichaelps/effuse/commit/f2a1a63d07c61d848b5f6a1a43b2a982f44df2eb))

### Code Refactoring

- **core/blueprint:** replace manual type guards with Predicate ([bda20b1](https://github.com/chrismichaelps/effuse/commit/bda20b1f9753972b72c526c89b222a956372499d))
- **core/infra:** replace manual type guards with Predicate ([6d5d745](https://github.com/chrismichaelps/effuse/commit/6d5d745534acc63c5d3296d640a471132b1bb950))
- **core/reactivity:** replace manual type guards with Predicate ([fc1b0ee](https://github.com/chrismichaelps/effuse/commit/fc1b0ee62cd3559c0c40b4cd47820b0d121d7d71))
- **core/render:** replace manual type guards with Predicate ([3f20c56](https://github.com/chrismichaelps/effuse/commit/3f20c5610ea0dd358a9cdcb5d426bd58fe38b7fd))
- **core:** audit and consolidate suspense module and remove dead code ([a47dd08](https://github.com/chrismichaelps/effuse/commit/a47dd08af5d085d6d94cc665de6f81ba3666ca62))
- **core:** consolidate scattered constants into constants.ts ([dc97342](https://github.com/chrismichaelps/effuse/commit/dc97342178775eb42874c5e936d01f70ce700144))
- **core:** Migrate runtime to modular bindings Ref: [#15](https://github.com/chrismichaelps/effuse/issues/15) ([79a4325](https://github.com/chrismichaelps/effuse/commit/79a4325b2d9afe8a339429e0ab86f6cde9551292))
- **core:** remove dead internal services and devtools module ([e2b896e](https://github.com/chrismichaelps/effuse/commit/e2b896efb957417bbb5b0082e255690708fd1fb9))
- **core:** use tagged enums for node types and mount logic ([3a2c5fd](https://github.com/chrismichaelps/effuse/commit/3a2c5fd9646e3ae9a5ea844dbcf692fdf775964b))

### Tests

- **core:** add refs system comprehensive tests ([60ee23e](https://github.com/chrismichaelps/effuse/commit/60ee23ed8a7281b2e7e37300c4582fdd3e2a67a8))

## @effuse/core [1.0.3](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.0.2...@effuse/core@1.0.3) (2026-01-08)

### Bug Fixes

- **core:** export EffuseLayerRegistry to support module augmentation ([1050c3a](https://github.com/chrismichaelps/effuse/commit/1050c3a520c20d9925a7a31e2c23e743f8edf02a))

## @effuse/core [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.0.1...@effuse/core@1.0.2) (2026-01-08)

### Bug Fixes

- trigger release for core and compiler ([e35df2f](https://github.com/chrismichaelps/effuse/commit/e35df2f65a199f7458fa50b3433a391f4d4bdd93))

## @effuse/core [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/core@1.0.0...@effuse/core@1.0.1) (2026-01-08)

### Bug Fixes

- add publishConfig to enable public npm publishing for scoped packages ([5d5ed45](https://github.com/chrismichaelps/effuse/commit/5d5ed454c076db8d96703b154836e2856c4da259))

## @effuse/core 1.0.0 (2026-01-08)

### Features

- implement a new event demo page with i18n support ([1d1325f](https://github.com/chrismichaelps/effuse/commit/1d1325fd791cbffbea73d5f9c907c2f597cd3a40)), closes [#4](https://github.com/chrismichaelps/effuse/issues/4)
- add cancellable, timeout, retry, and debounced/throttled actions, along with async reactivity features. ([16a7347](https://github.com/chrismichaelps/effuse/commit/16a73471bb07ac4c4a320b885de83e9f44dc581e))
- add children support to blueprints ([dbe91ac](https://github.com/chrismichaelps/effuse/commit/dbe91ac5f840f1f960d7ff928f109d624b92601f))
- add flush option to effects ([84c5cca](https://github.com/chrismichaelps/effuse/commit/84c5cca05b7473bc3b60d767101737bcb26ad7d6))
- Add prop schema validation to blueprints and introduce named portal outlets. ([ef6044b](https://github.com/chrismichaelps/effuse/commit/ef6044bb1ded936adf241df0a9bf95afe1e3b3a4))
- add support for functional children in render nodes. ([827c976](https://github.com/chrismichaelps/effuse/commit/827c976b223906e323eaebd687366a0545161d06))
- **ci:** add multi-semantic-release for monorepo npm publishing ([f8c00a1](https://github.com/chrismichaelps/effuse/commit/f8c00a14c857def7c3205a9b62c6ec4fb5cdbf89))
- **core, router:** implement support for compiler-generated function getters ([b833e1f](https://github.com/chrismichaelps/effuse/commit/b833e1f3b21a61cd71fd7f15dd5af5fd8ef5a93f))
- **core:** add layer registry auto-generator using Effect ([f1cdd3f](https://github.com/chrismichaelps/effuse/commit/f1cdd3f6e36b74828d41784bb82444116a92c647))
- **core:** add performance tracing and debug categories for hooks ([437527d](https://github.com/chrismichaelps/effuse/commit/437527d38f240066f46c30c1de91e58822b6da9b))
- **core:** add Repeat and Await components ([7a3ed33](https://github.com/chrismichaelps/effuse/commit/7a3ed33cc541f9bd0e5ddb6142ef91a245dca8b3))
- **core:** add ResourceFetchError and LayerExecutionError tagged errors ([e252549](https://github.com/chrismichaelps/effuse/commit/e252549469d939574e00d2f518321896d5a5afdc))
- **core:** add TaggedError utilities and guards ([72cd0c8](https://github.com/chrismichaelps/effuse/commit/72cd0c82fe6aacb22a5960d3fe3406ff2758abcf))
- **core:** add useCallback and useMemo hooks with automatic dependency tracking ([6c43c02](https://github.com/chrismichaelps/effuse/commit/6c43c02daf248b923d073e0ee6178e7c4ae9928a))
- **core:** detect circular dependencies in layer topology ([7837b26](https://github.com/chrismichaelps/effuse/commit/7837b260f519564861be44b7a808c1b5a1f7558f))
- **core:** export Context API utilities ([ad2ac44](https://github.com/chrismichaelps/effuse/commit/ad2ac449e512b67bc5647395dff569190dde56a6))
- **core:** implement category-based tracing and parallel layer initialization ([9578788](https://github.com/chrismichaelps/effuse/commit/957878874bf061487870bf95716ffec94aa096e6))
- **core:** implement category-based tracing system with logging ([cb7e925](https://github.com/chrismichaelps/effuse/commit/cb7e9251242b4097c211b4b987594092b6cddd75))
- **core:** implement Context API for dependency injection ([cea333a](https://github.com/chrismichaelps/effuse/commit/cea333a01ba566ad20e740d5e84d51eab0714dad))
- **core:** implement lifecycle hooks, props validation, and portal system ([9e4f9cc](https://github.com/chrismichaelps/effuse/commit/9e4f9ccab64b2d4c3201b7c539f5f0ccc7f70615))
- **core:** inject SetupContext into lifecycle hooks and add onReady ([d3c3354](https://github.com/chrismichaelps/effuse/commit/d3c33541ef9d68c9c03dfe8a3ebfaf224d6a2e0c))
- **emit:** add tracing for event emission and subscriptions ([b580da1](https://github.com/chrismichaelps/effuse/commit/b580da173f2559c3d289b5e35e373f59aec763a0))
- Fixed Double Proxying Bug and Fixed Effect Tracking on Throw. ([d21ad2b](https://github.com/chrismichaelps/effuse/commit/d21ad2be23102e10ff1032b3f96d851a84594278))
- implement useForm hook, configuration, and field validators. ([5a1a884](https://github.com/chrismichaelps/effuse/commit/5a1a884cba2469af689666a568cfe99ee3edd584))
- implement useStyles hook and CSS loading service, integrated into the define blueprint. ([b18fa91](https://github.com/chrismichaelps/effuse/commit/b18fa916c787eaaec689f6e05837d919bb42a3b2))
- introduce core emit module for reactive event signaling with hooks, modifiers. ([b277916](https://github.com/chrismichaelps/effuse/commit/b277916fbfef6236b74f0a6c610b42985e864d20)), closes [#4](https://github.com/chrismichaelps/effuse/issues/4)
- introduce new @effuse/query package for data fetching and update related dependencies. ([51c9380](https://github.com/chrismichaelps/effuse/commit/51c938043dede6fc21186888595a12aa18441e90))
- Introduce ReadonlySignal ([2524be8](https://github.com/chrismichaelps/effuse/commit/2524be8997bd8cc4f4ebea29288f6cf1cd5b2883))
- **reactivity:** add support for batched updates and array mutation methods ([5289079](https://github.com/chrismichaelps/effuse/commit/5289079a56e890feb34caf7e77ccc5443fd0e8a1))
- **reactivity:** add tracing for signal creation and updates ([c229422](https://github.com/chrismichaelps/effuse/commit/c229422f99c8d33bf7710b0865f7239ae97ed916))
- refactor i18n to use useTranslation hook with core error handling ([2aedfa0](https://github.com/chrismichaelps/effuse/commit/2aedfa0ce3539c25a932e116d4f59a487e89bbb2))
- refine reactivity core, including new proxy-utils and computed initialization. ([3466f2f](https://github.com/chrismichaelps/effuse/commit/3466f2fb3da640faed598498d6ba8215ebba7404))
- Replace generated layer registry with TypeScript module augmentation for layer type safety and add ref to docs md files. ([83118b3](https://github.com/chrismichaelps/effuse/commit/83118b38b090b7dbca35deea56d94b19eb2f92b5))
- **scripts:** support store property type inference in gen-layers ([f3fa29e](https://github.com/chrismichaelps/effuse/commit/f3fa29ec14737e2fbd62e7cc3d2937e5e6d33dce))
- **search:** integrate search into app header and add multi-language support ([96e6b9e](https://github.com/chrismichaelps/effuse/commit/96e6b9ece5f0192fc52a49148483e6b5803df99f))
- Simplify router API by removing Effect returns and introduce type safe router injection via EffuseRegistry. ([ae05e01](https://github.com/chrismichaelps/effuse/commit/ae05e012d9c9b3447f58f7d7bed637529cbd7493)), closes [#1](https://github.com/chrismichaelps/effuse/issues/1)
- update JSX style prop type to accept Partial<CSSStyleDeclaration> and a function returning string | Partial<CSSStyleDeclaration>. ([d351024](https://github.com/chrismichaelps/effuse/commit/d351024469566c3b9ca6205bb564aa3af381dfb6))

### Bug Fixes

- Attribute Name Injection (XSS & Path Normalization Bypass ([4f499d3](https://github.com/chrismichaelps/effuse/commit/4f499d373b386b0378331386da60ac3981d426d5))
- **core:** strict type cast for router fallback proxy ([58cc7da](https://github.com/chrismichaelps/effuse/commit/58cc7daac427dcb7070d8e1ddb38a17efcb3e468))
- **emit:** change EventMap to Record<string, any> for interface compat ([055ad6f](https://github.com/chrismichaelps/effuse/commit/055ad6f1f62c2fa553817e2bd59de80d1c3e8a1e))
- **framework:** implement reactive function props and router signal fix ([386583b](https://github.com/chrismichaelps/effuse/commit/386583b4629c32df191d0ea35f6c76e3f7b35daa))
- **reactivity:** handle frozen objects and fix self-modifying effect scheduling. ([fdd2576](https://github.com/chrismichaelps/effuse/commit/fdd2576c3830ae87a0da619734592fcbd0bde904))
- sync lockfile, restore workspace deps, update node engine ([652944d](https://github.com/chrismichaelps/effuse/commit/652944de75966caee5178d74c44620820d081f16))

### Documentation

- Add explanatory comments to (core/ink/router) reactivity, router, and utility functions. ([4e33bc6](https://github.com/chrismichaelps/effuse/commit/4e33bc6324c1e233edaf6e0003f5bef38c3f0bbb))

### Code Refactoring

- Portal and PortalOutlet components and update SearchModal to use them ([c98a3b3](https://github.com/chrismichaelps/effuse/commit/c98a3b3702fc2b44ddb5e1b8c2008ceec0a8c888))
- add custom tagged error types across core, router, and store packages for improved error handling. ([c4175c9](https://github.com/chrismichaelps/effuse/commit/c4175c923f79497001838ca1f96ec4f45d1f5629))
- **blueprint:** adopt Effect patterns with Predicate and Option ([a9366f8](https://github.com/chrismichaelps/effuse/commit/a9366f82be8b56595ea306a632fc3c9ec5b18e01))
- **core:** add store derivation and context providers to layers ([9d0bcfd](https://github.com/chrismichaelps/effuse/commit/9d0bcfd9ff8319c6af4e2143e0a22f0a320a8367))
- **core:** allow void return in onMount callback ([1732d15](https://github.com/chrismichaelps/effuse/commit/1732d150f2508a0e5cac8b4ab022167979f44581))
- **core:** fix tracing registration timing and integrate into layer runtime ([be2cf92](https://github.com/chrismichaelps/effuse/commit/be2cf927cdf002fc123f18638741535741e4a8e0))
- **core:** implement scoped defineHook api with effect-based lifecycle ([2a2579f](https://github.com/chrismichaelps/effuse/commit/2a2579ffd716ce7dffb05f27b2ef1e395de46d05))
- **core:** modernize control flow components with Effect patterns ([74d0d1a](https://github.com/chrismichaelps/effuse/commit/74d0d1a1d91f25316131d59e5208bfed7f1032ee))
- **core:** move error definitions to internal and cleanup legacy files ([4016a91](https://github.com/chrismichaelps/effuse/commit/4016a910b0ae68df409c6ae5d06f4dbe7a5a45fa))
- **core:** refine internal layer builder and topology patterns ([a16e059](https://github.com/chrismichaelps/effuse/commit/a16e059f2cf53f022f1d459a84777054e6f55f1f))
- **core:** update exports and add tagged error support ([86882b3](https://github.com/chrismichaelps/effuse/commit/86882b3ff89417167ac3f09ee6b8402c45c46326))
- **core:** update services to use consolidated error system ([90dab0b](https://github.com/chrismichaelps/effuse/commit/90dab0b496dc20722c9306e03001c413684537b0))
- **dom:** apply Effect patterns in mount service ([1a33426](https://github.com/chrismichaelps/effuse/commit/1a33426b946a2ded33667a15b8fdeb0cbaa0f2fa))
- **emit:** apply Effect patterns in emit hooks and services ([42962a1](https://github.com/chrismichaelps/effuse/commit/42962a1a0f1da1d2b63accb97b3a8bcc473a5c1d))
- **form:** adopt Effect patterns in useForm hook ([7f0e43b](https://github.com/chrismichaelps/effuse/commit/7f0e43b44905d1b4272f1c2f8706a1d80b8d46e1))
- **hooks:** simplify defineHook to 2-param generic <Config, Return> ([ee36610](https://github.com/chrismichaelps/effuse/commit/ee36610a318fbe74a908d64640de357182c90db2))
- **layers:** remove deprecated layer files ([529e4a9](https://github.com/chrismichaelps/effuse/commit/529e4a98fb55e1da71b8eabcda67ba1f8bd7a86c))
- **layers:** split layer system into modular architecture ([3dffba6](https://github.com/chrismichaelps/effuse/commit/3dffba608e2d0915349d3ffaad24d3432cdc68f4))
- **layers:** use Effect patterns in context and builder ([b8f0abf](https://github.com/chrismichaelps/effuse/commit/b8f0abf8cff70f045367356de5a49068cbe6a76b))
- modularize app error definitions into dedicated files and update import paths ([1ee8061](https://github.com/chrismichaelps/effuse/commit/1ee80612bfb38b87b3a6c196aea03730406b6bfa))
- **reactivity:** use Effect patterns in watch and proxy utils ([e7e3149](https://github.com/chrismichaelps/effuse/commit/e7e314960f734739289fd4f8f0da6a0de672763e))
- remove core style management and service, shifting style injection responsibility to individual packages. ([5d2f891](https://github.com/chrismichaelps/effuse/commit/5d2f891353afdd7b7bdfbc797cdc8dc7958f4b4d))
- remove unused services, no-op implementations, and simplify store persistence utilities. ([dfabafd](https://github.com/chrismichaelps/effuse/commit/dfabafdc0993ed02647eb9e4e36def9b171ea4a2))
- **render:** apply Effect patterns in element creation ([aaf0aa6](https://github.com/chrismichaelps/effuse/commit/aaf0aa6251a0394e40db693f4ea1a4d9bad6baef))
- **ssr:** adopt Effect patterns in head registry ([3c06861](https://github.com/chrismichaelps/effuse/commit/3c06861bc251af6831a9e5c484423cb740dc15d9))
- **suspense:** use Effect patterns in suspense utilities ([d426e7a](https://github.com/chrismichaelps/effuse/commit/d426e7a1947cf2eee93e995d88f88701f04eb539))
- **tracing:** apply Effect patterns across all tracing modules ([b2c0630](https://github.com/chrismichaelps/effuse/commit/b2c0630d842c69791497dcb803f614a39e75bbde))
- unexport internal Effect utilities and clean up API surface ([945a9e0](https://github.com/chrismichaelps/effuse/commit/945a9e077e1cd21b30fa7d31b516b12f4384863c))
