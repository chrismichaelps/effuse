## @effuse/cli [1.0.2](https://github.com/chrismichaelps/effuse/compare/@effuse/cli@1.0.1...@effuse/cli@1.0.2) (2026-07-28)


### Dependencies

* **@effuse/server:** upgraded to 1.0.2
* **@effuse/core:** upgraded to 2.0.2

## @effuse/cli [1.0.1](https://github.com/chrismichaelps/effuse/compare/@effuse/cli@1.0.0...@effuse/cli@1.0.1) (2026-07-26)

### Bug Fixes

* **core:** restore downstream JSX contracts ([#380](https://github.com/chrismichaelps/effuse/issues/380)) ([0839a89](https://github.com/chrismichaelps/effuse/commit/0839a893a9c8852743dfdf35fb71b82f32dad956)), closes [#379](https://github.com/chrismichaelps/effuse/issues/379)


### Dependencies

* **@effuse/server:** upgraded to 1.0.1
* **@effuse/core:** upgraded to 2.0.1

## @effuse/cli 1.0.0 (2026-07-26)

### Features

* **#59:** Auto-generate entry points from src/app.ts ([#76](https://github.com/chrismichaelps/effuse/issues/76)) ([78f2118](https://github.com/chrismichaelps/effuse/commit/78f211833234ee7fb43f6f6038ad3db661e5530c)), closes [#59](https://github.com/chrismichaelps/effuse/issues/59)
* **#59:** Component-level HMR without page reloads ([#80](https://github.com/chrismichaelps/effuse/issues/80)) ([8d9b429](https://github.com/chrismichaelps/effuse/commit/8d9b429cf2a770d44ba777eda55919f831ba8e4b)), closes [#59](https://github.com/chrismichaelps/effuse/issues/59) [#59](https://github.com/chrismichaelps/effuse/issues/59)
* **#59:** Edge-targeted server builds for Cloudflare/Vercel ([#78](https://github.com/chrismichaelps/effuse/issues/78)) ([d005924](https://github.com/chrismichaelps/effuse/commit/d005924b40f9edfe3594ecc344b3334238678a96)), closes [#59](https://github.com/chrismichaelps/effuse/issues/59)
* **#59:** Manifest integration for production SSR FOUC prevention ([#77](https://github.com/chrismichaelps/effuse/issues/77)) ([8f84bb9](https://github.com/chrismichaelps/effuse/commit/8f84bb9cff0d76162e3b899d057df52a8c46bd27)), closes [#59](https://github.com/chrismichaelps/effuse/issues/59)
* **cli:** add production-ready CLI package with build, dev, and typecheck ([6ad9f6c](https://github.com/chrismichaelps/effuse/commit/6ad9f6c2a03872ed30616a47a7a59094d948279a)), closes [#59](https://github.com/chrismichaelps/effuse/issues/59)
* **cli:** compile lazy server file registries refs [#293](https://github.com/chrismichaelps/effuse/issues/293) ([#295](https://github.com/chrismichaelps/effuse/issues/295)) ([433b8cf](https://github.com/chrismichaelps/effuse/commit/433b8cf819d30675a99718672215a16d3cf9a471))
* **cli:** discover scoped server middleware files refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#323](https://github.com/chrismichaelps/effuse/issues/323)) ([fd1ac7c](https://github.com/chrismichaelps/effuse/commit/fd1ac7c0549007d1e79247296589249c51ee45eb))
* **cli:** generate compiled server middleware registry module refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#324](https://github.com/chrismichaelps/effuse/issues/324)) ([752c494](https://github.com/chrismichaelps/effuse/commit/752c494687f074959999fd9fb1df3ca5859d0249))
* **cli:** generate manifest clients refs [#172](https://github.com/chrismichaelps/effuse/issues/172) ([8a96e21](https://github.com/chrismichaelps/effuse/commit/8a96e21af86e1fc7fd13e343cbe02dd72840b14f))
* **cli:** inspect layer server manifests refs [#174](https://github.com/chrismichaelps/effuse/issues/174) ([0f37e80](https://github.com/chrismichaelps/effuse/commit/0f37e80698d401ccd2c6d361ce4c357e41a4966d))
* **cli:** migrate dev and production servers onto @effuse/server refs [#261](https://github.com/chrismichaelps/effuse/issues/261) ([#263](https://github.com/chrismichaelps/effuse/issues/263)) ([5d1f956](https://github.com/chrismichaelps/effuse/commit/5d1f9569d5088677bead4802604240adaf6d20fd))
* **cli:** watch and regenerate server middleware registry refs [#301](https://github.com/chrismichaelps/effuse/issues/301) ([#325](https://github.com/chrismichaelps/effuse/issues/325)) ([66b015c](https://github.com/chrismichaelps/effuse/commit/66b015c67777c74157aace3d7b1ec6179e036f4d))
* **cli:** watch server registries atomically refs [#296](https://github.com/chrismichaelps/effuse/issues/296) ([#297](https://github.com/chrismichaelps/effuse/issues/297)) ([ce0cbd1](https://github.com/chrismichaelps/effuse/commit/ce0cbd19950ea45ea41e45661827f87f09f70ead))
* **core:** diagnose server file routes refs [#173](https://github.com/chrismichaelps/effuse/issues/173) ([76c386b](https://github.com/chrismichaelps/effuse/commit/76c386b63b94208d93236d0cc86c98d165d88ff9))
* **core:** unify layer DX and server routes refs [#171](https://github.com/chrismichaelps/effuse/issues/171) ([46d98d8](https://github.com/chrismichaelps/effuse/commit/46d98d8c766242106d8622cac08a61d2f6486827))
* **server:** compile matched lazy file registries refs [#300](https://github.com/chrismichaelps/effuse/issues/300) ([#302](https://github.com/chrismichaelps/effuse/issues/302)) ([ab426bd](https://github.com/chrismichaelps/effuse/commit/ab426bd257990b224001208346a8035699ff4888))

### Bug Fixes

* **build:** declare lint config dependencies refs [#180](https://github.com/chrismichaelps/effuse/issues/180) ([e0fbf46](https://github.com/chrismichaelps/effuse/commit/e0fbf46866aac2452e0a2799b2efbe38e38977a3))
* **cli:** repair boolean defaults, env parsing, and stale tests ([#99](https://github.com/chrismichaelps/effuse/issues/99), [#100](https://github.com/chrismichaelps/effuse/issues/100)) ([#101](https://github.com/chrismichaelps/effuse/issues/101)) ([bd7c5bf](https://github.com/chrismichaelps/effuse/commit/bd7c5bf38603bc6aa6de0f8149c8d339de8597e2))
* **cli:** stream dev headers before body refs [#184](https://github.com/chrismichaelps/effuse/issues/184) ([205a9cf](https://github.com/chrismichaelps/effuse/commit/205a9cf44c93b0b689016ef6e5138c802b7c9287))
* **framework:** harden async and build boundaries refs [#364](https://github.com/chrismichaelps/effuse/issues/364) ([#370](https://github.com/chrismichaelps/effuse/issues/370)) ([9c51801](https://github.com/chrismichaelps/effuse/commit/9c518010e78ade992062cbd665b3baaf09165f68))
* **release:** normalize npm oidc contracts refs [#373](https://github.com/chrismichaelps/effuse/issues/373) ([a8b3f27](https://github.com/chrismichaelps/effuse/commit/a8b3f27445d2533544aba463bde7137a80b8dbe2))
* **tests:** exclude .mjs files from vitest and harden CLI e2e tests ([#102](https://github.com/chrismichaelps/effuse/issues/102), [#103](https://github.com/chrismichaelps/effuse/issues/103)) ([#104](https://github.com/chrismichaelps/effuse/issues/104)) ([de0ff08](https://github.com/chrismichaelps/effuse/commit/de0ff08f147c3d1d6e14d945c7d3931cea5f336c))

### Tests

* **cli:** remove stale fixture e2e path refs [#184](https://github.com/chrismichaelps/effuse/issues/184) ([23bce85](https://github.com/chrismichaelps/effuse/commit/23bce85c3d4ef2eda646c6f5b23c41ab428bc051))

### Build System

* **cli:** make lint warning-free refs [#185](https://github.com/chrismichaelps/effuse/issues/185) ([e4eb9e8](https://github.com/chrismichaelps/effuse/commit/e4eb9e80e316103a783f7c76ba88396db3b75e98))


### Dependencies

* **@effuse/server:** upgraded to 1.0.0
* **@effuse/core:** upgraded to 2.0.0
