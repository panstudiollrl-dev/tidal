#!/usr/bin/env node
/**
 * 對拍測試：零點自我修正（Pan 2026-08-04 回饋）。
 *
 * Pan 跑了一次之後的兩個症狀，本測試證明它們是**同一個 bug**，並驗證修好了：
 *   ①「一剛開始鬆開手水位還是會跑到全滿」
 *   ②「478 一剛開始按壓會不太有反應 然後突然 bang＋震動好幾次」
 *
 * 成因：零點在「手已經握著」時取樣 → baseline 寫成握著的值。之後放開 → rawDev 是大負值
 * → update() 的 Math.abs() → 水位全滿（症狀①）；按壓 → raw 往 baseline 靠 → posDelta
 * 變小 → 量不到上升邊（症狀②前半）；再過幾秒零點被慢慢修回來 → 極性翻正 → 積著的邊一起
 * 認列（症狀②後半）。
 *
 * 沿用 tmp/sim_grip_nocalib.js 的做法：regex 從 index.html 抽**真正的** GripCalibrator
 * 與常數出來跑，不在這裡重寫一份（重寫的話測的就不是上線的碼）。
 *
 * 用法：node tmp/sim_grip_rezero.js
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

// ── 從 index.html 抽真的常數與 class（含 performance.now 的假時鐘）─────────────
function build(src) {
  const names = [
    "GRIP_FULL_SCALE", "GRIP_BASELINE_MS", "GRIP_HEADROOM", "GRIP_LEVEL_ATTACK", "GRIP_LEVEL_RELEASE",
    "GRIP_REST_MARGIN", "EDGE_ON_FRAC", "EDGE_ON_MIN_RAW", "EDGE_REARM_FRAC", "EDGE_FLOOR_RISE",
    "GRIP_GAMMA", "GRIP_DEADZONE", "GRIP_HIST_BIN", "GRIP_HIST_MIN_MS", "GRIP_REZERO_MS",
    "GRIP_REZERO_MIN_SHIFT", "GRIP_BEAT_REFRACTORY_MS", "GRIP_SETTLE_MS", "GRIP_SETTLE_MIN_SHIFT",
  ];
  const consts = names.map(n => {
    const m = src.match(new RegExp(`const ${n} = ([\\d.]+)`));
    if (!m) throw new Error(`抽不到常數 ${n}`);
    return `const ${n} = ${m[1]};`;
  }).join("\n");
  const cls = src.match(/class GripCalibrator \{[\s\S]*?\n\}/);
  if (!cls) throw new Error("抽不到 class GripCalibrator");
  const clock = { t: 0 };
  const factory = new Function("clock", `
    const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));
    const performance = { now: () => clock.t };
    ${consts}
    ${cls[0]}
    return { GripCalibrator, consts: { ${names.join(", ")} } };
  `);
  return { clock, ...factory(clock) };
}

// 一次「跑」：把一串 raw 值餵進去，回傳每一筆的水位與是否觸發拍
function run(src, samples, hz = 80) {
  const { clock, GripCalibrator } = build(src);
  const c = new GripCalibrator();
  const dt = 1000 / hz;
  const out = [];
  for (const raw of samples) {
    clock.t += dt;
    const level = c.update(raw);
    out.push({ t: clock.t, raw, level, pulse: !!(c.edge && c.edge.pulse), baseline: c.baseline });
  }
  return { out, c };
}
const seconds = (n, hz = 80) => Math.round(n * hz);
const noise = (i, amp = 6) => Math.sin(i * 2.1) * amp + Math.sin(i * 0.37) * amp * 0.6;

console.log("=== 零點自我修正 對拍測試 ===\n");

PAGES.forEach((page, pi) => {
  tag = `(${page.label}) `;
  const src = page.src;
  const { consts } = build(src);
  const REST = 300;               // 「拿著不握」的 raw（任意值，測的是相對量）
  const GRIP = 900;               // 握下去 +900（協定實測全力 ≈ +1250；這裡用明確握）

  if (pi === 0) console.log("[1] 症狀①：一開始就握著連上 → 放開不能變成全滿");
  {
    // 情境：連上時手已經握著（Pan 的 log 症狀），握 2 秒後放開、然後一直不握
    const s = [];
    for (let i = 0; i < seconds(2); i++) s.push(REST + GRIP + noise(i));       // 一開始就握著
    for (let i = 0; i < seconds(8); i++) s.push(REST + noise(i));              // 放開，之後都不握
    const { out, c } = run(src, s);
    const release = seconds(2);
    // 注意水位是**放開之後**才衝高的（握著的時候 raw 就等於寫錯的 baseline，dev=0 反而是 0），
    // 所以要量的是「最後一次高水位到什麼時候為止」，不是「第一次低於門檻」——後者在放開的
    // 那一瞬間就成立，會讓這條斷言變成空的。
    const peak = Math.max(...out.slice(release).map(o => o.level));
    ok(peak > 0.5, "先確認這個情境真的重現了症狀①（放開後水位確實衝到全滿）",
       `放開後峰值 ${peak.toFixed(2)}`);
    let lastHigh = null;
    for (let i = release; i < out.length; i++) if (out[i].level >= 0.06) lastHigh = out[i].t;
    const healedAt = lastHigh == null ? 0 : lastHigh - out[release].t;
    ok(healedAt < 3000, "假的全滿水位要在 ~3 秒內自己消掉（不能整場卡在全滿）",
       `持續了 ${healedAt.toFixed(0)}ms`);
    // 收斂之後就必須真的穩住在 0（不能修好又飄回全滿）
    const settled = out.slice(release + seconds(4));
    const maxAfter = Math.max(...settled.map(o => o.level));
    ok(maxAfter < 0.06, "收斂之後水位要穩住在 0（不能修好又飄回去）",
       `之後最高水位 ${maxAfter.toFixed(2)}`);
    // 「零點真的被換掉了」而不是「水位剛好掉下來」——後者可能是漂移吸收假裝出來的。
    // ⚠️ 不要寫成 `rezeroCount >= 1`：那是在斷言**用哪條路修的**，不是修好了沒有。
    // 2026-08-05 加了「零點下方的平台」那條之後，這個情境會由它先修（放開後 600ms，
    // 比眾數那套的 GRIP_HIST_MIN_MS 1500ms 早），於是零點在眾數還沒湊到門檻前就已經正確，
    // `Math.abs(sum/n - baseline) >= GRIP_REZERO_MIN_SHIFT` 不再成立 → rezeroCount 停在 0。
    // 那是**正確的優先順序**（證據更強、更快的先出手），不是回歸。
    ok(c.rezeroCount + c.settleCount >= 1, "應該要偵測到零點錯了並換掉（哪一條路修的都算）",
       `rezeroCount=${c.rezeroCount} settleCount=${c.settleCount}`);
    ok(Math.abs(c.baseline - REST) < 60, "修正後的零點要落在真正的靜止值附近",
       `baseline=${c.baseline.toFixed(0)}，真值 ${REST}`);
    if (pi === 0) console.log(`      放開後峰值 ${peak.toFixed(2)}、持續 ${healedAt.toFixed(0)}ms 後消掉；之後最高 ${maxAfter.toFixed(2)}；重取 ${c.rezeroCount} 次；baseline ${c.baseline.toFixed(0)}（真值 ${REST}）`);
  }

  if (pi === 0) console.log("[2] 症狀②：零點錯的期間，按壓不能沒反應、也不能突然連發");
  {
    // 情境：一開始握著連上 → 放開 → 之後每秒握一下（4-7-8 的數拍節奏）
    const s = [];
    for (let i = 0; i < seconds(1.5); i++) s.push(REST + GRIP + noise(i));     // 握著連上
    for (let i = 0; i < seconds(1.5); i++) s.push(REST + noise(i));            // 放開
    const beats = 8;
    for (let b = 0; b < beats; b++) {                                          // 每秒一拍：握 0.35s、放 0.65s
      for (let i = 0; i < seconds(0.35); i++) s.push(REST + GRIP + noise(i));
      for (let i = 0; i < seconds(0.65); i++) s.push(REST + noise(i));
    }
    const { out } = run(src, s);
    const pulses = out.filter(o => o.pulse);
    ok(pulses.length >= beats - 1, `${beats} 次握壓要數到至少 ${beats - 1} 拍（不能「按了沒反應」）`,
       `只數到 ${pulses.length} 拍`);
    ok(pulses.length <= beats + 1, `也不能超過 ${beats + 1} 拍（不能「突然 bang 好幾次」）`,
       `數到 ${pulses.length} 拍`);
    // 「連發」的量化判準：兩拍之間不能擠在 300ms 內（真實數拍是 ~1 拍/秒）
    let minGap = Infinity;
    for (let i = 1; i < pulses.length; i++) minGap = Math.min(minGap, pulses[i].t - pulses[i - 1].t);
    ok(pulses.length < 2 || minGap > 300, "相鄰兩拍不能擠在 300ms 內（＝bang 好幾次）",
       `最小間距 ${minGap === Infinity ? "n/a" : minGap.toFixed(0) + "ms"}`);
    if (pi === 0) console.log(`      ${beats} 次握壓 → 數到 ${pulses.length} 拍，最小間距 ${minGap === Infinity ? "n/a" : minGap.toFixed(0) + "ms"}`);
  }

  if (pi === 0) console.log("[2b] 一次持續長握只能算一拍（不能每過一次不反應期就再算一拍）");
  {
    // 這一項是為了釘住「不反應期只擋算拍、不擋解除武裝」。如果把解除武裝也一起擋掉，
    // 這一握永遠不會結束，於是每過一次不反應期就再算一拍＝另一種形式的「bang 好幾次」。
    // 刻意放在零點修正的窗之外（9 秒後），免得跟 [5] 的取捨糾纏在一起。
    const s = [];
    for (let i = 0; i < seconds(9); i++) s.push(REST + noise(i));
    for (let i = 0; i < seconds(3); i++) s.push(REST + GRIP + noise(i, 3));      // 一次握 3 秒不放
    const { out } = run(src, s);
    const pulses = out.filter(o => o.pulse);
    ok(pulses.length === 1, "持續握 3 秒＝1 拍（不是每 400ms 再算一拍）", `數到 ${pulses.length} 拍`);
    if (pi === 0) console.log(`      持續握 3 秒 → 數到 ${pulses.length} 拍`);

    // 被不反應期擋掉的那一握，仍然必須「結束」。否則它會一直武裝著，等不反應期一過就自己補一拍
    // ——使用者只握了一次，卻收到兩次 bang。這需要「快速再握一次然後按住」才測得出來：
    //   握一下(算第 1 拍) → 很快再握(被擋掉) → 這次按住不放
    // 正確：第二握被擋掉但仍解除武裝 ⇒ 全程 1 拍。壞掉：不反應期一過就補第 2 拍。
    const s2 = [];
    for (let i = 0; i < seconds(9); i++) s2.push(REST + noise(i));
    for (let i = 0; i < seconds(0.15); i++) s2.push(REST + GRIP + noise(i, 3));   // 第 1 握（算拍）
    for (let i = 0; i < seconds(0.1); i++) s2.push(REST + noise(i));              // 很短的放
    for (let i = 0; i < seconds(2); i++) s2.push(REST + GRIP + noise(i, 3));      // 第 2 握：按住不放
    const { out: o2 } = run(src, s2);
    const p2 = o2.filter(o => o.pulse);
    ok(p2.length === 1,
       "被不反應期擋掉的那一握仍要「結束」（否則不反應期一過就自己補一拍）",
       `數到 ${p2.length} 拍`);
    if (pi === 0) console.log(`      握一下→很快再握並按住 → 數到 ${p2.length} 拍`);
  }

  if (pi === 0) console.log("[2c] 連續數拍不能讓「握著」偷走零點");
  {
    // 真實踩到的 bug（2026-08-04，用 tmp/_dbg.js beats 發現）：零點修正原本只要求挑戰者
    // 「待滿 GRIP_HIST_MIN_MS」。但 4-7-8 數拍是每秒握 0.35 秒，連握 5 拍之後**握著那一格**
    // 的累計佔用就超過 1.5 秒 → 零點被搬到握著的值 → 放開後水位卡在 0.8（正是 Pan 的症狀①，
    // 只是成因換成數拍）。修法：挑戰者必須佔用得比「零點所在那一格」還多（眾數的定義）。
    const s = [];
    for (let i = 0; i < seconds(1.5); i++) s.push(REST + noise(i));              // 正常靜止起手
    for (let b = 0; b < 8; b++) {                                               // 每秒一拍，共 8 拍
      for (let i = 0; i < seconds(0.35); i++) s.push(REST + GRIP + noise(i));
      for (let i = 0; i < seconds(0.65); i++) s.push(REST + noise(i));
    }
    for (let i = 0; i < seconds(1.5); i++) s.push(REST + noise(i));             // 最後放開、讓慢落走完
    const { out, c } = run(src, s);
    ok(c.rezeroCount === 0, "數拍不該觸發重取零點（零點本來就對）", `rezeroCount=${c.rezeroCount}`);
    ok(Math.abs(c.baseline - REST) < 60, "數拍之後零點要還在真正的靜止值附近（不能被握壓偷走）",
       `baseline=${c.baseline.toFixed(0)}，真值 ${REST}`);
    // 最後一拍放開之後，水位必須落回 0——零點被偷走的話它會停在 ~0.8 不動。
    // 只看放開段的**末端**：GRIP_LEVEL_RELEASE=0.05（時間常數 ~250ms）是刻意的慢落
    // （「浪退本來就比湧慢」），放開後前 0.3 秒還在衰減途中，那不是 bug。
    const released = out.slice(out.length - seconds(0.15));
    ok(Math.max(...released.map(o => o.level)) < 0.06,
       "最後一拍放開後水位要落回 0（零點被偷走時會卡在高水位不動）",
       `最高 ${Math.max(...released.map(o => o.level)).toFixed(2)}`);
    if (pi === 0) console.log(`      8 拍之後：baseline ${c.baseline.toFixed(0)}（真值 ${REST}）、重取 ${c.rezeroCount} 次、放開後水位 ${Math.max(...released.map(o => o.level)).toFixed(2)}`);
  }

  if (pi === 0) console.log("[2d] 微小漂移不該用掉「只有一次」的重取零點額度");
  {
    // 這一項守的是 GRIP_REZERO_MIN_SHIFT。[2c] 的 ms > baseMs 是另一道獨立的守門：
    // 它擋的是「挑戰者佔用不夠多」，擋不住「挑戰者佔用真的比較多、但只挪了一點點」——
    // 零點只用 700ms 取樣，之後手放著微調一下握姿（幾十個 raw）就停在那裡不動，
    // 那一格的佔用時間必然超過 700ms＝贏過現任者。
    //
    // 為什麼不值得換：這種量級的漂移本來就由 restRef 的慢跟吸收掉，水位一直是 0，換零點
    // 反而有代價——重取零點是**一次性**的（rezeroCount === 0 當守門），用在這裡就等於
    // 把額度燒掉，之後真的遇到「握著連上」的錯零點（症狀①）就再也修不回來了。
    //
    // 注意漂移必須「漂到就停住」，不能是一路慢慢爬：爬的話佔用時間被攤到很多格，
    // 誰都贏不過零點那一格，於是 ms > baseMs 就先擋掉了，這條斷言會變成空的
    // （本測試第一版就是寫成斜坡，MIN_SHIFT=0 的變異照樣逃掉）。
    const DRIFT = 50;                                  // < GRIP_REZERO_MIN_SHIFT(90)＝「不值得換」的量級
    const s = [];
    for (let i = 0; i < seconds(1.2); i++) s.push(REST + noise(i, 4));            // 零點在這裡取樣
    for (let i = 0; i < seconds(6); i++) s.push(REST + DRIFT + noise(i, 4));      // 漂 50 raw 然後停住
    const { out, c } = run(src, s);
    ok(c.rezeroCount === 0, "微小漂移（< MIN_SHIFT）不該重取零點——額度要留給真的錯零點",
       `rezeroCount=${c.rezeroCount}`);
    const lv = Math.max(...out.slice(seconds(1.5)).map(o => o.level));
    ok(lv < 0.06, "微小漂移期間水位要一直是 0（restRef 的慢跟就夠了，不必動零點）",
       `最高 ${lv.toFixed(3)}`);
    if (pi === 0) console.log(`      漂 ${DRIFT}raw 後停住：重取 ${c.rezeroCount} 次、最高水位 ${lv.toFixed(3)}`);
  }

  if (pi === 0) console.log("[3] 極性相反的球（raw 握下去變小）也要一樣成立");
  {
    // Math.abs() 的用意就是不猜極性。零點修正也必須對兩種極性都對。
    const s = [];
    for (let i = 0; i < seconds(2); i++) s.push(REST - GRIP + noise(i));       // 握著連上（往下）
    for (let i = 0; i < seconds(8); i++) s.push(REST + noise(i));
    const { out, c } = run(src, s);
    const release = seconds(2);
    let lastHigh = null;
    for (let i = release; i < out.length; i++) if (out[i].level >= 0.06) lastHigh = out[i].t;
    const healedAt = lastHigh == null ? 0 : lastHigh - out[release].t;
    ok(healedAt < 3000, "極性相反的球，假的全滿水位也要在 ~3 秒內自己消掉",
       `持續了 ${healedAt.toFixed(0)}ms`);
    const settled = out.slice(release + seconds(4));
    ok(Math.max(...settled.map(o => o.level)) < 0.06, "極性相反時收斂後也要穩住在 0",
       `最高 ${Math.max(...settled.map(o => o.level)).toFixed(2)}`);
    ok(Math.abs(c.baseline - REST) < 60, "極性相反時零點也要修對", `baseline=${c.baseline.toFixed(0)}`);
  }

  if (pi === 0) console.log("[4] 不能弄壞正常情形（沒握著連上）");
  {
    const s = [];
    for (let i = 0; i < seconds(3); i++) s.push(REST + noise(i));              // 正常：拿著不握
    for (let i = 0; i < seconds(1); i++) s.push(REST + GRIP + noise(i));       // 握一下
    for (let i = 0; i < seconds(2); i++) s.push(REST + noise(i));
    const { out, c } = run(src, s);
    const idle = out.slice(seconds(1), seconds(3));
    ok(Math.max(...idle.map(o => o.level)) < 0.06, "正常情形：拿著不握水位要 ~0",
       `最高 ${Math.max(...idle.map(o => o.level)).toFixed(3)}`);
    const gripped = out.slice(seconds(3) + seconds(0.5), seconds(4));
    ok(Math.max(...gripped.map(o => o.level)) > 0.5, "正常情形：明確握要有明顯水位",
       `最高 ${Math.max(...gripped.map(o => o.level)).toFixed(2)}`);
    ok(c.rezeroCount === 0, "正常情形不該重取零點（零點本來就對）", `rezeroCount=${c.rezeroCount}`);
    if (pi === 0) console.log(`      正常情形：閒置 ${Math.max(...idle.map(o => o.level)).toFixed(3)}、握 ${Math.max(...gripped.map(o => o.level)).toFixed(2)}、重取 ${c.rezeroCount} 次`);
  }

  if (pi === 0) console.log("[5] 長握 vs 零點修正：把那個「無法消除」的取捨釘住");
  {
    // 「一開始握著→放開」跟「先靜止→刻意長握」的 raw 結構完全一樣（都是「在 A 待一下、跑到 B
    // 待著」，零點都取在 A），能區分的只有「在 B 待多久」。所以測試不能兩邊都要求成立——
    // 它要釘住的是**取捨落在我們選的那一邊**：窗內(8s)的長握會塌一次，窗外的長握不會。
    //
    // (a) 窗外：GRIP_REZERO_MS 過後的長握必須完好——這才是 4-7-8 憋氣真正發生的時機。
    const after = [];
    for (let i = 0; i < seconds(9); i++) after.push(REST + noise(i));           // 先正常靜止 9s（超過 8s 窗）
    for (let i = 0; i < seconds(5); i++) after.push(REST + GRIP + noise(i, 3)); // 然後長握 5s
    {
      const { out, c } = run(src, after);
      const held = out.slice(seconds(9) + seconds(1));
      ok(Math.min(...held.map(o => o.level)) > 0.4,
         "窗外（>GRIP_REZERO_MS）的長握 5 秒，水位不能塌掉——4-7-8 憋氣就在這裡",
         `最低 ${Math.min(...held.map(o => o.level)).toFixed(2)}`);
      ok(c.rezeroCount === 0, "窗外的長握不該觸發重取零點", `rezeroCount=${c.rezeroCount}`);
      if (pi === 0) console.log(`      窗外長握 5s：最低水位 ${Math.min(...held.map(o => o.level)).toFixed(2)}、重取 ${c.rezeroCount} 次`);
    }
    // (b) 窗內：這是我們**接受**的代價。斷言它「只塌一次就穩定」，而不是假裝它不會塌——
    //     重點是塌完之後零點停在新位置、不再反覆跳（反覆跳才是使用者受不了的）。
    const inside = [];
    for (let i = 0; i < seconds(1.5); i++) inside.push(REST + noise(i));
    for (let i = 0; i < seconds(6); i++) inside.push(REST + GRIP + noise(i, 3));
    {
      const { c } = run(src, inside);
      ok(c.rezeroCount <= 1, "窗內就算塌，也只能塌一次（不能反覆跳零點）", `rezeroCount=${c.rezeroCount}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[7] 30Hz × 握超過 8 秒才放開＝三方死鎖（Pan 2026-08-05 回報）");
  {
    // ⚠️ 這一項**必須跑 30Hz**。上面 [1]-[5] 全部用預設的 80Hz，而真實硬體是 30Hz
    // （Pan 2026-07-22 的 log：20653 筆／28 分鐘／兩顆 MB01）。這個 bug 藏在那個差別裡，
    // 所以 541 條斷言全部通過、Pan 卻回報「水位一直卡在半滿」。不要把 hz 拿掉。
    //
    // Pan 的實際順序是「拿起球、**握著**、等頁面連上、看說明、然後才放開」——握超過
    // GRIP_REZERO_MS(8s) 才放開，於是掉進三方死鎖：
    //   ① 握著連上 → 零點寫成握著的值；放開後偏差 ~700 raw。
    //   ② 偏差 700 → shaped 0.65 → 判定「握持中」→ baseline 凍結(0.00005/幀) → 錯零點被凍住。
    //   ③ 修 restRef 那行有 `< GRIP_REST_MARGIN`(45) 守衛，700 >> 45 → 進不去；
    //      「放開」分支要 shaped<=0，而 shaped 因為零點錯而恆 >0 → 也進不去。
    // 在 30Hz 下光靠 0.00005 的凍結率要 ~30 分鐘才收斂＝使用者體感「永遠卡住」。
    // 修法見 index.html 的 GRIP_SETTLE_MS：施力只會讓 raw **上升**（協定 +1250、真球 log
    // 兩顆球的靜止值都在分布底部），所以「持續停在零點下方」只可能是零點取錯了。
    const HZ = 30;
    const sec = n => seconds(n, HZ);
    // 3 秒（窗內、眾數救得到）到 25 秒（遠超窗）都要好。6 秒那一格是原本的分界：
    // 修好之前 3s 正常、6s 之後就永久卡在 0.65。
    for (const holdS of [3, 6, 9, 15, 25]) {
      const s = [];
      for (let i = 0; i < sec(holdS); i++) s.push(REST + GRIP + noise(i));   // 握著（含連上那一刻）
      for (let i = 0; i < sec(45); i++) s.push(REST + noise(i));             // 放開，之後都不握
      const { out, c } = run(src, s, HZ);
      const rel = sec(holdS);
      // 「放開後 3 秒內要回到 0」：Pan 要的是「越簡單越快越好」，不是等半分鐘。
      const lv3 = out[rel + sec(3)].level;
      ok(lv3 < 0.06, `握 ${holdS}s 才放開：放開後 3 秒內水位要回到 0`, `水位 ${lv3.toFixed(2)}`);
      // 而且要**穩住**，不能修好又飄回去（症狀是「握了再放掉會一直停留在半滿」）
      const after = out.slice(rel + sec(5)).map(o => o.level);
      ok(Math.max(...after) < 0.06, `握 ${holdS}s 才放開：之後水位要穩住在 0`,
         `之後最高 ${Math.max(...after).toFixed(2)}`);
      ok(Math.abs(c.baseline - REST) < 60, `握 ${holdS}s 才放開：零點要落在真正的靜止值附近`,
         `baseline=${c.baseline.toFixed(0)}，真值 ${REST}`);
    }
    if (pi === 0) {
      const r = [3, 25].map(h => {
        const s = [];
        for (let i = 0; i < sec(h); i++) s.push(REST + GRIP + noise(i));
        for (let i = 0; i < sec(45); i++) s.push(REST + noise(i));
        const { out, c } = run(src, s, HZ);
        return `握 ${h}s→放開後 3s 水位 ${out[sec(h) + sec(3)].level.toFixed(2)}、零點偏差 ${Math.abs(c.baseline - REST).toFixed(0)}`;
      });
      console.log(`      30Hz：${r.join("；")}`);
    }
  }

  // ───────────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[7b] 零點下方的平台不能吃掉刻意的長握（4-7-8 憋氣／緊繃度那題）");
  {
    // 這是新機制唯一可能踩壞的東西，所以要在 30Hz（真實速率）下釘住。
    // 之所以安全：長握是 raw **上升**、新機制只看零點**下方**，方向相反。
    const HZ = 30;
    const sec = n => seconds(n, HZ);
    const s = [];
    for (let i = 0; i < sec(12); i++) s.push(REST + noise(i));              // 先靜止（零點取對）
    for (let i = 0; i < sec(16); i++) s.push(REST + GRIP + noise(i));       // 刻意長握 16 秒
    for (let i = 0; i < sec(6); i++) s.push(REST + noise(i));               // 放開
    const { out, c } = run(src, s, HZ);
    const hold = out.slice(sec(13), sec(28)).map(o => o.level);
    ok(Math.min(...hold) > 0.5, "長握 16 秒期間水位不能下沉（4-7-8 憋氣的水位要撐住）",
       `最低 ${Math.min(...hold).toFixed(2)}`);
    ok(c.settleCount === 0, "零點對的時候，平台機制完全不該出手",
       `settleCount=${c.settleCount}`);
    // 放開之後也要乾淨落回 0（不能因為長握把零點推高而卡住）
    const rel = out.slice(sec(30)).map(o => o.level);
    ok(Math.max(...rel) < 0.06, "長握放開後水位要回到 0", `最高 ${Math.max(...rel).toFixed(2)}`);
    if (pi === 0) console.log(`      長握 16s：水位最低 ${Math.min(...hold).toFixed(2)}、平台出手 ${c.settleCount} 次、放開後最高 ${Math.max(...rel).toFixed(2)}`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[7c] 往下的慢漂移不該被當成平台（漂移歸 restRef 的慢跟處理）");
  {
    // 為什麼要有這一項：新機制只看「零點下方」，而**感測器往下的慢漂移**也在零點下方。
    // 若不要求「真的停住」，漂移會一路把零點往下拖，等於用一個一直在動的值當零點。
    // 漂移本來就有既有的處理方式（restRef 的 0.02 慢跟），不該動零點。
    // 這一項是 [2d] 的鏡像：那邊測往上漂，這邊測往下漂——而只有往下的方向會碰到新機制。
    const HZ = 30;
    const sec = n => seconds(n, HZ);
    const s = [];
    for (let i = 0; i < sec(1.2); i++) s.push(REST + noise(i, 4));            // 零點在這裡取樣
    for (let i = 0; i < sec(20); i++) s.push(REST - i * 0.4 + noise(i, 4));   // 20 秒滑下 240 raw
    const { out, c } = run(src, s, HZ);
    const lv = Math.max(...out.slice(sec(2)).map(o => o.level));
    ok(lv < 0.06, "往下慢漂移期間水位要一直是 0", `最高 ${lv.toFixed(3)}`);
    // 滑動中不該採用（值一直在動）；漂移由 restRef 吸收，零點自己也會跟著慢慢移。
    ok(c.settleCount === 0, "一路往下滑的期間不該採用平台（值還在動，不是靜止值）",
       `settleCount=${c.settleCount}`);
    if (pi === 0) console.log(`      往下滑 240raw：最高水位 ${lv.toFixed(3)}、平台出手 ${c.settleCount} 次`);
  }

  // ───────────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[7d] 記錄現況：把球放到桌上再拿起來仍然會短暫滿水位（已知界限）");
  {
    // 這一項**不是**在測「已經修好了」，是在釘住一個**沒有修好**的已知界限，免得下一個人
    // 以為它好了、或以為它是新機制造成的。見 index.html GRIP_SETTLE_MS 註解的 (b)。
    //
    // 為什麼分不開：「放開手」與「放下球」在 raw 串流裡都是「掉到一個更低的位置停住」，
    // 只差幅度，而幅度會重疊（協定實測用力握 +1250、放下球 1860）。要真的分開需要
    // 「球是否在手上」的獨立證據（IMU 靜止判定），那是另一個決策。
    //
    // 實測（30Hz、放下差 1860 raw）：修好前 再拿起後 30s 水位 0.75、60s 0.14；
    //                                修好後 30s 0.85、60s 0.20。量級沒變＝新機制沒有把它弄壞。
    const HZ = 30;
    const sec = n => seconds(n, HZ);
    const TABLE_DROP = 1860;   // 舊註解實測：Ball2 放到桌上與拿在手上差 1860 raw
    const s = [];
    for (let i = 0; i < sec(20); i++) s.push(REST + noise(i));                 // 拿著不握
    for (let i = 0; i < sec(40); i++) s.push(REST - TABLE_DROP + noise(i));    // 放到桌上
    const pickUp = s.length;
    for (let i = 0; i < sec(90); i++) s.push(REST + noise(i));                 // 再拿起來，放著不握
    const { out } = run(src, s, HZ);
    const at = n => out[pickUp + sec(n)].level;
    // 上界：確認它確實仍會衝高（如果哪天有人真的修好了，這條會失敗——那是好消息，
    // 請把這一項改寫成「要在 N 秒內回到 0」，不要直接刪掉）。
    ok(at(5) > 0.5, "（記錄現況）放桌上再拿起來，水位仍會短暫衝高——這是已知界限，不是回歸",
       `再拿起後 5s 水位 ${at(5).toFixed(2)}`);
    // 下界才是真正要守的：phantom 修復必須還在工作，不能變成**永久**卡住
    // （永久卡住才是 Pan 回報的那一類災難）。
    ok(at(90 - 1) < 0.3, "但它必須會自己收斂（phantom 修復仍然有效，不能變成永久卡住）",
       `再拿起後 89s 水位 ${at(89).toFixed(2)}`);
    if (pi === 0) console.log(`      放桌上再拿起：5s ${at(5).toFixed(2)}｜30s ${at(30).toFixed(2)}｜60s ${at(60).toFixed(2)}｜89s ${at(89).toFixed(2)}（已知界限，見 [7d] 註解）`);
  }

  if (pi === 0) console.log("[6] 常數的合理範圍與碼裡的接線");
  {
    ok(consts.GRIP_HIST_BIN > 10 && consts.GRIP_HIST_BIN < 60,
       "GRIP_HIST_BIN 要大於靜止雜訊、小於死區(143raw)", String(consts.GRIP_HIST_BIN));
    ok(consts.GRIP_HIST_MIN_MS >= 1500, "要待夠久才認定零點錯了（避免一開始用幾筆就換）",
       String(consts.GRIP_HIST_MIN_MS));
    ok(consts.GRIP_REZERO_MS >= 4000 && consts.GRIP_REZERO_MS <= 20000,
       "積極重取零點的窗要涵蓋「一剛開始」但不是永遠", String(consts.GRIP_REZERO_MS));
    // 取捨的兩個邊必須有明顯間隔：門檻要遠小於窗，否則窗內根本湊不滿門檻＝修正形同不存在
    ok(consts.GRIP_HIST_MIN_MS * 2 < consts.GRIP_REZERO_MS,
       "門檻要遠小於窗（否則窗內湊不滿門檻，修正形同不存在）",
       `${consts.GRIP_HIST_MIN_MS} vs ${consts.GRIP_REZERO_MS}`);
    ok(/const bin = Math\.round\(raw \/ GRIP_HIST_BIN\)/.test(src), "要用直方圖分格");
    // 挑戰者要贏過現任者，不是只過門檻——見 [2c]（數拍會把「握著」累積到超過門檻）
    ok(/ms >= GRIP_HIST_MIN_MS && ms > baseMs/.test(src),
       "換零點要求挑戰者的佔用時間**贏過**零點那一格（眾數的定義）");
    ok(/const baseBin = Math\.round\(this\.baseline \/ GRIP_HIST_BIN\)/.test(src),
       "要算出零點所在的格才能比較佔用時間");
    // 必須含鄰格：靜止的手抖會讓 raw 在格邊界來回，佔用時間被切兩半就永遠湊不到門檻
    ok(/for\(let b = bin - 1; b <= bin \+ 1; b\+\+\)/.test(src),
       "挑戰者要含左右鄰格（否則手抖跨在格邊界上，佔用時間被切兩半）");
    ok(/Math\.min\(100, now - this\.lastHistAt\)/.test(src),
       "每筆的佔用時間要有上限（斷線回來不能一次灌爆一格）");
    // 只做一次：反覆換零點本身就是「水位忽高忽低」的來源
    ok(/this\.rezeroCount === 0 && now - this\.firstReportAt < GRIP_REZERO_MS/.test(src),
       "重取零點只能做一次（rezeroCount === 0 當守門）");
    // 換零點時必須一起重設 edge detector，否則就是 Pan 遇到的「突然 bang 好幾次」
    const rez = src.match(/if\(ms >= GRIP_HIST_MIN_MS[\s\S]*?\n      \}/);
    ok(!!rez, "要找得到重取零點那段");
    if (rez) {
      ok(/this\.edge\.armed = true/.test(rez[0]), "換零點要重新武裝 edge detector");
      ok(/this\.edge\.floor = 0/.test(rez[0]), "換零點要重設 edge 的 floor（它是相對舊零點算的）");
      ok(/this\.level = 0/.test(rez[0]), "換零點要把水位歸零（舊零點算出來的水位是假的）");
      ok(/this\.healing = false/.test(rez[0]), "換零點要取消 phantom 修復（零點已經直接修好了）");
      ok(/this\.smRaw = raw/.test(rez[0]), "換零點要重設平滑器（不要拖著舊零點的殘影）");
    }
    // 不反應期：這是「bang 好幾次」的第二道防線，跟零點對不對無關
    ok(consts.GRIP_BEAT_REFRACTORY_MS >= 250 && consts.GRIP_BEAT_REFRACTORY_MS <= 600,
       "不反應期要短於真實拍距(~1s)、長於連發(<0.3s)", String(consts.GRIP_BEAT_REFRACTORY_MS));
    ok(/now - e\.lastFireAt >= GRIP_BEAT_REFRACTORY_MS/.test(src), "拍要過不反應期才算");
    // 不反應期只擋「算成拍」，不能擋解除武裝——否則這一握不會結束，下一拍永遠測不到
    const fire = src.match(/if\(rise >= onThresh\)\{[\s\S]*?\n      \}/);
    ok(!!fire && /e\.armed = false; e\.peak = posDelta/.test(fire[0]),
       "不反應期內仍要照常解除武裝與記峰值（只是不算拍）");
    // Math.abs 必須留著：極性不猜是 2026-08-04 的決定，而零點修正正是為它補的保險
    ok(/const dev = Math\.abs\(rawDev\)/.test(src), "極性仍然不猜（Math.abs 要留著）");

    // ── 零點下方的平台（2026-08-05）─────────────────────────────────────────
    ok(consts.GRIP_SETTLE_MS >= 400 && consts.GRIP_SETTLE_MS <= 1200,
       "平台時間要比一次握放的放開段短（才來得及救），又長於雜訊", String(consts.GRIP_SETTLE_MS));
    ok(consts.GRIP_SETTLE_MIN_SHIFT < consts.GRIP_FULL_SCALE * consts.GRIP_DEADZONE,
       "平台的最小位移要小於死區（否則死區內的錯零點救不到）",
       `${consts.GRIP_SETTLE_MIN_SHIFT} vs 死區 ${(consts.GRIP_FULL_SCALE * consts.GRIP_DEADZONE).toFixed(0)}`);
    ok(consts.GRIP_SETTLE_MIN_SHIFT > consts.GRIP_HIST_BIN,
       "平台的最小位移要大於直方圖分格寬（也就是大於靜止雜訊的量級）",
       `${consts.GRIP_SETTLE_MIN_SHIFT} vs ${consts.GRIP_HIST_BIN}`);
    // 方向性是整條機制的安全保證：只看零點**下方**。寫成 Math.abs 或反向就會吃掉長握。
    ok(/const below = this\.baseline - raw;/.test(src),
       "必須是「零點 − raw」＝只看零點下方（施力只會讓 raw 上升）");
    ok(/if\(below >= GRIP_SETTLE_MIN_SHIFT\)/.test(src),
       "只在低於零點超過門檻時才起算平台");
    ok(!/Math\.abs\(this\.baseline - raw\)\s*>=\s*GRIP_SETTLE_MIN_SHIFT/.test(src),
       "不可以寫成雙向（Math.abs）——那會把 4-7-8 的長握當成錯零點");
    // 「停住」而不是「一路滑下去」：漂移該由 restRef 慢跟吸收，不該動零點
    ok(/Math\.abs\(raw - this\.plateauRaw\) > GRIP_HIST_BIN/.test(src),
       "平台要求真的停住（離開一格就重新起算），否則慢漂移會被當成平台");
    ok(/now - this\.plateauAt >= GRIP_SETTLE_MS/.test(src), "平台要停滿 GRIP_SETTLE_MS 才採用");
    // 跟重取零點一樣，換零點必須清掉相對舊零點算的狀態（否則就是「突然 bang 好幾次」）
    const st = src.match(/\} else if\(now - this\.plateauAt >= GRIP_SETTLE_MS\)\{[\s\S]*?\n        \}/);
    ok(!!st, "要找得到平台採用那段");
    if (st) {
      ok(/this\.restRef = this\.plateauRaw/.test(st[0]), "採用平台時 restRef 要一起搬（否則放開分支又把零點拉回錯的地方）");
      ok(/this\.edge\.armed = true/.test(st[0]), "採用平台要重新武裝 edge detector");
      ok(/this\.edge\.floor = 0/.test(st[0]), "採用平台要重設 edge 的 floor");
      ok(/this\.level = 0/.test(st[0]), "採用平台要把水位歸零（舊零點算出來的水位是假的）");
      ok(/this\.healing = false/.test(st[0]), "採用平台要取消 phantom 修復");
      ok(/this\.smRaw = raw/.test(st[0]), "採用平台要重設平滑器");
    }
    // 這一條**不該**被關在 8 秒窗裡：Pan 的症狀正是「握超過 8 秒才放開」。
    // 也不該有 rezeroCount 那種一次性額度——放開幾次就該救幾次。
    const settleBlock = src.match(/if\(this\.baseline != null\)\{[\s\S]*?\n    \} else this\.plateauAt = null;\n    \}/)
      || src.match(/const below = this\.baseline - raw;[\s\S]*?\n      \} else this\.plateauAt = null;/);
    ok(!!settleBlock, "要找得到平台偵測那段");
    if (settleBlock) {
      ok(!/GRIP_REZERO_MS/.test(settleBlock[0]),
         "平台機制不可以被關在 GRIP_REZERO_MS 的窗裡（Pan 的症狀就是握超過 8 秒才放開）");
      ok(!/settleCount === 0/.test(settleBlock[0]),
         "平台機制不該只做一次（放開幾次就該救幾次）");
    }
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
