## @effuse/auth 1.0.0 (2026-08-14)

### ⚠ BREAKING CHANGES

* **auth:** OAuthTokens.idToken is optional and OAuthProvider is now a discriminated OIDC or OAuth userinfo provider union.
* **auth:** UserStore must implement findBySubject and replacePasswordHash. Credentials provider setup now requires revokeSessions and onPasswordChanged, and changePassword requires currentPassword and clientIp.

### Features

* **auth:** add @effuse/auth foundation, session engine, and credentials ([e30d59e](https://github.com/chrismichaelps/effuse/commit/e30d59e5ef0298155e2b49ed51e3b4a575337f8c)), closes [#440](https://github.com/chrismichaelps/effuse/issues/440) [#441](https://github.com/chrismichaelps/effuse/issues/441)
* **auth:** add atomic password reset lifecycle refs [#460](https://github.com/chrismichaelps/effuse/issues/460) ([0df5d23](https://github.com/chrismichaelps/effuse/commit/0df5d237c4e4b76dc4660a60b65f821aec1e6af6))
* **auth:** add authorization policies with build-time coverage enforcement ([03444fb](https://github.com/chrismichaelps/effuse/commit/03444fb1ffa343a8f828f0ce645688f615908866))
* **auth:** add OAuth 2.1 and OpenID Connect with mandatory PKCE ([89c6b22](https://github.com/chrismichaelps/effuse/commit/89c6b22a847548fa5117506081df7529141f16f7))
* **auth:** add single-flight token refresh with rotation and reuse detection ([1efbe4a](https://github.com/chrismichaelps/effuse/commit/1efbe4a0ad4f4f16d39270e3280dc9b4a6ba7048))
* **auth:** add SSR session hydration and unified client bindings ([92e0a32](https://github.com/chrismichaelps/effuse/commit/92e0a321a76124fe03d4aea2d71a842cf1401cc3))
* **auth:** complete the testing kit and add conformance suites for every port ([87f1a6d](https://github.com/chrismichaelps/effuse/commit/87f1a6d51bdb0f6e62054b13da76faa1d9074a5c))
* **auth:** harden configuration validation ([594fff1](https://github.com/chrismichaelps/effuse/commit/594fff17db39fcdeeedcd88798e42bab84d57fee)), closes [#456](https://github.com/chrismichaelps/effuse/issues/456)
* **auth:** secure server password changes refs [#462](https://github.com/chrismichaelps/effuse/issues/462) ([273c494](https://github.com/chrismichaelps/effuse/commit/273c494f144b022c2123bde975f2671f0cc2bf3f))
* **auth:** support server OAuth userinfo providers refs [#464](https://github.com/chrismichaelps/effuse/issues/464) ([bf6b923](https://github.com/chrismichaelps/effuse/commit/bf6b92336f0a909710f4c9d902ecd33b506b7f06))

### Bug Fixes

* **auth:** enforce config security invariants refs [#458](https://github.com/chrismichaelps/effuse/issues/458) ([6bca4a5](https://github.com/chrismichaelps/effuse/commit/6bca4a5ab144acd56006a71a6fc5c483b67b42e4))
* **auth:** make documented route setup type-safe refs [#448](https://github.com/chrismichaelps/effuse/issues/448) ([17a89a0](https://github.com/chrismichaelps/effuse/commit/17a89a088c211f21c73f67baae8848d8fd7c1ec7))
* **release:** bound release commit arguments refs [#611](https://github.com/chrismichaelps/effuse/issues/611) ([#612](https://github.com/chrismichaelps/effuse/issues/612)) ([da58aab](https://github.com/chrismichaelps/effuse/commit/da58aab8e042924a300d5884ab9e33086efeba92))

### Documentation

* **auth:** add secure setup and migration guides refs [#448](https://github.com/chrismichaelps/effuse/issues/448) ([b3dcce4](https://github.com/chrismichaelps/effuse/commit/b3dcce4368848aaa68040a93e48e05cb4813d6e9))
* **packages:** publish current framework contracts refs [#598](https://github.com/chrismichaelps/effuse/issues/598) ([#599](https://github.com/chrismichaelps/effuse/issues/599)) ([4c2b615](https://github.com/chrismichaelps/effuse/commit/4c2b615cbd11a702d92d6b1cd35132db0350de05))

### Tests

* **auth:** add resilience scenarios and route store failures through AuthError ([1854a9c](https://github.com/chrismichaelps/effuse/commit/1854a9c310a071a7c74588e04cb0e59eca83e639))
* **auth:** assert enumeration parity on work, not elapsed time ([#552](https://github.com/chrismichaelps/effuse/issues/552)) ([27c4180](https://github.com/chrismichaelps/effuse/commit/27c418009d77cf7646d676a34c22534052b96c50)), closes [#551](https://github.com/chrismichaelps/effuse/issues/551)
* **auth:** generate the fake IdP's keys once per process ([#561](https://github.com/chrismichaelps/effuse/issues/561)) ([db71e5b](https://github.com/chrismichaelps/effuse/commit/db71e5bc7a9d0cc0e8c8b22623a30f1f0fadbc22)), closes [#560](https://github.com/chrismichaelps/effuse/issues/560)
* **auth:** warm the fake IdP keys outside the test budget ([#571](https://github.com/chrismichaelps/effuse/issues/571)) ([d72e6e9](https://github.com/chrismichaelps/effuse/commit/d72e6e9f86a2c5de9966037c37ea07fa49eea6a6)), closes [#561](https://github.com/chrismichaelps/effuse/issues/561) [#570](https://github.com/chrismichaelps/effuse/issues/570)


### Dependencies

* **@effuse/core:** upgraded to 2.1.0
