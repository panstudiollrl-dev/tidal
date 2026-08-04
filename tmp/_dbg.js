#!/usr/bin/env node
/**
 * 手動觀察用的小工具（不是測試，不會斷言任何事）：把一段人造的 raw 序列餵進**真正的**
 * GripCalibrator，逐幀印出水位與零點修正的內部狀態。調常數時用它看「發生了什麼」；
 * 要「證明沒壞」請跑 tmp/sim_grip_rezero.js。
 *
 * 用法：
 *   node tmp/_dbg.js              # hold-release：連上時就握著，之後放開（Pan 的症狀①）
 *   node tmp/_dbg.js rest-hold    # 先靜止 9s、再長握 5s（那個無法消除的取捨的另一邊）
 *   node tmp/_dbg.js beats        # 每秒握一拍（4-7-8 數拍的節奏）
 */
const fs = require("fs"), path = require("path");
const src = fs.readFileSync(path.join(__dirname, "..", "web", "index.html"), "utf8");

// 常數清單跟著 index.html 走：抽不到就直接報錯，不要默默用舊值算出漂亮但不真的數字
// （這支工具 2026-08-04 就因為還抓已移除的 GRIP_FLAT_MARGIN 而整支不能跑）。
const names = ["GRIP_FULL_SCALE", "GRIP_BASELINE_MS", "GRIP_HEADROOM", "GRIP_LEVEL_ATTACK",
  "GRIP_LEVEL_RELEASE", "GRIP_REST_MARGIN", "EDGE_ON_FRAC", "EDGE_ON_MIN_RAW", "EDGE_REARM_FRAC",
  "EDGE_FLOOR_RISE", "GRIP_GAMMA", "GRIP_DEADZONE", "GRIP_HIST_BIN", "GRIP_HIST_MIN_MS",
  "GRIP_REZERO_MS", "GRIP_REZERO_MIN_SHIFT", "GRIP_BEAT_REFRACTORY_MS"];
const val = (n) => {
  const m = src.match(new RegExp(`const ${n} = ([\\d.]+)`));
  if (!m) throw new Error(`抽不到常數 ${n}——index.html 改過了，這支工具要跟著更新`);
  return m[1];
};
const consts = names.map(n => `const ${n} = ${val(n)};`).join("\n");
const cls = src.match(/class GripCalibrator \{[\s\S]*?\n\}/)[0];
const clock = { t: 0 };
const { GripCalibrator } = new Function("clock",
  `const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));const performance={now:()=>clock.t};${consts}\n${cls}\nreturn {GripCalibrator};`)(clock);

const HZ = 80, DT = 1000 / HZ;
const REST = 300, GRIP = 900;
const noise = (i, a = 6) => Math.sin(i * 2.1) * a + Math.sin(i * 0.37) * a * 0.6;
const secs = (n) => Math.round(n * HZ);

const SCENARIOS = {
  // Pan 的症狀①：連上時手已經握著，2 秒後放開 → 水位不該卡在全滿
  "hold-release": () => {
    const s = [];
    for (let i = 0; i < secs(2); i++) s.push(REST + GRIP + noise(i));
    for (let i = 0; i < secs(6); i++) s.push(REST + noise(i));
    return s;
  },
  // 取捨的另一邊：先正常靜止（超過 GRIP_REZERO_MS），再刻意長握 → 水位不該塌掉
  "rest-hold": () => {
    const s = [];
    for (let i = 0; i < secs(9); i++) s.push(REST + noise(i));
    for (let i = 0; i < secs(5); i++) s.push(REST + GRIP + noise(i, 3));
    return s;
  },
  // 數拍節奏：握 0.35s、放 0.65s，共 8 次 → 應該剛好 8 拍、沒有連發
  beats: () => {
    const s = [];
    for (let i = 0; i < secs(1.5); i++) s.push(REST + noise(i));
    for (let b = 0; b < 8; b++) {
      for (let i = 0; i < secs(0.35); i++) s.push(REST + GRIP + noise(i));
      for (let i = 0; i < secs(0.65); i++) s.push(REST + noise(i));
    }
    return s;
  },
};

const which = process.argv[2] || "hold-release";
const make = SCENARIOS[which];
if (!make) {
  console.error(`不認得情境 "${which}"。可用：${Object.keys(SCENARIOS).join(" / ")}`);
  process.exit(1);
}

console.log(`情境 ${which}｜${HZ}Hz｜REST=${REST} GRIP=+${GRIP}`);
console.log(names.map(n => `${n}=${val(n)}`).join(" ") + "\n");

const c = new GripCalibrator();
let beats = 0, lastRez = 0, lastBeatAt = null, minGap = Infinity;
make().forEach((raw, k) => {
  clock.t += DT;
  const lv = c.update(raw);
  const fired = !!(c.edge && c.edge.pulse);
  if (fired) {
    beats++;
    if (lastBeatAt != null) minGap = Math.min(minGap, clock.t - lastBeatAt);
    lastBeatAt = clock.t;
  }
  // 每 0.25 秒印一行；「重取零點」與「算成一拍」的那一幀一定印（那兩件事才是要看的）
  const rezJustNow = c.rezeroCount !== lastRez;
  lastRez = c.rezeroCount;
  if (k % Math.round(HZ / 4) === 0 || rezJustNow || fired) {
    console.log(
      `t=${(clock.t / 1000).toFixed(2).padStart(5)}s raw=${raw.toFixed(0).padStart(5)}` +
      ` lv=${lv.toFixed(2)} base=${(c.baseline == null ? 0 : c.baseline).toFixed(0).padStart(5)}` +
      ` rest=${(c.restRef == null ? 0 : c.restRef).toFixed(0).padStart(5)}` +
      ` armed=${c.edge.armed ? 1 : 0} rez=${c.rezeroCount} beats=${beats}` +
      (rezJustNow ? "  ←重取零點" : "") + (fired ? "  ←拍" : "")
    );
  }
});
console.log(`\n總計：${beats} 拍`
  + (minGap === Infinity ? "" : `（最小間距 ${minGap.toFixed(0)}ms）`)
  + `、重取零點 ${c.rezeroCount} 次、最後 baseline ${c.baseline.toFixed(0)}（真值 ${REST}）`);
