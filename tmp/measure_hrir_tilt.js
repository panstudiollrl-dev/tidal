#!/usr/bin/env node
/**
 * 量 assets/hrir/ 這批 IR 的**方向平均**振幅響應，然後設計一組 biquad 反向修正。
 *
 * 為什麼要做這件事（Pan 2026-08-04 回饋）：
 *   「這些聲音跟我當時阿朗壹海岸錄音的頻帶差很多，這個版本的模仿海浪的白噪音很假」
 * 上一版用的是**每層一個寬頻補償倍數**（SPATIAL_MAKEUP）。那只能把「該層頻帶的中位
 * 能量」拉回 0dB，帶**內**的斜率完全沒動。這批 IR 從 220Hz 到 7kHz 之間有 26dB 的
 * 上斜，所以任何寬頻噪音過去都會被削掉低頻、抬高嘶聲——正好是「白噪音很假」。
 *
 * 反向修正的做法：在每個 HrirSource 的卷積**之後**串一組固定的 biquad，逼近方向平均
 * 響應的倒數。左右耳乘同一條濾波器 ⇒ ILD / ITD 完全不受影響（那是方向感的來源）。
 *
 * 用法：node tmp/measure_hrir_tilt.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HRIR = path.join(ROOT, "assets", "hrir");
const manifest = JSON.parse(fs.readFileSync(path.join(HRIR, "manifest.json"), "utf8"));

function readIr(p) {
  const raw = fs.readFileSync(p);
  let o = 12, fmt = null, data = null;
  while (o + 8 <= raw.length) {
    const cid = raw.toString("latin1", o, o + 4);
    const sz = raw.readUInt32LE(o + 4);
    if (cid === "fmt ") fmt = raw.subarray(o + 8, o + 8 + sz);
    else if (cid === "data") data = raw.subarray(o + 8, o + 8 + sz);
    o += 8 + sz + (sz & 1);
  }
  const ch = fmt.readUInt16LE(2), sr = fmt.readUInt32LE(4);
  const n = data.length / 4;
  const chans = Array.from({ length: ch }, () => []);
  for (let i = 0; i < n; i++) chans[i % ch].push(data.readFloatLE(i * 4));
  return { sr, chans };
}

// 跟 index.html 裡完全一樣的 per-IR 增益（HRIR_MATCH / max(L2 norm, HRIR_MIN_NORM)）
const src = fs.readFileSync(path.join(ROOT, "web", "index.html"), "utf8");
const HRIR_MATCH = Number(src.match(/const HRIR_MATCH = ([\d.]+)/)[1]);
const HRIR_MIN_NORM = Number(src.match(/const HRIR_MIN_NORM = ([\d.]+)/)[1]);
console.log(`從 index.html 抽出：HRIR_MATCH=${HRIR_MATCH} HRIR_MIN_NORM=${HRIR_MIN_NORM}\n`);

const irs = manifest.map(e => {
  const r = readIr(path.join(HRIR, e.name));
  let sum = 0;
  for (const d of r.chans) for (const v of d) sum += v * v;
  const norm = Math.sqrt(sum / r.chans.length);
  return { r, gain: HRIR_MATCH / Math.max(norm, HRIR_MIN_NORM) };
});
const SR = irs[0].r.sr;

// 方向平均的功率響應（功率平均而非振幅平均：噪音層是不相關的能量，功率才是聽到的量）
function avgPowerAt(f) {
  const w = 2 * Math.PI * f / SR;
  let tot = 0, n = 0;
  for (const { r, gain } of irs) {
    for (const d of r.chans) {
      let re = 0, im = 0;
      for (let i = 0; i < d.length; i++) { re += d[i] * Math.cos(w * i); im -= d[i] * Math.sin(w * i); }
      tot += (re * re + im * im) * gain * gain; n++;
    }
  }
  return tot / n;
}

// 對數頻率格點：20Hz–16kHz
const GRID = [];
for (let k = 0; k <= 60; k++) GRID.push(20 * Math.pow(16000 / 20, k / 60));
const measured = GRID.map(f => ({ f, db: 10 * Math.log10(avgPowerAt(f)) }));

console.log("方向平均響應（含 per-IR 正規化增益）：");
for (const m of measured) {
  if (m.f < 40 || m.f > 12000) continue;
  const bar = "#".repeat(Math.max(0, Math.round(m.db + 26)));
  console.log(`  ${m.f.toFixed(0).padStart(6)}Hz ${m.db.toFixed(1).padStart(7)}dB ${bar}`);
}

// ── biquad 響應（Web Audio 的 BiquadFilterNode 公式，RBJ cookbook）──
function biquadCoef(type, f0, Q, gainDb) {
  const w0 = 2 * Math.PI * f0 / SR, cw = Math.cos(w0), sw = Math.sin(w0);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === "peaking") {
    const alpha = sw / (2 * Q);
    b0 = 1 + alpha * A; b1 = -2 * cw; b2 = 1 - alpha * A;
    a0 = 1 + alpha / A; a1 = -2 * cw; a2 = 1 - alpha / A;
  } else if (type === "lowshelf") {
    const alpha = sw / 2 * Math.sqrt((A + 1 / A) * (1 / Q - 2) + 2);
    const t = 2 * Math.sqrt(A) * alpha;
    b0 = A * ((A + 1) - (A - 1) * cw + t);
    b1 = 2 * A * ((A - 1) - (A + 1) * cw);
    b2 = A * ((A + 1) - (A - 1) * cw - t);
    a0 = (A + 1) + (A - 1) * cw + t;
    a1 = -2 * ((A - 1) + (A + 1) * cw);
    a2 = (A + 1) + (A - 1) * cw - t;
  } else if (type === "highshelf") {
    const alpha = sw / 2 * Math.sqrt((A + 1 / A) * (1 / Q - 2) + 2);
    const t = 2 * Math.sqrt(A) * alpha;
    b0 = A * ((A + 1) + (A - 1) * cw + t);
    b1 = -2 * A * ((A - 1) + (A + 1) * cw);
    b2 = A * ((A + 1) + (A - 1) * cw - t);
    a0 = (A + 1) - (A - 1) * cw + t;
    a1 = 2 * ((A - 1) - (A + 1) * cw);
    a2 = (A + 1) - (A - 1) * cw - t;
  } else throw new Error("type? " + type);
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function biquadDb([b0, b1, b2, a1, a2], f) {
  const w = 2 * Math.PI * f / SR;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
  const dr = 1 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

// ── 擬合：一組固定的 biquad，逼近 −measured（座標下降，夠用且結果可讀）──
// 目標只到 12kHz：更高的地方海景本來就沒能量（阿朗壹 6k+ 約 0%），不值得為它犧牲精度。
const FIT = measured.filter(m => m.f >= 40 && m.f <= 12000);
// 段落選得對應阿朗壹的頻帶結構：sub / 低中 / 中 / 高中 / 高
const stages = [
  { type: "lowshelf",  f0: 200,  Q: 0.7, gain: 18 },
  { type: "peaking",   f0: 420,  Q: 0.8, gain: 10 },
  { type: "peaking",   f0: 900,  Q: 0.9, gain: 5 },
  { type: "peaking",   f0: 2000, Q: 1.0, gain: 0 },
  { type: "highshelf", f0: 4000, Q: 0.7, gain: -3 },
];
const chainDb = (st, f) => st.reduce((s, x) => s + biquadDb(biquadCoef(x.type, x.f0, x.Q, x.gain), f), 0);
function cost(st) {
  // 只在意**形狀**：整體音量另外用一個 trim 處理，所以先扣掉平均誤差
  const errs = FIT.map(m => chainDb(st, m.f) + m.db);
  const mean = errs.reduce((a, b) => a + b, 0) / errs.length;
  // 用最大絕對誤差 + 均方，避免只有平均漂亮但某一段歪很多
  const dev = errs.map(e => e - mean);
  return Math.max(...dev.map(Math.abs)) + Math.sqrt(dev.reduce((a, b) => a + b * b, 0) / dev.length);
}
let best = stages.map(s => ({ ...s })), bestC = cost(best);
for (let round = 0; round < 400; round++) {
  const scale = Math.pow(0.94, round);
  let improved = false;
  for (let i = 0; i < best.length; i++) {
    for (const key of ["f0", "Q", "gain"]) {
      for (const dir of [1, -1]) {
        const step = (key === "f0" ? best[i].f0 * 0.08 : key === "Q" ? 0.08 : 0.7) * scale * dir;
        const trial = best.map(s => ({ ...s }));
        trial[i][key] += step;
        if (trial[i].Q < 0.25 || trial[i].Q > 3) continue;
        if (trial[i].f0 < 40 || trial[i].f0 > 14000) continue;
        if (Math.abs(trial[i].gain) > 26) continue;
        const c = cost(trial);
        if (c < bestC - 1e-9) { best = trial; bestC = c; improved = true; }
      }
    }
  }
  if (!improved && scale < 0.02) break;
}
// trim：擬合後把整體音量對回 0dB（用能量加權的平均誤差，權重照阿朗壹的頻帶分布）
const W = [[20, 120, 0.21], [120, 500, 0.37], [500, 2000, 0.34], [2000, 6000, 0.013]];
let num = 0, den = 0;
for (const [f0, f1, w] of W) {
  const pts = FIT.filter(m => m.f >= f0 && m.f < f1);
  if (!pts.length) continue;
  const e = pts.reduce((s, m) => s + (chainDb(best, m.f) + m.db), 0) / pts.length;
  num += e * w; den += w;
}
const trimDb = -(num / den);

console.log("\n擬合出的修正鏈（Web Audio BiquadFilterNode）：");
for (const s of best) {
  console.log(`  { type: "${s.type}", f: ${s.f0.toFixed(0)}, Q: ${s.Q.toFixed(2)}, gain: ${s.gain.toFixed(1)} },`);
}
console.log(`  整體 trim: ${trimDb.toFixed(2)} dB  →  線性 ${Math.pow(10, trimDb / 20).toFixed(3)}`);

console.log("\n修正後的殘差（HRIR + 修正鏈，越接近 0 越平）：");
let worst = 0;
for (const m of FIT) {
  const r = chainDb(best, m.f) + m.db + trimDb;
  worst = Math.max(worst, Math.abs(r));
  if (m.f < 50) continue;
  const n = Math.round(Math.abs(r) * 2);
  console.log(`  ${m.f.toFixed(0).padStart(6)}Hz  修正前 ${m.db.toFixed(1).padStart(6)}dB  修正後 ${r.toFixed(1).padStart(6)}dB  ${(r >= 0 ? "+" : "-").repeat(Math.min(n, 40))}`);
}
console.log(`\n最大殘差 ${worst.toFixed(1)}dB（修正前的落差是 ${(Math.max(...FIT.map(m => m.db)) - Math.min(...FIT.map(m => m.db))).toFixed(1)}dB）`);

// 分頻帶總結：直接對照阿朗壹的能量分布
console.log("\n頻帶能量（相對，白噪音輸入）：");
const bandE = (fn) => {
  const out = {};
  for (const [f0, f1] of [[20, 120], [120, 500], [500, 2000], [2000, 6000], [6000, 16000]]) {
    let s = 0, n = 0;
    for (let k = 0; k <= 24; k++) {
      const f = f0 * Math.pow(f1 / f0, k / 24);
      s += Math.pow(10, fn(f) / 10) * f; n++;      // ×f ＝ 對數格點的等效頻寬
    }
    out[`${f0}-${f1}`] = s / n;
  }
  const tot = Object.values(out).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(out)) out[k] = out[k] / tot * 100;
  return out;
};
const interp = (f) => {
  let lo = measured[0], hi = measured[measured.length - 1];
  for (let i = 1; i < measured.length; i++) if (measured[i].f >= f) { hi = measured[i]; lo = measured[i - 1]; break; }
  const t = (Math.log(f) - Math.log(lo.f)) / (Math.log(hi.f) - Math.log(lo.f));
  return lo.db + t * (hi.db - lo.db);
};
const before = bandE(f => interp(f));
const after = bandE(f => interp(f) + chainDb(best, f) + trimDb);
console.log("  頻帶            修正前    修正後   （平坦輸入應為）");
const flat = bandE(() => 0);
for (const k of Object.keys(before)) {
  console.log(`  ${k.padEnd(12)} ${before[k].toFixed(1).padStart(6)}% ${after[k].toFixed(1).padStart(8)}% ${flat[k].toFixed(1).padStart(10)}%`);
}
