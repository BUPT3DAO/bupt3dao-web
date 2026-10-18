import { describe, expect, it } from 'vitest';
import {
  createPublicClient,
  createTestClient,
  createWalletClient,
  http,
  parseAbi,
} from 'viem';
import { foundry } from 'viem/chains';
import { CAMPUS_ABI } from './campus';
import { readCampus } from './campus-chain';

// Opt-in local integration only. Never uses a browser wallet or a public network.
describe.skipIf(!process.env.CAMPUS_ANVIL_CONTRACT)('Anvil integration', () => {
  it('reads coherent snapshots through joining, accrual, upgrading, contributing and pause', async () => {
    const address = process.env.CAMPUS_ANVIL_CONTRACT as `0x${string}`;
    const transport = http('http://127.0.0.1:8545');
    const client = createPublicClient({
      chain: foundry,
      transport,
      pollingInterval: 50,
    });
    expect(await client.getChainId()).toBe(31337);
    const wallet = createWalletClient({ chain: foundry, transport });
    const clock = createTestClient({
      chain: foundry,
      mode: 'anvil',
      transport,
    });
    const [account, second] = await wallet.getAddresses();
    const config = {
      enabled: true,
      chain_id: 31337,
      contract_address: address,
      rpc_url: 'http://127.0.0.1:8545',
      explorer_url: null,
      faucet_url: null,
    };
    const send = async (name: 'join' | 'collect', owner = account) =>
      client.waitForTransactionReceipt({
        hash: await wallet.writeContract({
          account: owner,
          address,
          abi: CAMPUS_ABI,
          functionName: name,
        }),
      });
    await send('join');
    await send('join', second);
    let state = await readCampus(config, account);
    expect(state.player.knowledge).toBe(60n);
    expect(state.pending).toEqual([0n, 0n]);
    await clock.increaseTime({ seconds: 3600 });
    await clock.mine({ blocks: 1 });
    state = await readCampus(config, account);
    expect(state.player.knowledge).toBeGreaterThanOrEqual(70n);
    expect(state.pending[0]).toBeGreaterThanOrEqual(10n);
    await send('collect');
    expect((await readCampus(config, account)).pending).toEqual([0n, 0n]);
    const upgraded = await client.waitForTransactionReceipt({
      hash: await wallet.writeContract({
        account,
        address,
        abi: CAMPUS_ABI,
        functionName: 'upgrade',
        args: [0],
        gas: 300000n,
      }),
    });
    expect(upgraded.status).toBe('success');
    state = await readCampus(config, account, upgraded.blockNumber);
    expect(state.player.mainLevel).toBe(2);
    await client.waitForTransactionReceipt({
      hash: await wallet.writeContract({
        account,
        address,
        abi: CAMPUS_ABI,
        functionName: 'contribute',
        args: [10n],
        gas: 300000n,
      }),
    });
    state = await readCampus(config, account);
    expect(state.world.progress).toBe(10n);
    expect(state.player.contributed).toBe(10n);
    expect((await readCampus(config, second)).player.mainLevel).toBe(1);
    await client.waitForTransactionReceipt({
      hash: await wallet.writeContract({
        account,
        address,
        abi: parseAbi(['function setPaused(bool value)']),
        functionName: 'setPaused',
        args: [true],
      }),
    });
    expect((await readCampus(config, account)).world.stopped).toBe(true);
    await client.waitForTransactionReceipt({
      hash: await wallet.writeContract({
        account,
        address,
        abi: parseAbi(['function setPaused(bool value)']),
        functionName: 'setPaused',
        args: [false],
      }),
    });
  }, 30_000);
});
