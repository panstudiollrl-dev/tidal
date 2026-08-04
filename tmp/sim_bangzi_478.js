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
 * 這支測試把那段話逐條變成斷言：
 *   [1] 節拍形狀＝1 記重音 + (count−1) 個點，總數正好是 4 / 7 / 8
 *   [2] 「由快到慢」＝間隔嚴格遞增
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
  const names = ["BANGZI_UNIT_MS", "BANGZI_SLOWDOWN", "BANGZI_LEAD_MS", "BANGZI_TICK_MIN", "BANGZI_TICK_MAX"];
  const consts = names.map(n => {
    const m = src.match(new RegExp(`const ${n} = ([\\d.]+)`));
    if (!m) throw new Error(`抽不到常數 ${n}`);
    return `const ${n} = ${m[1]};`;
  }).join("\n");
  const accent = src.match(/const BANGZI_ACCENT = \{[^}]*\};/);
  if (!accent) throw new Error("抽不到 BANGZI_ACCENT");
  const fnPat = src.match(/function bangziPattern\(count\)\{[\s\S]*?\n\}/);
  const fnDur = src.match(/function bangziDuration\(count\)\{[\s\S]*?\n\}/);
  if (!fnPat) throw new Error("抽不到 bangziPattern");
  if (!fnDur) throw new Error("抽不到 bangziDuration");
  const factory = new Function(`
    ${consts}
    ${accent[0]}
    ${fnPat[0]}
    ${fnDur[0]}
    return { bangziPattern, bangziDuration, consts: { ${names.join(", ")} }, BANGZI_ACCENT };
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
  const consts = ["BANGZI_UNIT_MS", "BANGZI_SLOWDOWN", "BANGZI_LEAD_MS", "BANGZI_TICK_MIN", "BANGZI_TICK_MAX"]
    .map(n => `const ${n} = ${src.match(new RegExp(`const ${n} = ([\\d.]+)`))[1]};`).join("\n");
  const code = `
    ${consts}
    ${need(/const BANGZI_ACCENT = \{[^}]*\};/, "BANGZI_ACCENT")}
    ${need(/const MANUAL_478_PHASES = \[[\s\S]*?\n\];/, "MANUAL_478_PHASES")}
    ${need(/const MANUAL_478_TARGET_CYCLES = \d+;/, "MANUAL_478_TARGET_CYCLES")}
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
  const stats = { presses: 0, stones: 0, haptics: 0 };
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
    engine: { underwaterStone: () => { stats.stones++; } },
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
    minRemaining, maxRemaining,
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
      return after !== before;
    },
  };
}

console.log("=== 4-7-8 梆子節拍 對拍測試 ===\n");

PAGES.forEach((page, pi) => {
  tag = `(${page.label}) `;
  const src = page.src;
  const { bangziPattern, bangziDuration, consts, BANGZI_ACCENT } = build(src);

  // Pan 指定的三段：4 → 起頭一下 + 由快到慢三次；7 → 一下 + 六次；8 → 如法炮製
  const SPEC = [
    { count: 4, ticks: 3, label: "4（震動一下 + 由快到慢三次）" },
    { count: 7, ticks: 6, label: "7（震動一下 + 由快到慢六次）" },
    { count: 8, ticks: 7, label: "8（如法炮製）" },
  ];

  if (pi === 0) console.log("[1] 節拍形狀＝1 記重音 + (count−1) 個點");
  for (const s of SPEC) {
    const p = bangziPattern(s.count);
    ok(p.length === s.count, `${s.label}：總點數要等於 ${s.count}`, `實際 ${p.length}`);
    ok(p[0].accent === true, `${s.label}：第一記要是重音（梆子的「板」）`);
    ok(p.slice(1).every(x => x.accent === false), `${s.label}：後面的點都不是重音（「眼」）`);
    ok(p.filter(x => !x.accent).length === s.ticks,
       `${s.label}：由快到慢的點要正好 ${s.ticks} 次`, `實際 ${p.filter(x => !x.accent).length}`);
    if (pi === 0) {
      const gaps = p.slice(1).map((x, i) => i === 0 ? x.at : x.at - p[i].at);
      console.log(`      ${s.count} → ${p.length} 點；間隔 ${gaps.map(g => Math.round(g)).join(" → ")}ms`);
    }
  }

  if (pi === 0) console.log("[2] 「由快到慢」＝間隔要嚴格遞增");
  for (const s of SPEC) {
    const p = bangziPattern(s.count);
    // 只看「點與點之間」的間隔（第一段是重音到第一點的 lead，不算在漸慢的數列裡）
    const ticks = p.filter(x => !x.accent);
    const gaps = [];
    for (let i = 1; i < ticks.length; i++) gaps.push(ticks[i].at - ticks[i - 1].at);
    if (gaps.length >= 2) {
      let mono = true;
      for (let i = 1; i < gaps.length; i++) if (gaps[i] <= gaps[i - 1]) mono = false;
      ok(mono, `${s.label}：間隔要一路變長（由快到慢）`, `間隔 ${gaps.map(Math.round).join(",")}`);
      // 「慢」要真的有感。判準寫成「每一步的倍率」而不是「頭尾比」：4 那一段只有 3 點＝2 個
      // 間隔，頭尾比在數學上就只能是 1 個倍率，用固定的 1.4× 去要求它等於要求 SLOWDOWN≥1.4，
      // 那會讓 8 那一段的最後一拍被拖到很久。改成檢查每一步都至少慢 15%（人耳分辨得出的量級）。
      for (let i = 1; i < gaps.length; i++) {
        ok(gaps[i] / gaps[i - 1] > 1.15,
           `${s.label}：第 ${i} → ${i + 1} 個間隔要明顯變長（每一步至少慢 15%）`,
           `${(gaps[i] / gaps[i - 1]).toFixed(2)}×`);
      }
      // 而且整段從頭到尾要累積出明顯的漸慢（點數越多、累積越明顯）
      ok(gaps[gaps.length - 1] / gaps[0] >= Math.pow(1.15, gaps.length - 1),
         `${s.label}：整段頭尾的間隔差要隨點數累積`,
         `${(gaps[gaps.length - 1] / gaps[0]).toFixed(2)}×`);
    }
    // 強度也要跟著沉下去（不是機械的等強度）
    ok(ticks[ticks.length - 1].intensity < ticks[0].intensity,
       `${s.label}：點的強度要隨著變慢而減弱`);
    ok(ticks.every(t => t.intensity >= consts.BANGZI_TICK_MIN - 1 && t.intensity <= consts.BANGZI_TICK_MAX + 1),
       `${s.label}：點的強度要留在有界範圍內（guardrail：有界參數）`);
  }
  ok(consts.BANGZI_SLOWDOWN > 1, "BANGZI_SLOWDOWN 要大於 1（否則是由慢到快）", String(consts.BANGZI_SLOWDOWN));
  ok(consts.BANGZI_SLOWDOWN < 1.8, "但不能慢得太誇張（最後一拍會拖到十幾秒）", String(consts.BANGZI_SLOWDOWN));
  ok(BANGZI_ACCENT.intensity > consts.BANGZI_TICK_MAX,
     "重音（板）要比任何一個點都強", `${BANGZI_ACCENT.intensity} vs ${consts.BANGZI_TICK_MAX}`);

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
