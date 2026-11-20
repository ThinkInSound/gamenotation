// Runs seeded headless sessions of the Tension Score arena game and writes the analysis data.
// Usage: node tools/arena-analysis.js [secondsPerSession]
// Output: data/arena-analysis.json
"use strict";
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const SECS = Number(process.argv[2] || 600);
const HZ = 10;

const html = fs.readFileSync(path.join(ROOT, "tension-score.html"), "utf8");
const CORE = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));

function mulberry32(a) {
  return function () {
    a |= 0; a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}
// The game core captures Math.random when it is evaluated, so each session gets its own seeded copy.
function loadCore(seed) {
  const saved = Math.random;
  Math.random = mulberry32(seed);
  const mod = { exports: {} };
  new Function("module", "window", CORE)(mod, undefined);
  Math.random = saved;
  return mod.exports;
}
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const r3 = v => Math.round(v * 1000) / 1000;
const mean = a => a.reduce((x, y) => x + y, 0) / (a.length || 1);

function runSession(rule, seed, compose) {
  const M = loadCore(seed), s = M.newState(rule, compose || "structured"), dt = 1 / 60;
  let wander = 0, lastRoll = -1, p = 1, U = 0, Ud = 0, pS = 1, I4 = 0, lastSample = -1, hitsPending = 0, xTrace = 0;
  const S = { t: [], P: [], Sraw: [], Sn: [], Th: [], U: [], T: [], p: [], I4: [], X: [], V: [] };
  const ev = [], motifs = [], byId = new Map(), expect = M.newExpect();
  while (s.t < SECS) {
    wander += -wander * 1.5 * dt + M.gauss() * 0.9 * Math.sqrt(dt);
    const e = [];
    M.step(s, dt, M.botInput(s, wander), e);
    for (const x of e) {
      if (x.type === "gate") ev.push({ t: s.t, kind: x.banked ? "bank" : "gate", zone: x.zone });
      else if (x.type === "hit") { ev.push({ t: s.t, kind: "hit" }); hitsPending++; if (x.pi != null && byId.has(x.pi)) byId.get(x.pi).hits++; }
      else if (x.type === "death") ev.push({ t: s.t, kind: "death", lost: x.lost });
      else if (x.type === "motif") {
        const bits = M.expectSurprisal(expect, x.ti);
        xTrace = Math.min(1, xTrace + bits / M.SURPRISE_BITS);
        const m = { t: s.t, t1: null, ti: x.ti, id: x.id, n: x.n, varied: x.varied, together: x.together, bits, hits: 0, violation: x.violation, slot: x.slot };
        motifs.push(m); byId.set(x.id, m);
      } else if (x.type === "motifEnd" && byId.has(x.id)) byId.get(x.id).t1 = s.t;
    }
    xTrace *= Math.exp(-dt / M.SURPRISE_DECAY);
    if (lastRoll < 0 || s.t - lastRoll >= 0.33) { p = M.rollouts(s, false).p; U = M.entropy(p); lastRoll = s.t; }
    const k = Math.min(1, dt / 0.25);
    Ud += (U - Ud) * k; pS += (p - pS) * k;
    if (lastSample < 0 || s.t - lastSample >= 1 / HZ) {
      const sdt = lastSample < 0 ? 1 / HZ : s.t - lastSample;
      lastSample = s.t;
      const Sn = M.stakesN(s), Th = M.threatOf(s), T = M.tensionOf(Sn, Th, Ud);
      const bank = rule === "checkpoint" ? s.bankZone : 0;
      // Left 4 Dead-style intensity: jumps on damage, builds while enemies are close, decays over time.
      let raw = 0;
      for (const en of s.en) { const d = Math.hypot(s.pl.x - en.x, s.pl.y - en.y); raw += Math.exp(-Math.max(0, d - 17) / 55); }
      const nearP = 1 - Math.exp(-raw / 1.2);
      I4 = clamp(I4 + 0.25 * hitsPending + (0.25 * nearP - 0.35 * I4) * sdt, 0, 1);
      hitsPending = 0;
      S.t.push(s.t); S.P.push(M.progress(s)); S.Sraw.push(M.progress(s) - bank + 0.25); S.Sn.push(Sn);
      S.Th.push(Th); S.U.push(Ud); S.T.push(T); S.p.push(pS); S.I4.push(I4); S.X.push(xTrace); S.V.push(M.voicesOf(s));
    }
  }
  for (const m of motifs) if (m.t1 == null) m.t1 = s.t;
  const n = S.t.length;
  // Ely-style suspense: stakes x spread of the next belief update. Surprise: stakes x how far belief moved in the last second.
  S.ES = S.Sn.map((sn, i) => sn * 2 * Math.sqrt(S.p[i] * (1 - S.p[i])));
  S.SU = S.Sn.map((sn, i) => i < HZ ? 0 : clamp(sn * Math.abs(S.p[i] - S.p[i - HZ]) * 2, 0, 1));
  // Suspensions, same rule as the live page.
  const susp = []; let cur = null, hi = 0;
  const hits = ev.filter(x => x.kind === "hit").map(x => x.t);
  for (let i = 0; i < n; i++) {
    const t = S.t[i];
    let hitNow = false;
    while (hi < hits.length && hits[hi] <= t) { hitNow = true; hi++; }
    if (cur) {
      if (hitNow) { susp.push({ t0: cur.t0, t1: t, outcome: "broken" }); cur = null; continue; }
      if (S.P[i] - cur.P0 >= 0.15) { susp.push({ t0: cur.t0, t1: t, outcome: "res" }); cur = null; }
      else if (S.T[i] < 0.18 || t - cur.t0 > 10) { susp.push({ t0: cur.t0, t1: t, outcome: "faded" }); cur = null; }
    } else if (i > 20) {
      const dP = S.P[i] - S.P[i - 21];
      let thMin = Infinity; for (let j = i - 21; j <= i; j++) thMin = Math.min(thMin, S.Th[j]);
      if (dP >= 0 && dP < 0.05 && S.Th[i] - thMin > 0.15 && S.T[i] > 0.35) cur = { t0: t, P0: S.P[i] };
    }
  }
  return { rule, seed, S, ev, susp, motifs, deaths: s.deaths, maxZone: s.maxZone + 1 };
}

function acf(x, maxLag) {
  const n = x.length, m = mean(x);
  const d = x.map(v => v - m); let v = 0; for (const q of d) v += q * q;
  const out = [];
  for (let L = 0; L <= maxLag; L++) { let a = 0; for (let i = 0; i + L < n; i++) a += d[i] * d[i + L]; out.push(v ? a / v * n / (n - L) : 0); }
  return out;
}
function firstPeak(r, minLag) {
  let L0 = 1; while (L0 < r.length - 1 && r[L0] > 0) L0++;
  let best = 0, bestR = 0.1;
  for (let L = Math.max(L0, minLag); L < r.length - 1; L++) if (r[L] > bestR && r[L] >= r[L - 1] && r[L] >= r[L + 1]) { bestR = r[L]; best = L; }
  return best ? { lag: best / HZ, r: r3(bestR) } : null;
}
function pearson(a, b) {
  const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { const x = a[i] - ma, y = b[i] - mb; sab += x * y; saa += x * x; sbb += y * y; }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}
function crossLag(a, b, maxLag) {
  // Positive lag: b follows a.
  let best = { lag: 0, r: -2 };
  for (let L = -maxLag; L <= maxLag; L++) {
    const xa = [], xb = [];
    for (let i = Math.max(0, -L); i < a.length && i + L < b.length; i++) { xa.push(a[i]); xb.push(b[i + L]); }
    const r = pearson(xa, xb);
    if (r > best.r) best = { lag: L / HZ, r };
  }
  return { lag: best.lag, r: r3(best.r) };
}
// How predictable the motif sequence is: conditional entropy of the next motif given the previous one, and surprisal early vs late.
function seqStats(sessions) {
  const c1 = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], early = [], late = [];
  for (const ss of sessions) { let prev = -1; for (const m of ss.motifs) { if (prev >= 0) c1[prev][m.ti]++; prev = m.ti; (m.t < 180 ? early : late).push(m.bits); } }
  let Hc = 0, N = 0;
  for (const row of c1) { const tot = row.reduce((a, b) => a + b, 0); N += tot; for (const c of row) if (c) Hc -= c * Math.log2(c / tot); }
  return { condEntropy: r3(Hc / (N || 1)), maxEntropy: 2, surprisalEarly: r3(mean(early)), surprisalLate: r3(mean(late)), launches: N + sessions.length };
}
// Mean surprisal by launch number across sessions, smoothed: the model's learning curve.
function surprisalCurve(sessions, N, win) {
  const out = [];
  for (let i = 0; i < N; i++) {
    const v = [];
    for (const ss of sessions) for (let j = Math.max(0, i - win); j <= i + win; j++) if (ss.motifs[j]) v.push(ss.motifs[j].bits);
    out.push(v.length ? r3(mean(v)) : null);
  }
  return out;
}
function quantiles(vals) { const s = [...vals].sort((x, y) => x - y), q = f => s[Math.min(s.length - 1, Math.floor(f * (s.length - 1)))]; return [q(0.25), q(0.5), q(0.75)]; }
function nearestIdx(ts, t) { let lo = 0, hi = ts.length - 1; while (lo < hi) { const m = (lo + hi) >> 1; if (ts[m] < t) lo = m + 1; else hi = m; } return lo; }

const MODES = { checkpoint: [11, 12, 13], permadeath: [21, 22, 23] };
const DYN = [0.15, 0.3, 0.45, 0.6, 0.75, 9];
const out = { generated: new Date().toISOString(), secondsPerSession: SECS, hz: HZ, seeds: MODES, modes: {} };

for (const [rule, seeds] of Object.entries(MODES)) {
  const t0 = Date.now();
  const sessions = seeds.map(seed => runSession(rule, seed));
  const all = k => sessions.flatMap(x => x.S[k]);
  const T = all("T"), ES = all("ES");
  const esMean = mean(ES);
  const susp = sessions.flatMap(x => x.susp);
  const deaths = sessions.reduce((a, x) => a + x.deaths, 0);

  // Dominant tension cycle from the averaged autocorrelation.
  const acfs = sessions.map(x => acf(x.S.T, 60 * HZ));
  const acfMean = acfs[0].map((_, i) => mean(acfs.map(a => a[i])));

  // Score excerpt: 90 s before and 30 s after the first death that leaves room on both sides.
  const s0 = sessions[0];
  const d = s0.ev.find(x => x.kind === "death" && x.t >= 95 && x.t + 30 <= SECS);
  const w0 = d ? d.t - 90 : 200, w1 = w0 + 120;
  const i0 = nearestIdx(s0.S.t, w0), i1 = nearestIdx(s0.S.t, w1);
  const pick = k => s0.S[k].slice(i0, i1).map(r3);
  const excerpt = {
    t: s0.S.t.slice(i0, i1).map(t => r3(t - w0)),
    P: pick("P"), T: pick("T"), Sn: pick("Sn"), Th: pick("Th"), U: pick("U"), ES: pick("ES"), SU: pick("SU"), I4: pick("I4"), X: pick("X"), V: pick("V"),
    motifs: s0.motifs.filter(m => m.t1 >= w0 && m.t < w1).map(m => ({ t0: r3(m.t - w0), t1: r3(m.t1 - w0), ti: m.ti, n: m.n, varied: m.varied, violation: m.violation, bits: r3(m.bits) })),
    events: s0.ev.filter(x => x.t >= w0 && x.t < w1 && x.kind !== "hit").map(x => ({ t: r3(x.t - w0), kind: x.kind, lost: x.lost != null ? r3(x.lost) : undefined })),
    hits: s0.ev.filter(x => x.t >= w0 && x.t < w1 && x.kind === "hit").map(x => r3(x.t - w0)),
    susp: s0.susp.filter(x => x.t1 >= w0 && x.t0 < w1).map(x => ({ t0: r3(Math.max(0, x.t0 - w0)), t1: r3(Math.min(120, x.t1 - w0)), outcome: x.outcome })),
    sessionStart: r3(w0)
  };

  // Event-locked averages, 10 s either side.
  const locked = {};
  for (const kind of ["gate", "bank", "hit", "death"]) {
    const wins = [];
    for (const ss of sessions) for (const e of ss.ev) {
      if (e.kind !== kind || e.t < 10 || e.t > SECS - 10) continue;
      const c = nearestIdx(ss.S.t, e.t);
      if (c - 100 < 0 || c + 100 >= ss.S.t.length) continue;
      wins.push({ ss, c });
    }
    if (!wins.length) continue;
    const res = { n: wins.length };
    for (const k of ["T", "Sn", "Th", "U"]) {
      const m = [], q1 = [], q3 = [];
      for (let o = -100; o <= 100; o++) {
        const vals = wins.map(w => w.ss.S[k][w.c + o]);
        const q = quantiles(vals);
        m.push(r3(mean(vals))); q1.push(r3(q[0])); q3.push(r3(q[2]));
      }
      res[k] = { mean: m, q1, q3 };
    }
    locked[kind] = res;
  }

  // Phase portrait points and one trajectory.
  const pts = [];
  const stride = Math.max(1, Math.floor(T.length / 4000));
  for (const ss of sessions) for (let i = 0; i < ss.S.t.length; i += stride) pts.push([r3(ss.S.Th[i]), r3(ss.S.U[i]), r3(ss.S.Sn[i])]);
  let trajectory = null;
  if (d) {
    // 1-second steps, each averaged over a second, ending on the last sample before the death.
    const a = nearestIdx(s0.S.t, d.t - 25), b = nearestIdx(s0.S.t, d.t) - 1;
    trajectory = [];
    const push = i => {
      const lo = Math.max(a, i - 5), hi = Math.min(b, i + 5);
      trajectory.push([r3(mean(s0.S.Th.slice(lo, hi + 1))), r3(mean(s0.S.U.slice(lo, hi + 1))), r3(s0.S.t[i] - d.t)]);
    };
    for (let i = a; i < b; i += HZ) push(i);
    push(b);
  }

  // Histograms of time spent at each level.
  const hist = {};
  for (const k of ["T", "Sn", "Th", "U"]) {
    const v = all(k), b = new Array(20).fill(0);
    for (const x of v) b[Math.min(19, Math.floor(x * 20))]++;
    hist[k] = b.map(c => r3(c / v.length));
  }

  // Stakes over one full session, 1 Hz.
  const stakesRun = {
    Sn: s0.S.Sn.filter((_, i) => i % HZ === 0).map(r3),
    P: s0.S.P.filter((_, i) => i % HZ === 0).map(r3),
    deaths: s0.ev.filter(x => x.kind === "death").map(x => r3(x.t)),
    banks: s0.ev.filter(x => x.kind === "bank").map(x => r3(x.t))
  };

  // ---------- Motifs: establishment, frequency, concurrency, expectation ----------
  const meanOver = (ss, k, a, b) => { const i = nearestIdx(ss.S.t, a), j = nearestIdx(ss.S.t, b); return j > i ? mean(ss.S[k].slice(i, j)) : ss.S[k][i]; };
  const NB = 10;
  const motifStats = [0, 1, 2, 3].map(ti => {
    const all = sessions.flatMap(ss => ss.motifs.filter(m => m.ti === ti).map(m => Object.assign({ ss }, m)));
    const gaps = [];
    for (const ss of sessions) { const ts = ss.motifs.filter(m => m.ti === ti).map(m => m.t); for (let i = 1; i < ts.length; i++) gaps.push(ts[i] - ts[i - 1]); }
    gaps.sort((a, b) => a - b);
    const est = Array.from({ length: NB }, () => ({ T: [], hits: [] }));
    for (const m of all) { const b = Math.min(NB, m.n) - 1; est[b].T.push(meanOver(m.ss, "T", m.t, m.t1)); est[b].hits.push(m.hits); }
    const first = sessions[0].motifs.find(m => m.ti === ti);
    return {
      launches: all.length, per10: r3(all.length / (sessions.length * SECS / 600)),
      firstHeard: first ? r3(first.t) : null, medianGap: gaps.length ? r3(gaps[Math.floor(gaps.length / 2)]) : null,
      variedShare: r3(all.filter(m => m.varied).length / (all.length || 1)), combinedShare: r3(all.filter(m => m.together > 1).length / (all.length || 1)),
      hitsPerAppearance: r3(mean(all.map(m => m.hits))), meanDur: r3(mean(all.map(m => m.t1 - m.t))),
      establishment: est.map(e => ({ n: e.T.length, T: e.T.length ? r3(mean(e.T)) : null, hits: e.hits.length ? r3(mean(e.hits)) : null }))
    };
  });
  const vShare = [0, 0, 0, 0, 0], vT = [[], [], [], [], []];
  for (const ss of sessions) for (let i = 0; i < ss.S.t.length; i++) { const v = ss.S.V[i]; vShare[v]++; vT[v].push(ss.S.T[i]); }
  const vTot = vShare.reduce((a, b) => a + b, 0);
  const voices = { share: vShare.map(c => r3(c / vTot)), meanT: vT.map(a => a.length ? r3(mean(a)) : null), meanThreat: null };
  // Tension around a motif's start: first or second hearing against fourth or later.
  const lockMotif = filter => {
    const wins = [];
    for (const ss of sessions) for (const m of ss.motifs) {
      if (!filter(m) || m.t < 5 || m.t > SECS - 10) continue;
      const c = nearestIdx(ss.S.t, m.t); if (c - 50 < 0 || c + 100 >= ss.S.t.length) continue;
      wins.push({ ss, c });
    }
    const out = { n: wins.length, T: [], X: [] };
    for (let o = -50; o <= 100; o++) { out.T.push(r3(mean(wins.map(w => w.ss.S.T[w.c + o])))); out.X.push(r3(mean(wins.map(w => w.ss.S.X[w.c + o])))); }
    return out;
  };
  const novelty = { fresh: lockMotif(m => m.n <= 2), familiar: lockMotif(m => m.n >= 4) };
  const sequence = seqStats(sessions);
  // Broken patterns against kept ones (single-motif slots only, so layering does not confound it).
  const isKept = m => m.slot >= 0 && !m.violation && m.together === 1, isBroken = m => m.violation && m.together === 1;
  const allM = sessions.flatMap(ss => ss.motifs);
  const violations = {
    broken: lockMotif(isBroken), kept: lockMotif(isKept),
    brokenBits: r3(mean(allM.filter(isBroken).map(m => m.bits))), keptBits: r3(mean(allM.filter(isKept).map(m => m.bits))),
    nextBits: r3(mean(sessions.flatMap(ss => ss.motifs.map((m, i) => (i > 0 && isBroken(ss.motifs[i - 1]) ? m.bits : null)).filter(v => v != null)))),
    brokenHits: r3(mean(allM.filter(isBroken).map(m => m.hits))), keptHits: r3(mean(allM.filter(isKept).map(m => m.hits)))
  };
  const curve = surprisalCurve(sessions, 160, 6);

  // Our tension against the established measures.
  const keys = ["T", "ES", "SU", "I4", "Th", "U", "Sn", "X", "V"];
  const cols = Object.fromEntries(keys.map(k => [k, all(k)]));
  const corr = keys.map(a => keys.map(b => r3(pearson(cols[a], cols[b]))));
  const lags = {};
  for (const k of ["ES", "SU", "I4", "X", "V"]) {
    const per = sessions.map(ss => crossLag(ss.S.T, ss.S[k], 50));
    lags[k] = { lag: r3(mean(per.map(x => x.lag))), r: r3(mean(per.map(x => x.r))) };
  }
  let anticip = 0, after = 0;
  for (let i = 0; i < T.length; i++) { if (T[i] >= 0.5 && cols.I4[i] < 0.25) anticip++; if (cols.I4[i] >= 0.5 && T[i] < 0.25) after++; }

  const dyn = DYN.map((th, i) => r3(T.filter(v => v < th && v >= (DYN[i - 1] || 0)).length / T.length));
  out.modes[rule] = {
    summary: {
      sessions: sessions.length, minutes: r3(sessions.length * SECS / 60), deaths,
      deathsPer10: r3(deaths / (sessions.length * SECS / 600)),
      maxZone: Math.max(...sessions.map(x => x.maxZone)),
      lostPerDeath: r3(mean(sessions.flatMap(x => x.ev.filter(e => e.kind === "death").map(e => e.lost)))),
      hitsPer10: r3(sessions.flatMap(x => x.ev.filter(e => e.kind === "hit")).length / (sessions.length * SECS / 600)),
      meanT: r3(mean(T)), meanSn: r3(mean(all("Sn"))), meanTh: r3(mean(all("Th"))), meanU: r3(mean(all("U"))),
      loudShare: r3(T.filter(v => v >= 0.45).length / T.length),
      dyn,
      highLeverage: r3(ES.filter(v => v / esMean > 2).length / ES.length),
      suspensions: susp.length,
      suspOutcomes: { res: susp.filter(x => x.outcome === "res").length, broken: susp.filter(x => x.outcome === "broken").length, faded: susp.filter(x => x.outcome === "faded").length },
      cycle: firstPeak(acfMean, 30)
    },
    excerpt, locked, phase: { pts, trajectory }, hist, stakesRun,
    acf: acfMean.map(r3),
    motifs: { stats: motifStats, voices, novelty, sequence, violations, curve },
    comparison: { keys, corr, lags, anticipShare: r3(anticip / T.length), aftermathShare: r3(after / T.length), esMean: r3(esMean) }
  };
  console.log(`${rule}: ${sessions.length} sessions in ${((Date.now() - t0) / 1000).toFixed(0)} s`);
  console.log(JSON.stringify(out.modes[rule].summary));
  console.log("corr row T:", keys.map((k, i) => `${k}=${corr[0][i]}`).join(" "), "| lags vs T:", JSON.stringify(lags), "| anticipation", r3(anticip / T.length), "aftermath", r3(after / T.length));
  console.log("locked n:", Object.fromEntries(Object.entries(locked).map(([k, v]) => [k, v.n])));
  console.log("motifs:", motifStats.map((m, i) => `${"ABCD"[i]} n=${m.launches} first=${m.firstHeard}s gap=${m.medianGap}s varied=${m.variedShare} combined=${m.combinedShare} hits/app=${m.hitsPerAppearance} T by appearance=${m.establishment.map(e => e.T).join("/")}`).join("\n        "));
  console.log("voices share", voices.share.join("/"), "meanT by voices", voices.meanT.join("/"), "| sequence", JSON.stringify(sequence), "| novelty n", novelty.fresh.n, novelty.familiar.n);
  console.log("violations:", JSON.stringify({ nBroken: violations.broken.n, nKept: violations.kept.n, brokenBits: violations.brokenBits, keptBits: violations.keptBits, nextBits: violations.nextBits, brokenHits: violations.brokenHits, keptHits: violations.keptHits }), "| tension cycle", JSON.stringify(out.modes[rule].summary.cycle));
}

// Comparison: the same game with motifs in random order (checkpoints only).
{
  const sessions = [31, 32, 33].map(seed => runSession("checkpoint", seed, "random"));
  const acfs = sessions.map(x => acf(x.S.T, 60 * HZ));
  const acfMean = acfs[0].map((_, i) => mean(acfs.map(a => a[i])));
  const vShare = [0, 0, 0, 0, 0];
  for (const ss of sessions) for (const v of ss.S.V) vShare[v]++;
  const vTot = vShare.reduce((a, b) => a + b, 0);
  out.randomCompare = {
    seeds: [31, 32, 33], sequence: seqStats(sessions), curve: surprisalCurve(sessions, 160, 6),
    acf: acfMean.map(r3), cycle: firstPeak(acfMean, 30), meanT: r3(mean(sessions.flatMap(x => x.S.T))),
    deathsPer10: r3(sessions.reduce((a, x) => a + x.deaths, 0) / (sessions.length * SECS / 600)), voicesShare: vShare.map(c => r3(c / vTot))
  };
  console.log("random composition:", JSON.stringify({ sequence: out.randomCompare.sequence, cycle: out.randomCompare.cycle, meanT: out.randomCompare.meanT, deathsPer10: out.randomCompare.deathsPer10 }));
}
fs.mkdirSync(path.join(ROOT, "data"), { recursive: true });
const file = path.join(ROOT, "data", "arena-analysis.json");
fs.writeFileSync(file, JSON.stringify(out));
console.log(`wrote ${file} (${(fs.statSync(file).size / 1024).toFixed(0)} KB)`);
