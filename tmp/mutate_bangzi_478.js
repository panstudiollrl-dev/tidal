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
for (const [i, f] of PAGE_FILES.entries()) {
  if (!/const BANGZI_CURVE = /.test(ORIG[i]))
    throw new Error(`${f} 還沒有 BANGZI_CURVE——兩頁要先同步`);
}

const MUTANTS = [
  ["點數少一個（4 只給 3 點，不符 Pan 的「一下＋三次」）",
   "const n = Math.max(1, count) - 1;", "const n = Math.max(1, count) - 2;"],
  // ── 速度曲線（2026-08-05 取自 Pan 的 MIDI，取代了原本的 BANGZI_SLOWDOWN 幾何級數）──
  // 這一批全都是「改了不會報錯、只會聽起來不對」的寫法，正是需要測試守門的那種。
  ["曲線變等速（漸快漸慢都消失）",
   "const BANGZI_CURVE = [2.04, 1.33, 1.28, 1.00, 1.00, 1.09, 1.33, 1.37, 1.68, 1.89];",
   "const BANGZI_CURVE = [1, 1, 1, 1, 1, 1, 1, 1, 1, 1];"],
  ["曲線整個反過來（變成短起頭 + 漸慢再漸快）",
   "const BANGZI_CURVE = [2.04, 1.33, 1.28, 1.00, 1.00, 1.09, 1.33, 1.37, 1.68, 1.89];",
   "const BANGZI_CURVE = [1.89, 1.68, 1.37, 1.33, 1.09, 1.00, 1.00, 1.28, 1.33, 2.04];"],
  ["回到單向的漸慢（＝改版前的模型，沒有 accel）",
   "const BANGZI_CURVE = [2.04, 1.33, 1.28, 1.00, 1.00, 1.09, 1.33, 1.37, 1.68, 1.89];",
   "const BANGZI_CURVE = [1.00, 1.10, 1.21, 1.33, 1.46, 1.61, 1.77, 1.95, 2.14, 2.36];"],
  ["第一個間隔不是最長的（Pan 明確要求「第一拍拍下去有個較長間隔」）",
   "const BANGZI_CURVE = [2.04, 1.33, 1.28, 1.00, 1.00, 1.09, 1.33, 1.37, 1.68, 1.89];",
   "const BANGZI_CURVE = [1.20, 1.33, 1.28, 1.00, 1.00, 1.09, 1.33, 1.37, 1.68, 1.89];"],
  ["曲線是自己編的、不是那份 MIDI 量出來的比例",
   "const BANGZI_CURVE = [2.04, 1.33, 1.28, 1.00, 1.00, 1.09, 1.33, 1.37, 1.68, 1.89];",
   "const BANGZI_CURVE = [2.50, 1.60, 1.30, 1.00, 1.00, 1.20, 1.50, 1.60, 1.90, 2.20];"],
  ["曲線用**截斷**而不是重新取樣（短段落只拿到前半＝聽不到漸慢）",
   "    const p = i / (n - 1) * last;",
   "    const p = Math.min(last, i);"],
  ["重新取樣的頭尾沒對上曲線頭尾（差一格的經典錯）",
   "    const p = i / (n - 1) * last;",
   "    const p = i / n * last;"],
  ["MIN/MAX 寫死成別的值（強度的正規化會歪掉）",
   "const BANGZI_CURVE_MIN = Math.min(...BANGZI_CURVE);",
   "const BANGZI_CURVE_MIN = 0;"],
  ["起頭那一記不是重音（梆子沒有板）",
   "const out = [{ at: 0, accent: true,", "const out = [{ at: 0, accent: false,"],
  ["重音比點還弱（板被眼蓋過去）",
   "const BANGZI_ACCENT = { intensity: 165, duration: 78 };",
   "const BANGZI_ACCENT = { intensity: 40, duration: 78 };"],
  ["點的強度不遞減（機械等強度）",
   "intensity: Math.round(BANGZI_TICK_MAX - (BANGZI_TICK_MAX - BANGZI_TICK_MIN) * (0.65 * slow + 0.35 * k)),",
   "intensity: BANGZI_TICK_MAX,"],
  ["強度只看位置、不看當下的速度（MIDI 的力度在最快處會回升）",
   "const slow = span > 0 ? (gaps[i] - BANGZI_CURVE_MIN) / span : 0;   // 0＝最快、1＝最慢",
   "const slow = k;"],
  ["石頭大小與強度反向（一個變大一個變小＝收尾不是淡出）",
   "      size: 0.5 - 0.25 * (0.65 * slow + 0.35 * k),",
   "      size: 0.25 + 0.25 * (0.65 * slow + 0.35 * k),"],
  ["拍子快到跟不上（節律不再比使用者慢）",
   "const BANGZI_UNIT_MS = 880;", "const BANGZI_UNIT_MS = 120;"],
  ["拍子慢到失去 4-7-8 的形狀",
   "const BANGZI_UNIT_MS = 880;", "const BANGZI_UNIT_MS = 4000;"],
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
   "      sendHapticAll(p.intensity, p.duration, true);   // force：4-7-8 的引導震動是 Pan 要的",
   "      sendHapticAll(p.intensity * (state.grip[1] || 0), p.duration, true);"],
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
  ["段落聲音換回頌缽（不是 Pan 要的水中石頭）",
   "      if(engine) engine.underwaterStone(az, p.accent ? 2.2 : 2.8, p.accent ? 0.85 : 0.55, p.size);",
   "      if(engine) playBowlForHands();"],
  ["抵達流程（問問題）的握壓被拿掉（Pan：那邊要保持原狀）",
   "const ARRIVAL_PRESS_ON = 0.28;", "const ARRIVAL_PRESS_XX = 0.28;"],
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
