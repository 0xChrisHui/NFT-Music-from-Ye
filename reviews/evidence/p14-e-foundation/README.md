# P14-E Foundation｜本地冻结证据

> 日期：2026-09-06（Asia/Shanghai）
> 状态：E0、E1 与 E2/E5 本地实现完成；永久上传因 G7 权利确认未关闭而保持阻塞。

## 采用方向

采用 E0 的 A「月夜声纹图谱」：日式留白、黑绿夜塘、骨白月面、黄铜水纹和 36 格可读进度。完整三方向对照、12 张关键帧及 Edge 真音频证据位于相邻的 `p14-e-prototype/`。

## E1 顺序播放内核

- 36 段按 recipe 顺序调度，重复字符只下载和解码一次。
- 相邻片段使用 60ms `sin/cos` 等功率交叉淡化。
- 总时长统一为 `Σduration − 35×60ms`；固定主网 Score #1 向量为 `269900.000004ms`。
- AudioContext 只在用户调用 `play()` 后创建；pause/resume 使用 AudioContext 时钟保存真实播放头。
- 双 Arweave 网关 fallback，逐片段 SHA-256 与解码时长校验。
- destroy 会中止 fetch、停止 source、断开 gain、取消 RAF 并关闭 AudioContext。

定向验证：

```text
npx tsx scripts/p14/verify-wallet-recipe-player.ts
P14-E1 时间线、等功率衔接、状态机与资源清理验证通过
```

## E2 永久 Decoder v1

`src/wallet-recipe-decoder/index.html` 是单文件 HTML/CSS/vanilla JS，不依赖 npm runtime、网络字体、本地域名、数据库或 Vercel API。它只接受：

```text
?v=1&recipe=<36 位 A–Z/0–9>&clips=<43 位 manifest txid>
```

Decoder 严格校验 manifest 字段、自包含 identity hash、36 个 clip txid；每个 clip 再校验 SHA-256 与解码时长。两个网关各有 12 秒超时，用户点击前不创建 AudioContext、不加载或播放音频。播放参数与站内内核共享同一合同：36 段、60ms 真重叠、等功率淡化、精确暂停/恢复、同 recipe 重播。

本地静态审计：

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `src/wallet-recipe-decoder/index.html` | 13,512 | `2521bd95a7fb58f01343ce8625648553067a7c5831eaf71c17d84cd5f7833a4e` |

本轮没有生成 Decoder txid。G7 关闭后仍须完成 HTTP/CORS 真音频全曲、375/390/768/1024/1440、reduced-motion 和双网关 bytes/hash 证据，才允许一次永久上传。

## E5 共用封面

封面采用纯 Node 标准库像素生成器：固定 1200×1200 RGBA、固定 PNG chunk/DEFLATE 参数、无时间、随机 seed、网络字体或第三方图片。同一脚本连续生成得到相同 bytes：

| 文件 | bytes | SHA-256 |
|---|---:|---|
| `public/pond-echoes/cover-v1.png` | 1,247,695 | `8a93b0bda0ca87e104ec2991b63ed0b58a0f5d1bce836031ac74c0b27759bff8` |

E0 已目视确认封面的黑绿夜塘、骨白核心、36 个黄铜点与同心水纹符合推荐方向。所有 token 共用这一封面，独特性由 recipe 与 animation 表达。

## 未关闭 Gate

1. 音频及其采样的永久公开/NFT 使用权尚无用户明确确认。
2. `clips-v1.json` 的 36 个 `arweaveTxId` 仍为 `null`。
3. Decoder、manifest、封面尚无冻结 txid，也未做双网关传播验证。
4. 模型完成了 PCM、交界峰值和浏览器解码检查，但不能代替权利人的完整人耳审美试听。

因此 E Foundation 的“本地实现”通过，“永久媒体冻结”未通过；禁止用假 txid 或本地 URL 继续 F1。
