import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/src/lib/supabase";
import { operatorWalletClient, publicClient } from "@/src/lib/operator-wallet";
import { AIRDROP_NFT_ADDRESS, AIRDROP_NFT_ABI } from "@/src/lib/contracts";

/**
 * GET /api/cron/process-airdrop?secret=xxx
 * 每次处理一个 pending recipient → mint AirdropNFT → 标记 success
 *
 * 幂等策略（F5 修复）：
 *   1. CAS 抢单 pending → minting
 *   2. 链上 mint → 立刻存 tx_hash（即使后续步骤失败也能恢复）
 *   3. 等 receipt → 解析 tokenId → 标记 success
 *   4. recoverStuck 先查链上 tx 状态再决定回退还是补完
 */

const MINTING_TIMEOUT_MS = 5 * 60 * 1000;

export async function GET(req: NextRequest) {
  const secret = req.nextUrl.searchParams.get("secret");
  if (secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: "无效的 secret" }, { status: 401 });
  }

  try {
    await recoverStuck();

    const { data: round } = await supabaseAdmin
      .from("airdrop_rounds")
      .select("id, status")
      .in("status", ["ready", "distributing"])
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!round) {
      return NextResponse.json({ result: "idle" });
    }

    if (round.status === "ready") {
      await supabaseAdmin
        .from("airdrop_rounds")
        .update({ status: "distributing" })
        .eq("id", round.id);
    }

    const { data: recipient } = await supabaseAdmin
      .from("airdrop_recipients")
      .select("id, wallet_address")
      .eq("round_id", round.id)
      .eq("status", "pending")
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!recipient) {
      await maybeFinishRound(round.id);
      return NextResponse.json({ result: "round_check", roundId: round.id });
    }

    // CAS：pending → minting + 记录 updated_at
    const { data: claimed } = await supabaseAdmin
      .from("airdrop_recipients")
      .update({ status: "minting", updated_at: new Date().toISOString() })
      .eq("id", recipient.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();

    if (!claimed) {
      return NextResponse.json({ result: "skipped" });
    }

    // F5: 链上 mint
    const txHash = await publicClient.simulateContract({
      address: AIRDROP_NFT_ADDRESS,
      abi: AIRDROP_NFT_ABI,
      functionName: "mint",
      args: [recipient.wallet_address as `0x${string}`],
      account: operatorWalletClient.account,
    }).then(({ request }) =>
      operatorWalletClient.writeContract(request),
    );

    // F5: 立刻存 tx_hash — 即使后续崩溃也能从链上恢复
    await supabaseAdmin
      .from("airdrop_recipients")
      .update({ tx_hash: txHash })
      .eq("id", recipient.id);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
    });

    // F4: 解析 tokenId + NaN 防护
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const transferLog = receipt.logs.find(
      (l) => l.topics[0] === transferTopic,
    );
    const rawTokenId = transferLog?.topics[3]
      ? parseInt(transferLog.topics[3], 16)
      : null;
    const tokenId = rawTokenId != null && !isNaN(rawTokenId)
      ? rawTokenId
      : null;

    if (tokenId === null) {
      console.error("[process-airdrop] tokenId 解析失败:", recipient.id, txHash);
    }

    await supabaseAdmin
      .from("airdrop_recipients")
      .update({
        status: "success",
        token_id: tokenId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", recipient.id);

    return NextResponse.json({
      result: "minted",
      recipientId: recipient.id,
      wallet: recipient.wallet_address,
      txHash,
      tokenId,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[process-airdrop] error:", msg);
    return NextResponse.json(
      { error: "处理空投失败", detail: msg },
      { status: 500 },
    );
  }
}

/**
 * F5+F7: 恢复卡住的 minting — 先查链上 tx 状态再决定
 * - 有 tx_hash 且链上成功 → 补完 success
 * - 有 tx_hash 且链上失败 → 回退 pending 重试
 * - 无 tx_hash 且超时 → 回退 pending（链上没发过）
 */
async function recoverStuck() {
  const cutoff = new Date(Date.now() - MINTING_TIMEOUT_MS).toISOString();
  const { data: stuck } = await supabaseAdmin
    .from("airdrop_recipients")
    .select("id, tx_hash, wallet_address")
    .eq("status", "minting")
    .lt("updated_at", cutoff);

  for (const item of stuck ?? []) {
    if (item.tx_hash) {
      // 有 tx_hash → 查链上状态
      try {
        const receipt = await publicClient.getTransactionReceipt({
          hash: item.tx_hash as `0x${string}`,
        });
        if (receipt.status === "success") {
          // 链上已成功 → 补完 DB 记录
          const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
          const log = receipt.logs.find((l) => l.topics[0] === transferTopic);
          const tid = log?.topics[3] ? parseInt(log.topics[3], 16) : null;
          await supabaseAdmin
            .from("airdrop_recipients")
            .update({
              status: "success",
              token_id: tid && !isNaN(tid) ? tid : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", item.id);
          continue;
        }
      } catch {
        // tx 未找到或 pending → 回退重试
      }
    }
    // 无 tx_hash 或链上失败 → 回退 pending
    await supabaseAdmin
      .from("airdrop_recipients")
      .update({ status: "pending", tx_hash: null, updated_at: new Date().toISOString() })
      .eq("id", item.id);
  }
}

async function maybeFinishRound(roundId: string) {
  const { count: remaining } = await supabaseAdmin
    .from("airdrop_recipients")
    .select("id", { count: "exact", head: true })
    .eq("round_id", roundId)
    .in("status", ["pending", "minting"]);

  if ((remaining ?? 0) === 0) {
    await supabaseAdmin
      .from("airdrop_rounds")
      .update({ status: "done" })
      .eq("id", roundId);
  }
}
