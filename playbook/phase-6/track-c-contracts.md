# Track C — 合约 & 部署硬化

> **范围**：ScoreNFT setTokenURI 防覆盖 + operator 直接 MINTER_ROLE 收紧 +
> admin/minter 部署流程参数化 + Deploy 脚本主网污染修复 + TBA 开关决策
>
> **前置**：无 — Track C 纯合约 + 部署脚本，和其他 track 解耦
>
> **对应 findings**：#6 #13 #14 #16 #20（共 5 项，其中 #14 是决策类非修复）
>
> **核心交付物**：所有合约 + 部署脚本达到"可主网部署"的权限最小化与产品语义标准

---

## 冻结决策

### D-C1 — 主网权限模型：冷钱包 admin + 热钱包 minter 分离

主网部署流程必须产出：
- `admin` = 冷钱包地址（从 `.env` 或命令行参数传入）
- `minter` = 运营热钱包（operator）
- 部署后执行 `grantRole(MINTER_ROLE, minter)` + `revokeRole(DEFAULT_ADMIN_ROLE, deployer)` + `revokeRole(MINTER_ROLE, deployer)`
- 若 deployer ≠ admin，还需要 `grantRole(DEFAULT_ADMIN_ROLE, admin)`

热钱包被盗 ≠ 合约管理权被盗。

### D-C2 — ScoreNFT.setTokenURI 只允许首次写入

从 "MINTER_ROLE 可任意覆盖" 改为 "仅允许 tokenURI == '' 时写入"。已写 URI 不可改。保留 MINTER_ROLE 调用权限（Orchestrator 需要），但在合约里判断 first-write。

### D-C3 — TBA 开关是未实装能力，不是"预埋开关"

`MintOrchestrator.setTbaEnabled(true)` 当前只让 `_maybeCreateTba()` 进入空分支。Solidity 合约部署后代码不可改，`setTbaEnabled(true)` 永远不能创造新行为。

决策：**删除 TBA 开关空实现**，注释里写清楚 "ERC-6551 若未来需要，必须新部署合约或走升级模式"。避免 Phase 7 继任者误以为是"已就绪开关"。

### D-C4 — Deploy 脚本拆成"部署" + "验证铸造"两步

当前 `DeployOrchestrator.s.sol` 会 `orchestrator.mintScore(deployer)` 做端到端验证。主网照跑会污染合集 tokenId 1（第一张 NFT 无 metadata）。

拆成：
- `DeployOrchestrator.s.sol` → 只部署 + 授权，不 mint
- `TestMintOrchestrator.s.sol` → 独立脚本，**只在测试网手动跑**

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 |
|---|---|---|---|
| [C1](#step-c1--scorenftsettokenuri-防覆盖) | #6 | setTokenURI first-write-only 修饰 | 30 分钟 + 合约重部署 |
| [C2](#step-c2--权限最小化部署流程) | #16 #20 | Deploy 脚本参数化 admin/minter + revoke runbook | 半天 |
| [C3](#step-c3--deploy-脚本清洁化) | #13 | 主网部署脚本不 mint 测试 NFT | 1 小时 |
| [C4](#step-c4--tba-开关决策与清理) | #14 | 删除 TBA 开关空实现 + 文档澄清 | 1 小时 + 合约重部署 |

---

## Step C1 — ScoreNFT.setTokenURI 防覆盖

### 概念简报
ARCH 承诺"永久作品"。但当前 `setTokenURI(tokenId, uri)` 只校验 MINTER_ROLE，允许 operator 或任何 minter 改已铸造 NFT 的 tokenURI。测试代码 `ScoreNFT.t.sol:91-95` 明确允许 `ar://first` 覆盖 `ar://second`。

### 📦 范围
- `contracts/src/ScoreNFT.sol`
- `contracts/test/ScoreNFT.t.sol`
- `contracts/script/DeployScore.s.sol`（部署新合约）
- `.env.local`（更新 `NEXT_PUBLIC_SCORE_NFT_ADDRESS`）

### 做什么

**1. 合约改 setTokenURI**
```solidity
function setTokenURI(uint256 tokenId, string memory uri) external onlyRole(MINTER_ROLE) {
    require(bytes(_tokenURIs[tokenId]).length == 0, "ScoreNFT: URI already set");
    require(_ownerOf(tokenId) != address(0), "ScoreNFT: token does not exist");
    _setTokenURI(tokenId, uri);
}
```

**2. 测试改写**
```solidity
// 原来允许覆盖的测试删除或改为 "expect revert"
function test_setTokenURI_cannot_overwrite() public {
    vm.prank(minter);
    scoreNft.mint(user);
    vm.prank(minter);
    scoreNft.setTokenURI(1, "ar://first");

    vm.prank(minter);
    vm.expectRevert("ScoreNFT: URI already set");
    scoreNft.setTokenURI(1, "ar://second");
}
```

**3. 重部署 + 更新 .env.local**
因为合约逻辑改了，测试网需要重新部署一次（和 MaterialNFT 重部署流程一样）。

### 验证标准
- [ ] `forge test` 全绿（包括新增的 cannot_overwrite 测试）
- [ ] 新合约部署成功，地址写进 `.env.local`
- [ ] Vercel env vars 更新
- [ ] 手动在 Etherscan 调 setTokenURI 尝试覆盖 → revert

### 注意
已铸造的 tokenId 1 / tokenId 2（旧合约上）不受影响，旧合约仍可调。建议把旧合约地址记到 `reviews/phase-6-deprecated-contracts.md`，并在 /me 或 /score/[id] 里判断合约地址筛选展示。

---

## Step C2 — 权限最小化部署流程

### 概念简报
三个合约的部署脚本（`Deploy.s.sol` / `DeployScore.s.sol` / `DeployAirdropNFT.s.sol` / `DeployOrchestrator.s.sol`）都默认用 `OPERATOR_PRIVATE_KEY` 部署，且 deployer 同时拿 admin 和 minter。主网上 operator 被盗 = 合约治理权也被盗。

### 📦 范围
- `contracts/script/Deploy.s.sol`（MaterialNFT）
- `contracts/script/DeployScore.s.sol`（ScoreNFT）
- `contracts/script/DeployAirdropNFT.s.sol`（AirdropNFT）
- `contracts/script/DeployOrchestrator.s.sol`
- `.env.example`（新增 `ADMIN_ADDRESS / MINTER_ADDRESS`）
- `docs/MAINNET-RUNBOOK.md`（新建 — Phase 7 用）

### 做什么

**1. 脚本参数化**
```solidity
// Deploy.s.sol
function run() external {
    address admin = vm.envAddress("ADMIN_ADDRESS");
    address minter = vm.envAddress("MINTER_ADDRESS");
    address deployer = vm.envAddress("DEPLOYER_ADDRESS");

    vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));

    MaterialNFT nft = new MaterialNFT();

    // 授权目标角色
    nft.grantRole(nft.DEFAULT_ADMIN_ROLE(), admin);
    nft.grantRole(nft.MINTER_ROLE(), minter);

    // revoke deployer 的权限（若 deployer ≠ admin/minter）
    if (deployer != admin) nft.revokeRole(nft.DEFAULT_ADMIN_ROLE(), deployer);
    if (deployer != minter) nft.revokeRole(nft.MINTER_ROLE(), deployer);

    vm.stopBroadcast();
}
```

**2. Runbook 文档**
新建 `docs/MAINNET-RUNBOOK.md` 记主网部署步骤：
- 冷钱包 admin 地址准备
- 热钱包 minter（= operator）地址
- 部署命令
- 权限校验命令（`cast call ... hasRole`）
- Orchestrator 授权步骤

**3. 测试网兼容**
测试网可以 deployer = admin = minter（用 operator 自己），只要脚本**支持参数化**即可。不强制用三地址。

### 验证标准
- [ ] 所有 Deploy 脚本都读 ADMIN_ADDRESS / MINTER_ADDRESS / DEPLOYER_PRIVATE_KEY
- [ ] 本地 anvil 部署，验证授权路径正确（`cast call hasRole`）
- [ ] `docs/MAINNET-RUNBOOK.md` 通过（用户读一遍无卡壳）

---

## Step C3 — Deploy 脚本清洁化

### 概念简报
`DeployOrchestrator.s.sol:36-43` 部署后立刻 `orchestrator.mintScore(deployer)` 做端到端验证。测试网 OK（tokenId 1 可接受），主网照跑会让合集 tokenId 1 永久没有 metadata（因为测试 mint 没走完整 metadata 上传 + setTokenURI 链路）。

### 📦 范围
- `contracts/script/DeployOrchestrator.s.sol`
- `contracts/script/TestMintOrchestrator.s.sol`（新建 — 仅测试网用）

### 做什么

**1. DeployOrchestrator 删除测试 mint**
```solidity
// 删除这几行：
// orchestrator.mintScore(deployer);
```
部署脚本只负责：部署 Orchestrator + 授权（`scoreNft.grantRole(MINTER_ROLE, orchestrator)`）。

**2. 独立测试脚本**
`TestMintOrchestrator.s.sol`（新建）只用于测试网手动跑：
```solidity
function run() external {
    address orchestratorAddr = vm.envAddress("NEXT_PUBLIC_ORCHESTRATOR_ADDRESS");
    address deployer = msg.sender;
    vm.startBroadcast();
    MintOrchestrator(orchestratorAddr).mintScore(deployer);
    vm.stopBroadcast();
}
```

主网部署后如果要做端到端验证，不走这个脚本，而是通过正常业务流程（cron 铸造一张），验证完手动 burn 或标记为测试 tokenId。

### 验证标准
- [ ] DeployOrchestrator 主网跑完不会 mint 任何 tokenId
- [ ] 测试网单独跑 TestMintOrchestrator 能 mint 成功
- [ ] `forge test` 绿

---

## Step C4 — TBA 开关决策与清理

### 概念简报
`MintOrchestrator.sol:61-72` 有 `tbaEnabled` 开关和空的 `_maybeCreateTba()` 函数。注释暗示"Phase 7 可开启无需重部署"，但 Solidity 合约部署后代码不可改，`setTbaEnabled(true)` 只会进入空分支。是个误导性"预埋"。

### 📦 范围
- `contracts/src/MintOrchestrator.sol`
- `contracts/test/MintOrchestrator.t.sol`
- `contracts/script/DeployOrchestrator.s.sol`
- `docs/ARCHITECTURE.md`（决策 13 章节澄清）
- 合约重部署 + `.env.local` 更新

### 做什么

**方案：删除 TBA 开关 + 文档澄清**

```solidity
// MintOrchestrator.sol 删除：
// bool public tbaEnabled;
// function setTbaEnabled(bool v) external onlyRole(DEFAULT_ADMIN_ROLE) { ... }
// function _maybeCreateTba(uint256 tokenId) internal { }
// mintScore 里调用 _maybeCreateTba 的行
```

更新 `docs/ARCHITECTURE.md` 决策 13 章节：
> ERC-6551 TBA 当前未实装。若未来需要，必须新部署 Orchestrator 合约或采用 proxy 升级模式，**不能在现有合约上通过开关开启**。

### 依赖
合约重部署会改变 `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS`。需要：
- 测试网先部署新版，验证 OK
- `.env.local` + Vercel env vars 更新
- ScoreNFT 合约要 grantRole(MINTER_ROLE, new_orchestrator) + revoke 旧的
- 旧 Orchestrator 地址归档到 `reviews/phase-6-deprecated-contracts.md`

### 验证标准
- [ ] 新 Orchestrator 合约 `forge test` 绿
- [ ] 测试网部署 + 授权链路打通
- [ ] ScoreNFT mint 走新 Orchestrator 成功
- [ ] ARCHITECTURE.md 决策 13 更新

---

## Track C 完结标准

- [ ] 4 steps 全绿
- [ ] `forge test` 全绿（所有合约测试，含新增的 cannot_overwrite）
- [ ] 3 个新合约地址（ScoreNFT v2 + Orchestrator v2 + 可能 MaterialNFT/AirdropNFT 重部署）更新到 `.env.local` + Vercel
- [ ] `docs/MAINNET-RUNBOOK.md` 通过
- [ ] `docs/ARCHITECTURE.md` 决策 13 + 权限最小化章节更新
- [ ] `reviews/phase-6-deprecated-contracts.md` 记录旧合约地址
- [ ] `scripts/verify.sh` 通过

## 关于"重部署合约"的影响

Track C 会部署多个新合约版本。影响：
- **旧 ScoreNFT / Orchestrator 上已铸造的 tokenId 1, 2**：仍有效，但需要在前端路由或 /me 查询里兼容（要么多合约地址都查，要么接受"旧版 NFT 不显示在新 UI"）
- **tester 如果在 Phase 6 重设计前已铸造过 NFT**：测试网可以接受，给 tester 的反馈文案说清楚"测试网合约会升级，你当前的测试 NFT 可能在后续版本中不再展示"
- **主网不会有历史包袱**：Phase 6 完结后第一次部署就是新版合约
