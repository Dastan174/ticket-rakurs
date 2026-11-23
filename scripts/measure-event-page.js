// Замер страницы события для Playwright MCP (browser_run_code_unsafe с filename): CPU x4, 4G, без кеша, свежий контекст.
// Нужен запущенный production-сервер: npm run build && npx next start -p 3200. Гонять 3 раза, брать медиану.
async (orig) => {
  const ctx = await orig.context().browser().newContext();
  const page = await ctx.newPage();
  // Эмуляция среднего телефона: процессор в 4 раза медленнее, 4G 4 Мбит/с, задержка 150 мс, без кеша.
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Network.enable');
  await cdp.send('Network.setCacheDisabled', { cacheDisabled: true });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 150, downloadThroughput: 4e6 / 8, uploadThroughput: 1.5e6 / 8 });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 4 });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.addInitScript(() => {
    window.__lt = [];
    new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: 'longtask', buffered: true });
    window.__canvasAt = null;
    new MutationObserver(() => { if (!window.__canvasAt && document.querySelector('canvas')) window.__canvasAt = performance.now(); }).observe(document, { childList: true, subtree: true });
  });
  const t0 = Date.now();
  await page.goto('http://localhost:3200/events/cup-final', { waitUntil: 'load' });
  await page.waitForFunction(() => window.__canvasAt, null, { timeout: 60000 });
  await page.waitForTimeout(1500);
  const load = await page.evaluate(() => {
    const res = performance.getEntriesByType('resource');
    const js = res.filter((r) => r.name.includes('/_next/static') && r.name.endsWith('.js'));
    const fcp = performance.getEntriesByName('first-contentful-paint')[0]?.startTime;
    const tbt = window.__lt.reduce((a, [, d]) => a + Math.max(0, d - 50), 0);
    return { lt: window.__lt.filter(([,d])=>d>80).map(([s,d])=>Math.round(s)+':'+Math.round(d)).join(' '), jsKB: Math.round(js.reduce((a, r) => a + r.encodedBodySize, 0) / 1024), jsFiles: js.length, fcp: Math.round(fcp), canvasAt: Math.round(window.__canvasAt), tbtMs: Math.round(tbt), longTasks: window.__lt.length };
  });
  // Простой: 3 секунды без действий — сколько главного потока съедает сцена
  const idle = await page.evaluate(async () => {
    const start = performance.now();
    let frames = 0, busy = 0, last = start;
    await new Promise((res) => { const f = (t) => { frames++; busy += Math.max(0, t - last - 16.7); last = t; if (t - start < 3000) requestAnimationFrame(f); else res(); }; requestAnimationFrame(f); });
    const lt = window.__lt.filter(([s]) => s >= start).reduce((a, [, d]) => a + d, 0);
    return { fps: Math.round(frames / 3), longTaskMsIn3s: Math.round(lt) };
  });
  await cdp.send('Emulation.setCPUThrottlingRate', { rate: 1 });
  await cdp.send('Network.emulateNetworkConditions', { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 });
  await ctx.close();
  delete load.lt;
  return { ...load, ...idle, wallMs: Date.now() - t0 };
}
