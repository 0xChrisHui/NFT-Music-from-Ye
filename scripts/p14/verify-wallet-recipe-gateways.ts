import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  hasWalletRecipeGatewayQuorum,
  WALLET_RECIPE_GATEWAYS,
  WALLET_RECIPE_GATEWAY_QUORUM,
} from '../../src/lib/wallet-recipe/gateways';

assert.equal(WALLET_RECIPE_GATEWAYS.length, 3);
assert.equal(WALLET_RECIPE_GATEWAY_QUORUM, 2);
assert.equal(new Set(WALLET_RECIPE_GATEWAYS).size, 3);
assert.equal(hasWalletRecipeGatewayQuorum([
  { gateway: WALLET_RECIPE_GATEWAYS[0], ok: true },
  { gateway: WALLET_RECIPE_GATEWAYS[0], ok: true },
]), false, '重复网关不得凑 quorum');
assert.equal(hasWalletRecipeGatewayQuorum(WALLET_RECIPE_GATEWAYS.map(
  (gateway, index) => ({ gateway, ok: index < 2 }),
)), true);

const decoder = readFileSync('src/wallet-recipe-decoder/index.html', 'utf8');
for (const gateway of WALLET_RECIPE_GATEWAYS) assert.ok(decoder.includes(gateway));
assert.doesNotMatch(decoder, /ario\.permagate\.io/);

console.log('P14 三网关、2-of-3 quorum 与 Decoder 同步验证通过');
