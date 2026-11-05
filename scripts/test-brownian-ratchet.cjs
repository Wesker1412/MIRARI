const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

async function unitChecks() {
  const { integrateRatchetStep, ratchetTimeStep, ratchetPowerZW } =
    await import('../src/components/article/brownianRatchetPhysics.ts');

  for (const [previous, now] of [[null, 100], [100, 100], [100, 99], [100, NaN], [100, Infinity], [NaN, 100], [-Infinity, 100]]) {
    assert.equal(ratchetTimeStep(previous, now), 0, 'Invalid frame interval must not advance the simulation');
  }
  assert.equal(ratchetTimeStep(100, 116), 0.016);
  assert.equal(ratchetTimeStep(0, 100000), 0.04, 'A suspended tab must not integrate one giant step');

  for (const dt of [0, -0.01, NaN, Infinity, -Infinity]) {
    assert.equal(integrateRatchetStep(17, 1, 4.14, dt, 1), null);
  }
  for (const inputIndex of [0, 1, 2, 4]) {
    for (const bad of [NaN, Infinity, -Infinity]) {
      const args = [17, 1, 4.14, 0.001, 1];
      args[inputIndex] = bad;
      assert.equal(integrateRatchetStep(...args), null);
    }
  }
  assert.equal(integrateRatchetStep(0, 0, -1, 0.001, 1), null);
  assert.equal(integrateRatchetStep(Number.MAX_VALUE, Number.MAX_VALUE, 4.14, 0.01, 1), null);

  let position = 17;
  for (const dt of [0, -0.01, NaN, 0.001]) {
    const candidate = integrateRatchetStep(position, 1, 0, dt, 0);
    if (candidate !== null) position = candidate;
  }
  assert.equal(position, 17.02, 'Valid integration must resume from the retained position');

  let seed = 246813579;
  const uniform = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return (seed + 0.5) / 4294967296;
  };
  const gaussian = () => Math.sqrt(-2 * Math.log(uniform())) * Math.cos(2 * Math.PI * uniform());
  const statistics = [];
  for (const dt of [0.01, 0.0001]) {
    const n = 50000;
    let sum = 0;
    let squareSum = 0;
    for (let index = 0; index < n; index++) {
      const displacement = integrateRatchetStep(0, 0, 4.14, dt, gaussian());
      assert.ok(Number.isFinite(displacement));
      sum += displacement;
      squareSum += displacement * displacement;
    }
    const mean = sum / n;
    const variance = squareSum / n - mean * mean;
    const expectedVariance = 2 * 4.14 * dt / 0.05;
    assert.ok(Math.abs(mean) < 0.025 * Math.sqrt(expectedVariance), 'Free diffusion acquired artificial drift');
    assert.ok(Math.abs(variance / expectedVariance - 1) < 0.025, 'Thermal variance must scale as 2D dt, not dt squared');
    statistics.push({ dt, mean, variance, expectedVariance });
  }
  assert.equal(integrateRatchetStep(0, 1.5, 0, 0.001, 0), 0.03);
  assert.equal(integrateRatchetStep(0, -1.5, 0, 0.001, 0), -0.03);
  assert.equal(ratchetPowerZW(1.5, 1000), 1500, '1.5 pN * 1000 nm/s = 1500 zW = 1.5 aW');
  for (const [force, velocity] of [[0, 12], [1, -3], [NaN, 12], [1, Infinity], [Number.MAX_VALUE, 2]]) {
    assert.equal(ratchetPowerZW(force, velocity), 0);
  }
  console.log('PASS ratchet numerical guards, resumed motion, force drift, diffusion statistics and zW conversion');
  console.log(JSON.stringify(statistics));
}

async function browserChecks() {
  const { chromium } = require('playwright');
  const baseUrl = process.env.MARKDOWN_BASE_URL || 'http://127.0.0.1:5173';
  const output = path.resolve(__dirname, '..', '.mirari-cache', 'ratchet-verification');
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({
    channel: process.env.PLAYWRIGHT_CHANNEL || undefined,
    executablePath: process.env.PLAYWRIGHT_EXECUTABLE_PATH || undefined,
    headless: true,
  });
  const results = [];
  try {
    for (const viewport of [{ width: 1280, height: 900 }, { width: 390, height: 844 }]) {
      const page = await browser.newPage({
        viewport, isMobile: viewport.width < 640, hasTouch: viewport.width < 640, reducedMotion: 'reduce',
      });
      const errors = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.addInitScript(() => {
        window.__ratchetCanvasCalls = 0;
        for (const method of ['createRadialGradient', 'arc', 'moveTo', 'lineTo', 'quadraticCurveTo']) {
          const original = CanvasRenderingContext2D.prototype[method];
          CanvasRenderingContext2D.prototype[method] = function (...args) {
            if (this.canvas.closest('article')) {
              if (args.some((value) => typeof value === 'number' && !Number.isFinite(value))) {
                throw new Error('Non-finite canvas argument: ' + method);
              }
              window.__ratchetCanvasCalls++;
            }
            return original.apply(this, args);
          };
        }
      });

      await page.goto(new URL('/articles/brownian-ratchet-molecular-motors', baseUrl).href, { waitUntil: 'load' });
      const article = page.locator('article');
      const sliders = article.locator('input[type="range"]');
      await sliders.first().waitFor();
      assert.equal(await sliders.count(), 4);
      await article.getByText('× 10⁻²¹ W (zW)', { exact: true }).waitFor();

      const modes = ['等溫熱平衡 (淨位移=0)', 'ATP 驅動整流行走', '極限負載失速阻滯'];
      for (const mode of [...modes, modes[1]]) {
        await article.getByRole('button', { name: mode, exact: true }).click();
        for (let index = 0; index < 4; index++) {
          const slider = sliders.nth(index);
          if (await slider.isDisabled()) continue;
          await slider.focus();
          // Repeated effect restarts, including the supported slider extremes.
          await slider.press('Home');
          await slider.press('ArrowRight');
          await slider.press('End');
          await slider.press('ArrowLeft');
        }
        const calls = await page.evaluate(() => window.__ratchetCanvasCalls);
        await page.waitForFunction((previous) => window.__ratchetCanvasCalls > previous + 20, calls);
        await page.waitForTimeout(350);
        assert.ok(!/NaN|Infinity/.test(await article.innerText()), 'Non-finite metric appeared');
        assert.deepEqual(errors, [], 'A runtime or canvas error occurred');
      }

      const paints = await article.locator('canvas').evaluateAll((canvases) => canvases.map((canvas) => {
        const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
        return new Set(pixels).size > 3;
      }));
      assert.deepEqual(paints, [true, true], 'Both physics and trajectory canvases must be painted');
      const renderedValue = await article.getByText('微觀輸出機械功率 (P = F·v)', { exact: true })
        .locator('..').innerText();
      assert.ok(renderedValue.includes('zW') && !renderedValue.includes('aW'));
      results.push({ width: viewport.width, modes: modes.length, sliders: 4, canvases: paints.length, errors });
      await page.screenshot({ path: path.join(output, 'brownian-' + viewport.width + '.png'), fullPage: false });
      await page.close();
      console.log('PASS Chrome ratchet modes, slider limits, ongoing animation, finite coordinates and zW label', viewport.width);
    }
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(results, null, 2));
    await browser.close();
  }
}

(async () => {
  await unitChecks();
  if (process.argv.includes('--browser')) await browserChecks();
})().catch((error) => {
  console.error('FAIL ratchet regression:', error);
  process.exitCode = 1;
});
