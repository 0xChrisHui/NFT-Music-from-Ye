# Track C — 合约 & 部署硬化

> **范围**：ScoreNFT setTokenURI 防覆盖 + operator 直接 MINTER_ROLE 收紧 +
> admin/minter 部署流程参数化 + Deploy 脚本主网污染修复 + TBA 开关决策
>
> **前置**：无工程前置，但**发布窗口必须在 Pre-tester gate 之前**（见 D-C0）
>
> **对应 findings**：#6 #13 #14 #16 #20
>
> **核心交付物**：所有合约 + 部署脚本达到"可主网部署"的权限最小化与产品语义标准

---

## 冻结决策

### D-C0 — Track C 合约重部署必须在 Pre-tester gate 之前一次性完成

Phase 6 playbook 初版写 "Track C 可随时并行"，但 C1/C4 涉及**重部署 ScoreNFT 和 Orchestrator**，会改 `NEXT_PUBLIC_SCORE_NFT_ADDRESS` + `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS`。

若在 tester 窗口中途切换 = tester 今天看到的 NFT 明天因环境切换消失 → 反馈严重失真。

**正确发布窗口**：
```
Pre-tester gate 之前完成 Track C 全部 step
  → 新合约地址写进 .env.local + Vercel env
  → 验证 cron-job.org 5/5 仍绿（新合约地址下）
  → 放人进 tester
```

**不允许**：tester 窗口中途切合约地址、两组合约地址并行运行、"测试后再切"的延后策略。

例外：如果 Track C 因故必须在 tester 窗口完成（比如用户等不及 Pre-tester gate），则需要明确的旧合约兼容策略 + tester 公告。默认不走这条路径。

### D-C1 — 主网权限模型：冷钱包 admin + 热钱包 minter 分离

主网部署流程必须产出：
- `admin` = 冷钱包（从 env 或命令行传入）
- `minter` = 运营热钱包（operator）
- 部署后执行 `grantRole(MINTER_ROLE, minter)` + `revokeRole(DEFAULT_ADMIN_ROLE, deployer)` + `revokeRole(MINTER_ROLE, deployer)`
- 若 deployer ≠ admin，还需 `grantRole(DEFAULT_ADMIN_ROLE, admin)`

热钱包被盗 ≠ 合约治理权被盗。

### D-C2 — ScoreNFT.setTokenURI 只允许首次写入

从"MINTER_ROLE 可任意覆盖"改为"仅允许 tokenURI == '' 时写入"。已写 URI 不可改。保留 MINTER_ROLE 调用权限（Orchestrator 需要），但合约里判断 first-write。

### D-C3 — TBA 开关是未实装能力，删除空实现

`MintOrchestrator.setTbaEnabled(true)` 只让 `_maybeCreateTba()` 进入空分支。Solidity 合约部署后代码不可改，`setTbaEnabled(true)` 永远不能产生行为。

决策：**删除 TBA 开关**，注释写清 "ERC-6551 若未来需要，必须新部署或走 proxy 升级"。避免后继者误解为"已就绪开关"。

### D-C4 — Deploy 脚本拆成"部署" + "验证铸造"两步

`DeployOrchestrator.s.sol` 会 `orchestrator.mintScore(deployer)` 做 e2e 验证，主网照跑 = 合集 tokenId 1 永久无 metadata。

拆成：
- `DeployOrchestrator.s.sol` → 只部署 + 授权
- `TestMintOrchestrator.s.sol` → 独立脚本，**只测试网手动跑**

---

## 📋 Step 总览

| Step | Findings | 内容 | 工作量 |
|---|---|---|---|
| [C1](#step-c1--scorenftsettokenuri-防覆盖) | #6 | setTokenURI first-write-only | 30 分 + 重部署 |
| [C2](#step-c2--权限最小化部署流程) | #16 #20 | Deploy 脚本参数化 + revoke runbook | 半天 |
| [C3](#step-c3--deploy-脚本清洁化) | #13 | 主网部署不 mint 测试 NFT | 1 小时 |
| [C4](#step-c4--tba-开关决策与清理) | #14 | 删除 TBA 开关空实现 | 1 小时 + 重部署 |

**Pre-tester gate 前完成时间预算：~1 天**（含合约重部署 + .env 和 Vercel env 更新 + verify.sh）

---

## Step C1 — ScoreNFT.setTokenURI 防覆盖

### 📦 范围
- `contracts/src/ScoreNFT.sol`
- `contracts/test/ScoreNFT.t.sol`
- `contracts/script/DeployScore.s.sol`
- `.env.local`（更新 `NEXT_PUBLIC_SCORE_NFT_ADDRESS`）
- Vercel env vars 同步

### 做什么

**1. 合约**
```solidity
function setTokenURI(uint256 tokenId, string memory uri) external onlyRole(MINTER_ROLE) {
    require(bytes(_tokenURIs[tokenId]).length == 0, "ScoreNFT: URI already set");
    require(_ownerOf(tokenId) != address(0), "ScoreNFT: token does not exist");
    _setTokenURI(tokenId, uri);
}
```

**2. 测试改写**
```solidity
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

**3. 重部署**

按 C2 的参数化流程部署新合约。

### 验证标准
- [ ] `forge test` 全绿（含 cannot_overwrite）
- [ ] 新合约地址写进 `.env.local` + Vercel env
- [ ] 手动在 Etherscan 尝试 setTokenURI 覆盖 → revert
- [ ] 旧合约地址归档到 `reviews/phase-6-deprecated-contracts.md`

---

## Step C2 — 权限最小化部署流程

### 📦 范围
- `contracts/script/Deploy.s.sol`（MaterialNFT）
- `contracts/script/DeployScore.s.sol`（ScoreNFT）
- `contracts/script/DeployAirdropNFT.s.sol`（AirdropNFT）
- `contracts/script/DeployOrchestrator.s.sol`
- `.env.example`（新增 `ADMIN_ADDRESS / MINTER_ADDRESS / DEPLOYER_PRIVATE_KEY`）
- `docs/MAINNET-RUNBOOK.md`（新建 — Phase 7 用）

### 做什么

**1. 脚本参数化**
```solidity
function run() external {
    address admin = vm.envAddress("ADMIN_ADDRESS");
    address minter = vm.envAddress("MINTER_ADDRESS");
    address deployer = vm.envAddress("DEPLOYER_ADDRESS");

    vm.startBroadcast(vm.envUint("DEPLOYER_PRIVATE_KEY"));
    MaterialNFT nft = new MaterialNFT();

    nft.grantRole(nft.DEFAULT_ADMIN_ROLE(), admin);
    nft.grantRole(nft.MINTER_ROLE(), minter);

    if (deployer != admin) nft.revokeRole(nft.DEFAULT_ADMIN_ROLE(), deployer);
    if (deployer != minter) nft.revokeRole(nft.MINTER_ROLE(), deployer);

    vm.stopBroadcast();
}
```

**2. Runbook**

`docs/MAINNET-RUNBOOK.md`：冷钱包 admin 准备 / 热钱包 minter / 部署命令 / 权限校验 / Orchestrator 授权。

**3. 测试网兼容**

测试网可 deployer = admin = minter。脚本支持参数化但不强制三地址。

### 验证标准
- [ ] 所有 Deploy 脚本读 ADMIN_ADDRESS / MINTER_ADDRESS / DEPLOYER_PRIVATE_KEY
- [ ] 本地 anvil 部署验证授权 (`cast call hasRole`)
- [ ] `docs/MAINNET-RUNBOOK.md` 用户读一遍通过

---

## Step C3 — Deploy 脚本清洁化

### 📦 范围
- `contracts/script/DeployOrchestrator.s.sol`
- `contracts/script/TestMintOrchestrator.s.sol`（新建）

### 做什么

`DeployOrchestrator.s.sol` 删除：
```solidity
// orchestrator.mintScore(deployer); // 删除
```

新建 `TestMintOrchestrator.s.sol`：
```solidity
function run() external {
    address orchestratorAddr = vm.envAddress("NEXT_PUBLIC_ORCHESTRATOR_ADDRESS");
    vm.startBroadcast();
    MintOrchestrator(orchestratorAddr).mintScore(msg.sender);
    vm.stopBroadcast();
}
```

### 验证标准
- [ ] 主网跑 Deploy 不 mint 任何 tokenId
- [ ] 测试网单跑 TestMint 能 mint 成功
- [ ] `forge test` 绿

---

## Step C4 — TBA 开关决策与清理

### 📦 范围
- `contracts/src/MintOrchestrator.sol`（删除 TBA 相关）
- `contracts/test/MintOrchestrator.t.sol`
- `contracts/script/DeployOrchestrator.s.sol`
- `docs/ARCHITECTURE.md`（决策 13 澄清）
- 重部署 + env 更新

### 做什么

**删除**：
```solidity
// bool public tbaEnabled;
// function setTbaEnabled(bool v) external onlyRole(DEFAULT_ADMIN_ROLE) { ... }
// function _maybeCreateTba(uint256 tokenId) internal { }
// mintScore 里 _maybeCreateTba 的调用
```

**ARCHITECTURE.md 决策 13 章节补**：
> ERC-6551 TBA 当前未实装。若未来需要，必须新部署 Orchestrator 合约或采用 proxy 升级模式，**不能在现有合约上通过开关开启**。

### 依赖
合约重部署 → 新 `NEXT_PUBLIC_ORCHESTRATOR_ADDRESS` + ScoreNFT grantRole(MINTER_ROLE, new_orchestrator) + revoke 旧。旧 Orchestrator 地址归档。

### 验证标准
- [ ] `forge test` 绿
- [ ] 测试网部署 + 授权链路打通
- [ ] ScoreNFT mint 走新 Orchestrator 成功
- [ ] ARCHITECTURE.md 决策 13 更新

---

## Track C 完结标准

- [ ] 4 steps 全绿
- [ ] `forge test` 全绿
- [ ] 新合约地址（ScoreNFT v2 + Orchestrator v2 + 可能 Material/Airdrop 重部署）写进 `.env.local` + Vercel env
- [ ] `docs/MAINNET-RUNBOOK.md` 通过
- [ ] `docs/ARCHITECTURE.md` 决策 13 + 权限最小化章节更新
- [ ] `reviews/phase-6-deprecated-contracts.md` 记录旧合约地址
- [ ] **Pre-tester gate 前所有重部署完成** + Vercel 重新部署生效
- [ ] cron-job.org 5/5 cron 在新合约下仍绿
- [ ] `scripts/verify.sh` 通过

## 旧合约的历史 NFT 怎么处理

Track C 会生成多个新合约版本。已铸造的历史 NFT（旧 ScoreNFT 的 tokenId 1, 2 等）的处理原则：

- **测试网**：接受 "测试 NFT 会因合约升级而不再在前端展示"。tester 窗口开始前完成切换 = tester 看到的始终是新合约的 NFT。
- **主网**：Phase 7 直接部署新版，没有历史包袱
- **前端路由**：`/me` 和 `/score/[id]` 只查当前 `NEXT_PUBLIC_*_ADDRESS` 指向的合约，不做多合约兼容（除非有明确的迁移需求）
- **归档**：旧合约地址写进 `reviews/phase-6-deprecated-contracts.md`，Etherscan 链接可查
