#!/usr/bin/env node
/**
 * 握力門檻的單位測試（Pan 2026-08-06：「478結束之後握力球就沒有反應了 而且有一顆球幾乎沒有效用」）。
 *
 * 守的是什麼：**門檻必須用「力道（raw）」定義，不可以寫成裸水位數字。**
 *
 * 為什麼這件事需要一支測試守著——這個坑已經踩過兩次了：
 *   水位是正規化的，level = pow((|dev|/effScale − 死區)/(1−死區), GAMMA)，
 *   effScale = GRIP_FULL_SCALE × GRIP_HEADROOM。所以每個門檻的**實際力道**都被
 *   GRIP_FULL_SCALE 決定。2026-08-05 把它從 900 調成 1400（那個修法是對的），
 *   於是所有寫成水位的門檻在同一秒被悄悄調高 1.55 倍，一行程式碼都沒被改到，
 *   而後果是 Pan 回報的「478 結束後沒反應」＋「一顆球幾乎沒有效用」。
 *
 * 這支測試用**兩種**方式驗，缺一不可：
 *   [1]-[4] 靜態：門檻都經 gripLevelForRaw()、單調性、遲滯、兩頁同步。
 *   [5]-[7] 真球重播：用 Pan 的實機紀錄（只取 raw + tMs，見下面的重播規則）算
 *           「結束後問卷答不答得出來」與「兩顆球各自表達得到第幾級」。
 *           光有靜態測試會漏掉真正的症狀——460raw 這個值本身語法上完全合法。
 *
 * ⚠️ 重播規則：/tmp/griplog.ndjson 是 2026-07-22 錄的，**早於 2026-08-04 的校正改版**，
 *    所以裡面的 baseline/level/sign 欄位是舊校正算的，一律不採用；只取 `raw` 與 `tMs`
 *    （硬體事實），其餘全部用現在的碼重算。log 刻意不進 repo（AGENTS.md：session 紀錄
 *    只存本機、不上傳）；找不到就跳過重播段並說明，不假裝跑過。
 *
 * 用法：node tmp/test_grip_thresholds.js [--log <path>]
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = [
  { label: "zh", src: fs.readFileSync(path.join(ROOT, "web", "index.html"), "utf8") },
  { label: "en", src: fs.readFileSync(path.join(ROOT, "web", "en", "index.html"), "utf8") },
];
const argv = process.argv.slice(2);
const LOG = (() => { const i = argv.indexOf("--log"); return i >= 0 ? argv[i + 1] : "/tmp/griplog.ndjson"; })();

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("  ✗ " + msg); } };
const section = (s) => console.log("\n" + s);

// ── 從頁面抽出真正的常數與 gripLevelForRaw（不重寫、不寫死值）─────────────────
function extract(src, label) {
  const num = (n) => {
    const m = src.match(new RegExp(`const ${n} = ([\\d.]+)`));
    if (!m) throw new Error(`${label}: 抽不到 ${n}`);
    return Number(m[1]);
  };
  const base = ["GRIP_FULL_SCALE", "GRIP_HEADROOM", "GRIP_DEADZONE", "GRIP_GAMMA"];
  const K = {}; base.forEach(n => K[n] = num(n));
  // 允許抽不到（壞掉的形狀也要能被測到，而不是拋例外）——這是這個專案的測試慣例：
  // 突變測試會把 gripLevelForRaw 改壞／刪掉，測試必須以「斷言失敗」表現，不是崩掉。
  const fnSrc = (src.match(/function gripLevelForRaw\(raw\)\{[\s\S]*?\n\}/) || [null])[0];
  const fn = fnSrc
    ? new Function(`${base.map(n => `const ${n}=${K[n]};`).join("")}\n${fnSrc}\nreturn gripLevelForRaw;`)()
    : null;
  // 門檻：raw 定義的抓 raw 值；仍寫成裸水位的也抓出來（要被 [1] 抓到）
  const raws = {}, bare = {};
  for (const m of src.matchAll(/const (\w+) = gripLevelForRaw\((\d+)\)/g)) raws[m[1]] = Number(m[2]);
  for (const n of ["AFTER_ON", "AFTER_OFF", "ARRIVAL_PRESS_ON", "ARRIVAL_PRESS_OFF", "MANUAL_478_ON", "HARD_GRIP"]) {
    const m = src.match(new RegExp(`const ${n} = ([\\d.]+)`));
    if (m) bare[n] = Number(m[1]);
  }
  return { K, fn, raws, bare, effScale: K.GRIP_FULL_SCALE * K.GRIP_HEADROOM };
}

const E = {};
for (const p of PAGES) E[p.label] = extract(p.src, p.label);

// 這些門檻是「使用者要出多少力」，一律必須用 raw 定義。
const MUST_BE_RAW = ["AFTER_ON", "AFTER_OFF", "ARRIVAL_PRESS_ON", "ARRIVAL_PRESS_OFF", "MANUAL_478_ON", "HARD_GRIP"];

section("[1] 門檻必須用力道（raw）定義，不可以寫成裸水位");
for (const p of PAGES) {
  const e = E[p.label];
  ok(e.fn != null, `${p.label}: gripLevelForRaw() 必須存在（門檻換算的唯一入口）`);
  for (const n of MUST_BE_RAW) {
    ok(e.raws[n] != null, `${p.label}: ${n} 必須寫成 gripLevelForRaw(<raw>)，不是裸水位數字`);
    ok(e.bare[n] == null, `${p.label}: ${n} 不可以是裸水位常數（會被 GRIP_FULL_SCALE 悄悄改變意義）`);
  }
  // 分級也不能寫死：靈敏度低的球會表達不出上面兩級
  ok(!/v >= 0\.66 \? 3/.test(p.src), `${p.label}: afterAnswerBand 不可寫死 0.66/0.33`);
  ok(!/v >= 0\.66 \? "很明顯"/.test(p.src), `${p.label}: afterAnswerLabel 不可寫死 0.66/0.33`);
  ok(!/a >= 0\.66 \? 2/.test(p.src), `${p.label}: agreementBand 不可寫死 0.66/0.33`);
}

section("[2] 換算函式本身：死區、單調、值域");
for (const p of PAGES) {
  const e = E[p.label]; if (!e.fn) continue;
  const dzRaw = e.K.GRIP_DEADZONE * e.effScale;
  ok(e.fn(0) === 0, `${p.label}: 0 raw → 水位 0`);
  ok(e.fn(dzRaw) === 0, `${p.label}: 恰在死區邊界 → 水位 0`);
  ok(e.fn(dzRaw - 1) === 0, `${p.label}: 死區內 → 水位 0`);
  ok(e.fn(dzRaw + 50) > 0, `${p.label}: 死區之上 → 水位 > 0`);
  ok(Math.abs(e.fn(e.effScale) - 1) < 1e-9, `${p.label}: 滿刻度 raw → 水位 1`);
  let prev = -1, mono = true;
  for (let r = 0; r <= e.effScale; r += 25) { const v = e.fn(r); if (v < prev) mono = false; prev = v; }
  ok(mono, `${p.label}: 換算必須單調遞增`);
  // 殘壓（真球實測拿起球 ~62raw）必須落在死區內＝不會被讀成答案
  ok(e.fn(62) === 0, `${p.label}: 拿起球的殘壓 62raw 必須算成 0（否則會被當成答案）`);
}

section("[2b] 換算函式必須與 GripCalibrator 的曲線完全一致");
// 這是最容易出錯又最沒感覺的一種壞法：gripLevelForRaw 是「門檻寫成力道」的唯一入口，
// 而 GripCalibrator.update() 是真正把 raw 變成水位的地方。兩邊只要曲線不同（少乘
// HEADROOM、少了 GAMMA、死區算法不同），門檻的力道意義就又一次悄悄偏掉——
// 症狀跟 Pan 2026-08-06 回報的一模一樣，而兩段程式各自看起來都完全合理。
// 做法：從 GripCalibrator 裡把那兩行造型算式抽出來當「真值」，掃過整個量程比對。
for (const p of PAGES) {
  const e = E[p.label]; if (!e.fn) continue;
  const cls = (p.src.match(/class GripCalibrator \{[\s\S]*?\n\}/) || [null])[0];
  const shapeSrc = cls && cls.match(
    /const effScale = [^\n]*\n\s*let rawLevel = [^\n]*\n\s*rawLevel = [^\n]*\n\s*const shaped = [^\n]*/);
  ok(shapeSrc != null, `${p.label}: 抽得到 GripCalibrator 的造型算式（抽不到就無法保證兩邊一致）`);
  if (!shapeSrc) continue;
  // 算式裡有 this.span，所以用 .call({span}) 餵進去（`this` 不能用 const 宣告）
  const shapeFn = new Function("posDelta",
    `const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));
     const GRIP_HEADROOM=${e.K.GRIP_HEADROOM},GRIP_DEADZONE=${e.K.GRIP_DEADZONE},GRIP_GAMMA=${e.K.GRIP_GAMMA};
     ${shapeSrc[0]}
     return shaped;`);
  const calLevel = (raw) => shapeFn.call({ span: e.K.GRIP_FULL_SCALE }, raw);
  let maxErr = 0, worst = 0;
  for (let raw = 0; raw <= e.effScale; raw += 13) {
    const d = Math.abs(e.fn(raw) - calLevel(raw));
    if (d > maxErr) { maxErr = d; worst = raw; }
  }
  ok(maxErr < 1e-9,
    `${p.label}: gripLevelForRaw 必須與 GripCalibrator 的曲線逐點相同（最大誤差 ${maxErr.toFixed(4)} @ ${worst}raw）`);
}

section("[3] 門檻之間的關係：遲滯與分級單調");
for (const p of PAGES) {
  const e = E[p.label]; if (!e.fn) continue;
  const R = e.raws;
  if (R.AFTER_ON != null && R.AFTER_OFF != null) {
    ok(R.AFTER_ON > R.AFTER_OFF, `${p.label}: AFTER_ON 必須大於 AFTER_OFF`);
    ok(R.AFTER_ON - R.AFTER_OFF >= 40, `${p.label}: ON/OFF 至少差 40raw（遲滯，否則作答會被抖動打斷）`);
    // OFF 要在死區之上一點，才「偵測得到放開」；也不能低到永遠算放開
    ok(R.AFTER_OFF > e.K.GRIP_DEADZONE * e.effScale, `${p.label}: AFTER_OFF 要高於死區（否則偵測不到放開）`);
  }
  const some = R.AFTER_BAND_SOME, clear = R.AFTER_BAND_CLEAR;
  if (some != null && clear != null) {
    ok(R.AFTER_ON < some && some < clear, `${p.label}: AFTER_ON < 有一點 < 很明顯（分級單調）`);
  }
  if (R.AGREE_BAND_SOME != null && R.AGREE_BAND_CLOSE != null) {
    ok(R.AGREE_BAND_SOME < R.AGREE_BAND_CLOSE, `${p.label}: 相符程度分級單調`);
  }
  if (R.ARRIVAL_PRESS_ON != null && R.ARRIVAL_PRESS_OFF != null) {
    ok(R.ARRIVAL_PRESS_ON > R.ARRIVAL_PRESS_OFF, `${p.label}: ARRIVAL_PRESS ON > OFF`);
  }
}

section("[4] 門檻的力道必須落在真球做得到的範圍內");
// 真球實測（/tmp/griplog.ndjson 重播，兩顆 MB01）：
//   「刻意握一下」的 dev 峰值中位數 ball1 382raw / ball2 780raw；p25 259 / 667。
// 這是 AE-2 的核心：門檻若高過**靈敏度較低那顆**的正常握壓，那顆球就「幾乎沒有效用」。
const WEAK_BALL_TYPICAL = 382;   // 弱球刻意握一下的中位數
const WEAK_BALL_STRONG = 654;    // 弱球用力握（p75）
for (const p of PAGES) {
  const e = E[p.label]; const R = e.raws; if (!e.fn) continue;
  if (R.AFTER_ON != null)
    ok(R.AFTER_ON < WEAK_BALL_TYPICAL,
      `${p.label}: AFTER_ON(${R.AFTER_ON}raw) 必須低於弱球的中位握壓 ${WEAK_BALL_TYPICAL}raw，否則那顆球答不出任何東西`);
  if (R.AFTER_BAND_CLEAR != null)
    ok(R.AFTER_BAND_CLEAR <= WEAK_BALL_STRONG + 60,
      `${p.label}: 「很明顯」(${R.AFTER_BAND_CLEAR}raw) 要在弱球用力握 ${WEAK_BALL_STRONG}raw 摸得到的範圍內`);
  if (R.MANUAL_478_ON != null)
    ok(R.MANUAL_478_ON < WEAK_BALL_TYPICAL, `${p.label}: 「握一下開始 4-7-8」也要弱球按得動`);
}

section("[5] 鵝卵石：開場靜音，但底量本身保留");
for (const p of PAGES) {
  ok(/const PEBBLE_FLOOR = 0\.14/.test(p.src), `${p.label}: PEBBLE_FLOOR 要保留（Pan 2026-08-04：pebble 幾乎聽不到）`);
  ok(/this\.pebbleFloorAmt = 0;/.test(p.src), `${p.label}: 底量淡入係數初值必須是 0（開場完全沒有滾石聲）`);
  ok(/PEBBLE_FLOOR \* this\.pebbleFloorAmt/.test(p.src), `${p.label}: 底量必須乘上淡入係數才進 gain`);
  ok(/pebbleFloorOpen && level >= MANUAL_478_ON/.test(p.src), `${p.label}: 第一次真的握球才打開底量`);
  ok(/PEBBLE_FLOOR_RAMP_S/.test(p.src), `${p.label}: 要用時間常數慢慢長出來（平滑不跳變）`);
  // 握出來的量不可以被這個淡入係數擋住——否則第一次握球會沒有石頭聲
  ok(/\+ 0\.52 \* stoneAmt\)/.test(p.src), `${p.label}: 握出來的 0.52×stoneAmt 不受淡入影響`);
  // 淡入必須「慢到聽不出被打開」：時間常數太短＝喀一聲跳出來，違反 DESIGN.md「平滑，不跳變」
  const ramp = Number((p.src.match(/const PEBBLE_FLOOR_RAMP_S = ([\d.]+)/) || [0, 0])[1]);
  ok(ramp >= 2.0, `${p.label}: PEBBLE_FLOOR_RAMP_S(${ramp}s) 至少 2s，否則底量是「跳」出來的`);
}

section("[5b] 兩頁的引擎常數必須一致（英文頁只該差 UI 文案）");
// zh/en 共用同一份引擎碼，只有介面字串是英文。常數一旦分岔，就會出現「中文頁修好了、
// 英文頁還壞著」——en 的 AFTER_ON 先前就分岔成 0.14 沒人發現。
// 這一段同時是 GRIP_FULL_SCALE 的守門：門檻改用 raw 之後它不再影響門檻的力道，
// 但它仍決定水位的動態範圍（1400 是 2026-08-05 修「水位只有滿跟空」的結果，不可回退）。
{
  const a = E.zh, b = E.en;
  for (const n of Object.keys(a.K)) {
    ok(a.K[n] === b.K[n], `GRIP 常數 ${n} 兩頁必須相同（zh ${a.K[n]} / en ${b.K[n]}）`);
  }
  for (const n of Object.keys(a.raws)) {
    ok(a.raws[n] === b.raws[n], `門檻 ${n} 兩頁必須相同（zh ${a.raws[n]}raw / en ${b.raws[n]}raw）`);
  }
  ok(a.K.GRIP_FULL_SCALE >= 1400,
    `GRIP_FULL_SCALE(${a.K.GRIP_FULL_SCALE}) 不可回退到 1400 以下（水位會又只有滿跟空）`);
}

// ── [6][7] 真球重播 ──────────────────────────────────────────────────────────
if (!fs.existsSync(LOG)) {
  section(`[6][7] 真球重播：跳過（找不到 ${LOG}）`);
  console.log("   log 刻意不進 repo（AGENTS.md：session 紀錄只存本機）。用 --log 指定路徑。");
} else {
  const src = PAGES[0].src;   // 引擎碼兩頁相同，用 zh 版重播
  const names = ["GRIP_FULL_SCALE", "GRIP_BASELINE_MS", "GRIP_HEADROOM", "GRIP_LEVEL_ATTACK",
    "GRIP_LEVEL_RELEASE", "GRIP_REST_MARGIN", "EDGE_ON_FRAC", "EDGE_ON_MIN_RAW", "EDGE_REARM_FRAC",
    "EDGE_FLOOR_RISE", "GRIP_GAMMA", "GRIP_DEADZONE", "GRIP_HIST_BIN", "GRIP_HIST_MIN_MS",
    "GRIP_REZERO_MS", "GRIP_REZERO_MIN_SHIFT", "GRIP_BEAT_REFRACTORY_MS", "GRIP_SETTLE_MS", "GRIP_SETTLE_MIN_SHIFT"];
  const K = {}; const consts = names.map(n => {
    const m = src.match(new RegExp(`const ${n} = ([\\d.]+)`));
    K[n] = Number(m[1]); return `const ${n} = ${m[1]};`;
  }).join("\n");
  const cls = src.match(/class GripCalibrator \{[\s\S]*?\n\}/)[0];
  const mk = () => {
    const clock = { t: 0 };
    const { GripCalibrator } = new Function("clock",
      `const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));const performance={now:()=>clock.t};${consts}\n${cls}\nreturn {GripCalibrator};`)(clock);
    return { clock, c: new GripCalibrator() };
  };
  const HOLD = Number(src.match(/const AFTER_HOLD_MS = (\d+)/)[1]);
  const e = E.zh;
  const ON = e.fn ? e.fn(e.raws.AFTER_ON ?? 460) : 0.24;
  const OFF = e.fn ? e.fn(e.raws.AFTER_OFF ?? 271) : 0.07;
  const SOME = e.fn && e.raws.AFTER_BAND_SOME != null ? e.fn(e.raws.AFTER_BAND_SOME) : 0.33;
  const CLEAR = e.fn && e.raws.AFTER_BAND_CLEAR != null ? e.fn(e.raws.AFTER_BAND_CLEAR) : 0.66;

  const rows = [];
  for (const line of fs.readFileSync(LOG, "utf8").split("\n")) {
    if (!line) continue;
    let d; try { d = JSON.parse(line); } catch { continue; }
    if (d.event !== "report" || typeof d.raw !== "number" || d.slot == null) continue;
    rows.push({ t: d.tMs, raw: d.raw, slot: d.slot, ph: d.phase });   // 只取 raw / tMs / phase
  }
  rows.sort((a, b) => a.t - b.t);
  const cal = { 1: mk(), 2: mk() }, grip = { 1: 0, 2: 0 }, fr = [];
  const peaks = { 1: [], 2: [] }, cur = { 1: null, 2: null };
  for (const r of rows) {
    cal[r.slot].clock.t = r.t;
    grip[r.slot] = cal[r.slot].c.update(r.raw);
    const dev = Math.abs(cal[r.slot].c.smRaw - cal[r.slot].c.baseline);
    if (dev >= 250) {   // 「刻意握一下」的局部峰（相鄰 >600ms 算不同次）
      const q = cur[r.slot];
      if (!q || r.t - q.last > 600) { if (q) peaks[r.slot].push(q.max); cur[r.slot] = { max: grip[r.slot], last: r.t }; }
      else { q.max = Math.max(q.max, grip[r.slot]); q.last = r.t; }
    }
    fr.push({ t: r.t, ph: r.ph, g1: grip[1], g2: grip[2] });
  }
  for (const s of [1, 2]) if (cur[s]) peaks[s].push(cur[s].max);

  // 問卷式判定：連續 >=ON 撐過 AFTER_HOLD_MS 才記成一個答案
  const longestHold = (pick) => {
    let run = 0, best = 0, lastT = null;
    for (const f of fr) {
      if (f.ph !== "after") { run = 0; lastT = f.t; continue; }
      const dt = lastT == null ? 33 : Math.min(100, f.t - lastT); lastT = f.t;
      if (pick(f) >= ON) run += dt; else run = 0;
      best = Math.max(best, run);
    }
    return Math.round(best);
  };
  const both = longestHold(f => Math.max(f.g1, f.g2));
  const only1 = longestHold(f => f.g1);
  const only2 = longestHold(f => f.g2);

  // 問卷採用的是「連續握 >=AFTER_HOLD_MS 的那一段裡的峰值」（afterSurveyStep 的 a.peak）。
  // ⚠️ 不可以拿「刻意握一下」的瞬態峰來驗分級：GRIP_LEVEL_ATTACK=0.14 的慢起讓短促輕拍
  //    達不到靜態換算值，那個量測會低估使用者實際答得到的級別（第一版的斷言就是這樣寫錯的）。
  const holdPeaks = (pick) => {
    const out = []; let run = 0, peak = 0, lastT = null;
    for (const f of fr) {
      const dt = lastT == null ? 33 : Math.min(100, f.t - lastT); lastT = f.t;
      const v = pick(f);
      if (v >= ON) { run += dt; peak = Math.max(peak, v); }
      else { if (run >= HOLD) out.push(peak); run = 0; peak = 0; }
    }
    if (run >= HOLD) out.push(peak);
    return out;
  };

  section("[6] 真球重播：478 結束後的問卷答得出來嗎（AE-1）");
  console.log(`   after 段最長連續達標：兩顆 ${both}ms / 只有 ball1 ${only1}ms / 只有 ball2 ${only2}ms（需 ${HOLD}ms）`);
  ok(both >= HOLD, `兩顆一起必須答得出（實測 ${both}ms ≥ ${HOLD}ms）`);
  ok(both >= HOLD * 1.5, `而且要有餘裕（${both}ms ≥ ${Math.round(HOLD * 1.5)}ms），不能剛好卡在門檻上`);

  section("[7] 真球重播：兩顆球各自都要有效用（AE-2）");
  ok(only1 >= HOLD, `只用 ball1（靈敏度較低那顆）也必須答得出（實測 ${only1}ms）`);
  ok(only2 >= HOLD, `只用 ball2 也必須答得出（實測 ${only2}ms）`);
  const med = (a) => { const v = a.slice().sort((x, y) => x - y); return v.length ? v[Math.floor(v.length / 2)] : 0; };
  const h1 = holdPeaks(f => f.g1), h2 = holdPeaks(f => f.g2);
  const m1 = med(h1), m2 = med(h2);
  const band = (v) => v >= CLEAR ? 3 : v >= SOME ? 2 : 1;
  console.log(`   持續握（≥${HOLD}ms）的峰值中位數：ball1 ${m1.toFixed(2)}（${h1.length} 段）/ ball2 ${m2.toFixed(2)}（${h2.length} 段）`);
  ok(m1 >= SOME, `ball1 的正常持續握要至少到「有一點」（${m1.toFixed(2)} ≥ ${SOME.toFixed(2)}）——否則就是 Pan 說的「幾乎沒有效用」`);
  ok(m2 >= SOME, `ball2 的正常持續握也要至少到「有一點」（${m2.toFixed(2)}）`);
  // AE-2 的真正驗收：**兩顆球都要表達得出三級**（現況 ball1 到不了「很明顯」）
  ok(h1.some(v => band(v) === 3), `ball1 必須表達得到「很明顯」（弱球也要能給最高分）`);
  ok(h2.some(v => band(v) === 3), `ball2 必須表達得到「很明顯」`);
  ok(h1.some(v => band(v) === 1) || m1 < CLEAR, `ball1 也要表達得出低分（不是一握就滿）`);
  // 貼頂率：1400 這個滿刻度當初就是為了修「水位只有滿跟空」，不能倒退
  let sat = 0, n = 0;
  for (const f of fr) { n += 2; if (f.g1 >= 0.98) sat++; if (f.g2 >= 0.98) sat++; }
  ok(100 * sat / n < 1, `貼頂率必須 <1%（實測 ${(100 * sat / n).toFixed(2)}%）——別把 2026-08-05 的水位動態修法弄回去`);
}

console.log(`\n${pass} 通過${fail ? `、${fail} 失敗` : ""}。`);
process.exit(fail ? 1 : 0);
