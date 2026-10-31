# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 1.0.0 (2026-10-31)


### ⚠ BREAKING CHANGES

* **frontend:** build the App Router with vinext (Vite) instead of next
* **test:** Jest on SWC instead of Babel; TypeORM relations typed Relation<T>
* **lint:** drop ESLint, Biome alone lints the frontend
* **deps:** TypeORM 1.1
* **backend:** NestJS 12; unpdf replaces pdf-parse; own Redis throttler storage

### Features

* Accounts and Payees pages (port onto current main) ([a735d61](https://github.com/stoic-budget/stoic-budget/commit/a735d616de825737f51dfd0f644ce1cdec43789e))
* **accounts:** link statements where people look for them ([cfef6f2](https://github.com/stoic-budget/stoic-budget/commit/cfef6f249709cb25a788d8a84ddf6eddad1ed444))
* **accounts:** link statements where people look for them ([0a7444f](https://github.com/stoic-budget/stoic-budget/commit/0a7444f5f78ab407afdf020ab16adfc92ae2eba3))
* **admin:** parser health leads back to the admin page ([e09920b](https://github.com/stoic-budget/stoic-budget/commit/e09920b79bc275e5a5aa9526a0f63383e98e9078))
* **admin:** parser health page, every bank's parses and layouts ([98c200b](https://github.com/stoic-budget/stoic-budget/commit/98c200b90d2b505ef05a3a0f01a2b4673949491c))
* **avatars:** the first letter of the name on a sage tint, no more identicons ([8ec9528](https://github.com/stoic-budget/stoic-budget/commit/8ec9528351f29e705728612a14b648951d17f6c3))
* **avatars:** the first letter of the name on a sage tint, no more identicons ([2087064](https://github.com/stoic-budget/stoic-budget/commit/2087064a3ad21057fe80dbd10d295076b07f50f6))
* **backend:** every JSON answer has a response contract ([3fe0e72](https://github.com/stoic-budget/stoic-budget/commit/3fe0e72ccd503033f9ffd8bce4ffb01c0e3fa113))
* **backend:** every route param and query string through a schema (part 4a/4) ([e9ff556](https://github.com/stoic-budget/stoic-budget/commit/e9ff556bd372f89059f5eb67269ca111c0cbb970))
* **backend:** NestJS 12; unpdf replaces pdf-parse; own Redis throttler storage ([83735c4](https://github.com/stoic-budget/stoic-budget/commit/83735c44be58ebd7c07fd5dddd2599ab70874e83))
* **backend:** response contract on every JSON handler (part 4b/4) ([d0a5165](https://github.com/stoic-budget/stoic-budget/commit/d0a5165f6096d363c9cbb9d94e7d8469176224e4))
* **backend:** route params and query strings go through schemas ([98e9b7a](https://github.com/stoic-budget/stoic-budget/commit/98e9b7a23df86151164911f231c072fb443491e5))
* **bank-sync:** bring multi-provider bank sync onto main ([7c70b78](https://github.com/stoic-budget/stoic-budget/commit/7c70b78a91a9a7bab262ad2a14eb5bb5aeb11467))
* **bank-sync:** several providers, a feed per wallet, switching without starting over ([0b933f3](https://github.com/stoic-budget/stoic-budget/commit/0b933f380e04ebccc3a1f3a95a5d23a05ca322cd))
* **brand:** new logo mark ([f84d899](https://github.com/stoic-budget/stoic-budget/commit/f84d899220a16ad3f52253fc489f371158483c0d))
* **brand:** new logo mark ([969da5b](https://github.com/stoic-budget/stoic-budget/commit/969da5b03deaca92d40f626e13ac127638bb5a2e))
* **brand:** new piggy-bank logo and the app palette on the docs site ([e385526](https://github.com/stoic-budget/stoic-budget/commit/e385526cb2b373a81e70992be0d0bff816858c4b))
* **brand:** new piggy-bank logo and the app palette on the docs site ([080a60d](https://github.com/stoic-budget/stoic-budget/commit/080a60dc68de1f7a52e4c631b6974c6b26c29e20))
* **charts:** category chart as a solid pie with the slice colour in the tooltip ([d4d3d68](https://github.com/stoic-budget/stoic-budget/commit/d4d3d6863833ec83761c065ecc6ef78920954455))
* **charts:** category chart as a solid pie, hovered slice darkened, colour in the tooltip ([943af88](https://github.com/stoic-budget/stoic-budget/commit/943af885c1e3aa54c057560dde2ae77d73b632d3))
* **dashboard:** Balances widget — what you own and owe, by group ([b695151](https://github.com/stoic-budget/stoic-budget/commit/b6951510be9a4dcc879fa0247e7ded95f26aa5c8))
* **dashboard:** Balances widget — what you own and owe, by group, with a trend per group ([2044f30](https://github.com/stoic-budget/stoic-budget/commit/2044f305b97d2f4a61c6af675f11f1055b53d580))
* **dashboard:** budgeted share in cash flow bars ([bc44ab8](https://github.com/stoic-budget/stoic-budget/commit/bc44ab883185ef305df56228ac81bb0e94435b39))
* **dashboard:** calendar and flow views in the cash flow card ([f84c730](https://github.com/stoic-budget/stoic-budget/commit/f84c730643b6d1d44a7332bd755f368d05d0a92a))
* **dashboard:** calendar and flow views in the cash flow card ([38e7a47](https://github.com/stoic-budget/stoic-budget/commit/38e7a478e87778539a061e5c89410dee41a88398))
* **forecast:** say when the forecast is a rough estimate ([2af65d6](https://github.com/stoic-budget/stoic-budget/commit/2af65d64b8d2f6be26ad9551602cac2ccb054acd))
* **forecast:** say when the forecast is a rough estimate ([40e08c6](https://github.com/stoic-budget/stoic-budget/commit/40e08c62843474e39636f0099be9884ea0b948c5))
* **frontend:** loading skeletons that keep each page's real frame ([5322ea6](https://github.com/stoic-budget/stoic-budget/commit/5322ea65b41faab1a3f3ff219d9a8abb69a1553f))
* **frontend:** loading skeletons that keep each page's real frame ([1038f66](https://github.com/stoic-budget/stoic-budget/commit/1038f664794b44048e84288386ed4f88a28fb37c))
* **frontend:** snapshot skeletons instead of page and block spinners ([198007d](https://github.com/stoic-budget/stoic-budget/commit/198007d22269fb46aae5ac3437cd7de9a8abeeb7))
* **goals,receipts:** a transaction counts toward a goal; receipts link to budget, rules, bills and paybacks ([26dce2d](https://github.com/stoic-budget/stoic-budget/commit/26dce2dddec1142b19ef61eea8c92719fb4795cc))
* **goals:** a transaction counts toward a goal; receipts pick the goal and the account ([6adbfba](https://github.com/stoic-budget/stoic-budget/commit/6adbfba27f9c62255a550dd61abf4b487ae80a77))
* **import:** bank CSV/XLSX import into statements with remembered column mappings ([52c7607](https://github.com/stoic-budget/stoic-budget/commit/52c76070b9cb59ed1900ad8f915a1dca9a184e2e))
* **import:** bank CSV/XLSX import into statements with remembered column mappings ([fae3c83](https://github.com/stoic-budget/stoic-budget/commit/fae3c83ce71a2f09361ac6a34c154a66165d593e))
* **navigation:** Admin panel in the account menu, in place of What's new ([5b9db67](https://github.com/stoic-budget/stoic-budget/commit/5b9db67a1eff6cdc821e08fd1f67adf55a5406e9))
* **navigation:** Admin panel in the account menu; audit avatars match the member ([09a6991](https://github.com/stoic-budget/stoic-budget/commit/09a6991a6cb02fdcfd3cea748cdfd6991589f296))
* **parsing:** a shared layout becomes a pull request, which the maintainer merges ([ac5327f](https://github.com/stoic-budget/stoic-budget/commit/ac5327fc04a60fd702658530950944da5d56ed8a))
* **parsing:** a shared layout says how the bank prints, and the golden case prints so ([63e48f8](https://github.com/stoic-budget/stoic-budget/commit/63e48f8e9e5047a2f6db16a1ceb1a7303fbdcc03))
* **parsing:** a statement the parser cannot read can be taught ([50e5093](https://github.com/stoic-budget/stoic-budget/commit/50e5093c7850d8ff4842a54e56ebca78dd757423))
* **parsing:** Absa statements, and amounts with a letter currency sign ([ef38401](https://github.com/stoic-budget/stoic-budget/commit/ef38401de7dfc5033e5d12ac9827a24d3b722156))
* **parsing:** Absa statements, and amounts with a letter currency sign ([0220dff](https://github.com/stoic-budget/stoic-budget/commit/0220dffdc1ae8f731bd7726185d4222fd044d100))
* **parsing:** Ally Bank statements; dated balance lines are not transactions ([d1b4757](https://github.com/stoic-budget/stoic-budget/commit/d1b47572b4f96ecee93e5b0e91adc79760894994))
* **parsing:** Ally Bank statements; dated balance lines are not transactions ([fcb0fa5](https://github.com/stoic-budget/stoic-budget/commit/fcb0fa58d105360ffbd33d967dfcbbf0b24f8ee4))
* **parsing:** ANZ statements; rows whose text wraps around their amounts ([0cc6df4](https://github.com/stoic-budget/stoic-budget/commit/0cc6df4d1e7f3c4313e9c0935dce567a5be43d4e))
* **parsing:** ANZ statements; rows whose text wraps around their amounts ([d7c959f](https://github.com/stoic-budget/stoic-budget/commit/d7c959f163ec245c30b6f20c4db6fd0b78f2b241))
* **parsing:** Associated Bank statements; deposit and withdrawal sections ([fc6b67c](https://github.com/stoic-budget/stoic-budget/commit/fc6b67cd494a25c5f7a7be291103b40c1121b202))
* **parsing:** ATB Financial statements; scanned PDFs read by OCR ([e2902f9](https://github.com/stoic-budget/stoic-budget/commit/e2902f9317259a6a7e62e3ad8abf8ed5f13851f2))
* **parsing:** Axis Bank statements; text above the date, centred headings ([06d308b](https://github.com/stoic-budget/stoic-budget/commit/06d308be01ef6914776e1414db09c5a20f2abaa6))
* **parsing:** Banco do Brasil statements; amounts signed after the figure ([b3b593d](https://github.com/stoic-budget/stoic-budget/commit/b3b593decf0927595b8053517c16224911db6b47))
* **parsing:** Bank of China (Hong Kong) statements; year-first dates ([3cb28a0](https://github.com/stoic-budget/stoic-budget/commit/3cb28a0685b01501d3421ca7b21c16f369544e9b))
* **parsing:** Bank of Scotland statements; "Balance on &lt;date&gt;" ([312244e](https://github.com/stoic-budget/stoic-budget/commit/312244e63ad7d9f605421f147c57e237f787d5f6))
* **parsing:** check each PDF reading against what the statement prints ([f5a4c8f](https://github.com/stoic-budget/stoic-budget/commit/f5a4c8fc1678c9bab9b71f354cdabc86ae9d66ac))
* **parsing:** fingerprint each statement's layout, note banks it names ([600a027](https://github.com/stoic-budget/stoic-budget/commit/600a0271e8941f56a51635617bab98b517325641))
* **parsing:** read every account a statement prints, and say which were not imported ([4e379df](https://github.com/stoic-budget/stoic-budget/commit/4e379dffd404681d6b08614351b1751776b2ab76))
* **parsing:** read every account a statement prints, and say which were not imported ([3d9b898](https://github.com/stoic-budget/stoic-budget/commit/3d9b8981e54d69b56ef953c28904ef49eb81f674))
* **parsing:** read every statement of a Bereke file that holds several ([f6748f2](https://github.com/stoic-budget/stoic-budget/commit/f6748f2285af47fe94203e99f7db31b5357acbc5))
* **parsing:** read every statement of a Bereke file that holds several ([fa83451](https://github.com/stoic-budget/stoic-budget/commit/fa834518fd5b5cdca231fd76d0f200c3e3735408))
* **parsing:** read statements without ruling lines from word positions ([4e2d1b4](https://github.com/stoic-budget/stoic-budget/commit/4e2d1b4ec90e8122599e86d7c5fc33215e3682a5))
* **parsing:** read statements without ruling lines from word positions ([efe292b](https://github.com/stoic-budget/stoic-budget/commit/efe292b45508a04f4cc670e497f719bfbb6e7b69))
* **parsing:** share a taught layout with the project ([0f62f4f](https://github.com/stoic-budget/stoic-budget/commit/0f62f4f8c1bfa46cfe2beca68a64987f3fe76525))
* **parsing:** share a taught layout with the project, and propose it as a pull request ([056376c](https://github.com/stoic-budget/stoic-budget/commit/056376ca155900d93829b5d91696ec33f21029fb))
* **parsing:** shared layouts go to the project's deployed service by default ([1e4c426](https://github.com/stoic-budget/stoic-budget/commit/1e4c426395b6a68846391442a0b032e0334b314d))
* **parsing:** teach a statement again ([9ad439a](https://github.com/stoic-budget/stoic-budget/commit/9ad439acec6bfc8f6aa1fb8fd29c47e0c75f2725))
* **parsing:** weigh a shared layout without the statement behind it ([76fc200](https://github.com/stoic-budget/stoic-budget/commit/76fc200d1ded9af976c54750deaca903fd8311ce))
* **payees:** pick a payee in a drawer, and bulk categories in the category drawer ([7afb15c](https://github.com/stoic-budget/stoic-budget/commit/7afb15c232a38c21408b6604e9e604a87b1803af))
* pictures for what was bought or sold, vendor marks and item-kind icons ([515ad70](https://github.com/stoic-budget/stoic-budget/commit/515ad703f4cf21dc1c290e7f811f9e1f062f70b1))
* pictures for what was bought or sold, vendor marks and item-kind icons ([77eb108](https://github.com/stoic-budget/stoic-budget/commit/77eb108df066650b47a573faea313a65fda5dad5))
* **receipts:** budget line, rule from vendor, pay a bill or book a payback ([6adf117](https://github.com/stoic-budget/stoic-budget/commit/6adf1173c3f2e97a5ec7dc6d1f6a4d4db17179c7))
* **reports:** captions that fit small treemap tiles, and a tooltip on every tile ([c0d4c3a](https://github.com/stoic-budget/stoic-budget/commit/c0d4c3a4875f305840330251eed71d5efc7de812))
* **reports:** captions that fit small treemap tiles, and a tooltip on every tile ([080cb40](https://github.com/stoic-budget/stoic-budget/commit/080cb40c6b3efd6c47e1e9aea5c94330b056b6d6))
* **reports:** honest rates, last year's comparison, refunds and savings rate in cash flow ([df4e4ca](https://github.com/stoic-budget/stoic-budget/commit/df4e4caf86ec0c0cc8b248637c86bc0370a2f2a9))
* **reports:** port what feat/reports-analytics adds that main lacks ([0c141e3](https://github.com/stoic-budget/stoic-budget/commit/0c141e3515363fd8e4380e96f4f87207d4b2f03d))
* **reports:** stop generated report files piling up forever ([985f69a](https://github.com/stoic-budget/stoic-budget/commit/985f69aeb736dcb97aced9c5ed0d7ed3366822e8))
* **review:** fold a statement's rows into one line ([ed53ae3](https://github.com/stoic-budget/stoic-budget/commit/ed53ae31b9f57b0067a5baa4092e0e45fc6744c7))
* **review:** fold a statement's rows into one line ([1c5677f](https://github.com/stoic-budget/stoic-budget/commit/1c5677fc34be52e54a8f3cc1680422faa40555cb))
* **rules:** categorization rules page over the existing engine ([c0a6b1f](https://github.com/stoic-budget/stoic-budget/commit/c0a6b1fa8db468ce15b5632cf17ad1e7f5d1d76d))
* **rules:** categorization rules page over the existing engine ([ecc0540](https://github.com/stoic-budget/stoic-budget/commit/ecc05401ea7ea52375e9c935cdfd60618f74b504))
* **rules:** rule editor page, ordered table, suggestions, tags and account conditions ([37dc63f](https://github.com/stoic-budget/stoic-budget/commit/37dc63fafe2def4da09709e82a427873ce827894))
* **rules:** rule editor page, ordered table, suggestions, tags and account conditions ([f862d13](https://github.com/stoic-budget/stoic-budget/commit/f862d13ba9567512eeb1a401d780aab382074cdc))
* **settings:** "Round amounts" switch shows cents on overviews ([97dca49](https://github.com/stoic-budget/stoic-budget/commit/97dca497d7aa3ac69ebbd7668b7c7470c92ffd4b))
* **settings:** "Round amounts" switch shows cents on overviews ([4137a15](https://github.com/stoic-budget/stoic-budget/commit/4137a15b1b6a147317fc7c76e15c9d517fd8ce73))
* **statements:** a statement's Category cell counts the rows still uncategorized ([aee0a01](https://github.com/stoic-budget/stoic-budget/commit/aee0a015eca3469c30cef6ba512fe47ccb4fe34a))
* **statements:** a statement's Category cell counts the rows still uncategorized ([7d0d11e](https://github.com/stoic-budget/stoic-budget/commit/7d0d11ed5c8fdeb9836b69e388cc5777b037054e))
* **statements:** Amount shows spending, income, both or the net change ([89fd512](https://github.com/stoic-budget/stoic-budget/commit/89fd5129218f8b40fbc0656e4a2f4d80c050d7ee))
* **statements:** Amount shows spending, income, both or the net change ([355005d](https://github.com/stoic-budget/stoic-budget/commit/355005db2c0767f6d63a28a7ace0b53e6aaa3f8c))
* **statements:** file by payee, suggested categories, payees that learn ([f90d652](https://github.com/stoic-budget/stoic-budget/commit/f90d6522f71e863df05fd74887cc058f88d27b8a))
* **statements:** file by payee, suggested categories, payees that learn ([c698be0](https://github.com/stoic-budget/stoic-budget/commit/c698be0bfe8a3b3cce738ba231d833b2b5054dd5))
* **statements:** import each account of a multi-account file as its own statement ([3039037](https://github.com/stoic-budget/stoic-budget/commit/30390379112477ddacbf048d92794bd7fefc2f5b))
* **statements:** import each account of a multi-account file as its own statement ([d0f7ec3](https://github.com/stoic-budget/stoic-budget/commit/d0f7ec37b375c6e51bc7d67a68b41af4143bc594))
* **statements:** offer to share a taught layout after saving ([b79add0](https://github.com/stoic-budget/stoic-budget/commit/b79add0924f36679d5ea09c9045fd01bc5694bb7))
* **statements:** teach a statement again from its preview's menu ([f3aece2](https://github.com/stoic-budget/stoic-budget/commit/f3aece27e2033963d95918ddccfbd073f83cca71))
* **statements:** teach the parser in the preview, where the amount was ([04bdd16](https://github.com/stoic-budget/stoic-budget/commit/04bdd16d38ab94796bba9a80d7ad9db1ed3e4630))
* **statements:** the scan takes bank statements too ([45a444d](https://github.com/stoic-budget/stoic-budget/commit/45a444d05200e707ada6db15832091725036149c))
* **statements:** the scan takes bank statements too ([e081840](https://github.com/stoic-budget/stoic-budget/commit/e081840c1f45e98ae3bd7b3a72672cc7afd695c7))
* **subscriptions:** turn a receipt into a subscription ([4f8d609](https://github.com/stoic-budget/stoic-budget/commit/4f8d609ba3047b594d746acc08835769006c9d79))
* **subscriptions:** turn a receipt into a subscription ([f0e8054](https://github.com/stoic-budget/stoic-budget/commit/f0e80548d982ac99e62a1d7db82a20b7e7873f0e))
* **tags:** tags page, tags on receipts and payables, categories page ([f9a8c1f](https://github.com/stoic-budget/stoic-budget/commit/f9a8c1f6eaea92359088fc90a2ed0bddc73ff560))
* **tags:** tags page, tags on receipts and payables, categories page ([13965f8](https://github.com/stoic-budget/stoic-budget/commit/13965f8a975459a2904172d8d8b7d50443246874))
* **theme:** calmer light theme; theme follows the system by default ([9175b61](https://github.com/stoic-budget/stoic-budget/commit/9175b613c800f3a15aae3808b316f8e23fce8bbc))
* **theme:** calmer light theme; theme follows the system by default ([af72b01](https://github.com/stoic-budget/stoic-budget/commit/af72b0152030087c2210e03eddffc51360de3d16))
* **tooling:** refuse source files over 300 lines of code — "Split it into hooks/helpers" ([693010d](https://github.com/stoic-budget/stoic-budget/commit/693010dc159c4afab96477785759c4aa30f0443e))
* **tooling:** refuse source files over 300 lines of code ("Разбей на хуки/хелперы") ([9e66a9e](https://github.com/stoic-budget/stoic-budget/commit/9e66a9e58c804ac705b321dbfb4e5803b5a91a36))
* **transactions:** a History tab people can read, with a way back ([5a7b85f](https://github.com/stoic-budget/stoic-budget/commit/5a7b85f8fdae785f511906ea7dd3c827cc2c5a14))
* **transactions:** History reads as a timeline with an icon for each change ([e50eb13](https://github.com/stoic-budget/stoic-budget/commit/e50eb135ac45ac4b5d32767ff204708d0f1e4e10))
* **ui:** skeletons from a snapshot of the last layout instead of loading spinners ([37d3e56](https://github.com/stoic-budget/stoic-budget/commit/37d3e567fda8112c2995639dd5059a582daac1e6))


### Bug Fixes

* **admin:** parser health refreshes with the statements it counts ([52def6d](https://github.com/stoic-budget/stoic-budget/commit/52def6d349cb1fc0eceb914be035e25bdf311082))
* **audit:** draw the actor as the account menu does ([50df1dd](https://github.com/stoic-budget/stoic-budget/commit/50df1dd8b8a66f0adfcde03fb67ce0983809610c))
* **backend:** errors a user causes are coded, not a bare 500 ([dc4f28d](https://github.com/stoic-budget/stoic-budget/commit/dc4f28d427e1c31693b306bcbe02f15762d7d608))
* **backend:** every HTTP exception carries an error code ([4337bc1](https://github.com/stoic-budget/stoic-budget/commit/4337bc13c4845c3ea518933b1a5ccd489af2fb0d))
* **backend:** every HTTP exception carries an error code (525 throws, 396 codes) ([4d8db16](https://github.com/stoic-budget/stoic-budget/commit/4d8db1610c2966b747f36b59ac8fdb8289e21673))
* **backend:** keep the item-kinds generator out of the scripts build ([9281a45](https://github.com/stoic-budget/stoic-budget/commit/9281a451a554649a4a10989de51616db8d39ae2d))
* **backend:** user-caused errors coded instead of bare 500 (part 2/4) ([6742eb6](https://github.com/stoic-budget/stoic-budget/commit/6742eb6cd02c29f0048b24e978744dbfed1df19d))
* **categories:** remove the categories earlier guesses made up ([1f8b89e](https://github.com/stoic-budget/stoic-budget/commit/1f8b89efc15313911102c23c3303b6e73ad03ad4))
* **ci:** format workspace activity query; drop a payee check that belongs to another branch ([3c3ad4d](https://github.com/stoic-budget/stoic-budget/commit/3c3ad4da45517e3ef9762c2b9f8e02fb4fb706ec))
* **classification:** "never" payees get no suggestion; whole words are not a cut-off ([11b090a](https://github.com/stoic-budget/stoic-budget/commit/11b090a393712e0cd5ec8b2d57199326eabce537))
* **contracts:** budgeted fields in the dashboard contract source ([da8953a](https://github.com/stoic-budget/stoic-budget/commit/da8953a448ea81b329ac19ea959da6c980e881d0))
* **crypto:** use .js subpaths for @noble/hashes v2 ([22f63bc](https://github.com/stoic-budget/stoic-budget/commit/22f63bcfb5c4f161de046da88b5def319ad29451))
* **dashboard:** budgeted share code meets the merged guards ([5054896](https://github.com/stoic-budget/stoic-budget/commit/5054896f06bfbe39482ba181f0d8771c10262df3))
* **dashboard:** figures sized by their card, steady skeletons, widgets follow the month ([bd3f1b9](https://github.com/stoic-budget/stoic-budget/commit/bd3f1b95f8973b7b70d58dc8cd09c3f9ee0eb111))
* **dashboard:** figures sized by their card, steady skeletons, widgets follow the month ([142fd6b](https://github.com/stoic-budget/stoic-budget/commit/142fd6be16fc86eb75a691d054a686530d404305))
* **dashboard:** labels read through text() were empty ([668d8ba](https://github.com/stoic-budget/stoic-budget/commit/668d8baaeb2fee736385c21886400aa7148b3fef))
* **dashboard:** upcoming charges ring the subscription they open ([57208a9](https://github.com/stoic-budget/stoic-budget/commit/57208a931b69933e245c73cd4d6d91429d60dd8a))
* **dashboard:** upcoming charges ring the subscription they open ([10882b5](https://github.com/stoic-budget/stoic-budget/commit/10882b53e65ab9aefe01fb69cd20352606605915))
* **deps:** drop deepmerge from the backend via react-email render 2.2 ([9986306](https://github.com/stoic-budget/stoic-budget/commit/998630659cb7692d62c795c96da0087a44f61e27))
* **deps:** drop deepmerge from the backend via react-email render 2.2 ([732d2bf](https://github.com/stoic-budget/stoic-budget/commit/732d2bf5a2a5d0e4557c740b6fa9662a1ef7e0e1))
* **deps:** follow-redirects 1.16.2 (frontend), minimatch 11.0.3 (backend) ([7b30b99](https://github.com/stoic-budget/stoic-budget/commit/7b30b99fc987faf24d56b92ba3ac6a2fc010d680))
* **deps:** follow-redirects 1.16.2 in the frontend (GHSA-mrwp-f3q8-3g9p) ([eec1b4c](https://github.com/stoic-budget/stoic-budget/commit/eec1b4c58a2b2c57777e1a712f20f2e612408373))
* **deps:** intlayer 9 drops vulnerable simple-git 3; vitest 4.1.12 ([eed7d1e](https://github.com/stoic-budget/stoic-budget/commit/eed7d1ebb0a9db8ab6ef8a800ba3503366d3bc00))
* **deps:** keep @noble/hashes in production deps ([8efed55](https://github.com/stoic-budget/stoic-budget/commit/8efed55aa03f3aefbb7ab07314726ae8b578dfb5))
* **deps:** minimatch 11.0.3 in the backend (GHSA-g3hv-75wg-m249) ([e19e48a](https://github.com/stoic-budget/stoic-budget/commit/e19e48a4e703791eec2852a0548fc0b67a7141ed))
* **deps:** patch advisories published 2026-10-23 ([aadf196](https://github.com/stoic-budget/stoic-budget/commit/aadf1960b86e402508d34800c5f52a267f15f02c))
* **deps:** resync backend lockfile after removing Babel ([b2379d0](https://github.com/stoic-budget/stoic-budget/commit/b2379d0969c3d877ba63d9e985cd394302b75717))
* **deps:** website React 19, override postcss-selector-parser and uuid ([e811722](https://github.com/stoic-budget/stoic-budget/commit/e811722f46121ec6df276f68f242433724829870))
* **docker:** drop onnxruntime leftovers; build the image on PRs that touch it ([8c9a330](https://github.com/stoic-budget/stoic-budget/commit/8c9a3309ec75fc38190ec656959467a626cc71ab))
* **docker:** drop onnxruntime leftovers; build the image on PRs that touch it ([0e5bd59](https://github.com/stoic-budget/stoic-budget/commit/0e5bd59b05fc9851fb8a1571f31e590c9e062b7f))
* **docker:** restart postgres and redis after a reboot ([84122e4](https://github.com/stoic-budget/stoic-budget/commit/84122e47f5ae842d9efbd06eb6d688051fd7436e))
* **docker:** restart postgres and redis after a reboot ([174b68a](https://github.com/stoic-budget/stoic-budget/commit/174b68a71346c4818fb13dcbac4472c3f315c252))
* **e2e:** start no cron jobs in e2e apps ([7492163](https://github.com/stoic-budget/stoic-budget/commit/7492163a5d61b246127a705b4d3a8c499e54d26f))
* **e2e:** start no cron jobs in e2e apps ([fc3f306](https://github.com/stoic-budget/stoic-budget/commit/fc3f3069ff90e91b480f4ee89b374acb32c80b1e))
* **fixtures:** replace the Hapoalim statement scans with invented pages ([b1c86e0](https://github.com/stoic-budget/stoic-budget/commit/b1c86e04f1018ada4423d67f7c24b7164ce12f0b))
* **fixtures:** replace the Hapoalim statement scans with invented pages ([9573f4e](https://github.com/stoic-budget/stoic-budget/commit/9573f4e698e2826e9e215adb23732ad6ccf9e4fe))
* four bugs found while adding the contracts ([5085d47](https://github.com/stoic-budget/stoic-budget/commit/5085d473ac25a82a1f0b9081786c8a1f82bb68c1))
* **frontend:** dev start rebuilds the dictionaries and locale packs ([90b754b](https://github.com/stoic-budget/stoic-budget/commit/90b754bf250f1cb89926c52686b5f907ee51f785))
* **frontend:** dev start rebuilds the dictionaries and locale packs ([96d6d8c](https://github.com/stoic-budget/stoic-budget/commit/96d6d8cbdd12d09a949b64fe7bf78b7f5d6dba6a))
* **frontend:** green Vitest suite (132 red → 0), run it in CI ([d8870be](https://github.com/stoic-budget/stoic-budget/commit/d8870be5c00a3e6b3e9994f0fa441d1c0e1205e8))
* **frontend:** keep Effect out of the webhooks chunk; classify two query roots ([873dc01](https://github.com/stoic-budget/stoic-budget/commit/873dc01bd238d3dc4973625f3e181c0c3b3ca016))
* **frontend:** read apiBaseUrl when a picture is drawn, not at import ([15fd113](https://github.com/stoic-budget/stoic-budget/commit/15fd113503d241f05aa0010d684af8ca09907ded))
* **frontend:** small fixes from the shared checkout ([334e693](https://github.com/stoic-budget/stoic-budget/commit/334e6932065fd81ca5016ffd71c32a3fe23ab4b2))
* **frontend:** small fixes from the shared checkout ([73bcc64](https://github.com/stoic-budget/stoic-budget/commit/73bcc64851675fc9cacf7fbf2acf256765267808))
* **goals:** a missing exchange rate answers with a typed error code ([bb4758d](https://github.com/stoic-budget/stoic-budget/commit/bb4758d02cd73196b800c9e6f873c03e3fa40876))
* **goals:** no hydration mismatch when the workspace id is already stored ([0dbf947](https://github.com/stoic-budget/stoic-budget/commit/0dbf947b696969c6311367612330196ea79e7733))
* **i18n:** 'Invoice not found' said 'New client' in 15 locales ([890bbe4](https://github.com/stoic-budget/stoic-budget/commit/890bbe4c4c20e970ecb58cc21dcf1f3f045f2305))
* **i18n:** every backend error code translated into 35 locales (part 3/4) ([f63033b](https://github.com/stoic-budget/stoic-budget/commit/f63033bc1bbbd4a376bebfd0c3dbb26a083c1967))
* **i18n:** every user-facing text in the frontend comes from a dictionary ([a081a93](https://github.com/stoic-budget/stoic-budget/commit/a081a93124af55d70d09808f49dfaadc85905dbc))
* **i18n:** no English stand-ins next to dictionary keys ([3abe72e](https://github.com/stoic-budget/stoic-budget/commit/3abe72ee833cfd42f03927b655ea0f0a3939f464))
* **i18n:** no hard-coded text in the frontend; CI guard keeps it at zero ([918cf5d](https://github.com/stoic-budget/stoic-budget/commit/918cf5d832b2e70ac7a2eb081c37258869637da6))
* **i18n:** shifted translations in 15 locales (275 keys) ([bb54800](https://github.com/stoic-budget/stoic-budget/commit/bb548005132462a40549b6531d549f2f4e0025b1))
* **i18n:** shifted translations in the 15 locales added together ([038964b](https://github.com/stoic-budget/stoic-budget/commit/038964b2d5c3cfbc2bc62670e8187d8586f7a4b4))
* **i18n:** translate every backend error code into all 35 locales ([9552743](https://github.com/stoic-budget/stoic-budget/commit/95527432ffff486c42b7fe2ca8b2d7e6d9378a02))
* **lint:** Biome 2.6.3 across the repo, config migrated ([da1737d](https://github.com/stoic-budget/stoic-budget/commit/da1737da0dbb2aa4749f9a9648496131e5e72e7f))
* **navigation:** the admin entry in the account menu has a short name ([141c13b](https://github.com/stoic-budget/stoic-budget/commit/141c13b841f107b22362d859600702dd45e6300f))
* **navigation:** the admin entry in the account menu has a short name ([509c765](https://github.com/stoic-budget/stoic-budget/commit/509c76506ca8b5bf1af913099a3cbf11f589ae14))
* **notifications:** only workspace members join its socket room ([a0e361a](https://github.com/stoic-budget/stoic-budget/commit/a0e361a6bfc5685972372c51fdd3ae071769d5fb))
* **notifications:** only workspace members join its socket room ([262ed8c](https://github.com/stoic-budget/stoic-budget/commit/262ed8c1f78bf754cdc96fb214a3b6a0029dffad))
* **parsing:** a balance's label is what the user drew around it, never a line far above ([a022bdc](https://github.com/stoic-budget/stoic-budget/commit/a022bdc42e7bd10c30ff64d5767d62722ce15dfc))
* **parsing:** a parsed statement gets no guessed category ([5b2573d](https://github.com/stoic-budget/stoic-budget/commit/5b2573de62b0f20a55d4cf4cd64fa9e465e5f727))
* **parsing:** a parsed statement gets no guessed category ([5916c9f](https://github.com/stoic-budget/stoic-budget/commit/5916c9f125a53112c31972110525efab3cac708b))
* **parsing:** a template learns nothing from tags put on the wrong things ([3198609](https://github.com/stoic-budget/stoic-budget/commit/31986092253fb2fd983f082a968c44ab1be31d4d))
* **parsing:** an unknown column after the money starts where the money ends ([ab16696](https://github.com/stoic-budget/stoic-budget/commit/ab166964183965d9ccce3cd148afc3365bbfe3c0))
* **payees:** an empty comparison fills the column, with the empty-state icon ([464def1](https://github.com/stoic-budget/stoic-budget/commit/464def1ddd6345e2c18b4f17bdd8f43f21399164))
* **payees:** the comparison card always fills its column; statement names no longer broken by their button ([df76775](https://github.com/stoic-budget/stoic-budget/commit/df767751bc4547760eba4c5e142b10aa8ec6dd54))
* **policy:** accept actions/attest for the SLSA provenance and SBOM controls ([069de44](https://github.com/stoic-budget/stoic-budget/commit/069de440a381c8247cedaa8913d29368a636108e))
* **receipts:** drop the stray quotes OCR reads off a logo beside the vendor ([5133078](https://github.com/stoic-budget/stoic-budget/commit/51330780db2e438f17a760b9ba6adbbf300cfa7b))
* **receipts:** drop the stray quotes OCR reads off a logo beside the vendor ([f42bce6](https://github.com/stoic-budget/stoic-budget/commit/f42bce65efdd9dde4baade845fe912df3b6c9565))
* **reports:** cash-flow tiles take the dashboard KPI widths ([f546f29](https://github.com/stoic-budget/stoic-budget/commit/f546f29d965fcca27a3fca8b280171bc8ab8fb06))
* **reports:** cash-flow tiles take the dashboard KPI widths ([f35d322](https://github.com/stoic-budget/stoic-budget/commit/f35d322f7431063109d175bfc4563a5340ab19b9))
* **review:** count rows in the Uncategorized fallback as uncategorised ([0580fbf](https://github.com/stoic-budget/stoic-budget/commit/0580fbf6ffb8135ce2a50ec2d4bc2e7bf1853c64))
* **review:** count rows in the Uncategorized fallback as uncategorised ([8bde3ac](https://github.com/stoic-budget/stoic-budget/commit/8bde3ac435a0777f42d467d4c33e3e7d2a8abf3b))
* **review:** keep the import notification on rows with no category at all ([4ac9c4f](https://github.com/stoic-budget/stoic-budget/commit/4ac9c4fa2f8e5367bcfd3ac4e5844a55298873fa))
* **review:** stop row clicks on the confirm button itself (a11y lint) ([ee8422f](https://github.com/stoic-budget/stoic-budget/commit/ee8422f82f1785d3c1cda6b5ad16114c1fab1176))
* **security:** resolve 15 open CodeQL alerts ([319235d](https://github.com/stoic-budget/stoic-budget/commit/319235d2bccb9d5bca170fcd9c06bd02f34bd351))
* **security:** resolve 15 open CodeQL alerts ([1252b2f](https://github.com/stoic-budget/stoic-budget/commit/1252b2f6fecb9e079f92c6c69cf96ce1cbb8b31a))
* **statements:** a ? beside Teach says what it does and where to teach again ([88c0d4f](https://github.com/stoic-budget/stoic-budget/commit/88c0d4f6795b99e0b9b0ca61c6f36e31cb594909))
* **statements:** a statement the parser cannot read is still a statement ([2b95bd8](https://github.com/stoic-budget/stoic-budget/commit/2b95bd82f64d852566887ed2b1bc35689cada259))
* **statements:** a trashed statement can be scanned again; "-$503.00" is money ([0e12d8c](https://github.com/stoic-budget/stoic-budget/commit/0e12d8c188a19e9a7b68bab35b48f802fe04a0a9))
* **statements:** area labels step aside while an area is drawn ([95a2704](https://github.com/stoic-budget/stoic-budget/commit/95a2704427d4e6a8cb3879055f7280a35920a465))
* **statements:** calm parsing warnings list ([7485b9f](https://github.com/stoic-budget/stoic-budget/commit/7485b9f77e309490a11c3746938a4bb2dce42107))
* **statements:** calm parsing warnings list ([1b72c54](https://github.com/stoic-budget/stoic-budget/commit/1b72c54617e236ae9125547a3cba6e1a8e81e8b7))
* **statements:** clearer tags in the marking view, and warnings for areas off their mark ([edbbcf0](https://github.com/stoic-budget/stoic-budget/commit/edbbcf0bc6ad5b44c134b9197c7545e0d2ee6348))
* **statements:** drop imports and a wrapper the upload split left unused ([2f20de2](https://github.com/stoic-budget/stoic-budget/commit/2f20de2f1766d1d3a409bc359e4d1a49c1ef6902))
* **statements:** move the source-account migration to a free timestamp ([7b035a9](https://github.com/stoic-budget/stoic-budget/commit/7b035a94e2c37370f3652da1384c3ee7aad2ea99))
* **statements:** name the moved migration class after its new timestamp ([67de24c](https://github.com/stoic-budget/stoic-budget/commit/67de24cc389098188bb6e6a5cc67bf30d7b30856))
* **statements:** newest uploads stay on top; banks show their real names ([863809a](https://github.com/stoic-budget/stoic-budget/commit/863809aec175d6af2a2d21f04ddab715f0026dad))
* **statements:** newest uploads stay on top; banks show their real names ([158f449](https://github.com/stoic-budget/stoic-budget/commit/158f449148236880a6e4de68e746bb73313e295a))
* **statements:** stop ParsingWarningsPanel re-rendering forever ([3227c9d](https://github.com/stoic-budget/stoic-budget/commit/3227c9d7cf617b6287383747b85c544ee6715491))
* **statements:** the preview's menu in the theme's colours, at the app's size ([0f8ffc1](https://github.com/stoic-budget/stoic-budget/commit/0f8ffc1a3364a449920af6818b11611a87842cb0))
* tax rule without category, repeated rows on convert, import-session scoping ([f9f2976](https://github.com/stoic-budget/stoic-budget/commit/f9f2976ecae600a33e66d7c4ee576b3f0d82ed91))
* **test:** restore UPLOADS_DIR by deleting it, not by assigning undefined ([2d672a6](https://github.com/stoic-budget/stoic-budget/commit/2d672a6d4ad40f2d0d82e800149d7b4cdd55638e))
* **test:** stop unit specs writing uploads into backend/undefined/ ([f3f86f7](https://github.com/stoic-budget/stoic-budget/commit/f3f86f7662d84934afff97690b1feafb0518e9d5))
* **tooling:** a merge may keep the longer side of a file ([b083994](https://github.com/stoic-budget/stoic-budget/commit/b0839944b90a89dca9c607ebe4c6a6e763460176))
* **tooling:** file-size check message in English ([650b4e4](https://github.com/stoic-budget/stoic-budget/commit/650b4e405b21348f1dd7dc0663317feea7814952))
* **tours:** admin tour points at the page as it is now ([78bed73](https://github.com/stoic-budget/stoic-budget/commit/78bed737676d454d276f17843fb2f8b2445ed6bd))
* **ui:** modal backdrop as a theme token, darker in dark mode ([2345f56](https://github.com/stoic-budget/stoic-budget/commit/2345f564db6748885a5a45e51a28096321cca143))
* **ui:** modal backdrop as a theme token, darker in dark mode ([d3a12aa](https://github.com/stoic-budget/stoic-budget/commit/d3a12aae6dc97006852b4af15b6a0615581c308a))
* **webhooks:** deliver each claimed delivery to its own subscription ([f2ddf4e](https://github.com/stoic-budget/stoic-budget/commit/f2ddf4e89c0197ad76b495ae8a4eedd5711aa0c8))
* **webhooks:** deliver each claimed delivery to its own subscription ([c2c8adf](https://github.com/stoic-budget/stoic-budget/commit/c2c8adfba7ece10844da79af99be01c8a199e1bc))


### Miscellaneous Chores

* **deps:** TypeORM 1.1 ([144834a](https://github.com/stoic-budget/stoic-budget/commit/144834a34ffe08be2e25b584c55e2992debac7d0))
* **lint:** drop ESLint, Biome alone lints the frontend ([2985431](https://github.com/stoic-budget/stoic-budget/commit/29854319db04488ec13f4962c1cc20ed911d363e))
* **test:** Jest on SWC instead of Babel; TypeORM relations typed Relation&lt;T&gt; ([119bf7e](https://github.com/stoic-budget/stoic-budget/commit/119bf7e6c05e842334bd9586f8e62e0bd0c083cd))


### Build System

* **frontend:** build the App Router with vinext (Vite) instead of next ([50aa7a5](https://github.com/stoic-budget/stoic-budget/commit/50aa7a53b2d5b37dd81df93531f3d09b3bf82ba4))

## [Unreleased]

### Added

#### Bank sync through your own SimpleFIN account (2026-10-01)

- **Integrations → Bank sync via SimpleFIN**: paste the setup token from your own SimpleFIN Bridge
  account; Lumio exchanges it once (`POST /integrations/simplefin/connect`), keeps the access
  credential encrypted, lists the accounts and pulls them (`POST /integrations/simplefin/sync`) on
  demand or every six hours. Per-account *Pull* switch and target wallet
  (`POST /integrations/simplefin/settings`), *Refresh accounts*, disconnect deletes the credential.
- Each pull becomes an **OFX statement through the regular import**: dedupe, rules, review inbox
  and audit are the same as for an uploaded file. Provider transaction ids are document numbers, so
  nothing is imported twice; the first pull covers 90 days, later ones overlap by a week; pending
  rows wait until they post. A rejected credential flips the integration to *Needs a new token*.
- README positioning: Lumio holds no bank integration of its own; you may connect your own
  provider account. Enable Banking is not wired (needs an application registered with them).

#### Multi-currency: no silent 1.0, manual rates (2026-10-01)

- A missing exchange rate is now said out loud: `GET /exchange-rates` answers `missing: true`, the
  dashboard snapshot lists `missingRates` and shows a banner, Settings → Data → **Exchange rates**
  lists every currency in the workspace's rows with the rate used (or "no rate") and a field to
  **set a rate by hand** (`POST /exchange-rates/manual`; it wins over the provider for that day).
- The transaction drawer shows the amount **in the workspace currency** with the rate and its date,
  or that no rate exists and the row counts at face value in totals.

#### Import formats: OFX/QFX, QIF, camt.053, MT940, bank CSV presets, mailbox (2026-10-01)

- **Four more statement formats**: OFX/QFX (SGML and XML), QIF (date order inferred from the whole
  file), ISO 20022 camt.053 and SWIFT MT940 (structured `:86:` details). Recognised by extension and
  content, whatever MIME type the browser sends; a file that only has the extension is refused.
- **CSV presets for 22 bank layouts** (Revolut, Wise, N26, Monzo, Starling, Chase, Bank of America,
  Capital One, American Express, Wells Fargo, PayPal, ING, Rabobank, Sparkasse/DKB, Commerzbank,
  Nordea, Santander, Barclays, HSBC, Lloyds, Tinkoff): matched by the header row, columns mapped
  exactly instead of guessed, signed amounts and card-style charges handled per bank.
- **Forward a statement to the mailbox**: an export attached to an email in the IMAP inbox goes
  through statement import instead of the receipt pile (PDFs stay receipts).

#### Mobile layer: offline entries and web push (2026-10-01)

- **Works without a network**: a service worker caches the app shell and serves an offline page;
  a manual expense or a receipt photo added while offline is kept on the device (IndexedDB) and
  sent as soon as the connection is back, with an idempotency key so a retry cannot double-book.
  A strip at the top shows "Offline" or "N waiting to send" with a *Send now* button.
- **Web push**: a new *Push* column in notification settings and *Push on this device* to subscribe
  the browser or installed app; budget alerts, subscription price changes, "N waiting for review"
  and the rest reach the phone with the app closed. Digests go as one push. Needs VAPID keys on
  the server (`npx web-push generate-vapid-keys` → `WEB_PUSH_VAPID_*`); without them the channel
  says it is off. Dead subscriptions are dropped on the next send.
- **Home-screen shortcuts**: *Add expense* and *Scan receipt* on a long-press of the app icon.

#### Small-business pack (2026-10-01)

- **Bank reconciliation** (`/statements/reconcile`, linked from Payables): open bills and
  receivables next to the bank rows that look like their payment (same amount and currency, the
  vendor in the row's text, a date near the due date), one row per bill, confidence shown. *Confirm*
  links the row and settles the bill through the existing mark-as-paid path.
- **AR/AP ageing**: open amounts per direction in current / 1–30 / 31–60 / 61–90 / 90+ days past
  due, with the largest counterparties.
- **Duplicate bills**: open bills with the same counterparty, amount and currency due within a week.
- **Dunning reminders**: *Send reminder* on a sent or overdue invoice emails the client (EN/RU) and
  counts it on the invoice; needs SMTP and a client email, and says so otherwise.
- **Owners report** for business subscriptions: every active subscription with owner, monthly cost in
  the workspace currency, next charge and last review, totals per owner, CSV download
  (`GET /subscriptions/business-report?format=csv`).

#### MCP and AI as a trusted agent (2026-10-01)

- **Scoped API keys**: a key names what it may do (the same strings as the permissions the routes
  check), with *Read only* / *Read and write* / hand-picked presets in the MCP panel. A key is never
  wider than its owner's role; managing keys, people, workspace settings or integrations is never
  granted to a key. `GET /api-keys/scopes`; new keys require `scopes`. Keys made before scopes keep
  their owner's full reach (`scopes: null`).
- **Every agent write is on the record and undoable**: requests authenticated with an API key are
  audited as the actor *Integration* with the key's name and prefix; the in-app assistant's writes
  carry `X-Lumio-Actor: ai-chat` and are audited as the new actor *AI assistant*. Both record whom
  they acted for and are undoable wherever rollback knows the entity. The activity log filters by
  *AI assistant*.
- The assistant is told that every number in a reply comes from a tool result, never from an estimate.
- Docs: *MCP and API keys* (Claude Code / Claude Desktop setup, scopes) and *Security posture*
  (threat model, what is encrypted, what leaves the server and when, how to switch AI off entirely).

#### Reports: cash-flow map (2026-10-01)

- **Cash flow** tab on the reports page: a Sankey of income sources → income → categories →
  subcategories, a treemap of spending by size (click a category for its subcategories), and a
  by-category table with the period before and the change.
- Period presets or custom dates, a **"compare with the period before"** switch, an **"include
  transfers and investments"** switch (off by default: they are not spending), category chips
  with All / None, and a CSV export of the table.
- `GET /reports/cash-flow-map?dateFrom&dateTo&compare&includeTransfers&categories&format=csv`.

#### Investments v1 (2026-10-01)

- **Investment and retirement accounts** under the balance sheet's Investments section, with
  holdings entered by hand (ticker, class, quantity, price). The account's value is written as
  today's balance snapshot on every change, so the balance sheet and net worth read the same number.
- **Prices by ticker** from Stooq (free, no key; `AAPL` → `AAPL.US`, `VWCE.DE`), crypto from
  CoinGecko; cached fifteen minutes, egress-guarded. A price that cannot be fetched is simply kept.
- **Contributions count as transfers**: "Mark as a contribution" on an expense in the transaction
  drawer turns it into a one-leg transfer of kind `investment`. It leaves every spending aggregate;
  the account shows contributed, value and gain.
- **Net worth**: ranges 1M / 3M / 6M / 1Y / 3Y / 5Y / All, the all-time high with its date, and an
  allocation by asset class (stocks, ETFs, funds, bonds, crypto, cash, real estate, other).
- Endpoints under `/investments` (accounts, holdings, `refresh-prices`, `contributions`).

#### Cash-flow forecast (2026-10-01)

- **`/forecast`**: the balance 30, 90 or 365 days ahead, day by day, from unpaid bills, active
  subscriptions, sent invoices, dated goals (what each needs per month), paydays detected from
  history and the everyday spending average of the last three months. The low point and its day,
  the first day the balance goes negative, the closing balance.
- **Safe to spend** until the next payday (committed items only, never below zero) for a home
  workspace; **runway** in months at the current burn for a business one.
- **Scenarios**: untick any item ("what if I cancel Netflix"), scale income (50–150%) and spending
  (50–150%). `GET /forecast?days=&exclude=&incomeFactor=&expenseFactor=`.
- The dashboard's cash runway card now opens the forecast.

#### Workspace profile: Home or Business (2026-10-01)

- A workspace now says what it is for. **Home** hides invoices, the ledger, the tax declaration and
  custom tables from the menu (and from the welcome tutorial); nothing is deleted and every page
  still opens by link. **Business** is the default and is how every workspace behaved before.
- Chosen when creating a workspace (first step) and changed any time in Settings → Data →
  Workspace profile (`PATCH /workspaces/:id { profile }`, stored in `settings.profile`).

#### Budget mechanics (2026-10-01)

- **Rollover**: a budget now says what happens to unspent money. *Resets* is the old behaviour;
  *Carries over* moves leftover and overspend whole into the next period (the envelope for
  irregular costs); *Refills to the limit* tops the budget back up but never above it, and still
  deducts an overspend. The card shows the amount available this period and what was carried in.
- **Parent-category budgets**: a budget on "Food" counts "Groceries" and "Restaurants" too, and
  a spend in a subcategory is checked against every budget up the tree.
- **"What would this do"** under the category field of a manual expense: which budgets it pushes over
  (and by how much), and whether it takes the default account below zero. Advice, never a gate
  (`GET /budgets/impact`).

#### Subscriptions 2.0 (2026-10-01)

- **Price change with the yearly effect**: when the last two charges of a known subscription settle
  on a new price (more than 5% off the old one), the row is flagged, the delta per charge and per
  year is shown on the card, and the workspace gets a notification saying both numbers. A change is
  announced once; "Keep" clears the flag.
- **Possible duplicates**: two active or detected rows of one service (same domain, or the same
  name without plan words such as Premium/Basic) are grouped under `GET /subscriptions/duplicates`,
  counted on the page and marked on the row.
- **Cost per use**: a "Used it" tap on the card counts a use; the card then shows the price per use
  since the first tap, so "is Netflix worth it" has a number.
- **Set aside for annual and quarterly bills**: the card offers the monthly amount that covers the
  next charge by its date; one tap creates a savings goal linked to the subscription
  (`POST /subscriptions/:id/sinking-fund`, idempotent; `GET /subscriptions/sinking-funds` lists them).
- **Bills and invoices in the charge calendar**: open payables appear next to subscriptions with a
  "bill" label; sent invoices appear as money coming in and stay out of the month totals.
- **Switch for "is this a subscription?" prompts** in Settings → Notifications (`subscriptionPrompts`).

#### Telegram inbound (2026-10-01)

- **Send the bot a photo of a receipt** (or an image as a file): it goes through the same scan
  pipeline as the in-app camera, lands in the review inbox, and the bot answers with the vendor,
  the amount and a delete button. PDFs still go to statement import.
- **Type an expense**: "coffee 4.50", "taxi 15 EUR", "такси 1500 тг" books a manual expense dated
  today, unreviewed and uncategorised on purpose, so the category is picked in the review inbox.
  The reply carries a delete button. `/help` explains both.

#### Receipts meet bank rows (2026-10-01)

- **Receipt → transaction match:** after parsing, a receipt is matched to the bank row it documents
  (same money, same direction, within three days, the name agrees; exactly one plausible row) or to
  the several charges of one order (Amazon bills per shipment). Approving attaches the receipt to
  that row and copies its image as a transaction attachment instead of booking the expense a second
  time; `POST /receipts/:id/approve` takes `{transactionId}` to pick another row or `null` to book
  a new one, `GET /receipts/:id/transaction-matches` lists the candidates.
- **Split by line items:** `GET /receipts/:id/split-suggestion` categorises each line (keywords,
  then the model) and groups them into parts that add up to the transaction; `POST /receipts/:id/split`
  applies it through the ordinary split. Line categories are remembered on the receipt.
- **Receipts in the email body:** order confirmations without an attachment now get their line items
  (and a total when the amount scan found none) from the stripped text, and a `YYYY-MM-DD` date
  instead of the raw header.

#### Review inbox (2026-10-01)

- **One queue for everything that needs a decision** at `/review` (`GET /review-inbox`,
  `GET /review-inbox/counts`): transactions nobody categorised or the model categorised, receipts
  without an amount, suspected duplicates, detected subscriptions. Read from the existing rows,
  so an item leaves the queue the moment it is resolved anywhere.
- Keyboard-first on desktop (`j`/`k`, `x`, `a`, `c`, `Esc`), group by payee with one-click group
  selection, a date range for "everything from the trip → Vacation", approve with a category or as
  is (`POST /review-inbox/transactions/approve`, which records a manual pick and learns from it),
  keep or confirm a duplicate (`POST /review-inbox/duplicates/:id/resolve`), approve receipts,
  confirm or dismiss subscriptions. On mobile, swipe right approves and left skips.
- Settings → Processing: "Trust AI picks" keeps the model's categories out of the queue.
- A weekly notification "N items are waiting for review" (Monday morning, through the existing
  "uncategorised items" preference and digest mode).

#### Data you can trust: transfers, reimbursements, category provenance (2026-10-01)

- **Transfers between your own accounts** are paired automatically after every statement import
  (same money, different account, within three days, exactly one counterpart) and by hand
  (`POST /transactions/:id/link-transfer`, `unlink-transfer`, `transfer-candidates`,
  `POST /transactions/transfers/detect`). Paired rows keep their direction but no longer count as
  spend or income anywhere: dashboard, reports, budgets, goals, insights, subscriptions, tax drafts.
  The list filter `type=transfer` shows them; unlinked pairs are never re-paired automatically.
- **Reimbursements:** an incoming row can be linked to the expense it pays back
  (`link-reimbursement`, `unlink-reimbursement`, `reimbursement-candidates`). A full repayment
  becomes a `reimbursement` pair and leaves the aggregates; a partial one keeps the link and still
  counts gross.
- **Category provenance:** every transaction records which step set its category (`manual`, `rule`,
  `keyword`, `learned`, `history`, `ai`, `default`) and why (the rule name, the learned payee, the
  keyword, the model's confidence). The details drawer shows it. The order is fixed and stated in
  Settings → Processing: your pick → rules → keywords → your corrections → payee history → AI →
  "Uncategorised". A hand-picked category is sticky and bulk re-classification skips it.
- **Switches** in Settings → Processing: AI categorisation (off means no model calls and no reuse of
  what the model taught), AI merchant names, and learning from corrections.
- **Learning guard:** one correction does not replace a payee's established category; the second
  one does, and what you taught outranks what the model taught at any confidence.

### Changed

- Cross-statement duplicate detection no longer matches rows from two different accounts: the same
  coffee on two cards is two coffees. Overlapping re-imports of one account are still caught.
- The AI result is applied only where rules, keywords and your corrections found nothing; the
  statement import and the custom-table conversion now agree on that order.

### Fixed

- Changing a transaction's category through `PUT /transactions/:id` or `bulk-update` answered with
  the new category but wrote the old one back to the database (TypeORM preferred the loaded
  relation over the changed id). Category, branch and wallet changes now persist.

#### Income tax declaration (2026-09-14)

- **Tax declaration wizard** (`/tax-declaration`, `GET/PUT/POST /income-tax/*`) drafts the annual
  income tax return for the self-employed: disclaimer, profile, category → form-line mapping, data
  check, draft, PDF/XLSX export, finalize and reopen. Only mappings the user confirmed count.
- **Rule packs:** Germany Anlage EÜR (2025–2026), Spain Modelo 100 estimación directa simplificada
  (2025–2026), Poland PIT-36L (2025–2026), PIT-28 and PIT-36 (2025); every other country gets a
  generic annual income and expense summary.
- **Official FX sources** for Poland (NBP table A) and Italy (Banca d'Italia); a missing rate is
  reported as an issue instead of defaulting to 1.
- **Filing information** — form, deadlines, portal and record retention — for 25 EU countries.

#### Receipt locations and self-hosted maps (2026-09-14)

- Receipts get a location from a manual pin, the geocoded merchant address, the photo's EXIF GPS or
  the device position (in-app camera only, after per-device consent); `PATCH/DELETE
  /receipts/:id/location`.
- Optional Compose profiles `maps` (Planetiler + tileserver-gl, four styles) and `geocoder`
  (Nominatim). The backend proxies tiles (`/maps/styles`, `/maps/tiles/...`); the feature stays off
  until `TILESERVER_URL` / `GEOCODER_URL` are set.

#### Account security (2026-09-14)

- Self-service password reset by email (`/auth/forgot-password`, `/auth/reset-password`): single-use
  1-hour tokens, all sessions revoked on reset.
- Email changes take effect only after the confirmation link sent to the new address is opened.

#### Content background (2026-09-14)

- A bundled or uploaded photo behind the app content, with adjustable dimming (Settings → General).

### Changed

#### Cookie sessions and API hardening (2026-09-14)

- **Breaking for API clients:** browsers now authenticate with HttpOnly `access_token` /
  `refresh_token` cookies, and `/auth/login` no longer returns tokens in the body. Scripts can still
  send `Authorization: Bearer` or `X-Api-Key`.
- Double-submit CSRF protection on cookie-authenticated writes (`csrf_token` cookie →
  `x-csrf-token` header).
- The access token lifetime dropped from 30 days (set in `docker-compose.yml` and the JWT module
  default) to **30 minutes**; the refresh token stays at 30 days.
- New settings: `CORS_ORIGINS`, `AUTH_COOKIE_SAMESITE`, `AUTH_COOKIE_DOMAIN`,
  `PASSWORD_RESET_TOKEN_SECRET`, `BCRYPT_ROUNDS`. In production the backend refuses to start without
  a CORS origin.
- helmet security headers, Redis-backed rate limit counters, and an egress guard that blocks
  private and loopback addresses for user-supplied URLs.

#### Self-hosted delivery (2026-09-14)

- CD builds, scans, signs and publishes images on `v*.*.*` tags (or manual runs) and stops there:
  no staging/production environments, no post-deploy smoke check, no `staging` branch triggers.

#### Aurum-style charts (2026-09-13)

- **Cash flow on the Trends tab** is now monthly income/expense bars with a signed net total and an
  All time / 5 years / 12 mo / This year switcher (`?cf=`), backed by the new
  `GET /dashboard/cash-flow?range=` endpoint (whole calendar months, empty months zero-filled).
- **Net worth, category donuts (Overview and Trends) and the ROI projection** moved from ECharts to
  Recharts with the same look: no Y axis or grid, year ticks only across calendar years, first/last
  label row, theme colours via CSS variables.
- Chart design follows [Aurum](https://github.com/ZProger/Aurum) by ZProger; reimplemented, no Aurum
  code included. The goal Sankey, the spend trend forecast and the statements charts stay on ECharts.

### Removed

#### Bundled monitoring and Railway (2026-09-14)

- The Prometheus + Grafana stack: `docker-compose.observability.yml`, `observability/`, and
  `make observability` / `make observability-stop`. `/api/v1/metrics` stays; guard it with
  `METRICS_AUTH_TOKEN` and scrape it with your own collector.
- Railway deployment: `RAILWAY.md`, `railway.json`, its Conftest policy and the docs page.

### Fixed

#### API URL Path in Document Viewer (2025-01-20)

- **Fixed incorrect API URL paths** in `/statements/:id/view` page
  - Added missing `/api/v1/` prefix to statement and transactions fetch requests
  - Previously: `${API_URL}/statements/:id` (404 error)
  - Now: `${API_URL}/api/v1/statements/:id` (works correctly)
  - Impact: Document viewer page now loads data successfully
  - Files changed: `frontend/app/statements/[id]/view/page.tsx`

### Added

#### Transaction Document Viewer (2025-01-XX)

- **New Document View Page** (`/statements/:id/view`)
  - Beautiful, professionally formatted document for viewing bank statements and transactions
  - Optimized for viewing and printing
  - Responsive design for desktop, tablet, and mobile devices
  
- **TransactionDocumentViewer Component**
  - Rich header with gradient background and bank information
  - Summary cards showing: starting balance, income, expenses, ending balance
  - Detailed transaction table with all fields
  - Visual indicators: color-coded borders (green for income, red for expenses)
  - Category chips displayed under transaction purpose
  - Print-optimized styles with color preservation
  
- **Action Panel Features**
  - Back button to return to previous page
  - Edit button to switch to edit mode
  - Print button with browser print dialog integration
  
- **Print Optimization**
  - A4 format with 15mm margins
  - Color preservation (gradients, borders, semantic colors)
  - Smart page breaks (no broken tables/rows)
  - Hidden UI elements (action panel not printed)
  - Optimized fonts and spacing for printing
  
- **Data Formatting**
  - Numbers: localized formatting with thousand separators (e.g., `1 234 567.89 KZT`)
  - Dates: DD.MM.YYYY format (e.g., `27.11.2025`)
  - Currency codes displayed alongside amounts
  
- **Documentation**
  - `DOCUMENT_VIEWER.md` - English technical documentation
  - `ПРОСМОТР_ДОКУМЕНТА_ТРАНЗАКЦИЙ.md` - Russian user guide
  - `TESTING_DOCUMENT_VIEWER.md` - Comprehensive testing guide

### Changed

#### Storage Page Navigation

- **View Button Behavior**
  - Previously: Clicking eye icon (👁️) in Storage navigated to edit page (`/statements/:id/edit`)
  - Now: Clicking eye icon navigates to new document view page (`/statements/:id/view`)
  - Edit page still accessible via "Edit" button in document view or directly from statements list

### Technical Details

#### New Files
- `frontend/app/components/TransactionDocumentViewer.tsx` - Main document viewer component
- `frontend/app/statements/[id]/view/page.tsx` - Document view page wrapper
- `docs/DOCUMENT_VIEWER.md` - English documentation
- `docs/ПРОСМОТР_ДОКУМЕНТА_ТРАНЗАКЦИЙ.md` - Russian documentation
- `docs/TESTING_DOCUMENT_VIEWER.md` - Testing guide

#### Modified Files
- `frontend/app/storage/page.tsx` - Updated `handleView()` navigation target

#### API Endpoints Used
- `GET /api/v1/statements/:id` - Fetch statement data
- `GET /api/v1/statements/:id/transactions` - Fetch transactions list

#### Dependencies
- Material-UI components: Box, Paper, Table, Typography, Chip, etc.
- Material-UI icons: TrendingUp, TrendingDown, AccountBalance, CalendarToday, Receipt
- Next.js navigation: useRouter

#### Browser Support
- Chrome/Edge (recommended for best print quality)
- Firefox
- Safari
- Opera

### Performance

- Fast loading for statements with up to 500 transactions (< 3s)
- Acceptable performance for statements with up to 2000 transactions (< 10s)
- No memory leaks detected in testing
- Smooth scrolling and hover effects

### UX Improvements

- **Visual Clarity**: Color-coded transaction types (green/red)
- **Information Density**: All data visible at once
- **Professional Appearance**: Gradient header, clean layout
- **Easy Navigation**: Clear action buttons
- **Quick Access**: One click from Storage to document view

### Known Limitations

1. Large statements (>5000 transactions) may have performance issues
2. Safari may not preserve gradient colors when printing
3. PDF export only available through browser (no server-side generation yet)
4. Internet Explorer 11 not supported

### Future Enhancements

Planned features:
- [ ] Server-side PDF generation
- [ ] Configurable column visibility
- [ ] Transaction filtering within document
- [ ] Watermark support for printed documents
- [ ] Charts and visualizations
- [ ] Period comparison
- [ ] Multiple document templates
- [ ] Company logo customization

---

## [Previous versions]

(Previous changelog entries would go here)

---

**Note**: This project uses semantic versioning. Version numbers follow the pattern MAJOR.MINOR.PATCH where:
- MAJOR: Incompatible API changes
- MINOR: Backwards-compatible functionality additions
- PATCH: Backwards-compatible bug fixes
