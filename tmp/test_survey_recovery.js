#!/usr/bin/env node
/**
 * 對拍測試：4-7-8 之後問卷不可以卡住，也不可以憑空編一個分數。
 *
 * Pan 2026-08-06：「478過程中因為沒有持續按壓握力球 連線就消失了 導致呼吸結束之後
 * 整個問卷都不能繼續做而卡住」
 *
 * 三個各自獨立的頁面端缺陷（都能單獨造成 Pan 看到的症狀）：
 *   ① 看門狗 6.5s 之後呼叫 `ghost.forget()` ⇒ 撤銷**使用者授權**。WebHID 的授權只能在
 *      使用者手勢裡重新取得，而 `syncBalls()` 走 `getDevices()`（只看得到還有授權的球）
 *      ⇒ 中途撤銷之後整段體驗都不可能自動接回。4-7-8 自走化之後使用者有 104 秒完全
 *      不需要出力，正好是最容易讓球靜掉的一段。
 *   ② 問卷的開窗閘門（`!a.armed`）**沒有任何逾時**。球凍在高位 ⇒ 永遠等不到「放開」。
 *      arrival 的同一個閘門 2026-07-29 就補過 `AGREEMENT_ARM_GRACE_MS`，問卷漏了。
 *   ③ 空白鍵/Shift 後援的條件是 `!state.connected[slot]`，而球靜掉之後 `connected`
 *      還是 true（看門狗要 6.5s 才清）⇒ 那段時間連鍵盤退路都沒有。
 *
 * ⚠️ 這支測試把 index.html 裡**真正的** `afterSurveyStep` 抽出來跑，不重寫一份邏輯——
 * 重寫的話「修好的是我這份 replica、不是頁面」這種假通過就抓不到（AF 診斷過程中我自己
 * 的 probe 就先犯過這個錯：用不看提示的握壓時程，量出來的 0 分全是 probe 的假象）。
 *
 * 用法：node tmp/test_survey_recovery.js
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

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));

// ── 從頁面抽常數（容忍 gripLevelForRaw(...) 與裸數字兩種形狀）──
function constants(src) {
  const K = {};
  for (const m of src.matchAll(/const ([A-Z][A-Z0-9_]+) = ([\d.]+);/g)) K[m[1]] = Number(m[2]);
  const FS = K.GRIP_FULL_SCALE * K.GRIP_HEADROOM;
  const g = (raw) => {
    let l = clamp(Math.abs(raw) / FS);
    l = Math.max(0, (l - K.GRIP_DEADZONE) / (1 - K.GRIP_DEADZONE));
    return Math.pow(l, K.GRIP_GAMMA);
  };
  const lvl = (name) => {
    const m = src.match(new RegExp(`const ${name} = gripLevelForRaw\\((\\d+)\\)`));
    if (m) return g(Number(m[1]));
    const bare = src.match(new RegExp(`const ${name} = ([\\d.]+);`));
    if (bare) return Number(bare[1]);          // 壞形狀也要抽得到（回退才會是斷言失敗，不是例外）
    throw new Error(`抽不到 ${name}`);
  };
  return { K, g, gripLevelForRaw: g, AFTER_ON: lvl("AFTER_ON"), AFTER_OFF: lvl("AFTER_OFF"),
           AFTER_BAND_SOME: lvl("AFTER_BAND_SOME"), AFTER_BAND_CLEAR: lvl("AFTER_BAND_CLEAR") };
}

// ── 把真正的 afterSurveyStep 端出來，用假的 DOM / 時鐘餵它 ──
function harness(src, e) {
  const grab = (re, what) => {
    const m = src.match(re);
    if (!m) throw new Error(`抽不到 ${what}`);
    return m[0];
  };
  const body = grab(/function afterSurveyStep\(a, dt\)\{[\s\S]*?\n\}/, "afterSurveyStep");
  const bandFn = grab(/function afterAnswerBand\(v\)\{[\s\S]*?\n\}/, "afterAnswerBand");
  const labelFn = grab(/function afterAnswerLabel\(v\)\{[\s\S]*?\n\}/, "afterAnswerLabel");
  const fixFn = grab(/function afterFixAnswer\(a, value\)\{[\s\S]*?\n\}/, "afterFixAnswer");
  // 2026-08-06：定案改由**真正的** AnswerSampler 負責（Pan：「太敏感 輕輕碰就全滿」），
  // 所以它也要一起抽出來——重寫一份的話「取樣壞了」在這支測試裡就看不到（見檔頭 ⚠️）。
  const samplerCls = grab(/class AnswerSampler\{[\s\S]*?\n\}/, "AnswerSampler");

  const box = { RAW: 0, NOW: 0, recorded: [], prompt: "", logs: [] };
  const env = {
    clamp, gripLevelForRaw: e.gripLevelForRaw,
    performance: { now: () => box.NOW },
    AFTER_ON: e.AFTER_ON, AFTER_OFF: e.AFTER_OFF,
    AFTER_BAND_SOME: e.AFTER_BAND_SOME, AFTER_BAND_CLEAR: e.AFTER_BAND_CLEAR,
    AFTER_SETTLE_MS: e.K.AFTER_SETTLE_MS, AFTER_SAMPLE_MS: e.K.AFTER_SAMPLE_MS,
    AFTER_READ_MS: e.K.AFTER_READ_MS,
    AFTER_RESPONSE_MS: e.K.AFTER_RESPONSE_MS, AFTER_FIXED_RELEASE_MS: e.K.AFTER_FIXED_RELEASE_MS,
    AFTER_ARM_GRACE_MS: e.K.AFTER_ARM_GRACE_MS,
    AFTER_QUESTIONS: [{ key: "post", sub: "q" }],
    // zh 走 trustedHeld()、en 走 state.grip[1..2] 的 max——兩條路都餵同一個 box.RAW
    trustedHeld: () => box.RAW,
    state: { grip: { get 1() { return box.RAW; }, get 2() { return 0; } } },
    slotLive: () => box.live !== false,
    log: (m) => box.logs.push(String(m)),
    $: () => ({
      get textContent() { return box.prompt; },
      set textContent(v) { box.prompt = v; },
      classList: { add() {}, remove() {} }, style: {},
    }),
    document: { documentElement: { style: { setProperty() {} } } },
    afterRecordAnswer: (a, q, v) => { box.recorded.push(Math.round(clamp(v) * 10)); a.fading = true; },
  };
  const made = new Function(...Object.keys(env),
    `${samplerCls}\n${bandFn}\n${labelFn}\n${fixFn}\n${body}\nreturn { afterSurveyStep, AnswerSampler };`)(...Object.values(env));
  return { box, step: made.afterSurveyStep, AnswerSampler: made.AnswerSampler };
}

function freshState(AnswerSampler) {
  return { stage: "survey", i: 0, armed: false, peak: 0, heldMs: 0, orbFill: 0, answers: {},
    fading: false, dismissed: false, lastT: 0, stageAt: 0, questionAt: 0,
    fixed: false, fixedAt: 0, fixedValue: 0, band: null,
    armWaitFrom: null, afterFloor: 0, afterRest: null, armedAt: 0,
    // beginAfter() 真的會給一個 sampler，所以這裡也給——不給的話 afterSurveyStep 走的是
    // 「沒有就補一個」那條防禦路徑，測到的就不是正常路徑了。
    sampler: new AnswerSampler() };
}

/* 一題的模擬。使用者是**有反應的**：只有在開窗且讀題期過了（＝提示真的出現）之後
   reactMs 才出力，握 holdMs，然後回到 stuckRaw。
   trialGrip=[from,to]：等待期間先試著握（畫面沒反應時很自然的行為）。 */
function playQuestion(src, e, { stuckRaw, answerRaw, reactMs, holdMs = 1800, trialGrip = null,
                               live = true, maxMs = 60000 }) {
  const { box, step, AnswerSampler } = harness(src, e);
  box.live = live;
  const a = freshState(AnswerSampler);
  const DT = 1000 / 30;                       // 真硬體是 30Hz
  let promptAt = null;
  for (let t = 0; t < maxMs && !a.fading; t += DT) {
    box.NOW = t;
    const windowFrom = Math.max(a.questionAt, a.armedAt || 0);
    if (a.armed && !a.fixed && promptAt === null && t - windowFrom >= e.K.AFTER_READ_MS) promptAt = t;
    let raw = stuckRaw;
    if (trialGrip && t >= trialGrip[0] && t < trialGrip[1]) raw = answerRaw;
    if (promptAt !== null && t - promptAt >= reactMs && t - promptAt < reactMs + holdMs) raw = answerRaw;
    box.RAW = e.g(raw);
    step(a, DT / 1000);
  }
  return { answer: box.recorded.length ? box.recorded[0] : null, prompt: box.prompt,
           logs: box.logs, armed: a.armed, armedAt: a.armedAt, floor: a.afterFloor };
}

console.log("=== 478 之後問卷的復原測試 ===\n");

PAGES.forEach((page, pi) => {
  tag = `(${page.label}) `;
  const src = page.src;
  const e = constants(src);

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[1] 看門狗不可以在體驗中途撤銷 WebHID 授權");
  {
    const wd = src.match(/if\(age > HID_FORGET_STALE_MS\)\{[\s\S]*?\n {6}\}/);
    ok(!!wd, "要找得到看門狗的 FORGET 分支");
    if (wd) {
      const blk = wd[0];
      // ⚠️ 這一段的註解本身就寫著 `ghost.forget()` 與 `syncBalls()`（在解釋為什麼不呼叫
      // 前者），所以凡是「這個呼叫在不在」的斷言都必須先把註解剝掉再比對，
      // 否則註解會替程式碼作證＝斷言恆真。
      const code = blk.replace(/\/\/[^\n]*/g, "");
      ok(/ghost\.forget/.test(code), "（前提）這個分支本來就是在處理 forget");
      // 關鍵：forget() 必須被「還沒開始體驗」的條件包住
      const gated = /if\(state\.phase === "before" && state\.arrival\.step === "connect"\)\{[\s\S]*?ghost\.forget/.test(code);
      ok(gated, "forget() 要被「還在連線畫面（before / connect）」包住，不能無條件呼叫",
         gated ? "" : "體驗中途撤銷授權 ⇒ 剩下整段都不可能自動接回");
      // 而且不可以有第二個沒被包住的 forget（改一半的經典狀況）
      const bare = code.split(/if\(state\.phase === "before"/)[0];
      ok(!/ghost\.forget/.test(bare), "條件之前不可以還留著一個裸的 forget()");
      // 撤銷之後仍要重掃（不然清掉 slot 就沒人遞補）
      ok(/syncBalls\(\)/.test(code), "仍要重新掃描讓在線的球遞補");
      // 不撤銷的那條路要留下痕跡給使用者/log
      ok(/else \{[\s\S]*?log\(/.test(code), "保留授權那條路要有 log（不要靜悄悄）");
    }
    // 手動重新配對的退路必須還在（撤銷授權的正當用途搬到這裡）
    ok(/function repairBalls\(\)/.test(src), "手動「重新配對」的退路要還在（R 鍵）");
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[2] 問卷的開窗閘門要有逾時保險");
  {
    ok(e.K.AFTER_ARM_GRACE_MS > 0, "要有 AFTER_ARM_GRACE_MS");
    ok(e.K.AFTER_ARM_GRACE_MS >= 2000,
       "保險要夠長，不能把「正常放開」誤判成卡住（放開只要幾百 ms）", String(e.K.AFTER_ARM_GRACE_MS));
    ok(e.K.AFTER_ARM_GRACE_MS <= 8000,
       "但也不能長到使用者以為壞了（Pan 的症狀就是「卡住」）", String(e.K.AFTER_ARM_GRACE_MS));
    const body = src.match(/function afterSurveyStep\(a, dt\)\{[\s\S]*?\n\}/)[0];
    const armBlk = body.match(/if\(!a\.armed\)\{[\s\S]*?\n {2}\}/);
    ok(!!armBlk, "要找得到開窗閘門");
    if (armBlk) {
      ok(/AFTER_ARM_GRACE_MS/.test(armBlk[0]), "開窗閘門裡要真的用到那個逾時常數",
         "常數宣告了但沒用＝等於沒有保險");
      ok(/a\.armWaitFrom/.test(armBlk[0]), "要記下開始等的時刻");
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[3] 逾時開窗之後，使用者真的握**必須**還算得到分");
  {
    // 這是 AF 修法最容易做壞的地方：地板取「開窗那一刻的瞬時值」的話，剛好在那一刻
    // 正在試握的使用者會被把自己的答案記成地板 ⇒ 這一題永遠 0 分。
    const F = 700, A = 1400;   // 殘壓 700raw、使用者握到 1400raw
    for (const react of [200, 700, 1500, 2000, 3000, 4000]) {
      const r = playQuestion(src, e, { stuckRaw: F, answerRaw: A, reactMs: react });
      ok(r.answer !== null && r.answer >= 5,
         `殘壓 ${F}raw、握到 ${A}raw、反應 ${react}ms 要記得到分`,
         `記成 ${r.answer}`);
    }
    // 使用者在等待期間就先試握（含「剛好在開窗那一刻正在握」）
    for (const [lbl, trial] of [["3000–4000ms（跨過開窗那刻）", [3000, 4000]],
                                ["3600–4600ms（開窗那刻正在握）", [3600, 4600]],
                                ["完全沒試握", null]]) {
      const r = playQuestion(src, e, { stuckRaw: F, answerRaw: A, reactMs: 700, trialGrip: trial });
      ok(r.answer !== null && r.answer >= 5,
         `等待期試握 ${lbl} 之後仍要記得到分（不可以把使用者的握記成殘壓地板）`,
         `記成 ${r.answer}`);
    }
    // 球正常的那條路不可以被這個改動弄壞
    for (const react of [200, 700, 1500, 3000]) {
      const r = playQuestion(src, e, { stuckRaw: 0, answerRaw: 900, reactMs: react });
      ok(r.answer !== null && r.answer >= 4,
         `球正常、握到 900raw、反應 ${react}ms 要記得到分`, `記成 ${r.answer}`);
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[4] 回應窗要從「開窗」算起，不是從上一題結束算起");
  {
    // 開窗保險吃掉 4000ms，如果窗口從 questionAt 算，5200ms 只剩 1200ms 完成 hold。
    const body = src.match(/function afterSurveyStep\(a, dt\)\{[\s\S]*?\n\}/)[0];
    ok(/a\.armedAt/.test(body), "要記下開窗時刻（armedAt）");
    ok(!/now - a\.questionAt >= AFTER_RESPONSE_MS/.test(body),
       "回應窗不可以還從 a.questionAt 算", "開窗保險會把回應窗吃掉");
    ok(!/now - a\.questionAt < AFTER_READ_MS/.test(body),
       "讀題期也不可以還從 a.questionAt 算", "提示還沒出現就開始倒數");
    ok(/Math\.max\(a\.questionAt, a\.armedAt/.test(body),
       "要用 max(questionAt, armedAt)（正常球沒開窗延遲時行為不變）");
    // 行為上的證據：走了 grace 之後，回應窗的長度要跟沒走 grace 時一樣
    const slow = playQuestion(src, e, { stuckRaw: 700, answerRaw: 1400, reactMs: 3000 });
    ok(slow.answer !== null && slow.answer > 0,
       "走了逾時開窗、反應 3000ms 仍要在窗內（＝窗口沒被保險吃掉）", `記成 ${slow.answer}`);
    ok(slow.armedAt >= e.K.AFTER_ARM_GRACE_MS,
       "（前提）這個情境真的走了逾時開窗", `armedAt=${Math.round(slow.armedAt)}ms`);
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[5] 但仍然不可以憑空編一個分數（資料完整性）");
  {
    // 「不卡住」不可以用「自動填 0／自動填一個值」換來。沒作答就是 0（沒作答），
    // 而殘壓本身**不可以**被讀成答案。
    const cases = [
      ["殘壓 700raw、使用者完全不動", 700, 700],
      ["球正常、完全不握", 0, 0],
      ["殘壓 1400raw 貼頂、完全不動", 1400, 1400],
    ];
    for (const [lbl, st, an] of cases) {
      const r = playQuestion(src, e, { stuckRaw: st, answerRaw: an, reactMs: 1e9 });
      ok(r.answer === 0, `${lbl} ⇒ 要記成 0（沒作答），不可以把殘壓讀成答案`, `記成 ${r.answer}`);
    }
    // 殘壓越高也不可以換到越高的分數（這是「地板沒扣掉」的指紋）
    const a700 = playQuestion(src, e, { stuckRaw: 700, answerRaw: 700, reactMs: 1e9 }).answer;
    const a1000 = playQuestion(src, e, { stuckRaw: 1000, answerRaw: 1000, reactMs: 1e9 }).answer;
    ok(a700 === 0 && a1000 === 0, "殘壓高低都要記成 0（殘壓不是答案）", `${a700} / ${a1000}`);
    // 而且每一題都要重新起算（不繼承上一題的地板）
    const body = src.match(/function afterNextQuestion\(a\)\{[\s\S]*?\n\}/)[0];
    for (const f of ["armWaitFrom", "afterFloor", "afterRest", "armedAt"]) {
      ok(new RegExp(`a\\.${f} = (null|0)`).test(body), `換題要重設 a.${f}`);
    }
    // 2026-08-06 的取樣器也是「每一題重新起算」的一部分：不重設的話上一題還沒放開的那段
    // 取樣會被下一題直接拿去定案（＝上一題的握變成下一題的答案）。
    ok(/a\.sampler\.reset\(\)/.test(body), "換題要重設取樣器（不繼承上一題的握）");
    const begin = src.match(/function beginAfter\(\)\{[\s\S]*?\n\}/)[0];
    ok(/afterRest/.test(begin),
       "beginAfter 要初始化 afterRest（undefined 會讓 Math.min 變 NaN）");
    ok(/sampler: new AnswerSampler\(\)/.test(begin),
       "beginAfter 要建立取樣器（不要靠 afterSurveyStep 的防禦路徑補）");
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[6] 地板必須是「等待期的最低水位」而且只會往下修");
  {
    const body = src.match(/function afterSurveyStep\(a, dt\)\{[\s\S]*?\n\}/)[0];
    ok(/a\.afterRest = Math\.min\(/.test(body), "地板要取等待期的**最低**水位");
    ok(/a\.afterFloor = clamp\(a\.afterRest\)/.test(body),
       "開窗時要用那個最低值當地板，不是用當下的瞬時值",
       "瞬時值會把「使用者正在握」記成殘壓");
    ok(/if\(a\.afterFloor > 0 && raw < a\.afterFloor\) a\.afterFloor = raw;/.test(body),
       "地板要只往下修（殘壓退掉之後門檻要跟著回到正常）");
    // 行為證據：殘壓中途自己退掉之後，同一題的門檻要回到正常，弱一點的握也答得到
    const r = playQuestion(src, e, { stuckRaw: 700, answerRaw: 700, reactMs: 1e9 });
    ok(r.floor > 0, "（前提）這個情境真的記了一個地板", `floor=${r.floor.toFixed(3)}`);
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[7] 球靜掉時要有鍵盤退路，而且畫面要說出來");
  {
    ok(/function slotLive\(slot\)\{/.test(src), "要有 slotLive()");
    const fn = src.match(/function slotLive\(slot\)\{[\s\S]*?\n\}/)[0];
    ok(/state\.connected\[slot\]/.test(fn), "slotLive 要看 connected");
    ok(/state\.ready\[slot\]/.test(fn), "slotLive 要看 ready（看門狗判 stale 之後就不算活著）");
    ok(/lastGripReportAt/.test(fn) && /HID_STALE_MS/.test(fn),
       "slotLive 要看「最後一次 report 有多久」——這才是「真的在供水位」",
       "只看 connected 的話，球靜掉之後的 6.5s 內鍵盤退路完全無效");
    // 五處鍵盤後援都要改用 slotLive，不能留著只看 connected 的
    const sites = src.match(/if\(!(?:state\.connected|slotLive)[([]1[\])]?\)? ?setGrip\(1/g) || [];
    ok(!/if\(!state\.connected\[1\]\) setGrip\(1/.test(src),
       "空白鍵的後援不可以還只看 state.connected[1]");
    ok(!/if\(!state\.connected\[2\]\) setGrip\(2/.test(src),
       "Shift 的後援不可以還只看 state.connected[2]");
    const live = (src.match(/!slotLive\(/g) || []).length;
    ok(live >= 5, "五處鍵盤後援＋畫面提示都要走 slotLive", `只有 ${live} 處`);
    // 兩顆球都不活時，畫面要寫出退路（不要讓使用者對著不動的畫面猜）
    const r = playQuestion(src, e, { stuckRaw: 900, answerRaw: 900, reactMs: 1e9, live: false, maxMs: 3000 });
    ok(/Space|空白鍵/.test(r.prompt), "兩顆都不活時，球上的字要寫出鍵盤退路", `顯示「${r.prompt}」`);
  }
});

// ─────────────────────────────────────────────────────────────────────
tag = "";
console.log("[8] zh / en 兩頁的復原行為要一致");
{
  const A = constants(PAGES[0].src), B = constants(PAGES[1].src);
  ok(A.K.AFTER_ARM_GRACE_MS === B.K.AFTER_ARM_GRACE_MS,
     "兩頁的 AFTER_ARM_GRACE_MS 要相同", `${A.K.AFTER_ARM_GRACE_MS} vs ${B.K.AFTER_ARM_GRACE_MS}`);
  ok(A.K.HID_FORGET_STALE_MS === B.K.HID_FORGET_STALE_MS,
     "兩頁的 HID_FORGET_STALE_MS 要相同");
  ok(A.K.HID_STALE_MS === B.K.HID_STALE_MS, "兩頁的 HID_STALE_MS 要相同");
  for (const p of PAGES) {
    ok(/function slotLive\(slot\)\{/.test(p.src), `${p.label} 要有 slotLive()`);
    ok(/AFTER_ARM_GRACE_MS/.test(p.src), `${p.label} 要有開窗保險`);
    ok(/state\.phase === "before" && state\.arrival\.step === "connect"/.test(p.src),
       `${p.label} 的 forget() 要被包住`);
    ok(/a\.afterRest = Math\.min\(/.test(p.src), `${p.label} 的地板要取等待期最低值`);
    ok(/Math\.max\(a\.questionAt, a\.armedAt/.test(p.src), `${p.label} 的回應窗要從開窗算`);
  }
}

console.log("\n" + "=".repeat(60));
if (failures.length) {
  console.log(`${passed} 項通過，${failures.length} 項失敗：\n`);
  failures.forEach(f => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`全部通過：${passed} 項斷言。`);
