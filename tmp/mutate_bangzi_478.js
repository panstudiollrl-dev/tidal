#!/usr/bin/env node
/**
 * 變異測試：證明 tmp/sim_bangzi_478.js 真的抓得到東西。
 * 用法：node tmp/mutate_bangzi_478.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SIM = path.join(__dirname, "sim_bangzi_478.js");
// 2026-08-05：en 頁已經同步了梆子這一段，所以**兩頁各注入一次**——只改 zh 版是這個專案
// 最容易發生的漏同步，而如果只對 zh 注入，「en 版寫錯」這一類就永遠測不到。
// （在此之前這裡會生成一個只跑 zh 的測試變體；en 同步後那個分支就是在放水，已移除。）
const PAGE_FILES = [path.join(ROOT, "web", "index.html"), path.join(ROOT, "web", "en", "index.html")];
const ORIG = PAGE_FILES.map(f => fs.readFileSync(f, "utf8"));
// 前提檢查：兩頁都要已經是 2026-08-06 的等速版（Pan：「還是用規律數數跟震動就好」）。
// 這個檢查的用途跟原本的 BANGZI_CURVE 版一樣——防止「只改了 zh」這種漏同步在下面
// 變成一整排「找不到目標字串」而被當成雜訊看過去。
for (const [i, f] of PAGE_FILES.entries()) {
  if (/const BANGZI_CURVE = /.test(ORIG[i]))
    throw new Error(`${f} 還留著 BANGZI_CURVE——2026-08-06 已改等速，兩頁要先同步`);
  if (!/const BANGZI_UNIT_MS = /.test(ORIG[i]))
    throw new Error(`${f} 抽不到 BANGZI_UNIT_MS——兩頁要先同步`);
}

const MUTANTS = [
  ["點數少一個（4 只給 3 點，不符 Pan 的「一下＋三次」）",
   "const n = Math.max(1, count) - 1;", "const n = Math.max(1, count) - 2;"],
  // ── 等速（Pan 2026-08-06「還是用規律數數跟震動就好」，取代了 2026-08-05 的 MIDI 曲線）──
  // 這一批全都是「改了不會報錯、只會聽起來不對」的寫法，正是需要測試守門的那種。
  // 重點是：把**任何一種**速度變化偷偷加回來都要被抓到——Pan 是試用過漸快漸慢之後才要等速的，
  // 所以「速度又開始變」是這一段最需要守的迴歸。
  ["拍距又開始變（把 2026-08-05 的漸快漸慢加回來）",
   "      at: (i + 1) * BANGZI_UNIT_MS,",
   "      at: Math.round((i + 1) * BANGZI_UNIT_MS * (1 + 0.4 * Math.cos(k * Math.PI))),"],
  ["只有起頭那一段變長（＝2026-08-05 的「第一拍拍下去有個較長間隔」，已被 Pan 撤回）",
   "      at: (i + 1) * BANGZI_UNIT_MS,",
   "      at: Math.round((i + 1) * BANGZI_UNIT_MS + 800),"],
  ["單向漸慢（回到最早的幾何級數）",
   "      at: (i + 1) * BANGZI_UNIT_MS,",
   "      at: Math.round(BANGZI_UNIT_MS * (Math.pow(1.24, i + 1) - 1) / 0.24),"],
  ["改成逐步累加（浮點漂移；等速在時間表上不再精確）",
   "      at: (i + 1) * BANGZI_UNIT_MS,",
   "      at: (i + 1) * BANGZI_UNIT_MS + i * 0.1,"],
  ["起頭那一記不是重音（梆子沒有板）",
   "const out = [{ at: 0, accent: true,", "const out = [{ at: 0, accent: false,"],
  ["重音比點還弱（板被眼蓋過去）",
   "const BANGZI_ACCENT = { intensity: 165, duration: 78 };",
   "const BANGZI_ACCENT = { intensity: 40, duration: 78 };"],
  ["點的強度不遞減（機械等強度，段落戛然而止）",
   "      intensity: Math.round(BANGZI_TICK_MAX - (BANGZI_TICK_MAX - BANGZI_TICK_MIN) * k),",
   "      intensity: BANGZI_TICK_MAX,"],
  ["點的強度反過來遞增（收尾越來越重）",
   "      intensity: Math.round(BANGZI_TICK_MAX - (BANGZI_TICK_MAX - BANGZI_TICK_MIN) * k),",
   "      intensity: Math.round(BANGZI_TICK_MIN + (BANGZI_TICK_MAX - BANGZI_TICK_MIN) * k),"],
  ["石頭大小與強度反向（一個變大一個變小＝收尾不是淡出）",
   "      size: 0.5 - 0.25 * k,",
   "      size: 0.25 + 0.25 * k,"],
  ["拍子快到跟不上（節律不再比使用者慢）",
   "const BANGZI_UNIT_MS = 1374;", "const BANGZI_UNIT_MS = 120;"],
  ["拍子慢到失去 4-7-8 的形狀",
   "const BANGZI_UNIT_MS = 1374;", "const BANGZI_UNIT_MS = 4000;"],
  ["拍子回到 880ms（漸快漸慢那版的 UNIT；等速下會變成一輪只有 16.7s ＝ 3.6 次/分）",
   "const BANGZI_UNIT_MS = 1374;", "const BANGZI_UNIT_MS = 880;"],
  ["石頭不低沉（回到頌缽的音高）",
   "const f0 = 190 - 70 * clamp(size)", "const f0 = 620 - 70 * clamp(size)"],
  ["水的低通拿掉（聽起來不在水裡）",
   'water.type = "lowpass";', 'water.type = "allpass";'],
  ["水的低通開太高（高頻沒被水吃掉）",
   "water.frequency.value = 900;", "water.frequency.value = 6000;"],
  ["衰減拉長成頌缽（連擊糊成一團）",
   "const decays = [0.45, 0.26, 0.16, 0.10];", "const decays = [4.5, 2.6, 1.6, 1.0];"],
  ["音量不設上限（guardrail：限幅保護）",
   "const peak = clamp(intensity, 0.15, 1) * 0.30;", "const peak = intensity * 0.30;"],
  ["段落不再由時間推進（回到握壓數拍）",
   "  if(now < m.phaseEndsAt) return;", "  if(true) return;"],
  ["每幀不再 tick（段落永遠停在第一段）",
   "  tickManual478();                       // 自走：由時間推進段落（Pan 2026-08-04，不再抓捏握）",
   "  // (mutant) 不 tick"],
  ["開始之後握壓又有作用了（沒真的「不抓取捏握」）",
   "  if(!m.intro || m.done) return;             // 已經開始（或已完成）＝這一握沒有任何作用",
   "  if(m.done) return;"],
  ["梆子的震動改看使用者握壓（＝催促）",
   "      if(!p.accent) sendHapticAll(p.intensity, p.duration, true);",
   "      if(!p.accent) sendHapticAll(p.intensity * (state.grip[1] || 0), p.duration, true);"],
  // ── Pan 2026-08-06：「除了開頭那一下頌缽不要震動之外每一下都要震動」──────────────
  ["板又跟著震了（Pan 明確說開頭那一下頌缽不要震動）",
   "      if(!p.accent) sendHapticAll(p.intensity, p.duration, true);",
   "      sendHapticAll(p.intensity, p.duration, true);"],
  ["條件寫反：只有板震、眼都不震",
   "      if(!p.accent) sendHapticAll(p.intensity, p.duration, true);",
   "      if(p.accent) sendHapticAll(p.intensity, p.duration, true);"],
  ["震動整個拿掉（Pan 要的是「每一下都要震動」，不是都不震）",
   "      if(!p.accent) sendHapticAll(p.intensity, p.duration, true);",
   "      // (mutant) 不震"],
  ["板連聲音一起拿掉（Pan 只要拿掉震動，頌缽的聲音要留著）",
   "        if(p.accent) engine.singingBowl(az, 2.2, 0.85);\n        else engine.underwaterStone(az, 2.8, 0.55, p.size);",
   "        if(!p.accent) engine.underwaterStone(az, 2.8, 0.55, p.size);"],
  ["timer 不登記（離開段落時取消不掉＝殘留震動）",
   "    state.guided.hapticTimers.push(timer);\n  }\n  return bangziDuration(phase.count);",
   "  }\n  return bangziDuration(phase.count);"],
  ["完成時不清掉還沒發的點",
   "  clearGuidedHaptics();                   // 完成：取消這一段還沒發完的梆子點\n",
   ""],
  ["起新段落前不清上一段（兩段的點會疊在一起）",
   "function playBangziPhase(phase){\n  clearGuidedHaptics();",
   "function playBangziPhase(phase){"],
  ["偷偷打開震動總開關",
   "const HAPTICS_ENABLED = false;", "const HAPTICS_ENABLED = true;"],
  // ── Pan 2026-08-05 的三件回報（AC-3 / AC-4）─────────────────────────────────
  ["每一個點都換成頌缽（不只第一個音——Pan：「其他聲音維持目前設定」）",
   "        if(p.accent) engine.singingBowl(az, 2.2, 0.85);\n        else engine.underwaterStone(az, 2.8, 0.55, p.size);",
   "        engine.singingBowl(az, 2.2, 0.85);"],
  ["每一個點都是水中石頭（頌缽的那一記不見了＝Pan 的要求被還原掉）",
   "        if(p.accent) engine.singingBowl(az, 2.2, 0.85);\n        else engine.underwaterStone(az, 2.8, 0.55, p.size);",
   "        engine.underwaterStone(az, 2.8, 0.55, p.size);"],
  ["頌缽掛在錯的地方（改看第幾個點，不是看時間表上的板）",
   "        if(p.accent) engine.singingBowl(az, 2.2, 0.85);",
   "        if(p.idx === 1) engine.singingBowl(az, 2.2, 0.85);"],
  ["倒數又變成從 count−1 開始（Pan：「7 這段 竟然是從6開始」）",
   "  m.remaining = Math.max(0, phase.count - Math.max(0, done - 1));",
   "  m.remaining = Math.max(0, phase.count - done);"],
  ["倒數扣掉兩記（跳號，看不到 count 也看不到 count−1）",
   "  m.remaining = Math.max(0, phase.count - Math.max(0, done - 1));",
   "  m.remaining = Math.max(0, phase.count - Math.max(0, done - 2));"],
  // ⚠️ 2026-08-06：原本這裡有一個「改成算剩下的**時間比例**」的變異，等速化之後它變成
  // **等價變異**（equivalent mutant）——段長正好是 count × UNIT，所以按比例算出來的換數字
  // 時刻跟拍點完全重合，行為上無法區分，測試也就不該假裝抓得到。
  // 換成兩個真的會錯位的形狀（比例算錯分母 / 取整方向寫錯），對齊那條斷言仍然有效力：
  ["倒數改成算時間比例、但分母漏掉段尾的餘白（畫面比聲音早一步）",
   "  m.remaining = Math.max(0, phase.count - Math.max(0, done - 1));",
   "  m.remaining = Math.max(0, Math.ceil(phase.count * (m.phaseEndsAt - now) / Math.max(1, m.phaseEndsAt - m.phaseStartedAt - BANGZI_UNIT_MS)));"],
  ["倒數的取整方向寫反（第一個看到的數字變成 count−1）",
   "  m.remaining = Math.max(0, phase.count - Math.max(0, done - 1));",
   "  m.remaining = Math.max(0, Math.floor(phase.count * (m.phaseEndsAt - now) / (m.phaseEndsAt - m.phaseStartedAt)));"],
  ["點的震動時長回到寫死的 34ms（Pan：「有些數字有震動 有些沒有」）",
   "const BANGZI_TICK_MS = 54;", "const BANGZI_TICK_MS = 34;"],
  ["點的震動長到蓋過下一拍（連成一片嗡嗡，不是一點一點）",
   "const BANGZI_TICK_MS = 54;", "const BANGZI_TICK_MS = 400;"],
  ["點的震動比板還長（板不再是重音）",
   "const BANGZI_TICK_MS = 54;", "const BANGZI_TICK_MS = 120;"],
  ["點的時長沒吃常數（又寫死一個數字）",
   "      duration: BANGZI_TICK_MS,", "      duration: 34,"],
  // 2026-08-06：門檻改用力道定義（gripLevelForRaw），所以這裡的宣告形狀跟著變了
  ["抵達流程（問問題）的握壓被拿掉（Pan：那邊要保持原狀）",
   "const ARRIVAL_PRESS_ON = gripLevelForRaw(", "const ARRIVAL_PRESS_XX = gripLevelForRaw("],
  ["共振呼吸的引導被拿掉（Pan：前面自由呼吸保持原狀）",
   'if(presetId === "resonance"){', 'if(presetId === "__gone__"){'],
];

let caught = 0;
const escaped = [];

try {
  execFileSync("node", [SIM], { stdio: "pipe" });
  console.log("基準：乾淨的 index.html 通過測試 ✓\n");
} catch (e) {
  console.log("基準就失敗了，先修測試再跑變異：\n" + e.stdout.toString());
  process.exit(1);
}

let total = 0;
for (const [desc, from, to] of MUTANTS) {
  for (const [i, page] of PAGE_FILES.entries()) {
    total++;
    const tag = `(${i === 0 ? "zh" : "en"}) `;
    if (!ORIG[i].includes(from)) {
      escaped.push(`${tag}${desc}  ← 找不到要改的字串（變異腳本過期，或兩頁不同步）`);
      console.log(`  ?  ${tag}${desc}  ← 找不到目標字串`);
      continue;
    }
    fs.writeFileSync(page, ORIG[i].replace(from, to));
    let died = false, detail = "";
    try {
      execFileSync("node", [SIM], { stdio: "pipe" });
    } catch (e) {
      died = true;
      const m = e.stdout.toString().match(/  ✗ .*/);
      detail = m ? m[0].trim().slice(0, 76) : "";
    } finally {
      fs.writeFileSync(page, ORIG[i]);
    }
    if (died) { caught++; console.log(`  ✓  ${tag}${desc}\n         → ${detail}`); }
    else { escaped.push(tag + desc); console.log(`  ✗  ${tag}${desc}  ← 沒被抓到！`); }
  }
}

console.log("\n" + "=".repeat(60));
console.log(`${caught}/${total} 個變異被抓到。`);
if (escaped.length) {
  console.log("\n逃掉的變異（測試在這些地方沒有效力）：");
  escaped.forEach(e => console.log("  ✗ " + e));
  process.exit(1);
}
console.log("測試對所有變異都有效力。");
