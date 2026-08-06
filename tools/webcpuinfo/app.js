/* webcpuinfo — detect CPU/browser/hardware from browser APIs and run a bench. */
(function () {
  const set = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
  const status = document.getElementById('status');

  function archHints() {
    // Parse UA for the best arch/bits hints we can truthfully offer.
    const ua = navigator.userAgent;
    const hints = [];
    if (/arm64|aarch64|Apple Silicon/i.test(ua + (navigator.platform || ''))) hints.push('ARM64');
    else if (/Win|Linux|Mac/i.test(navigator.platform || '')) hints.push('x86-64 (likely)');
    if (/\b(Modern|Chrome)\/\d+/.test(ua) && navigator.userAgentData) {
      const arch = navigator.userAgentData?.getHighEntropyValues?.('architecture', 'bitness');
      // platform is async; handled below
    }
    return hints.length ? hints.join(', ') : '—';
  }

  function parseUA() {
    const ua = navigator.userAgent;
    let browser = '—';
    if (/Edg\//i.test(ua)) browser = 'Microsoft Edge';
    else if (/Chrome\//i.test(ua) && !/Chromium/i.test(ua)) browser = 'Chrome';
    else if (/Firefox\//i.test(ua)) browser = 'Firefox';
    else if (/Safari\//i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Chromium/i.test(ua)) browser = 'Chromium';
    return browser + ' · ' + ua;
  }

  async function cpuInfo() {
    set('f-cores', navigator.hardwareConcurrency ? navigator.hardwareConcurrency + ' logical' : '—');

    let arch = archHints();
    if (navigator.userAgentData && navigator.userAgentData.getHighEntropyValues) {
      try {
        const v = await navigator.userAgentData.getHighEntropyValues(['architecture','bitness']);
        arch = `${v.architecture || '?'}${v.bitness? '/'+v.bitness : ''}`;
      } catch (e) { /* fall through */ }
    }
    set('f-arch', arch);

    // best-guess SIMD from UA (Chromium exposes some) — otherwise honest '—'
    const simd = /x86|Intel|amd64/i.test(navigator.userAgent + (navigator.platform||'')) ? 'AVX/SSE (likely)' : '—';
    set('f-simd', simd);
  }

  function memInfo() {
    const dm = navigator.deviceMemory; // Chrome only
    set('f-ram', dm ? dm + ' GiB (deviceMemory)' : '—');
    if (performance && performance.memory) {
      set('f-heap', (performance.memory.jsHeapSizeLimit>>20) + ' MiB');
    } else {
      set('f-heap', '—');
    }
  }

  async function gpuInfo() {
    // WebGPU adapter gives real adapter info where available (Chrome/Edge).
    if (navigator.gpu) {
      try {
        const a = await navigator.gpu.requestAdapter();
        if (a) {
          const info = a.info || {};
          set('f-gpu', info.description || info.architecture || '—');
          set('f-gpu-vendor', info.vendor || info.adapterType || '—');
          return;
        }
      } catch (e) { /* no WebGPU adapter */ }
    }
    set('f-gpu', '—');
    set('f-gpu-vendor', '—');
  }

  function sysInfo() {
    set('f-platform', navigator.userAgentData?.platform || navigator.platform || '—');
    set('f-ua', parseUA());
  }

  /* Honest JS integer benchmark: count how many 32-bit mixes we do in ~1s. */
  function benchmark() {
    const runBtn = document.getElementById('run-bench');
    const out = document.getElementById('bench-result');
    runBtn.disabled = true;
    out.textContent = 'running…';
    // warm
    let x = 1 | 0;
    for (let i = 0; i < 1e6; i++) x = (x ^ (x << 13)) | (x >>> 17) | (x * 31 | 0);
    const t0 = performance.now();
    let iters = 0;
    while (performance.now() - t0 < 1000) {   // run ~1 second
      for (let i = 0; i < 1e6; i++) x = (x ^ (x << 13)) ^ (x >>> 17) ^ (x * 2654435761 | 0);
      iters += 1e6;
    }
    const ms = performance.now() - t0;
    runBtn.disabled = false;
    out.textContent = `${(iters / (ms/1000) / 1e6).toFixed(1)} M integer-mix ops/sec (${iters} ops in ${ms|0} ms)`;
  }

  document.getElementById('run-bench').addEventListener('click', benchmark);

  async function init() {
    await cpuInfo();
    memInfo();
    await gpuInfo();
    sysInfo();
    set('status', 'Done. Scroll for the honest benchmark.');
  }
  init();
})();
