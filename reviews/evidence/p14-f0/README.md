# P14-F0 只读发布预检

- 时间：2026-09-05T17:57:16.971Z
- 总 Gate：**BLOCKED**
- 外部写入：无

| 检查 | 状态 | 摘要 |
|---|---|---|
| worktree | BLOCKED | `{"counts":{"p14":34,"user-media":3,"existing":31},"lines":["M .claude/hooks/check-file-size.js"," M .claude/hooks/check-folder-size.js"," M .claude/hooks/check-forbidden-imports.js"," M .claude/hooks/session-start-context.js"," M .claude/hooks/stop-checklist.js"," M .env.example"," M AGENTS.md"," M QUICKSTART.md"," M STATUS.md"," M TASKS.md"," M app/api/health/route.ts"," M contracts/src/WalletRecipeNFT.sol"," M contracts/test/DeployWalletRecipe.t.sol"," M contracts/test/WalletRecipeNFT.t.sol","` |
| p14-code-policy | PASS | `{"files":79,"oversized":[],"crowded":[],"forbidden":[]}` |
| score-isolation | PASS | `{"anchor":"cb06907250046e84743d9d0f9b1c0eee1e82a836","changed":[]}` |
| contract-forge | PASS | `{"rules":{"ERC721Enumerable":true,"tokenIdByOrigin":true,"originWalletOf":true,"mintToOrigin":true,"contractURI()":true,"_transferOwnership(admin_)":true,"RolesMustDiffer":true},"absentCapabilities":[],"forgeAvailable":true,"forgeExitCode":0}` |
| permanent-local-inputs | PASS | `{"count":36,"mismatches":[],"hashes":{"manifest":"fffadcde8d0a04d13f9240cf3d42fc4e89b932b1ef8d221a0885cbd74f62252c","decoder":"2521bd95a7fb58f01343ce8625648553067a7c5831eaf71c17d84cd5f7833a4e","image":"8a93b0bda0ca87e104ec2991b63ed0b58a0f5d1bce836031ac74c0b27759bff8"}}` |
| recipe-vector | PASS | `{"wallet":"0x19da4b170dF5CcA47414b04f04a24f67E2E6bA54","expected":"ER81BTKWSDL7QAXTPCV28IGGYFVPSTIERCMR","actual":"ER81BTKWSDL7QAXTPCV28IGGYFVPSTIERCMR"}` |
| permanent-txids | BLOCKED | `{"configured":{"manifest":false,"decoder":false,"image":false},"clipTxIds":0}` |
| metadata-roundtrip | BLOCKED | `{"reason":"永久 txid 未冻结，拒绝使用假地址代验"}` |
| environment | BLOCKED | `{"required":{"rpcSepolia":true,"rpcMainnet":false,"operator":true,"deployer":true,"supabase":true,"upstash":true,"resend":false,"cron":true,"turbo":true,"vercel":false,"admin":false,"minter":false},"secrets":{"ALCHEMY_RPC_URL":true,"OP_SEPOLIA_RPC_URL":false,"OP_MAINNET_RPC_URL":false,"OPERATOR_PRIVATE_KEY":true,"DEPLOYER_PRIVATE_KEY":true,"SUPABASE_SERVICE_ROLE_KEY":true,"UPSTASH_REDIS_REST_TOKEN":true,"RESEND_API_KEY":false,"CRON_SECRET":true,"TURBO_WALLET_PATH":true,"TURBO_WALLET_JWK":false,"` |
| roles | BLOCKED | `{"deployer":"0x306D3A445b1fc7a789639fa9115e308a34231633","admin":null,"operator":"0x306D3A445b1fc7a789639fa9115e308a34231633","minter":null,"minterMatchesOperator":false}` |
| rpc-11155420 | PASS | `{"configured":true,"actualChainId":11155420,"balances":[{"address":"0x306D3A445b1fc7a789639fa9115e308a34231633","wei":"9212950866073795"}]}` |
| rpc-10 | BLOCKED | `{"configured":false}` |
| turbo-balance | PASS | `{"address":"0xD9AEDeAd70F4Cd7532163C4FACBEc77b127B4582","token":"base-eth","winc":"623213389830"}` |
| database-tooling | PASS | `{"supabaseCli":true,"docker":false,"psql":false,"supabaseHttp":200}` |
| rights-gate | BLOCKED | `{"expected":"reviews/evidence/p14-f0/rights-confirmation.md"}` |
| homepage-build-isolation | PASS | `{"buildArtifacts":1021,"leaks":[]}` |
| opensea-metadata | PASS | `{"checkedAt":"2026-09-05T17:57:16.968Z","official":["https://docs.opensea.io/docs/metadata-standards","https://docs.opensea.io/docs/metadata-storage","https://docs.opensea.io/docs/contract-level-metadata"]}` |
