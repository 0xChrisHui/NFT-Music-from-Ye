# P14 封面网关复核

> 日期：2026-09-10（Asia/Shanghai）
> 对象：`4uEbvBt9gIaVt50FZ1wfQkuz3ogXZIGGjAdoWre3-SU`

## 结果

- 连续两次只读执行 `image --verify`，中间保留 15 秒传播窗口。
- 首次：`arweave.net` 完整请求与 Range 均连接失败；`ario.permagate.io` 返回 HTTP 503。
- 第二次：`arweave.net` 仍连接失败；`ario.permagate.io` 完整请求超时，Range 最小分段返回 HTTP 502。
- 历史已证明本地封面与 `arweave.net` 的 1,247,695 bytes 和 SHA-256 `8a93b0bda0ca87e104ec2991b63ed0b58a0f5d1bce836031ac74c0b27759bff8` 一致；本轮不把历史证据当作当前双网关通过。

## 决定

- ledger 继续保持 image=`uploaded`、`verifiedAt=null`、`upload_result_unknown=0`。
- 本轮没有上传、没有产生新 txid，也没有执行 collection metadata 或链上部署。
- P14 仍停在永久封面 Gate；恢复点不变：只验证现有 txid，双网关通过后首次上传 collection metadata。
