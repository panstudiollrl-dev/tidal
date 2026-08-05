#!/usr/bin/env node
/**
 * 對拍測試：4-7-8 的梆子節拍（Pan 2026-08-04 的新設計）。
 *
 * Pan 的原話：
 *   「我參考了 The calming effect of a new wearable device during the anticipation of public
 *     speech 這篇 2016 年的文章，突然覺得好像 478 呼吸這邊 可以做一種圓圓的石頭之間在水中
 *     碰撞的低沉的聲音 由快到慢 像中國戲曲中的梆子的打法 例如 4震動一下 然後一個由快到慢的
 *     系列震動三次 然後7震動一下 然後一個由快到慢的系列震動六次 然後8 也如法炮製
 *     就不抓取使用者的捏握了 只在問問題還有前面自由呼吸保持原狀」
 *
 * ⚠️ 2026-08-05 Pan 修正了速度曲線：
 *   「478的部分，應該是第一拍拍下去有個較長間隔，然後漸快再漸慢，我等下輸出一個midi檔案
 *     給妳，請你去學習那裡面的midi note之間的速度變化的相對關係」
 *   「你看一下 tidal 資料夾裡面有個midi_Accel_Rit_Rhythm 的 midi clip」
 * 所以 [2] 從「間隔嚴格遞增」改成「長起頭 → 漸快 → 漸慢」。原本的單向幾何級數
 * （BANGZI_SLOWDOWN）與最短的起頭空隙（BANGZI_LEAD_MS）都與 Pan 的新指示相反，已移除。
 *
 * 這支測試把那段話逐條變成斷言：
 *   [1] 節拍形狀＝1 記重音 + (count−1) 個點，總數正好是 4 / 7 / 8
 *   [2] 速度曲線＝第一個間隔最長 → 漸快 → 漸慢（取自 Pan 的 MIDI）
 *   [3] 4-7-8 三段都照同一個規則（「也如法炮製」）
 *   [4] 不再抓捏握：碼裡的握壓數拍路徑要真的移除
 *   [5] 「只在問問題還有前面自由呼吸保持原狀」＝其他段落不能被動到
 *   [6] 水中圓石的聲音特徵（低沉、水的低通、短衰減）
 *   [7] 節奏的絕對時間要落在「可以跟著呼吸」的範圍（比使用者當下更慢＝該論文的機制）
 *
 * 沿用本專案的做法：regex 從 index.html 抽**真正的**函式與常數出來跑，不在這裡重寫一份。
 *
 * 用法：node tmp/sim_bangzi_478.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = [
  { label: "zh", file: path.join(ROOT, "web", "index.html") },
  { label: "en", file: path.join(ROOT, "web", "en", "index.html") },
];
for (const p of PAGES) p.src = fs.readFileSync(p.file, "utf8");

let passed = 0;
const failures = [];
let tag = "";
const ok = (cond, label, detail) => {
  if (cond) { passed++; return; }
  failures.push(tag + label + (detail ? `  ← ${detail}` : ""));
};

// ── 從 index.html 抽真的 bangziPattern / bangziDuration 與常數 ────────────────
function build(src) {
  const names = ["BANGZI_UNIT_MS", "BANGZI_TICK_MIN", "BANGZI_TICK_MAX", "BANGZI_TICK_MS"];
  const consts = names.map(n => {
    const m = src.match(new RegExp(`const ${n} = ([\\d.]+)`));
    if (!m) throw new Error(`抽不到常數 ${n}`);
    return `const ${n} = ${m[1]};`;
  }).join("\n");
  const accent = src.match(/const BANGZI_ACCENT = \{[^}]*\};/);
  if (!accent) throw new Error("抽不到 BANGZI_ACCENT");
  // 速度曲線（來自 Pan 的 MIDI）與它的極值：這三個是 2026-08-05 取代 BANGZI_SLOWDOWN 的東西。
  const curve = src.match(/const BANGZI_CURVE = \[[^\]]*\];/);
  if (!curve) throw new Error("抽不到 BANGZI_CURVE");
  const cmin = src.match(/const BANGZI_CURVE_MIN = [^;]*;/);
  const cmax = src.match(/const BANGZI_CURVE_MAX = [^;]*;/);
  if (!cmin || !cmax) throw new Error("抽不到 BANGZI_CURVE_MIN / BANGZI_CURVE_MAX");
  const fnGaps = src.match(/function bangziGaps\(n\)\{[\s\S]*?\n\}/);
  if (!fnGaps) throw new Error("抽不到 bangziGaps");
  const fnPat = src.match(/function bangziPattern\(count\)\{[\s\S]*?\n\}/);
  const fnDur = src.match(/function bangziDuration\(count\)\{[\s\S]*?\n\}/);
  if (!fnPat) throw new Error("抽不到 bangziPattern");
  if (!fnDur) throw new Error("抽不到 bangziDuration");
  const factory = new Function(`
    ${consts}
    ${accent[0]}
    ${curve[0]}
    ${cmin[0]}
    ${cmax[0]}
    ${fnGaps[0]}
    ${fnPat[0]}
    ${fnDur[0]}
    return { bangziPattern, bangziDuration, bangziGaps, consts: { ${names.join(", ")} },
             BANGZI_ACCENT, BANGZI_CURVE, BANGZI_CURVE_MIN, BANGZI_CURVE_MAX };
  `);
  return factory();
}

// ── 把真正的 tickManual478 / startBangziPhase / manual478State 跑起來 ─────────
// 用假時鐘 + 假的 setTimeout（只記錄、不真的發聲），驗證段落**靠時間**前進。
// 聲音/震動/DOM 都換成計數器：這支測試要驗的是狀態機，不是 Web Audio。
function buildTicker(src) {
  const need = (re, name) => {
    const m = src.match(re);
    if (!m) throw new Error(`抽不到 ${name}`);
    return m[0];
  };
  const consts = ["BANGZI_UNIT_MS", "BANGZI_TICK_MIN", "BANGZI_TICK_MAX", "BANGZI_TICK_MS"]
    .map(n => `const ${n} = ${src.match(new RegExp(`const ${n} = ([\\d.]+)`))[1]};`).join("\n");
  const code = `
    ${consts}
    ${need(/const BANGZI_ACCENT = \{[^}]*\};/, "BANGZI_ACCENT")}
    ${need(/const BANGZI_CURVE = \[[^\]]*\];/, "BANGZI_CURVE")}
    ${need(/const BANGZI_CURVE_MIN = [^;]*;/, "BANGZI_CURVE_MIN")}
    ${need(/const BANGZI_CURVE_MAX = [^;]*;/, "BANGZI_CURVE_MAX")}
    ${need(/const MANUAL_478_PHASES = \[[\s\S]*?\n\];/, "MANUAL_478_PHASES")}
    ${need(/const MANUAL_478_TARGET_CYCLES = \d+;/, "MANUAL_478_TARGET_CYCLES")}
    ${need(/function bangziGaps\(n\)\{[\s\S]*?\n\}/, "bangziGaps")}
    ${need(/function bangziPattern\(count\)\{[\s\S]*?\n\}/, "bangziPattern")}
    ${need(/function bangziDuration\(count\)\{[\s\S]*?\n\}/, "bangziDuration")}
    ${need(/function playBangziPhase\(phase\)\{[\s\S]*?\n\}/, "playBangziPhase")}
    ${need(/function manual478State\(\)\{[\s\S]*?\n\}/, "manual478State")}
    ${need(/function resetManual478\(\)\{[\s\S]*?\n\}/, "resetManual478")}
    ${need(/function startBangziPhase\(\)\{[\s\S]*?\n\}/, "startBangziPhase")}
    ${need(/function tickManual478\(\)\{[\s\S]*?\n\}/, "tickManual478")}
    ${need(/function beginManual478\(\)\{[\s\S]*?\n\}/, "beginManual478")}
    return { tickManual478, beginManual478, resetManual478, manual478State, state, stats };
  `;
  const clock = { t: 1000 };
  const stats = { presses: 0, stones: 0, bowls: 0, haptics: 0 };
  const state = {
    phase: "session",
    grip: { 1: 0, 2: 0 },
    guided: { preset: "hold478", manual478: null, hapticTimers: [], manual478LastPressAt: 0 },
  };
  const env = {
    performance: { now: () => clock.t },
    state,
    stats,
    // 假 setTimeout：登記在佇列裡，由 advance() 到時間才執行
    timers: [],
    setTimeout: (fn, ms) => { const id = { fn, at: clock.t + ms }; env.timers.push(id); return id; },
    clearTimeout: (id) => { const i = env.timers.indexOf(id); if (i >= 0) env.timers.splice(i, 1); },
    clearGuidedHaptics: () => {
      for (const t of state.guided.hapticTimers) env.clearTimeout(t);
      state.guided.hapticTimers = [];
    },
    // 石頭與頌缽分開記：Pan 2026-08-05 要「每段第一個音用頌缽，其他維持」，
    // 所以「每段剛好一記缽、其餘都是石頭」是可以被斷言的（見 [4c]）。
    engine: {
      underwaterStone: () => { stats.stones++; },
      singingBowl: () => { stats.bowls++; },
    },
    sendHapticAll: () => { stats.haptics++; },
    beatPulse: () => {},
    play478Voice: () => {},
    requestAudioFadeIn: () => {},
    updateGuidedSession: () => {},
    complete478: () => { const m = state.guided.manual478; if (m) m.done = true; },
    clamp: (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v)),
  };
  const keys = Object.keys(env);
  const api = new Function(...keys, code)(...keys.map(k => env[k]));
  api.resetManual478();
  const phaseLog = {};       // name → 累計停留時間
  const minRemaining = {}, maxRemaining = {};
  // ⚠️ 2026-08-05：倒數的斷言必須看「**顯示了多久**」，不能只看有沒有出現過。
  // Pan 的回報是「我看不到所有數字倒數 例如 7 這段 竟然是從6開始」——而在有 bug 的版本裡
  // `startBangziPhase` 確實有把 m.remaining 設成 7，只是下一幀 tickManual478 立刻把它蓋成 6，
  // 所以 7 只「存在」了一幀（≤50ms）＝畫面上根本讀不到。舊的 maxRemaining.hold === 7 正是
  // 抽到那一幀的值，所以它對這個 bug 完全免疫（實驗證實：把修正 revert 掉，234 項仍全過）。
  // 這裡改記「連續同值的區段各持續幾 ms」，再用一個可讀門檻（見 [4c]）過濾。
  // 每一段各自記：`at` 是「這個數字第一次出現在畫面上時，距離段落開始幾 ms」——
  // 用來驗「數字換的時刻＝真的有一記石頭落下」（見 [4c]②）。
  const remainRuns = {};     // name → [{ v, ms, at }]（依出現順序）
  const trackRemain = (ms) => {
    const { m, phase } = api.manual478State();
    if (m.intro || m.done) return;
    const runs = remainRuns[phase.name] || (remainRuns[phase.name] = []);
    const last = runs[runs.length - 1];
    if (!last || last.v !== m.remaining) runs.push({ v: m.remaining, ms, at: clock.t - m.phaseStartedAt });
    else last.ms += ms;
  };
  const track = () => {
    const { m, phase } = api.manual478State();
    if (m.intro || m.done) return;
    const n = phase.name;
    minRemaining[n] = minRemaining[n] == null ? m.remaining : Math.min(minRemaining[n], m.remaining);
    maxRemaining[n] = maxRemaining[n] == null ? m.remaining : Math.max(maxRemaining[n], m.remaining);
  };
  return {
    get now() { return clock.t - 1000; },
    get pressCount() { return stats.presses; },
    get stoneCount() { return stats.stones; },
    get bowlCount() { return stats.bowls; },
    get hapticCount() { return stats.haptics; },
    minRemaining, maxRemaining, remainRuns,
    begin() { api.beginManual478(); track(); },
    phaseName() {
      const { m, phase } = api.manual478State();
      return m.done ? "done" : m.intro ? "intro" : phase.name;
    },
    phaseDur(name) { return phaseLog[name] || 0; },
    advance(ms) {
      const before = this.phaseName();
      clock.t += ms;
      // 到時間的假 timer 先跑（模擬瀏覽器）
      const due = env.timers.filter(t => t.at <= clock.t);
      for (const t of due) { env.clearTimeout(t); t.fn(); }
      api.tickManual478();
      const after = this.phaseName();
      // 停留時間記在「這一幀所處的段落」上。只累計**第一次造訪**：跑超過一輪時同名段落會再出現，
      // 全部加總的話 phaseDur 會變成兩倍（這正是本測試第一版自己踩到的坑）。
      if (!phaseLog.__done || !phaseLog.__done.has(before)) {
        phaseLog[before] = (phaseLog[before] || 0) + ms;
      }
      if (after !== before) {
        (phaseLog.__done || (phaseLog.__done = new Set())).add(before);
      }
      track();
      trackRemain(ms);
      return after !== before;
    },
  };
}

console.log("=== 4-7-8 梆子節拍 對拍測試 ===\n");

PAGES.forEach((page, pi) => {
  tag = `(${page.label}) `;
  const src = page.src;
  const { bangziPattern, bangziDuration, bangziGaps, consts, BANGZI_ACCENT,
          BANGZI_CURVE, BANGZI_CURVE_MIN, BANGZI_CURVE_MAX } = build(src);

  // Pan 指定的三段：4 → 起頭一下 + 三次；7 → 一下 + 六次；8 → 如法炮製
  const SPEC = [
    { count: 4, ticks: 3, label: "4（震動一下 + 三次）" },
    { count: 7, ticks: 6, label: "7（震動一下 + 六次）" },
    { count: 8, ticks: 7, label: "8（如法炮製）" },
  ];
  // 一段裡**全部**的間隔（含「重音 → 第一個點」那一段）。Pan 說的「第一拍拍下去有個較長間隔」
  // 講的正是這一段，所以不能像舊版那樣只看點與點之間——那會把要驗的東西排除在外。
  const allGaps = (p) => p.slice(1).map((x, i) => x.at - p[i].at);

  if (pi === 0) console.log("[1] 節拍形狀＝1 記重音 + (count−1) 個點");
  for (const s of SPEC) {
    const p = bangziPattern(s.count);
    ok(p.length === s.count, `${s.label}：總點數要等於 ${s.count}`, `實際 ${p.length}`);
    ok(p[0].accent === true, `${s.label}：第一記要是重音（梆子的「板」）`);
    ok(p.slice(1).every(x => x.accent === false), `${s.label}：後面的點都不是重音（「眼」）`);
    ok(p.filter(x => !x.accent).length === s.ticks,
       `${s.label}：由快到慢的點要正好 ${s.ticks} 次`, `實際 ${p.filter(x => !x.accent).length}`);
    if (pi === 0) console.log(`      ${s.count} → ${p.length} 點；間隔 ${allGaps(p).map(g => Math.round(g)).join(" → ")}ms`);
  }

  if (pi === 0) console.log("[2] 速度曲線＝長起頭 → 漸快 → 漸慢（取自 Pan 的 MIDI）");
  // 先驗曲線本身真的是那份 MIDI 量出來的比例（IOI / 最短的 57 tick）。
  // 沒有這一項的話，任何人都可以把 BANGZI_CURVE 換成自己編的數列而測試照樣通過——
  // 而 Pan 的要求正是「去學習那裡面的midi note之間的速度變化的相對關係」。
  {
    const MIDI_IOI = [116, 76, 73, 57, 57, 62, 76, 78, 96, 108];   // Tidal/midi_Accel_Rit_Rhythm.mid
    const want = MIDI_IOI.map(v => v / Math.min(...MIDI_IOI));
    ok(BANGZI_CURVE.length === want.length,
       `曲線要有 ${want.length} 個間隔（＝MIDI 的 11 個音）`, String(BANGZI_CURVE.length));
    ok(BANGZI_CURVE.every((v, i) => Math.abs(v - want[i]) < 0.02),
       "曲線的每一項要等於 MIDI 的 IOI 比例（誤差 <0.02）",
       BANGZI_CURVE.map((v, i) => `${v}/${want[i].toFixed(2)}`).join(" "));
    ok(Math.abs(BANGZI_CURVE_MIN - Math.min(...BANGZI_CURVE)) < 1e-9 &&
       Math.abs(BANGZI_CURVE_MAX - Math.max(...BANGZI_CURVE)) < 1e-9,
       "MIN/MAX 要真的是曲線的極值（強度插值靠它們正規化）");
  }
  for (const s of SPEC) {
    const p = bangziPattern(s.count);
    const ticks = p.filter(x => !x.accent);
    // 這裡看的是**全部**間隔，包含「重音 → 第一個點」——那正是 Pan 說的「第一拍拍下去有個較長間隔」。
    const gaps = allGaps(p);
    ok(gaps.length === s.ticks, `${s.label}：間隔數要等於點數`, `${gaps.length}`);
    // ① 第一個間隔最長（嚴格最大，不是並列）
    ok(gaps.every((g, i) => i === 0 || g < gaps[0]),
       `${s.label}：第一個間隔要是最長的（「第一拍拍下去有個較長間隔」）`,
       gaps.map(Math.round).join(","));
    if (gaps.length >= 3) {
      // ② 形狀要是「單一個谷」：先一路變短（accel）、過了最快點再一路變長（rit）。
      //    寫成「找最小值的位置，再檢查兩側各自單調」——比逐步比大小更能說明是哪種形狀壞了。
      const minIdx = gaps.indexOf(Math.min(...gaps));
      ok(minIdx > 0 && minIdx < gaps.length - 1,
         `${s.label}：最快的那一拍要在中間（前有漸快、後有漸慢）`,
         `最快在第 ${minIdx + 1}/${gaps.length} 個間隔`);
      let accel = true, rit = true;
      for (let i = 1; i <= minIdx; i++) if (gaps[i] > gaps[i - 1] + 1) accel = false;
      for (let i = minIdx + 1; i < gaps.length; i++) if (gaps[i] < gaps[i - 1] - 1) rit = false;
      ok(accel, `${s.label}：最快點之前要一路變短（accelerando）`, gaps.map(Math.round).join(","));
      ok(rit, `${s.label}：最快點之後要一路變長（ritardando）`, gaps.map(Math.round).join(","));
      // ③ 兩邊都要**聽得出來**（不是名義上的 accel/rit）。MIDI 的量級是 2.04→1.00→1.89，
      //    也就是各約 2 倍；門檻取 1.25 倍，留給重新取樣的內插誤差。
      ok(gaps[0] / gaps[minIdx] > 1.25, `${s.label}：漸快要有感（起頭 ÷ 最快 > 1.25）`,
         `${(gaps[0] / gaps[minIdx]).toFixed(2)}×`);
      ok(gaps[gaps.length - 1] / gaps[minIdx] > 1.25, `${s.label}：漸慢要有感（結尾 ÷ 最快 > 1.25）`,
         `${(gaps[gaps.length - 1] / gaps[minIdx]).toFixed(2)}×`);
    }
    // ④ 重新取樣、不是截斷：不管幾個點，頭尾都要落在曲線的頭尾（否則短段落只拿到前半＝沒有漸慢）
    ok(Math.abs(gaps[0] / consts.BANGZI_UNIT_MS - BANGZI_CURVE[0]) < 0.05,
       `${s.label}：第一個間隔要等於曲線的頭（重新取樣的證據）`,
       `${(gaps[0] / consts.BANGZI_UNIT_MS).toFixed(2)} vs ${BANGZI_CURVE[0]}`);
    ok(Math.abs(gaps[gaps.length - 1] / consts.BANGZI_UNIT_MS - BANGZI_CURVE[BANGZI_CURVE.length - 1]) < 0.05,
       `${s.label}：最後一個間隔要等於曲線的尾（截斷的話這裡會對不上）`,
       `${(gaps[gaps.length - 1] / consts.BANGZI_UNIT_MS).toFixed(2)} vs ${BANGZI_CURVE[BANGZI_CURVE.length - 1]}`);
    // ⑤ 強度跟著**當下的速度**走：最快處那一點要比結尾（最慢）強，結尾要比起頭弱。
    //    MIDI 的力度就是這樣（52→57→63→65 在最快處附近回升，尾端 50→39 才收掉）。
    const minIdx = gaps.indexOf(Math.min(...gaps));
    ok(ticks[minIdx].intensity > ticks[ticks.length - 1].intensity,
       `${s.label}：最密的那一點要比結尾強（密＝稍強，梆子的「緊起」）`,
       `${ticks[minIdx].intensity} vs ${ticks[ticks.length - 1].intensity}`);
    ok(ticks[ticks.length - 1].intensity < ticks[0].intensity,
       `${s.label}：結尾要比起頭弱（「慢收」）`,
       `${ticks[ticks.length - 1].intensity} vs ${ticks[0].intensity}`);
    ok(ticks.every(t => t.intensity >= consts.BANGZI_TICK_MIN - 1 && t.intensity <= consts.BANGZI_TICK_MAX + 1),
       `${s.label}：點的強度要留在有界範圍內（guardrail：有界參數）`);
    // 石頭大小要跟強度**同向**：這是原設計就有的語氣（「聲音跟著節奏一起沉下去」）——
    // 密的地方石頭大、聲音也強；收尾時石頭變小、聲音變弱，整段是淡出而不是戛然而止。
    // （underwaterStone 的 f0 = 190 − 70×size，所以 size 大＝低沉。慢的那幾點刻意用小石頭、
    //   小音量，是為了「淡出」，不是為了更低沉——這一項就是在釘住這個容易被寫反的方向。）
    ok(ticks[minIdx].size > ticks[ticks.length - 1].size,
       `${s.label}：最密的那一點石頭要比結尾大（size 與強度同向＝一起淡出）`,
       `${ticks[minIdx].size.toFixed(2)} vs ${ticks[ticks.length - 1].size.toFixed(2)}`);
    const sizeOrder = ticks.map(t => t.size);
    const intOrder = ticks.map(t => t.intensity);
    ok(sizeOrder.every((_, i) => i === 0 ||
         Math.sign(sizeOrder[i] - sizeOrder[i - 1]) === Math.sign(intOrder[i] - intOrder[i - 1])),
       `${s.label}：size 與 intensity 每一步都要同向（不能一個變大一個變小）`);
  }
  // 曲線的絕對快慢由 UNIT_MS 一個數字控制，它要落在「跟得上、又不會拖」的範圍
  ok(consts.BANGZI_UNIT_MS >= 500 && consts.BANGZI_UNIT_MS <= 1400,
     "BANGZI_UNIT_MS（最快那一拍）要在 0.5–1.4s", String(consts.BANGZI_UNIT_MS));
  ok(BANGZI_ACCENT.intensity > consts.BANGZI_TICK_MAX,
     "重音（板）要比任何一個點都強", `${BANGZI_ACCENT.intensity} vs ${consts.BANGZI_TICK_MAX}`);
  // 舊的單向幾何級數要真的移除（不是留在碼裡沒用——那會讓下一位以為它還有效）。
  // 註解裡還留著這兩個名字是**刻意**的：那段註解在解釋「為什麼移除」。所以這裡驗的是
  // 「沒有宣告、也沒有被用到」，不是「字串完全不出現」——否則會逼人把說明刪掉。
  for (const old of ["BANGZI_SLOWDOWN", "BANGZI_LEAD_MS"]) {
    ok(!new RegExp(`const ${old} = `).test(src), `舊的 ${old} 要不再宣告（與 Pan 的新指示相反）`);
    const pat = src.match(/function bangziPattern\(count\)\{[\s\S]*?\n\}/);
    ok(pat && !new RegExp(old).test(pat[0]), `bangziPattern 裡不能再用 ${old}`);
  }

  if (pi === 0) console.log("[3] 三段都照同一個規則（「也如法炮製」）");
  {
    // 用同一個公式產生：8 的形狀應該可以由 4 / 7 的規則外推
    const r = (c) => bangziPattern(c).filter(x => !x.accent).length;
    ok(r(4) === 3 && r(7) === 6 && r(8) === 7, "4/7/8 的點數要是 3/6/7", `${r(4)}/${r(7)}/${r(8)}`);
    // 段落時間要隨數字變長（8 比 7 長、7 比 4 長）＝吐氣段最長，符合 4-7-8 的用意
    const d4 = bangziDuration(4), d7 = bangziDuration(7), d8 = bangziDuration(8);
    ok(d4 < d7 && d7 < d8, "段落長度要 4 < 7 < 8", `${Math.round(d4)}/${Math.round(d7)}/${Math.round(d8)}ms`);
    if (pi === 0) console.log(`      段落長度 4→${(d4/1000).toFixed(1)}s、7→${(d7/1000).toFixed(1)}s、8→${(d8/1000).toFixed(1)}s`);
  }

  if (pi === 0) console.log("[4] 不再抓捏握（Pan：「就不抓取使用者的捏握了」）");
  {
    // 段落推進必須由時間驅動，不能再由握壓扣
    ok(/function tickManual478\(\)\{/.test(src), "要有時間驅動的 tickManual478");
    ok(/tickManual478\(\);/.test(src), "tickManual478 要真的被每幀呼叫");
    ok(/m\.phaseEndsAt/.test(src), "段落要有預定的結束時間（時間驅動的證據）");
    // 舊的握壓數拍機制要真的移除，不是留著沒用
    ok(!/beat478Armed/.test(src), "per-ball 數拍武裝（beat478Armed）要移除");
    ok(!/beat478Peak/.test(src), "per-ball 數拍峰值（beat478Peak）要移除");
    ok(!/MANUAL_478_REFRACTORY_MS = /.test(src), "握壓數拍的去重常數要移除（沒有拍要去重了）");
    ok(!/m\.remaining -= 1/.test(src), "不能再有「一握扣一拍」");
    ok(!/firstBeatPending/.test(src), "舊的「第一拍待發」狀態機要移除");
    // 握壓只剩「開始」這一個作用
    ok(/function beginManual478\(\)\{/.test(src), "要有 beginManual478（握一下開始）");
    const trig = src.match(/function trigger478Press\([\s\S]*?\n\}/);
    ok(!!trig, "要找得到 trigger478Press");
    if (trig) {
      ok(/if\(!m\.intro \|\| m\.done\) return;/.test(trig[0]),
         "開始之後的握壓要完全沒有作用（只有 intro 階段有效）");
      ok(!/advanceManual478/.test(trig[0]), "不能再呼叫舊的 advanceManual478");
    }
    ok(!/function advanceManual478/.test(src), "舊的 advanceManual478 要移除");
  }

  if (pi === 0) console.log("[4b] 真的跑一次：段落要靠時間自己走完 4→7→8→下一輪");
  {
    // 前面 [4] 都是 regex（「碼裡有沒有這段」）。這一項真的把 tickManual478 跑起來，
    // 用假時鐘推進時間、完全不碰握壓，驗證段落會自己前進——這是「不抓捏握」的行為證據。
    const st = buildTicker(src);
    const seen = [];
    let guard = 0;
    // 推進到第一輪 4→7→8 走完（用真的段落長度算上限，留 1.5 倍餘裕）
    const budget = (bangziDuration(4) + bangziDuration(7) + bangziDuration(8)) * 1.5;
    st.begin();
    seen.push(st.phaseName());
    while (st.now < budget && guard++ < 100000) {
      st.advance(50);                       // 每 50ms 跑一幀（比 60fps 疏，證明不依賴幀率）
      const n = st.phaseName();
      if (n !== seen[seen.length - 1]) seen.push(n);
    }
    ok(seen.length >= 3, "段落要自己往前走（不需要任何握壓）", `走過 ${seen.join(" → ")}`);
    ok(seen[0] === "inhale" && seen[1] === "hold" && seen[2] === "exhale",
       "順序要是 4(吸) → 7(停) → 8(吐)", seen.slice(0, 3).join(" → "));
    ok(st.pressCount === 0, "整段過程中不能有任何握壓輸入", `${st.pressCount} 次`);
    if (pi === 0) console.log(`      不碰握壓 ${(st.now / 1000).toFixed(1)}s → ${seen.join(" → ")}`);
    // 段落停留時間要接近 bangziDuration（畫面/聲音/推進三者要對得上）
    ok(Math.abs(st.phaseDur("inhale") - bangziDuration(4)) < 400,
       "吸氣段的實際停留時間要接近 bangziDuration(4)",
       `${Math.round(st.phaseDur("inhale"))} vs ${Math.round(bangziDuration(4))}ms`);
    ok(Math.abs(st.phaseDur("hold") - bangziDuration(7)) < 400,
       "屏息段的實際停留時間要接近 bangziDuration(7)",
       `${Math.round(st.phaseDur("hold"))} vs ${Math.round(bangziDuration(7))}ms`);
    // 倒數要從 count 走到 0（畫面的數字要跟實際的點對上）
    ok(st.minRemaining.inhale <= 1, "吸氣段的倒數要走到 0/1", String(st.minRemaining.inhale));
    ok(st.maxRemaining.hold === 7, "屏息段的倒數要從 7 開始", String(st.maxRemaining.hold));
  }

  if (pi === 0) console.log("[4c] Pan 2026-08-05 的三件回報：每個數字都看得到、每點都震、每段一記缽");
  {
    // ⚠️ 上面那條 maxRemaining.hold === 7 **對 Pan 的 bug 免疫**，這一段是它的替代品。
    // 驗證方式：把修好的那一行 revert 回 `phase.count - done`，這一段必須失敗（已實驗確認）。
    const st = buildTicker(src);
    st.begin();
    let guard = 0;
    // **剛好一輪**：走到 exhale 結束、要進下一輪的 inhale 的那一刻就停。
    // （多跑一點點就會把第二輪 inhale 的板算進來，數量與倒數都會多一筆——本測試第一版踩到。）
    let seenExhale = false;
    while (guard++ < 100000) {
      const changed = st.advance(50);
      const n = st.phaseName();
      if (n === "exhale") seenExhale = true;
      if (seenExhale && changed && n !== "exhale") break;
    }

    // ── ① 「我看不到所有數字倒數 例如 7 這段 竟然是從6開始」──────────────────────
    // 每一段都要**完整顯示 count → 1**，而且每個數字都要停留得夠久到讀得出來。
    // 400ms 這個門檻是刻意訂在「一幀（50ms）遠遠不夠」與「最短的真實拍距（880ms）之內」之間：
    // 有 bug 的版本裡起始數字只活一幀，一定被這條抓到。
    const READABLE_MS = 400;
    for (const [name, count] of [["inhale", 4], ["hold", 7], ["exhale", 8]]) {
      const runs = st.remainRuns[name] || [];
      const readable = runs.filter(r => r.ms >= READABLE_MS).map(r => r.v);
      for (let v = count; v >= 1; v--) {
        ok(readable.includes(v),
           `${name}（${count}）段的倒數要看得到 ${v}（停留 ≥${READABLE_MS}ms）`,
           `讀得到的是 ${readable.join(",") || "（無）"}`);
      }
      // 而且第一個讀得到的數字就是 count 本身（不是 count−1）——這正是 Pan 看到「7 從 6 開始」。
      ok(readable[0] === count,
         `${name} 段第一個讀得到的數字要是 ${count}，不是 ${count - 1}`,
         `實際是 ${readable[0]}`);
      // 倒數只能往下走，不能跳回去（時間表反推很容易寫成非單調）
      let mono = true;
      for (let i = 1; i < readable.length; i++) if (readable[i] > readable[i - 1]) mono = false;
      ok(mono, `${name} 段的倒數要單調遞減`, readable.join(","));

      // ── 數字換的**時刻**要跟聽到的點對上 ────────────────────────────────────
      // 倒數的語意是「還剩幾下要聽」，所以每次數字往下跳，都必須剛好是一記石頭落下的時候。
      // 若改成「按剩餘時間比例算」，數字會等速往下走，而梆子是先快後慢＝畫面與耳朵各走各的
      // （聽起來就是「數字跟聲音沒對上」）。用一格 50ms 的容差對時間表比。
      const beats = bangziPattern(count).map(p => p.at);
      const drops = runs.slice(1).filter(r => r.ms >= 100).map(r => r.at);   // 跳過抖動用的短段
      const offs = drops.map(t => Math.min(...beats.map(b => Math.abs(t - b))));
      const worst = offs.length ? Math.max(...offs) : 0;
      ok(worst <= 60,
         `${name} 段：倒數換數字的時刻要落在某一記的時間點上（畫面要跟耳朵對齊）`,
         `最遠差 ${Math.round(worst)}ms（拍點 ${beats.map(Math.round).join(",")}）`);
    }

    // ── ② 「有些數字有震動 有些沒有」────────────────────────────────────────────
    // 這一輪響了幾記，就要送出同樣多次震動：一次都不能被 sendHaptic 的 95ms 節流吃掉。
    const beats = bangziPattern(4).length + bangziPattern(7).length + bangziPattern(8).length;
    ok(st.hapticCount === beats,
       "一輪裡每一記（板＋眼）都要有一次震動，不能有點沒震動",
       `${st.hapticCount} 次震動 vs ${beats} 記`);
    ok(st.stoneCount + st.bowlCount === beats,
       "聲音的次數也要對得上（震動與聲音同步）",
       `${st.stoneCount + st.bowlCount} vs ${beats}`);

    // ── ③ 「每段第一個音可以用頌缽 其他聲音維持目前設定」────────────────────────
    ok(st.bowlCount === 3, "一輪三段＝剛好三記頌缽（每段第一個音）", `${st.bowlCount} 記`);
    ok(st.stoneCount === beats - 3, "其餘的點全部維持水中石頭",
       `${st.stoneCount} vs ${beats - 3}`);
    if (pi === 0) console.log(`      一輪 ${beats} 記：頌缽 ${st.bowlCount} + 石頭 ${st.stoneCount}，震動 ${st.hapticCount} 次`);
  }

  if (pi === 0) console.log("[5] 「只在問問題還有前面自由呼吸保持原狀」");
  {
    // 抵達流程（問問題）用的是 handleArrivalGrip / ARRIVAL_PRESS_ON，不能被動到
    ok(/function handleArrivalGrip\(/.test(src), "抵達流程的握壓處理要保持存在");
    ok(/const ARRIVAL_PRESS_ON = /.test(src), "抵達流程的握壓門檻要保持存在");
    ok(/const ARRIVAL_PRESS_OFF = /.test(src), "抵達流程的放開門檻要保持存在");
    // 結束後問卷也是握壓作答，不能動到
    ok(/function updateAfter\(/.test(src), "結束後問卷的逐幀握壓讀取要保持存在");
    // 其他呼吸 preset（自由呼吸/共振等）仍走原本的 guideHapticsForPhase
    ok(/if\(presetId === "resonance"\)\{/.test(src), "共振呼吸的引導要保持原狀");
    ok(/function guideHapticsForPhase\(/.test(src), "其他 preset 的引導函式要保持存在");
    // 而且 478 不能再走進 guideHapticsForPhase（它的 478 分支已移除）
    const gh = src.match(/function guideHapticsForPhase\([\s\S]*?\n\}\n\nfunction/);
    if (gh) ok(!/presetId === "hold478"/.test(gh[0]), "guideHapticsForPhase 裡不該再有 478 分支");
  }

  if (pi === 0) console.log("[6] 水中圓石的聲音特徵");
  {
    const st = src.match(/underwaterStone\(azimuth = 0[\s\S]*?\n  \}/);
    ok(!!st, "要有 underwaterStone");
    if (st) {
      const s = st[0];
      // 低沉：f0 要遠低於頌缽的 300Hz
      const f0 = s.match(/const f0 = (\d+) - (\d+) \* clamp\(size\)/);
      ok(!!f0, "f0 要由石頭大小決定");
      if (f0) {
        const hi = Number(f0[1]), lo = Number(f0[1]) - Number(f0[2]);
        ok(hi <= 220 && lo >= 90, "f0 要落在 90–220Hz（低沉，且在阿朗壹的 120–500Hz 主帶）",
           `${lo}–${hi}Hz`);
      }
      // 水：一定要有 lowpass（水把高頻吃掉＝「在水裡」最關鍵的線索）
      ok(/water\.type = "lowpass"/.test(s), "要有水的 lowpass");
      const wf = s.match(/water\.frequency\.value = (\d+)/);
      ok(wf && Number(wf[1]) <= 1400, "水的 lowpass 要壓在 1.4kHz 以下（悶在水裡）", wf ? wf[1] : "?");
      // 短衰減＝「篤」不是「鳴」（否則密集連擊會糊成一團，聽不出由快到慢）
      const dec = s.match(/const decays = \[([\d.,\s]+)\]/);
      ok(!!dec, "要有 decays");
      if (dec) {
        const ds = dec[1].split(",").map(x => Number(x.trim()));
        ok(Math.max(...ds) < 0.7, "最長衰減要短於 0.7s（連擊不糊）", `${Math.max(...ds)}s`);
        // 最快的間隔也要比衰減長，否則兩點會疊在一起
        ok(Math.max(...ds) * 1000 < consts.BANGZI_UNIT_MS * 1.6,
           "衰減要短於最快的拍距（不然由快到慢聽不出來）",
           `衰減 ${Math.max(...ds) * 1000}ms vs 拍距 ${consts.BANGZI_UNIT_MS}ms`);
      }
      ok(/panningModel = "HRTF"/.test(s), "要走 HRTF（跟聲景其他一次性聲音一致）");
      ok(/clamp\(intensity, 0\.15, 1\)/.test(s), "音量要有界（guardrail：限幅保護）");
    }
    // 節拍要真的用這個聲音
    ok(/engine\.underwaterStone\(/.test(src), "梆子節拍要真的擊發 underwaterStone");
    ok(!/playBowlForHands\(\);\s*\n\s*updateGuidedSession/.test(src), "不該再用頌缽當段落聲");
  }

  if (pi === 0) console.log("[7] 絕對時間要能跟著呼吸（該論文的機制：給一個比現在更慢的節律）");
  {
    // 4-7-8 的用意是吸4/停7/吐8。梆子段落長度要落在「可以真的照著呼吸」的範圍：
    // 吸氣段 3–8 秒、吐氣段 6–20 秒（比吸氣長＝副交感），且整輪不要長到失去 4-7-8 的形狀。
    const d4 = bangziDuration(4), d7 = bangziDuration(7), d8 = bangziDuration(8);
    ok(d4 >= 3000 && d4 <= 9000, "吸氣段（4）要 3–9 秒", `${(d4 / 1000).toFixed(1)}s`);
    ok(d8 >= 6000 && d8 <= 22000, "吐氣段（8）要 6–22 秒", `${(d8 / 1000).toFixed(1)}s`);
    ok(d8 > d4, "吐氣要比吸氣長（副交感）", `${(d8 / 1000).toFixed(1)}s vs ${(d4 / 1000).toFixed(1)}s`);
    const cycle = d4 + d7 + d8;
    ok(cycle >= 20000 && cycle <= 50000, "一整輪 4-7-8 要 20–50 秒", `${(cycle / 1000).toFixed(1)}s`);
    // 慢：整輪換算成「每分鐘幾次呼吸」要明顯低於平靜的 12–16 bpm（該論文的核心＝比現在更慢）
    const bpm = 60000 / cycle;
    ok(bpm < 3.5, "換算成每分鐘呼吸次數要遠低於平常（＝一個更慢的外部節律）",
       `${bpm.toFixed(1)} 次/分`);
    if (pi === 0) console.log(`      一輪 ${(cycle / 1000).toFixed(1)}s ＝ ${bpm.toFixed(1)} 次呼吸/分`);
    // 目標輪數 × 一輪 ＝ 整段練習長度，要在數分鐘的量級（不能一輪就 5 分鐘）
    const cyc = Number(src.match(/const MANUAL_478_TARGET_CYCLES = (\d+)/)[1]);
    const total = cycle * cyc / 1000;
    ok(total >= 60 && total <= 400, "整段練習要 1–7 分鐘", `${total.toFixed(0)}s（${cyc} 輪）`);
    if (pi === 0) console.log(`      ${cyc} 輪 ＝ 約 ${(total / 60).toFixed(1)} 分鐘`);
  }

  if (pi === 0) console.log("[8] 震動：Pan 要求的，但仍守「不作為懲罰或催促」");
  {
    // 這批震動是 Pan 2026-08-04 明確要求的，所以走 force（繞過 HAPTICS_ENABLED）
    ok(/sendHapticAll\(p\.intensity, p\.duration, true\)/.test(src),
       "梆子的震動要用 force（Pan 明確要求 → HAPTICS_ENABLED 的守則已由 Pan 確認）");
    // 但總開關本身不能被偷偷打開（其他地方的自動震動仍然要是關的）
    ok(/const HAPTICS_ENABLED = false/.test(src),
       "HAPTICS_ENABLED 仍要維持 false（只有明確 force 的地方才震）");
    // 不作為催促：震動只掛在梆子的時間表上，不能因為「使用者沒做什麼」而觸發
    const pb = src.match(/function playBangziPhase\([\s\S]*?\n\}/);
    ok(!!pb, "要找得到 playBangziPhase");
    if (pb) {
      ok(!/grip|press|level/i.test(pb[0]),
         "梆子的震動不能看使用者的握壓（＝不催促、不獎懲）");
      ok(/state\.guided\.hapticTimers\.push/.test(pb[0]),
         "排出去的 timer 要登記（否則離開段落時取消不掉＝殘留震動）");
    }
    // 離開/完成/換 preset 都要取消還沒發的點
    const cp = src.match(/function complete478\(\)\{[\s\S]*?\n\}/);
    ok(cp && /clearGuidedHaptics\(\)/.test(cp[0]), "完成時要取消還沒發完的梆子點");
    ok(/clearGuidedHaptics\(\);\s*\n\s*const pattern = bangziPattern/.test(src),
       "起新段落前要先清掉上一段的殘留");

    // ── 震動時長（Pan 2026-08-05：「有些數字有震動 有些沒有」）───────────────────
    // 原本點是寫死 34ms，比協定文件的範例（GRIPBALL_PROTOCOL.md:73 的 50ms）還短，
    // 短到一部分點在真球上感覺不到。BANGZI_TICK_MS 就是為此加的，這裡把「不能又被調回去」釘住。
    const tickMs = consts.BANGZI_TICK_MS;
    ok(!Number.isNaN(tickMs), "要有 BANGZI_TICK_MS（點的震動時長）");
    ok(tickMs >= 50, "點的震動時長要 ≥ 協定範例的 50ms（太短在真球上感覺不到）", `${tickMs}ms`);
    ok(tickMs < BANGZI_ACCENT.duration,
       "但仍要短於板（重音）的時長——板要聽/摸得出比眼重",
       `眼 ${tickMs}ms vs 板 ${BANGZI_ACCENT.duration}ms`);
    ok(/duration: BANGZI_TICK_MS,/.test(src),
       "bangziPattern 的點要真的吃 BANGZI_TICK_MS（不能又寫死一個數字）");
    ok(!/duration: 34\b/.test(src), "不能留著寫死的 34ms");
    // 不會被節流吃掉：sendHaptic 有 95ms 節流窗，而最短的拍距要遠大於它。
    const throttle = Number((src.match(/if\(now - lastHaptic\[slot\] < (\d+)\)/) || [])[1]);
    ok(!Number.isNaN(throttle), "要找得到 sendHaptic 的節流窗");
    let minGap = Infinity;
    for (const c of [4, 7, 8]) {
      const p = bangziPattern(c);
      for (let i = 1; i < p.length; i++) minGap = Math.min(minGap, p[i].at - p[i - 1].at);
    }
    ok(minGap > throttle * 2,
       "最短的拍距要遠大於節流窗（否則會有點被吃掉＝Pan 說的「有些沒有」）",
       `最短拍距 ${minGap}ms vs 節流 ${throttle}ms`);
    // 震動時長本身也不能長到蓋過下一拍（會連成一片，失去「一點一點」的感覺）
    ok(Math.max(tickMs, BANGZI_ACCENT.duration) < minGap / 4,
       "震動時長要遠短於拍距（一點一點，不是連續嗡嗡）",
       `最長 ${Math.max(tickMs, BANGZI_ACCENT.duration)}ms vs 拍距 ${minGap}ms`);
    if (pi === 0) console.log(`      震動：板 ${BANGZI_ACCENT.duration}ms／眼 ${tickMs}ms，最短拍距 ${minGap}ms（節流 ${throttle}ms）`);
  }

  if (pi === 0) console.log("[9] 每段第一個音用頌缽（Pan 2026-08-05）");
  {
    const pb = src.match(/function playBangziPhase\([\s\S]*?\n\}/);
    ok(!!pb, "要找得到 playBangziPhase");
    if (pb) {
      // 分岔必須看 p.accent（＝時間表上的板），不是看第幾次呼叫或使用者輸入
      ok(/if\(p\.accent\) engine\.singingBowl\(/.test(pb[0]),
         "板（每段第一個音）要用 singingBowl");
      ok(/else engine\.underwaterStone\(/.test(pb[0]),
         "其餘的點要維持 underwaterStone（Pan：「其他聲音維持目前設定」）");
      // 反面：不能兩種都打（會變成缽＋石頭疊在同一記上）
      const bowlCalls = (pb[0].match(/engine\.singingBowl\(/g) || []).length;
      const stoneCalls = (pb[0].match(/engine\.underwaterStone\(/g) || []).length;
      ok(bowlCalls === 1 && stoneCalls === 1,
         "板與眼各一個呼叫點（不能無條件兩種都打）", `缽 ${bowlCalls} / 石 ${stoneCalls}`);
    }
    // singingBowl 要真的存在、而且它的冷卻不會吃掉板（板與板至少隔一整段）
    const bowl = src.match(/singingBowl\(azimuth = 0[\s\S]*?\n  \}/);
    ok(!!bowl, "要找得到 singingBowl");
    if (bowl) {
      const cd = bowl[0].match(/now - \(?this\.lastBowl[^<]*< ([\d.]+)/);
      ok(!!cd, "要找得到頌缽的冷卻時間");
      const shortest = Math.min(bangziDuration(4), bangziDuration(7), bangziDuration(8));
      if (cd) ok(Number(cd[1]) * 1000 < shortest,
                 "頌缽的冷卻要短於最短的段落長度（否則有的段落會沒有板）",
                 `冷卻 ${cd[1]}s vs 最短段落 ${(shortest / 1000).toFixed(1)}s`);
    }
    // 頌缽的長衰減之所以在這裡沒問題，是因為一段只有一記板。這件事要能被測到：
    ok(bangziPattern(4).filter(p => p.accent).length === 1, "一段只有一記板（4）");
    ok(bangziPattern(8).filter(p => p.accent).length === 1, "一段只有一記板（8）");
  }
});
tag = "";

console.log("\n" + "=".repeat(60));
if (failures.length) {
  console.log(`${passed} 項通過，${failures.length} 項失敗：\n`);
  failures.forEach(f => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`全部通過：${passed} 項斷言。`);
