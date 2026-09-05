# P14-A0｜36 段音频本地冻结前审计

> 审计时间：2026-09-06（Asia/Shanghai）  
> 范围：`public/the36` 本地母带；未上传 Arweave，未产生费用或永久写入。

## 结论

| Gate | 结果 |
|---|---|
| 固定字符顺序 | ✅ `ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789` |
| 文件数 / 缺失 / 多余 MP3 | ✅ 36 / 0 / 0 |
| 零字节 / 大小写碰撞 | ✅ 0 / 0 |
| 文件大小 | ✅ 36 项均为 126,402 bytes；总计 4,550,472 bytes |
| SHA-256 | ✅ 36/36 唯一 |
| 编码格式 | ✅ 36 项均为 MP3 MPEG-1 Layer III |
| 采样率 / 声道 | ✅ 48,000 Hz / 2 ch |
| Node 与 Edge 解码真值 | ✅ 36/36 的 key、frameCount、sampleRate、channels、durationMs 逐项一致 |
| 削波样本（绝对值 ≥ 0.999） | ✅ 0 |
| Arweave txid / 双网关 | ⏸ 0/36；A0 明确未执行外部上传 |
| 人工顺序试听 | ⏸ 审计页已就绪，听感结论仍需真实听完 A→9 |

本地候选 manifest 为
`src/features/wallet-recipe/clips-v1.json`，其内容身份 hash 是
`ae7d258634e32d6b2cb29ee6bbc6908f885c27373267d962f43d8988bec86bb7`。
完整 36 行 key、文件名、bytes、SHA-256、精确样本数和时长只在该 JSON 保存一次，
本报告不复制第二份易漂移大表。

## 精确时长证据

Node 审计器读取首帧 Info/Lavc gapless 信息，用
`encodedFrames × 1152 - encoderDelay - endPadding` 得到解码样本数，
不使用“文件大小 ÷ 码率”估算。随后用 Edge 138 的标准
`AudioContext.decodeAudioData` 独立解码 36 项并逐字段对照：

- 24 项：362,667 frames / 7,555.5625 ms。
- 12 项：362,666 frames / 7,555.541667 ms。
- 36 项合计：13,056,000 frames，约 272,000 ms。
- Edge ↔ manifest：36/36 一致，mismatch=0。

审计脚本重复运行时 `generatedAt` 会变化，但两次
`manifestSha256` 均为 `ae7d...6bb7`，证明时间戳未进入内容身份。

## 信号异常摘要（上传前需听感裁决）

浏览器页同时扫描了解码 PCM。它不能替代人耳，但已把最值得优先听的片段缩小为：

| key | RMS dBFS | peak | 首静音 | 尾静音 | 说明 |
|---|---:|---:|---:|---:|---|
| `A` | -25.700 | 0.493835 | 1,088.667 ms | 0 ms | 明显延迟进入，需确认是否为编排意图 |
| `W` | -34.308 | 0.179260 | 0 ms | 0 ms | 相对主体组偏轻，需确认听感 |
| `9` | -51.085 | 0.020753 | 0 ms | 1,727.063 ms | 全组最轻且尾部静音最长，上传前必须重点确认 |

全组 RMS 范围为 -51.085 至 -16.985 dBFS，峰值最高为 `H` 的 0.826197，
未检测到数字削波。响度差可能是 36 轨编排本身的设计，不能由审计器擅自归一化或改母带。

## 可复核方式

```bash
npx tsx scripts/arweave/p14/upload-p14-assets.ts clips --audit
npx tsx scripts/arweave/p14/upload-p14-assets.ts clips --audit --write-manifest
npm run dev
```

浏览器打开 `/p14-clip-audit.html`，点击“开始 36/36 解码”得到浏览器真值；
再点击“按 A→9 顺序试听”完成爆音、截断、长静音与响度突变的人工 Gate。
脚本对 `--upload` 等尚未授权模式返回非零退出码，防止 A0 误触永久写入。

## A0 边界

本地内容与技术格式证据已完成，可以作为候选 v1 母带；但在人工顺序试听、
永久公开/NFT 使用权利证据与外部写入预检全部通过前，不应进入 A1 上传。
