// ================================================================
//  DOTS AND BOXES — PewPlay
//  @bg #fdf6e9
//  @accent #ff6b57
//  @light
//  Griglie 3×3, 4×4, 5×5 o 6×6 quadrati. Contro il computer (3 livelli)
//  o in due. Chi chiude un quadrato gioca ancora.
// ================================================================
(function () {
  'use strict';
  const { sfx, store } = PP;

  const GAME_ID = 'dots-and-boxes';
  const SIZES = [3, 4, 5, 6];
  const MODES = ['vs Computer', '2 Players'];
  const LEVELS = ['Easy', 'Medium', 'Hard'];
  const PCOL = ['', '#ff6b57', '#3b82f6'];
  const PFILL = ['', 'rgba(255,107,87,.22)', 'rgba(59,130,246,.22)'];

  let sizeIdx = 1, mode = 0, level = 1;
  let N, h, v, owner, turn, scores, aiTimer, done, lastEdge, hoverEdge, newBoxes;
  let geo = { x: 0, y: 0, step: 60 };

  function layout() {
    const top = 80, pad = 30;
    const step = Math.min((PP.W - pad * 2) / N, (PP.H - top - pad) / N);
    geo = { step, x: (PP.W - step * N) / 2, y: top + (PP.H - top - pad - step * N) / 2 };
  }

  function start() {
    N = SIZES[sizeIdx];
    h = Array.from({ length: N + 1 }, () => Array(N).fill(0));
    v = Array.from({ length: N }, () => Array(N + 1).fill(0));
    owner = Array.from({ length: N }, () => Array(N).fill(0));
    turn = 1; scores = [0, 0, 0]; aiTimer = 0; done = false; lastEdge = null; hoverEdge = null; newBoxes = [];
    layout();
  }

  // ── REGOLE ──────────────────────────────────────
  const sides = (r, c, H = h, V = v) => (H[r][c] ? 1 : 0) + (H[r + 1][c] ? 1 : 0) + (V[r][c] ? 1 : 0) + (V[r][c + 1] ? 1 : 0);
  function boxesOf(e) {
    const out = [];
    if (e.t === 'h') { if (e.r > 0) out.push([e.r - 1, e.c]); if (e.r < N) out.push([e.r, e.c]); }
    else { if (e.c > 0) out.push([e.r, e.c - 1]); if (e.c < N) out.push([e.r, e.c]); }
    return out;
  }
  function freeEdges(H = h, V = v) {
    const out = [];
    for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) if (!H[r][c]) out.push({ t: 'h', r, c });
    for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) if (!V[r][c]) out.push({ t: 'v', r, c });
    return out;
  }
  const setEdge = (e, val, H = h, V = v) => { (e.t === 'h' ? H : V)[e.r][e.c] = val; };

  function play(e) {
    if (done || (e.t === 'h' ? h : v)[e.r][e.c]) return false;
    setEdge(e, turn);
    lastEdge = e;
    let closed = 0;
    for (const [r, c] of boxesOf(e)) if (sides(r, c) === 4 && !owner[r][c]) {
      owner[r][c] = turn; closed++; scores[turn]++;
      newBoxes.push({ r, c, t: 0 });
      const cx = geo.x + (c + 0.5) * geo.step, cy = geo.y + (r + 0.5) * geo.step;
      PP.burst(cx, cy, [PCOL[turn], '#fff'], 12, 160, 3, 0.6, 0);
    }
    if (closed) sfx.chord(closed === 2 ? [660, 880, 1100] : [660, 880], 0.12, 'triangle', 0.13, 0.05);
    else sfx.tone(turn === 1 ? 520 : 420, 0.05, 'square', 0.07);
    if (scores[1] + scores[2] === N * N) return finish();
    if (!closed) turn = 3 - turn;
    if (mode === 0 && turn === 2) aiTimer = closed ? 0.35 : 0.55;
    return true;
  }

  function finish() {
    done = true;
    const w = scores[1] > scores[2] ? 1 : scores[2] > scores[1] ? 2 : 3;
    const key = `stats-${level}`, st = store.get(key, { w: 0, l: 0 });
    if (mode === 0 && w === 1) st.w++; if (mode === 0 && w === 2) st.l++;
    if (mode === 0) store.set(key, st);
    if (w === 2 && mode === 0) sfx.lose(); else sfx.win();
    const title = w === 3 ? 'Draw!' : mode === 1 ? `${w === 1 ? 'Red' : 'Blue'} wins!` : w === 1 ? 'You win!' : 'Computer wins';
    PP.game.overDelay = 900;
    PP.over(title, `Red ${scores[1]} · Blue ${scores[2]}${mode === 0 ? `\n${LEVELS[level]}: ${st.w} wins · ${st.l} losses` : ''}`);
  }

  // ── IA ──────────────────────────────────────────
  function givesAway(e) { return boxesOf(e).some(([r, c]) => sides(r, c) === 2); }
  function completes(e) { return boxesOf(e).some(([r, c]) => sides(r, c) === 3); }
  // quante caselle l'avversario prende di fila dopo questa mossa (presa avida)
  function sacrifice(e) {
    const H = h.map(r => r.slice()), V = v.map(r => r.slice());
    setEdge(e, 9, H, V);
    let taken = 0, again = true;
    while (again) {
      again = false;
      for (let r = 0; r < N && !again; r++) for (let c = 0; c < N && !again; c++) {
        if (sides(r, c, H, V) === 3) {
          for (const ed of [{ t: 'h', r, c }, { t: 'h', r: r + 1, c }, { t: 'v', r, c }, { t: 'v', r, c: c + 1 }]) if (!(ed.t === 'h' ? H : V)[ed.r][ed.c]) { setEdge(ed, 9, H, V); break; }
          taken++; again = true;
        }
      }
    }
    return taken;
  }
  function aiMove() {
    const free = PP.shuffle(freeEdges());
    const take = free.find(completes);
    if (level === 0) {
      if (take && Math.random() < 0.8) return take;
      const safe = free.filter(e => !givesAway(e));
      return (Math.random() < 0.7 && safe.length ? PP.pick(safe) : PP.pick(free));
    }
    if (take) return take;
    const safe = free.filter(e => !givesAway(e));
    if (safe.length) return PP.pick(safe);
    // obbligati a regalare: il meno possibile
    let best = free[0], bv = Infinity;
    for (const e of free) { const s = sacrifice(e); if (s < bv) { bv = s; best = e; } if (level === 1 && bv <= 1) break; }
    return best;
  }

  function update(dt) {
    for (const b of newBoxes) b.t = Math.min(1, b.t + dt * 4);
    if (!done && mode === 0 && turn === 2) {
      aiTimer -= dt;
      if (aiTimer <= 0) play(aiMove());
    }
  }

  // ── DISEGNO ─────────────────────────────────────
  function edgePos(e) {
    const { x, y, step } = geo;
    return e.t === 'h' ? [x + e.c * step, y + e.r * step, x + (e.c + 1) * step, y + e.r * step] : [x + e.c * step, y + e.r * step, x + e.c * step, y + (e.r + 1) * step];
  }

  function draw(ctx, W, H) {
    ctx.fillStyle = '#fdf6e9'; ctx.fillRect(0, 0, W, H);
    // carta a quadretti
    ctx.strokeStyle = 'rgba(80,120,200,.10)'; ctx.lineWidth = 1;
    for (let gx = 0; gx < W; gx += 22) { ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, H); ctx.stroke(); }
    for (let gy = 0; gy < H; gy += 22) { ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(W, gy); ctx.stroke(); }
    if (!h) return;
    layout();
    const { x, y, step } = geo;
    // caselle chiuse
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (owner[r][c]) {
      const nb = newBoxes.find(b => b.r === r && b.c === c);
      const t = nb ? PP.easeOut(nb.t) : 1;
      const pad = step * 0.08 + (1 - t) * step * 0.4;
      PP.rr(x + c * step + pad, y + r * step + pad, step - pad * 2, step - pad * 2, step * 0.12);
      ctx.fillStyle = PFILL[owner[r][c]]; ctx.fill();
      if (t > 0.6) PP.text(owner[r][c] === 1 ? (mode === 0 ? 'You' : 'R') : mode === 0 ? 'CPU' : 'B', x + (c + 0.5) * step, y + (r + 0.5) * step + 1, Math.max(12, step * 0.22), PCOL[owner[r][c]], 'center', 800);
    }
    // linee
    ctx.lineCap = 'round';
    const lw = Math.max(4, step * 0.08);
    const drawEdge = (e, color, width, alpha = 1) => { const [a, b, c2, d] = edgePos(e); ctx.globalAlpha = alpha; ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath(); ctx.moveTo(a, b); ctx.lineTo(c2, d); ctx.stroke(); ctx.globalAlpha = 1; };
    for (let r = 0; r <= N; r++) for (let c = 0; c < N; c++) { const p = h[r][c]; if (p) drawEdge({ t: 'h', r, c }, PCOL[p], lw); }
    for (let r = 0; r < N; r++) for (let c = 0; c <= N; c++) { const p = v[r][c]; if (p) drawEdge({ t: 'v', r, c }, PCOL[p], lw); }
    if (lastEdge && PP.state !== 'menu') drawEdge(lastEdge, '#fff', lw * 0.35, 0.8);
    if (hoverEdge && PP.state === 'playing' && !done && (mode === 1 || turn === 1)) drawEdge(hoverEdge, PCOL[turn], lw, 0.35);
    // punti
    for (let r = 0; r <= N; r++) for (let c = 0; c <= N; c++) PP.circle(x + c * step, y + r * step, Math.max(5, step * 0.085), '#2b2b3a');
    PP.drawFx();

    if (PP.state !== 'menu') {
      const name = p => (mode === 0 ? (p === 1 ? 'You' : 'Computer') : p === 1 ? 'Red' : 'Blue');
      const bw = Math.min(150, (W - 140) / 2);
      for (const p of [1, 2]) {
        const bx = 14 + (p - 1) * (bw + 10);
        PP.rr(bx, 14, bw, 50, 14);
        ctx.fillStyle = turn === p && !done ? PCOL[p] : 'rgba(0,0,0,.06)'; ctx.fill();
        PP.text(name(p), bx + 14, 32, 13, turn === p && !done ? '#fff' : '#555', 'left', 700);
        PP.text(String(scores[p]), bx + 14, 52, 20, turn === p && !done ? '#fff' : PCOL[p], 'left', 900);
      }
    }
  }

  // ── INPUT ───────────────────────────────────────
  function edgeAt(px, py) {
    const { x, y, step } = geo;
    const fx = (px - x) / step, fy = (py - y) / step;
    let best = null, bd = 0.42;
    const r0 = Math.round(fy), c0 = Math.floor(fx);
    if (r0 >= 0 && r0 <= N && c0 >= 0 && c0 < N) { const d = Math.abs(fy - r0); if (d < bd) { bd = d; best = { t: 'h', r: r0, c: c0 }; } }
    const c1 = Math.round(fx), r1 = Math.floor(fy);
    if (c1 >= 0 && c1 <= N && r1 >= 0 && r1 < N) { const d = Math.abs(fx - c1); if (d < bd) { bd = d; best = { t: 'v', r: r1, c: c1 }; } }
    if (best && (best.t === 'h' ? h : v)[best.r][best.c]) return null;
    return best;
  }
  function pointerMove(p) { hoverEdge = edgeAt(p.x, p.y); }
  function pointerDown(p) {
    if (done || (mode === 0 && turn === 2)) return;
    const e = edgeAt(p.x, p.y);
    if (e) { play(e); hoverEdge = null; }
  }

  function demo(n) {
    sizeIdx = [1, 1, 2, 3][n]; start();
    const fill = [0, 0.55, 0.7, 0.35][n];
    const all = freeEdges();
    PP.shuffle(all);
    for (const e of all.slice(0, Math.floor(all.length * fill))) {
      // evita di chiudere troppe caselle a caso: le assegna a turno
      setEdge(e, Math.random() < 0.5 ? 1 : 2);
    }
    for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) if (sides(r, c) === 4) { owner[r][c] = (r + c) % 3 ? 1 : 2; scores[owner[r][c]]++; }
    lastEdge = all[0]; turn = 1;
    hoverEdge = freeEdges()[2] || null;
  }

  function icon(c, S) {
    c.fillStyle = '#fdf6e9'; c.fillRect(0, 0, S, S);
    const st = S * 0.2, x0 = S * 0.3, y0 = S * 0.3;
    c.fillStyle = 'rgba(255,107,87,.25)'; c.fillRect(x0 + 6, y0 + 6, st - 12, st - 12);
    c.fillStyle = 'rgba(59,130,246,.25)'; c.fillRect(x0 + st + 6, y0 + st + 6, st - 12, st - 12);
    c.lineCap = 'round'; c.lineWidth = S * 0.035;
    const L = (a, b, c2, d, col) => { c.strokeStyle = col; c.beginPath(); c.moveTo(x0 + a * st, y0 + b * st); c.lineTo(x0 + c2 * st, y0 + d * st); c.stroke(); };
    L(0, 0, 1, 0, '#ff6b57'); L(0, 0, 0, 1, '#ff6b57'); L(1, 0, 1, 1, '#3b82f6'); L(0, 1, 1, 1, '#ff6b57');
    L(1, 1, 2, 1, '#3b82f6'); L(2, 1, 2, 2, '#3b82f6'); L(1, 2, 2, 2, '#ff6b57'); L(1, 1, 1, 2, '#3b82f6'); L(1, 0, 2, 0, '#ff6b57');
    for (let r = 0; r <= 2; r++) for (let k = 0; k <= 2; k++) { c.fillStyle = '#2b2b3a'; c.beginPath(); c.arc(x0 + k * st, y0 + r * st, S * 0.03, 0, 7); c.fill(); }
  }

  PP.run({
    id: GAME_ID,
    title: 'Dots and Boxes',
    intro: 'Take turns drawing lines between dots.\nClose a box to claim it and play again. Most boxes wins.',
    choices: () => [
      { label: 'Opponent', options: MODES, value: mode, onChange: i => { mode = i; store.set('mode', i); PP.showMain(); } },
      ...(mode === 0 ? [{ label: 'Difficulty', options: LEVELS, value: level, onChange: i => { level = i; store.set('level', i); } }] : []),
      { label: 'Board', options: SIZES.map(s => `${s}×${s}`), value: sizeIdx, onChange: i => { sizeIdx = i; store.set('size', i); } },
    ],
    bestText: () => { if (mode) return ''; const st = store.get(`stats-${level}`, { w: 0, l: 0 }); return `${LEVELS[level]}: ${st.w} wins · ${st.l} losses`; },
    pauseText: () => `Red ${scores[1]} · Blue ${scores[2]}`,
    init() { mode = store.get('mode', 0); level = store.get('level', 1); sizeIdx = store.get('size', 1); start(); },
    start() { PP.game.overDelay = 650; start(); },
    update, draw, pointerDown, pointerMove, demo, icon,
    resize() { if (N) layout(); },
  });
})();
