import { test, expect, type Page } from '@playwright/test';
import { decodeFunctionData, encodeFunctionResult } from 'viem';
import { CAMPUS_ABI } from '../src/lib/campus';

const account = '0x0000000000000000000000000000000000000001';
const contract = '0x0000000000000000000000000000000000000002';
const txHash = `0x${'a'.repeat(64)}`;
const user = {
  address: account,
  nickname: '二期验收 · 示例成员',
  avatar_url: null,
  banner_url: null,
  cohort: '',
  school: '',
  major: '',
  university: '北京邮电大学',
  bio: '',
  links: [],
  is_admin: false,
  created_at: '2026-10-18T00:00:00Z',
};
async function fixture(page: Page, signedIn = true) {
  if (signedIn)
    await page.addInitScript(() =>
      localStorage.setItem('bupt3dao.token', 'local-e2e-fixture'),
    );
  const state = {
    blocked: 0,
    round: 4n,
    knowledge: 140n,
    joined: true,
    mainLevel: 4,
    libraryLevel: 3,
    badges: 23,
    stopped: false,
    collected: false,
    receiptStatus: '0x1',
    calls: [] as string[],
    blocks: [] as string[],
  };
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === '/api/auth/me') return route.fulfill({ json: user });
    if (path === '/api/auth/nonce')
      return route.fulfill({
        json: { message: 'BUPT3DAO local test login', nonce: 'localtest' },
      });
    if (path === '/api/auth/verify')
      return route.fulfill({
        json: { access_token: 'local-e2e-fixture', token_type: 'bearer', user },
      });
    if (path === '/api/game/config')
      return route.fulfill(
        state.blocked
          ? { status: state.blocked, json: { detail: '账号已失效' } }
          : {
              json: {
                enabled: true,
                chain_id: 84532,
                contract_address: contract,
                rpc_url: 'http://127.0.0.1:3000/test-campus-rpc',
                explorer_url: 'https://sepolia.basescan.org',
                faucet_url: null,
              },
            },
      );
    if (path === '/api/game/status')
      return route.fulfill({ json: { enabled: true } });
    if (path.includes('summary')) return route.fulfill({ json: { unread: 0 } });
    return route.fulfill({ json: { items: [], total: 0 } });
  });
  await page.route('**/test-campus-rpc', async (route) => {
    const payload = route.request().postDataJSON();
    const respond = (request: {
      id: number;
      method: string;
      params: [Record<string, string>, string];
    }) => {
      state.calls.push(request.method);
      let result: unknown = '0x0';
      if (request.method === 'eth_blockNumber') result = '0xa';
      else if (request.method === 'eth_chainId') result = '0x14a34';
      else if (request.method === 'eth_getBalance') result = '0x2386f26fc10000';
      else if (request.method === 'eth_getTransactionReceipt') {
        state.collected = true;
        result = {
          transactionHash: txHash,
          transactionIndex: '0x0',
          blockHash: `0x${'b'.repeat(64)}`,
          blockNumber: '0xb',
          from: account,
          to: contract,
          contractAddress: null,
          cumulativeGasUsed: '0x5208',
          gasUsed: '0x5208',
          effectiveGasPrice: '0x1',
          logs: [],
          logsBloom: `0x${'0'.repeat(512)}`,
          status: state.receiptStatus,
          type: '0x2',
        };
      } else if (request.method === 'eth_call') {
        state.blocks.push(request.params[1]);
        const { functionName } = decodeFunctionData({
          abi: CAMPUS_ABI,
          data: request.params[0].data as `0x${string}`,
        });
        if (functionName === 'getPlayer')
          result = encodeFunctionResult({
            abi: CAMPUS_ABI,
            functionName,
            result: {
              joined: state.joined,
              knowledge: state.knowledge,
              compute: 180n,
              knowledgeRemainder: 0n,
              computeRemainder: 0n,
              lastAccrued: 0n,
              contributed: 200n,
              mainLevel: state.mainLevel,
              libraryLevel: state.libraryLevel,
              badges: state.badges,
            },
          });
        if (functionName === 'getWorld')
          result = encodeFunctionResult({
            abi: CAMPUS_ABI,
            functionName,
            result: [state.round, 1000n * state.round, 350n, state.stopped],
          });
        if (functionName === 'getPending')
          result = encodeFunctionResult({
            abi: CAMPUS_ABI,
            functionName,
            result: state.collected ? [0n, 0n] : [40n, 60n],
          });
      }
      return { jsonrpc: '2.0', id: request.id, result };
    };
    return route.fulfill({
      json: Array.isArray(payload) ? payload.map(respond) : respond(payload),
    });
  });
  return state;
}

async function testWallet(page: Page, reject = false) {
  await page.addInitScript(
    ({ account, txHash, reject }) => {
      const handlers = new Map<string, Set<(...args: unknown[]) => void>>();
      const provider = {
        isMetaMask: true,
        isConnected: () => true,
        on(name: string, fn: (...args: unknown[]) => void) {
          if (!handlers.has(name)) handlers.set(name, new Set());
          handlers.get(name)!.add(fn);
        },
        removeListener(name: string, fn: (...args: unknown[]) => void) {
          handlers.get(name)?.delete(fn);
        },
        async request({ method }: { method: string }) {
          if (method === 'eth_accounts' || method === 'eth_requestAccounts')
            return [account];
          if (method === 'eth_chainId') return '0x14a34';
          if (method === 'personal_sign') return `0x${'1'.repeat(130)}`;
          if (method === 'eth_sendTransaction') {
            if (reject)
              throw Object.assign(new Error('User rejected'), { code: 4001 });
            return txHash;
          }
          if (method === 'eth_getBalance') return '0x2386f26fc10000';
          if (method === 'eth_estimateGas') return '0x5208';
          if (method === 'eth_gasPrice') return '0x1';
          if (method === 'eth_getTransactionCount') return '0x0';
          if (method === 'wallet_switchEthereumChain') return null;
          if (
            method === 'wallet_getCapabilities' ||
            method === 'wallet_requestPermissions'
          )
            throw Object.assign(new Error('Unsupported test method'), {
              code: -32601,
            });
          return null;
        },
      };
      Object.defineProperty(window, 'ethereum', { value: provider });
      const announce = () =>
        window.dispatchEvent(
          new CustomEvent('eip6963:announceProvider', {
            detail: {
              info: {
                uuid: 'b7d0a29a-1ea2-4883-9f82-000000000001',
                name: 'MetaMask',
                icon: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=',
                rdns: 'io.metamask',
              },
              provider,
            },
          }),
        );
      window.addEventListener('eip6963:requestProvider', announce);
      announce();
      window.addEventListener('test-wallet-change', () =>
        handlers
          .get('accountsChanged')
          ?.forEach((fn) => fn(['0x0000000000000000000000000000000000000003'])),
      );
    },
    { account, txHash, reject },
  );
}

test('simulated wallet collection confirms and refreshes without double counting', async ({
  page,
}) => {
  await fixture(page);
  await testWallet(page);
  await page.goto('/game/campus');
  await expect(
    page.getByRole('button', { name: '领取资源', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '领取资源', exact: true }).click();
  await expect(
    page.getByRole('status').filter({ hasText: '交易与校园进度已同步。' }),
  ).toBeVisible();
  await expect(page.getByTestId('campus-knowledge')).toHaveText('140');
  await expect(
    page.getByText('领取已确认，资源已结算。', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByRole('button', { name: '领取资源', exact: true }),
  ).toBeDisabled();
});

test('simulated wallet rejection shows no success', async ({ page }) => {
  await fixture(page);
  await testWallet(page, true);
  await page.goto('/game/campus');
  await expect(
    page.getByRole('button', { name: '领取资源', exact: true }),
  ).toBeEnabled();
  await page.getByRole('button', { name: '领取资源', exact: true }).click();
  await expect(
    page.getByRole('alert').filter({ hasText: '已在钱包中取消操作。' }),
  ).toBeVisible();
  await expect(
    page.getByText('领取已确认，资源已结算。', { exact: true }),
  ).toHaveCount(0);
});

test('wallet switch clears private progress immediately', async ({ page }) => {
  await fixture(page);
  await testWallet(page);
  await page.goto('/game/campus');
  await expect(
    page.getByRole('button', { name: '领取资源', exact: true }),
  ).toBeEnabled();
  await page.evaluate(() =>
    window.dispatchEvent(new Event('test-wallet-change')),
  );
  await expect(page.getByTestId('campus-knowledge')).toHaveCount(0);
  await expect(page.getByTestId('campus-canvas')).toHaveCount(0);
});

test('new members, all five levels, capped scenery, and paused writes', async ({
  page,
}) => {
  const state = await fixture(page);
  state.joined = false;
  state.badges = 0;
  state.mainLevel = 0;
  await testWallet(page);
  await page.goto('/game/campus');
  await expect(
    page.getByRole('button', { name: '领取通行证', exact: true }),
  ).toBeEnabled();
  await page.locator('.campus-journey-step').first().click();
  await expect(page.getByTestId('campus-canvas')).toHaveAttribute(
    'data-detail',
    'close',
  );
  state.joined = true;
  state.knowledge = 10000n;
  await page
    .getByRole('navigation', { name: '选择校园地标' })
    .getByRole('button', { name: /西土城主楼/ })
    .click();
  for (let level = 1; level <= 5; level++) {
    state.mainLevel = level;
    state.round = BigInt(level);
    await page.getByRole('button', { name: /刷新链上状态/ }).click();
    await expect(
      page
        .getByRole('navigation', { name: '选择校园地标' })
        .getByRole('button', { name: new RegExp(`西土城主楼 Lv.${level}`) }),
    ).toBeVisible();
  }
  await expect(
    page.getByText('建筑与附属设施已全部建成。', { exact: true }),
  ).toBeVisible();
  await expect(
    page.getByText('广场纪念装置已建成', { exact: true }),
  ).toBeVisible();
  state.stopped = true;
  await page.getByRole('button', { name: /刷新链上状态/ }).click();
  await expect(page.getByText(/链上操作已暂停/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: '领取资源', exact: true }),
  ).toBeDisabled();
});

test('public preview is lazy, interactive, and never reads private progress', async ({
  page,
}) => {
  await fixture(page, false);
  const requests: string[] = [];
  page.on('request', (r) => requests.push(r.url()));
  await page.goto('/game');
  await expect(
    page.getByRole('button', { name: '预览微缩校园' }),
  ).toBeVisible();
  expect(requests.some((u) => u.includes('/campus/v2/'))).toBe(false);
  await page.getByRole('button', { name: '预览微缩校园' }).click();
  const map = page.getByTestId('campus-canvas');
  await expect(map).toHaveAttribute('data-ready', 'true');
  await expect(
    page.getByText('校园预览 · 示例场景', { exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: '放大地图' }).click();
  await expect.poll(() => map.getAttribute('data-detail')).toBe('district');
  await page
    .getByRole('navigation', { name: '选择校园地标' })
    .getByRole('button', { name: /西土城主楼/ })
    .click();
  await expect.poll(() => map.getAttribute('data-detail')).toBe('close');
  await page.getByRole('button', { name: '回到全景' }).click();
  await expect.poll(() => map.getAttribute('data-detail')).toBe('world');
  await page.getByRole('button', { name: '展开地图' }).click();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: '退出沉浸视图' })).toHaveCount(
    0,
  );
  expect(
    requests.some(
      (u) => u.includes('/api/game/config') || u.includes('test-campus-rpc'),
    ),
  ).toBe(false);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    path: 'test-results/campus-public-desktop.png',
    fullPage: true,
  });
});

test('member view uses one block, avoids double counting, and keeps classic fallback', async ({
  page,
}) => {
  const state = await fixture(page);
  await page.goto('/game/campus');
  await expect(page.getByTestId('campus-knowledge')).toHaveText('140');
  expect(new Set(state.blocks)).toEqual(new Set(['0xa']));
  const map = page.getByTestId('campus-canvas');
  await expect(map).toHaveAttribute('data-ready', 'true');
  await expect(
    page.getByText('广场纪念装置已建成', { exact: true }),
  ).toBeVisible();
  await page.getByLabel('地图时段').selectOption('night');
  await expect(page.locator('.campus-scene-shell')).toHaveAttribute(
    'data-daylight',
    'night',
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    path: 'test-results/campus-member-night.png',
    fullPage: true,
  });
  await page
    .locator('.campus-scene-shell')
    .screenshot({ path: 'test-results/campus-map-night.png' });
  await page.getByLabel('地图时段').selectOption('day');
  await page.getByRole('button', { name: '经典视图', exact: true }).click();
  await expect(page.getByTestId('campus-canvas')).toHaveCount(0);
  await expect(
    page.getByRole('button', { name: /西土城主楼，算力/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: '微缩视图', exact: true }).click();
  await expect(page.getByTestId('campus-canvas')).toHaveAttribute(
    'data-ready',
    'true',
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    path: 'test-results/campus-member-day.png',
    fullPage: true,
  });
  await page
    .locator('.campus-scene-shell')
    .screenshot({ path: 'test-results/campus-map-day.png' });
  await page
    .getByRole('navigation', { name: '选择校园地标' })
    .getByRole('button', { name: /西土城主楼/ })
    .click();
  await expect(page.getByTestId('campus-canvas')).toHaveAttribute(
    'data-detail',
    'close',
  );
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    path: 'test-results/campus-main-close.png',
    fullPage: true,
  });
});

test('WebGL failure falls back without losing member progress', async ({
  page,
}) => {
  await fixture(page);
  await page.addInitScript(() => {
    const original = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (
      this: HTMLCanvasElement,
      type: string,
      ...args: unknown[]
    ) {
      if (
        type === 'webgl' ||
        type === 'webgl2' ||
        type === 'experimental-webgl'
      )
        return null;
      return original.apply(this, [type, ...args] as Parameters<
        typeof original
      >);
    } as typeof original;
    if (typeof OffscreenCanvas !== 'undefined') {
      const offscreenOriginal = OffscreenCanvas.prototype.getContext;
      OffscreenCanvas.prototype.getContext = function (
        this: OffscreenCanvas,
        type: string,
        ...args: unknown[]
      ) {
        if (
          type === 'webgl' ||
          type === 'webgl2' ||
          type === 'experimental-webgl'
        )
          return null;
        return offscreenOriginal.apply(this, [type, ...args] as Parameters<
          typeof offscreenOriginal
        >);
      } as typeof offscreenOriginal;
    }
  });
  await page.goto('/game/campus');
  await expect(page.getByText(/已切换到经典视图/)).toBeVisible();
  await expect(page.getByTestId('campus-knowledge')).toHaveText('140');
});

test('mobile stays read-only in portrait and landscape with private progress', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() =>
    Object.defineProperty(navigator, 'userAgent', { value: 'iPhone' }),
  );
  await fixture(page);
  await page.goto('/game/campus');
  await expect(page.getByTestId('campus-knowledge')).toHaveText('140');
  await expect(page.getByText(/手机浏览模式/)).toBeVisible();
  await expect(
    page.getByRole('button', { name: '领取资源', exact: true }),
  ).toHaveCount(0);
  await page
    .getByRole('navigation', { name: '选择校园地标' })
    .getByRole('button', { name: /西土城主楼/ })
    .click();
  await expect(page.getByRole('button', { name: /升级到/ })).toHaveCount(0);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await page.screenshot({
    path: 'test-results/campus-mobile.png',
    fullPage: true,
  });
  await page.setViewportSize({ width: 844, height: 390 });
  await expect(page.getByRole('button', { name: /升级到/ })).toHaveCount(0);
});

for (const code of [401, 403])
  test(`access failure ${code} clears the old campus`, async ({ page }) => {
    const state = await fixture(page);
    await page.goto('/game/campus');
    await expect(page.getByTestId('campus-knowledge')).toHaveText('140');
    state.blocked = code;
    await page.getByRole('button', { name: /刷新链上状态/ }).click();
    await expect(page.getByTestId('campus-knowledge')).toHaveCount(0);
    await expect(page.getByTestId('campus-canvas')).toHaveCount(0);
  });

test('logout removes personal state and failed artwork falls back', async ({
  page,
}) => {
  await fixture(page);
  await page.route('**/campus/v2/main-low.webp', (r) => r.abort());
  await page.goto('/game/campus');
  await expect(page.getByText(/已切换到经典视图/)).toBeVisible();
  await page.getByRole('button', { name: '退出登录', exact: true }).click();
  await expect(page.getByTestId('campus-knowledge')).toHaveCount(0);
  await expect(
    page.getByRole('heading', { name: '连接钱包后进入校园' }),
  ).toBeVisible();
});

test('camera gestures, context loss, and repeated scene cleanup', async ({
  page,
}, testInfo) => {
  const state = await fixture(page);
  await page.goto('/game/campus');
  const map = page.getByTestId('campus-canvas');
  await expect(map).toHaveAttribute('data-ready', 'true');
  const bounds = (await map.boundingBox())!;
  await page.mouse.move(
    bounds.x + bounds.width / 2,
    bounds.y + bounds.height / 2,
  );
  await page.mouse.wheel(0, -700);
  await expect
    .poll(async () => Number(await map.getAttribute('data-zoom')))
    .toBeGreaterThan(2);
  await page.mouse.down();
  await page.mouse.move(
    bounds.x + bounds.width / 2 - 100,
    bounds.y + bounds.height / 2 - 70,
    { steps: 10 },
  );
  await page.mouse.up();
  const calls = state.calls.length;
  const metrics = await map.evaluate(async (element) => {
    const before = Number((element as HTMLElement).dataset.frameCount),
      start = performance.now();
    await new Promise((resolve) => setTimeout(resolve, 2500));
    const elapsed = performance.now() - start;
    return {
      frames: Number((element as HTMLElement).dataset.frameCount) - before,
      elapsedMs: elapsed,
      fps:
        ((Number((element as HTMLElement).dataset.frameCount) - before) /
          elapsed) *
        1000,
      canvasCount: document.querySelectorAll('.campus-pixi-host canvas').length,
    };
  });
  await testInfo.attach('desktop-performance', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  expect(metrics.fps).toBeGreaterThan(40);
  expect(metrics.canvasCount).toBe(1);
  expect(state.calls.length).toBe(calls);
  await page.getByLabel('减少动态效果').check();
  await expect(map).toHaveAttribute('data-running', 'false');
  await page.getByLabel('减少动态效果').uncheck();
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(map).toHaveAttribute('data-running', 'false');
  await page.evaluate(() => {
    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
  });
  await expect(map).toHaveAttribute('data-running', 'true');
  const memory = await page.context().newCDPSession(page);
  await memory.send('HeapProfiler.collectGarbage');
  const heapBefore = await memory.send('Runtime.getHeapUsage');
  for (let i = 0; i < 3; i++) {
    await page.getByRole('button', { name: '经典视图', exact: true }).click();
    await expect(page.locator('.campus-pixi-host canvas')).toHaveCount(0);
    await page.getByRole('button', { name: '微缩视图', exact: true }).click();
    await expect(map).toHaveAttribute('data-ready', 'true');
    await expect(page.locator('.campus-pixi-host canvas')).toHaveCount(1);
  }
  await memory.send('HeapProfiler.collectGarbage');
  const heapAfter = await memory.send('Runtime.getHeapUsage');
  const lifecycle = { heapBeforeBytes: heapBefore.usedSize, heapAfterBytes: heapAfter.usedSize, heapGrowthBytes: heapAfter.usedSize - heapBefore.usedSize, sceneReentries: 3, remainingCanvases: await page.locator('.campus-pixi-host canvas').count() };
  await testInfo.attach('scene-lifecycle', { body: JSON.stringify(lifecycle, null, 2), contentType: 'application/json' });
  expect(lifecycle.heapGrowthBytes).toBeLessThan(32 * 1024 * 1024);
  await map
    .locator('canvas')
    .evaluate((canvas) =>
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true })),
    );
  await expect(page.getByText(/已切换到经典视图/)).toBeVisible();
  await expect(page.getByTestId('campus-knowledge')).toHaveText('140');
});

test('touch pinch zoom works and mobile animation stays within its frame budget', async ({
  browser,
}, testInfo) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'iPhone',
  });
  const page = await context.newPage();
  await fixture(page);
  await page.goto('/game/campus');
  const map = page.getByTestId('campus-canvas');
  await expect(map).toHaveAttribute('data-ready', 'true');
  await map.scrollIntoViewIfNeeded();
  const box = (await map.boundingBox())!;
  const cdp = await context.newCDPSession(page);
  const y = box.y + box.height / 2,
    cx = box.x + box.width / 2;
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [
      { x: cx - 25, y },
      { x: cx + 25, y },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchMove',
    touchPoints: [
      { x: cx - 85, y },
      { x: cx + 85, y },
    ],
  });
  await cdp.send('Input.dispatchTouchEvent', {
    type: 'touchEnd',
    touchPoints: [],
  });
  await expect
    .poll(async () => Number(await map.getAttribute('data-zoom')))
    .toBeGreaterThan(2);
  const metrics = await map.evaluate(async (element) => {
    const start = performance.now(),
      before = Number((element as HTMLElement).dataset.frameCount);
    await new Promise((resolve) => setTimeout(resolve, 2200));
    return {
      fps:
        ((Number((element as HTMLElement).dataset.frameCount) - before) /
          (performance.now() - start)) *
        1000,
      emulatedMobile: true,
    };
  });
  await testInfo.attach('mobile-emulation-performance', {
    body: JSON.stringify(metrics, null, 2),
    contentType: 'application/json',
  });
  expect(metrics.fps).toBeGreaterThan(24);
  expect(metrics.fps).toBeLessThan(34);
  await context.close();
});
