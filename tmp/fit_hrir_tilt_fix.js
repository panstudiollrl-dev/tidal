#!/usr/bin/env node
/**
 * 定案「HRIR 傾斜修正鏈」的係數，並重算修正後各層還需要多少 makeup。
 *
 * 背景（Pan 2026-08-04 回饋）：
 *   「這些聲音跟我當時阿朗壹海岸錄音的頻帶差很多，這個版本的模仿海浪的白噪音很假」
 *
 * 診斷：assets/hrir/ 這批 IR 的**方向平均**響應從 208Hz 到 7.3kHz 有 26.7dB 的上斜
 * （208Hz −23.7dB、7.3kHz +3.0dB）。阿朗壹的指紋剛好相反（centroid 428Hz、2–6kHz 只
 * 佔 1.3%、6k+ ≈0%）。上一版用「每層一個寬頻倍數」(SPATIAL_MAKEUP) 補償，那只能把該層
 * 頻帶的**中位**能量拉回 0dB，帶內斜率完全沒動——寬頻噪音過去照樣被削低頻、抬嘶聲。
 *
 * 修正：在卷積**之後**串一組固定 biquad 逼近方向平均響應的倒數。左右耳乘同一條 ⇒
 * ILD / ITD（方向感的來源）完全不受影響。
 *
 * 這支腳本做三件事：
 *   [A] 用「好看好記」的固定 f / Q，只解增益，印出定案係數與殘差
 *   [B] 重算修正後每層還剩多少帶內誤差 ＝ 新的 SPATIAL_MAKEUP
 *   [C] 模擬整個引擎的輸出頻帶分布，跟阿朗壹的指紋對照
 *
 * 用法：node tmp/fit_hrir_tilt_fix.js
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

const src = fs.readFileSync(path.join(ROOT, "web", "index.html"), "utf8");
const HRIR_MATCH = Number(src.match(/const HRIR_MATCH = ([\d.]+)/)[1]);
const HRIR_MIN_NORM = Number(src.match(/const HRIR_MIN_NORM = ([\d.]+)/)[1]);

const irs = manifest.map(e => {
  const r = readIr(path.join(HRIR, e.name));
  let sum = 0;
  for (const d of r.chans) for (const v of d) sum += v * v;
  const norm = Math.sqrt(sum / r.chans.length);
  return { r, gain: HRIR_MATCH / Math.max(norm, HRIR_MIN_NORM) };
});
const SR = irs[0].r.sr;

const avgDbAt = (f) => {
  const w = 2 * Math.PI * f / SR;
  let tot = 0, n = 0;
  for (const { r, gain } of irs) for (const d of r.chans) {
    let re = 0, im = 0;
    for (let i = 0; i < d.length; i++) { re += d[i] * Math.cos(w * i); im -= d[i] * Math.sin(w * i); }
    tot += (re * re + im * im) * gain * gain; n++;
  }
  return 10 * Math.log10(tot / n);
};

// 快取一個對數頻率格點，之後全部用內插（每點都跑 90×2 個 DFT 很貴）
const GRID = [];
for (let k = 0; k <= 240; k++) GRID.push(20 * Math.pow(20000 / 20, k / 240));
const HRIR_DB = GRID.map(f => ({ f, db: avgDbAt(f) }));
const hrirDb = (f) => {
  if (f <= GRID[0]) return HRIR_DB[0].db;
  if (f >= GRID[GRID.length - 1]) return HRIR_DB[HRIR_DB.length - 1].db;
  let i = 1;
  while (HRIR_DB[i].f < f) i++;
  const lo = HRIR_DB[i - 1], hi = HRIR_DB[i];
  const t = (Math.log(f) - Math.log(lo.f)) / (Math.log(hi.f) - Math.log(lo.f));
  return lo.db + t * (hi.db - lo.db);
};

// ── Web Audio BiquadFilterNode 的響應（RBJ cookbook，跟瀏覽器同一組公式）──
function coef(type, f0, Q, gainDb) {
  const w0 = 2 * Math.PI * f0 / SR, cw = Math.cos(w0), sw = Math.sin(w0);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === "peaking") {
    const al = sw / (2 * Q);
    b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A;
    a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
  } else if (type === "lowshelf" || type === "highshelf") {
    const al = sw / 2 * Math.sqrt((A + 1 / A) * (1 / Q - 2) + 2);
    const t = 2 * Math.sqrt(A) * al, hi = type === "highshelf" ? -1 : 1;
    b0 = A * ((A + 1) - hi * (A - 1) * cw + t);
    b1 = 2 * hi * A * ((A - 1) - hi * (A + 1) * cw);
    b2 = A * ((A + 1) - hi * (A - 1) * cw - t);
    a0 = (A + 1) + hi * (A - 1) * cw + t;
    a1 = -2 * hi * ((A - 1) + hi * (A + 1) * cw);
    a2 = (A + 1) + hi * (A - 1) * cw - t;
  } else if (type === "lowpass") {
    const al = sw / (2 * Q);
    b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
    a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
  } else if (type === "highpass") {
    const al = sw / (2 * Q);
    b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
    a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
  } else if (type === "bandpass") {
    const al = sw / (2 * Q);
    b0 = al; b1 = 0; b2 = -al;
    a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
  } else throw new Error(type);
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function bqDb([b0, b1, b2, a1, a2], f) {
  const w = 2 * Math.PI * f / SR;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
  const dr = 1 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

// ═══ [A] 定案的修正鏈：f / Q 選好記的整數，只解增益 ══════════════════════════
// 段落刻意對上阿朗壹的頻帶結構（sub / 低中 / 中）：
//   lowshelf 250Hz  ＝ 把 −20dB 的整片低頻抬回來（IR 只有 5.33ms，這是「補回可聽的量」
//                      不是「還原」——256 taps 在 60Hz 只有 0.32 個週期，物理上無法表示）
//   peaking  230Hz  ＝ 208–260Hz 那個 −23.7dB 的凹谷（最深點）
//   peaking  520Hz  ＝ 300–700Hz 的過渡段
//   highshelf 4500Hz ＝ 壓掉 +3dB 的高頻上翹（阿朗壹 6k+ 幾乎沒有能量）
const STAGES = [
  { type: "lowshelf",  f: 250,  Q: 0.5 },
  { type: "peaking",   f: 230,  Q: 0.9 },
  { type: "peaking",   f: 520,  Q: 1.3 },
  { type: "peaking",   f: 1500, Q: 1.0 },
  { type: "highshelf", f: 4500, Q: 0.5 },
];
const FITF = GRID.filter(f => f >= 45 && f <= 12000);
const chainDb = (gains, f) => STAGES.reduce((s, st, i) => s + bqDb(coef(st.type, st.f, st.Q, gains[i]), f), 0);

let gains = [18, 10, 2, -1, -3];
const shapeCost = (g) => {
  const e = FITF.map(f => chainDb(g, f) + hrirDb(f));
  const mean = e.reduce((a, b) => a + b, 0) / e.length;
  const d = e.map(x => x - mean);
  return Math.max(...d.map(Math.abs)) + Math.sqrt(d.reduce((a, b) => a + b * b, 0) / d.length);
};
let bestC = shapeCost(gains);
for (let it = 0; it < 300; it++) {
  const step = 2 * Math.pow(0.96, it);
  let moved = false;
  for (let i = 0; i < gains.length; i++) for (const d of [step, -step]) {
    const t = gains.slice(); t[i] += d;
    if (Math.abs(t[i]) > 26) continue;
    const c = shapeCost(t);
    if (c < bestC - 1e-9) { gains = t; bestC = c; moved = true; }
  }
  if (!moved && step < 0.02) break;
}
// 四捨五入到 0.1dB（要寫進碼裡的可讀常數），再算整體 trim
gains = gains.map(g => Math.round(g * 10) / 10);
// trim：用阿朗壹的頻帶權重做能量加權，把整體音量對回 0dB
const ALANGYI_W = [[20, 120, 0.209], [120, 500, 0.37], [500, 2000, 0.34], [2000, 6000, 0.013]];
let num = 0, den = 0;
for (const [f0, f1, w] of ALANGYI_W) {
  const pts = FITF.filter(f => f >= f0 && f < f1);
  if (!pts.length) continue;
  num += w * pts.reduce((s, f) => s + (chainDb(gains, f) + hrirDb(f)), 0) / pts.length;
  den += w;
}
const trimDb = Math.round(-(num / den) * 10) / 10;

console.log("═══ [A] HRIR 傾斜修正鏈（定案）═══\n");
console.log("const HRIR_TILT_FIX = [");
STAGES.forEach((st, i) => {
  console.log(`  { type: "${st.type}", f: ${st.f}, q: ${st.Q}, gain: ${gains[i].toFixed(1)} },`);
});
console.log("];");
console.log(`const HRIR_TILT_TRIM = ${Math.pow(10, trimDb / 20).toFixed(3)};   // ${trimDb.toFixed(1)}dB\n`);

const resid = FITF.map(f => chainDb(gains, f) + hrirDb(f) + trimDb);
const rawSpan = Math.max(...FITF.map(hrirDb)) - Math.min(...FITF.map(hrirDb));
console.log(`修正前 45Hz–12kHz 的落差：${rawSpan.toFixed(1)}dB`);
console.log(`修正後最大殘差：${Math.max(...resid.map(Math.abs)).toFixed(1)}dB`);
console.log("\n  頻率     修正前      修正鏈     修正後");
for (const f of [60, 100, 160, 220, 320, 450, 640, 900, 1250, 1800, 2500, 3500, 5000, 7000, 10000]) {
  const b = hrirDb(f), c = chainDb(gains, f) + trimDb;
  console.log(`  ${String(f).padStart(6)}Hz ${b.toFixed(1).padStart(7)}dB ${c.toFixed(1).padStart(9)}dB ${(b + c).toFixed(1).padStart(9)}dB`);
}

// ═══ [B] 修正後各層還剩多少帶內誤差 ＝ 新的 SPATIAL_MAKEUP ═════════════════════
// 每層用**它自己的濾波器**當權重去平均（不是矩形頻帶）——這才是那一層真正聽到的頻譜。
console.log("\n═══ [B] 修正後的 SPATIAL_MAKEUP（每層用自己的濾波器加權）═══\n");
// foam 的頂端蓋子（foamLP）是 2026-08-04 加的，這裡從碼裡讀，不要寫死——
// 寫死的話這支腳本算出來的 makeup 會對應一個「已經不存在的 foam」（本檔就漏過一次：
// 仍把 foam 當成沒有上限的 HP1500，於是給出的 0.90 比實際需要的 0.98 少了 0.8dB）。
const FOAM_LP = Number(src.match(/this\.foamLP\.frequency\.value = (\d+)/)[1]);
const LAYERS = {
  surge:  [{ type: "lowpass",  f: 800,  Q: 0.7 }],
  foam:   [{ type: "highpass", f: 1500, Q: 0.7 }, { type: "lowpass", f: FOAM_LP, Q: 0.7 }],
  pebble: [{ type: "lowpass",  f: 700,  Q: 0.6 }],
  bubble: [{ type: "bandpass", f: 320,  Q: 0.9 }],
  shore:  [{ type: "lowpass",  f: 640,  Q: 0.7 }],
};
const oldMk = new Function("return " + src.match(/const SPATIAL_MAKEUP = \{[^}]*\}/)[0].replace("const SPATIAL_MAKEUP = ", ""))();
const newMk = {};
for (const [layer, filt] of Object.entries(LAYERS)) {
  // 該層濾波器的功率權重（含濾波器本身），量「過了 HRIR+修正鏈之後」相對「沒過」的能量比
  let withHrir = 0, without = 0;
  for (let k = 0; k < GRID.length - 1; k++) {
    const f = GRID[k], bw = GRID[k + 1] - GRID[k];
    if (f < 30 || f > 16000) continue;
    const wDb = filt.reduce((s, st) => s + bqDb(coef(st.type, st.f, st.Q, 0), f), 0);
    const wP = Math.pow(10, wDb / 10) * bw;
    without += wP;
    withHrir += wP * Math.pow(10, (hrirDb(f) + chainDb(gains, f) + trimDb) / 10);
  }
  const lossDb = 10 * Math.log10(withHrir / without);
  newMk[layer] = Math.round(Math.pow(10, -lossDb / 20) * 100) / 100;
  console.log(`  ${layer.padEnd(8)} 帶內殘差 ${lossDb.toFixed(2).padStart(6)}dB  →  makeup ${newMk[layer].toFixed(2)}  （舊值 ${oldMk[layer]}）`);
}
console.log("\nconst SPATIAL_MAKEUP = { " +
  Object.entries(newMk).map(([k, v]) => `${k}: ${v.toFixed(2)}`).join(", ") + " };");

// ═══ [C] 整個引擎的輸出頻帶分布 vs 阿朗壹指紋 ═════════════════════════════════
// 阿朗壹指紋（AGENTS.md 2026-07-09 (h) 的實測紀錄，錄音本身不在 repo 裡）
const ALANGYI = { "20-120": 20.9, "120-500": 37, "500-2000": 34, "2000-6000": 1.3, "6000+": 0.2 };
console.log("\n═══ [C] 引擎輸出頻帶分布 vs 阿朗壹錄音 ═══\n");

// 各層：濾波器 × 代表音量（放鬆底床，非峰值）× 是否過 HRIR
// 音量取自 loop() 的低喚起情形（energy≈0.12、swell≈0.5、無握壓）——Pan 聽到的就是這個狀態。
function layers(mk, tiltOn, pebbleFloor, shimmerLevel) {
  const hr = (f) => tiltOn ? hrirDb(f) + chainDb(gains, f) + trimDb : hrirDb(f);
  return [
    { name: "surge",   g: 0.20, spatial: true,  mk: mk.surge,  filt: [{ type: "lowpass", f: 800, Q: 0.7 }] },
    { name: "foam",    g: 0.07, spatial: true,  mk: mk.foam,   filt: [{ type: "highpass", f: 1500, Q: 0.7 }, { type: "lowpass", f: FOAM_LP, Q: 0.7 }] },
    { name: "pebble",  g: pebbleFloor, spatial: true, mk: mk.pebble, filt: [{ type: "lowpass", f: 700, Q: 0.6 }] },
    { name: "bubble",  g: 0.05, spatial: true,  mk: mk.bubble, filt: [{ type: "bandpass", f: 320, Q: 0.9 }] },
    { name: "shore",   g: 0.06, spatial: true,  mk: mk.shore,  filt: [{ type: "lowpass", f: 640, Q: 0.7 }] },
    { name: "sub",     g: 0.14, spatial: false, mk: 1,         filt: [{ type: "lowpass", f: 110, Q: 0.4 }] },
    { name: "wide",    g: 0.10, spatial: false, mk: 1,         filt: [{ type: "lowpass", f: 520, Q: 0.7 }] },
    { name: "shimmer", g: shimmerLevel * 0.019, spatial: false, mk: 1, filt: [{ type: "lowpass", f: 1200, Q: 0.55 }] },
  ].map(L => ({ ...L, resp: (f) => {
    const fd = L.filt.reduce((s, st) => s + bqDb(coef(st.type, st.f, st.Q, 0), f), 0);
    return fd + 20 * Math.log10(L.g * L.mk) + (L.spatial ? hr(f) : 0);
  }}));
}
function bands(mk, tiltOn, pebbleFloor, shimmerLevel) {
  const Ls = layers(mk, tiltOn, pebbleFloor, shimmerLevel);
  const B = { "20-120": [20, 120], "120-500": [120, 500], "500-2000": [500, 2000], "2000-6000": [2000, 6000], "6000+": [6000, 16000] };
  const out = {}; let tot = 0; let num = 0, den = 0;
  for (const [k, [f0, f1]] of Object.entries(B)) {
    let p = 0;
    for (let i = 0; i < GRID.length - 1; i++) {
      const f = GRID[i], bw = GRID[i + 1] - GRID[i];
      if (f < f0 || f >= f1) continue;
      const e = Ls.reduce((s, L) => s + Math.pow(10, L.resp(f) / 10), 0) * bw;
      p += e; num += e * f; den += e;
    }
    out[k] = p; tot += p;
  }
  for (const k of Object.keys(out)) out[k] = out[k] / tot * 100;
  return { bands: out, centroid: num / den };
}
const before = bands(oldMk, false, 0.030, 1.6);
const after = bands(newMk, true, 0.14, 2.4);
console.log("  頻帶          阿朗壹    這次改動前   這次改動後");
for (const k of Object.keys(ALANGYI)) {
  console.log(`  ${k.padEnd(12)} ${ALANGYI[k].toFixed(1).padStart(6)}% ${before.bands[k].toFixed(1).padStart(11)}% ${after.bands[k].toFixed(1).padStart(12)}%`);
}
console.log(`  ${"spectral centroid".padEnd(12)} ${"428".padStart(6)}Hz ${before.centroid.toFixed(0).padStart(10)}Hz ${after.centroid.toFixed(0).padStart(11)}Hz`);
const err = (b) => Object.keys(ALANGYI).reduce((s, k) => s + Math.abs(b.bands[k] - ALANGYI[k]), 0);
console.log(`\n  頻帶絕對誤差合計：改動前 ${err(before).toFixed(1)}% → 改動後 ${err(after).toFixed(1)}%`);
