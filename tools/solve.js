// Headless check: node solve.js <html> [level numbers...]
// Loads the /*SIM*/ block of the game and best-first searches each level for a winning input sequence.
const fs = require('fs'), vm = require('vm');
const sim = fs.readFileSync(process.argv[2], 'utf8').split('/*SIM*/')[1].split('/*ENDSIM*/')[0];
vm.runInThisContext(sim + `
function bfs(g) {
  const d = new Int32Array(L.w * L.h).fill(1e6), q = [[Math.floor(g.x / T), Math.floor(g.y / T)]];
  d[q[0][1] * L.w + q[0][0]] = 0;
  for (let i = 0; i < q.length; i++) { const [x, y] = q[i];
    for (const [a, b] of [[1,0],[-1,0],[0,1],[0,-1]]) { const nx = x + a, ny = y + b;
      if (nx < 0 || ny < 0 || nx >= L.w || ny >= L.h || SOLID.includes(L.rows[ny][nx]) || d[ny * L.w + nx] < 1e6) continue;
      d[ny * L.w + nx] = d[y * L.w + x] + 1; q.push([nx, ny]); } }
  return d;
}
function solveLevel(i, maxExp) {
  setLevel(i);
  if (!L.rows.every(r => r.length === L.w)) throw new Error('ragged rows in level ' + (i + 1));
  if (!L.start || !L.goal) throw new Error('missing S or G in level ' + (i + 1));
  const fields = (L.orbs || [L.goal]).map(bfs), heap = [], seen = new Set(), timed = L.rings.length > 0;
  const hval = () => fields[S.next || 0][Math.floor(S.p.y / T) * L.w + Math.floor(S.p.x / T)] + (fields.length - 1 - (S.next || 0)) * 500;
  const push = n => { heap.push(n); let k = heap.length - 1; while (k > 0) { const m = (k - 1) >> 1; if (heap[m].s <= heap[k].s) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } };
  const pop = () => { const top = heap[0], l = heap.pop(); if (heap.length) { heap[0] = l; let k = 0; for (;;) { let m = k, a = 2 * k + 1, b = a + 1;
    if (a < heap.length && heap[a].s < heap[m].s) m = a; if (b < heap.length && heap[b].s < heap[m].s) m = b; if (m === k) break; [heap[m], heap[k]] = [heap[k], heap[m]]; k = m; } } return top; };
  if (hval() >= 1e6) return { ok: false, why: 'goal walled off' };
  push({ S: structuredClone(S), s: hval(), n: 0 });
  const pick = a => a[Math.floor(Math.random() * a.length)];
  let exp = 0, bestH = 1e9;
  while (heap.length && exp < maxExp) {
    const node = pop(); exp++;
    for (let k = 0; k < 10; k++) {
      S = structuredClone(node.S);
      const r = Math.random();
      if (r < .45) { const a = Math.random() < .8 ? -Math.random() * Math.PI : Math.random() * Math.PI; fire(Math.cos(a), Math.sin(a)); }
      else if (r < .6) retract();
      const reel = pick([-1, 0, 0, 1, 1]), swing = pick([-1, 0, 1]), steps = Math.round(pick([.1, .2, .35, .6]) / DT);
      for (let s = 0; s < steps && !S.won && !S.dead; s++) step(DT, reel, swing);
      if (S.won) return { ok: true, time: +S.time.toFixed(1), exp, moves: node.n + 1 };
      if (S.dead) continue;
      const p = S.p, ro = S.rope, key = (p.x >> 3) + ',' + (p.y >> 3) + ',' + Math.round(p.vx / 120) + ',' + Math.round(p.vy / 120) + ',' +
        (ro ? Math.round(ro.len / 16) + ':' + ro.pts.length + ':' + (piv().x >> 4) + ':' + (piv().y >> 4) : '-') + (timed ? ',' + Math.floor(S.t * 2) : '') + ',' + Object.keys(S.broken).length + ',' + (S.next || 0);
      if (seen.has(key)) continue; seen.add(key);
      const h = hval(); if (h < bestH) bestH = h;
      push({ S, s: h + S.time * .3 + Math.random() * .5, n: node.n + 1 });
    }
  }
  return { ok: false, exp, bestH };
}
`);
const want = process.argv.slice(3).map(Number);
let fail = 0;
LEVELS.forEach((lv, i) => {
  if (want.length && !want.includes(i + 1)) return;
  const t0 = Date.now(), r = solveLevel(i, lv.race ? 150000 : 40000);
  if (!r.ok) fail++;
  console.log(`${String(i + 1).padStart(2)} ${lv.name.padEnd(8)} ${r.ok ? 'SOLVED' : 'UNSOLVED'} ${JSON.stringify(r)} ${((Date.now() - t0) / 1000).toFixed(1)}s`);
});
process.exit(fail ? 1 : 0);
