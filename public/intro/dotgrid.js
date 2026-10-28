/* Interactive dot grid for the intro background (GSAP + InertiaPlugin).
   Dots glow near the pointer, get flicked away when you move fast, spring back with an elastic ease,
   and a click sends out a shockwave. Drawn on one canvas, so it stays smooth. */
(function () {
  const canvas = document.getElementById('dotgrid');
  if (!canvas || !window.gsap || !window.InertiaPlugin) return;
  gsap.registerPlugin(InertiaPlugin);
  const ctx = canvas.getContext('2d');
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  const cfg = {
    size: 3,                 // dot diameter (px)
    gap: 26,                 // space between dots
    base: [42, 42, 54],      // resting colour
    active: [184, 201, 255], // colour near the pointer (matches the page's pale blue)
    proximity: 150,          // glow radius around the pointer
    speedTrigger: 100,       // pointer speed (px/s) needed to flick dots
    maxSpeed: 5000,
    resistance: 750,         // higher = dots stop sooner
    returnTime: 1.5,         // elastic spring-back (s)
    shockRadius: 260,
    shockStrength: 5,
  };

  let dots = [], w = 0, h = 0, dpr = 1;
  const p = { x: -9999, y: -9999, vx: 0, vy: 0, speed: 0, t: 0 };

  function build() {
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    w = window.innerWidth; h = window.innerHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const cell = cfg.size + cfg.gap;
    const cols = Math.floor((w + cfg.gap) / cell), rows = Math.floor((h + cfg.gap) / cell);
    const x0 = (w - (cell * cols - cfg.gap)) / 2 + cfg.size / 2;
    const y0 = (h - (cell * rows - cfg.gap)) / 2 + cfg.size / 2;
    dots.forEach(d => gsap.killTweensOf(d));
    dots = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) dots.push({ cx: x0 + c * cell, cy: y0 + r * cell, xo: 0, yo: 0, busy: false });
    draw();
  }

  const mix = (a, b, t) => Math.round(a + (b - a) * t);
  function draw() {
    ctx.clearRect(0, 0, w, h);
    const { base, active, proximity, size } = cfg, pr2 = proximity * proximity, r = size / 2;
    for (const d of dots) {
      const dx = d.cx - p.x, dy = d.cy - p.y, q = dx * dx + dy * dy;
      let t = 0;
      if (q < pr2) t = 1 - Math.sqrt(q) / proximity;
      ctx.fillStyle = t > 0
        ? `rgb(${mix(base[0], active[0], t)},${mix(base[1], active[1], t)},${mix(base[2], active[2], t)})`
        : `rgb(${base[0]},${base[1]},${base[2]})`;
      ctx.beginPath();
      ctx.arc(d.cx + d.xo, d.cy + d.yo, r * (1 + t * 0.7), 0, 6.2832);
      ctx.fill();
    }
  }
  if (!reduced) gsap.ticker.add(draw); // redraw with GSAP's own clock

  function springBack(d) {
    gsap.to(d, { xo: 0, yo: 0, duration: cfg.returnTime, ease: 'elastic.out(1,0.75)', onComplete: () => { d.busy = false; } });
  }
  function fling(d, vx, vy) {
    d.busy = true;
    gsap.killTweensOf(d);
    gsap.to(d, { inertia: { xo: vx, yo: vy, resistance: cfg.resistance }, onComplete: () => springBack(d) });
  }

  function onMove(e) {
    const now = performance.now(), dt = p.t ? now - p.t : 16;
    if (dt < 8) return;
    let vx = ((e.clientX - p.x) / dt) * 1000, vy = ((e.clientY - p.y) / dt) * 1000;
    if (p.x < -9000) { vx = 0; vy = 0; }
    let sp = Math.hypot(vx, vy);
    if (sp > cfg.maxSpeed) { const k = cfg.maxSpeed / sp; vx *= k; vy *= k; sp = cfg.maxSpeed; }
    p.t = now; p.x = e.clientX; p.y = e.clientY; p.vx = vx; p.vy = vy; p.speed = sp;
    if (reduced || sp <= cfg.speedTrigger) return;
    for (const d of dots) {
      if (d.busy || Math.hypot(d.cx - p.x, d.cy - p.y) > cfg.proximity) continue;
      fling(d, d.cx - p.x + vx * 0.005, d.cy - p.y + vy * 0.005);
    }
  }
  function onLeave() { p.x = p.y = -9999; p.t = 0; }
  function onClick(e) {
    if (reduced) return;
    for (const d of dots) {
      const dx = d.cx - e.clientX, dy = d.cy - e.clientY, dist = Math.hypot(dx, dy);
      if (dist > cfg.shockRadius || d.busy) continue;
      const fall = Math.max(0, 1 - dist / cfg.shockRadius);
      fling(d, dx * cfg.shockStrength * fall, dy * cfg.shockStrength * fall);
    }
  }

  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerdown', onClick, { passive: true });
  document.documentElement.addEventListener('mouseleave', onLeave);
  addEventListener('blur', onLeave);
  addEventListener('resize', build);
  build();
})();
