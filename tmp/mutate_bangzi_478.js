#!/usr/bin/env node
/**
 * 變異測試：證明 tmp/sim_bangzi_478.js 真的抓得到東西。
 * 用法：node tmp/mutate_bangzi_478.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PAGE = path.join(ROOT, "web", "index.html");
// en 頁還沒同步之前用只跑 zh 的變體。每次都從 sim_bangzi_478.js **重新生成**——
// 手動維護兩份的話它會悄悄過期，然後變異測試量的是舊測試（本專案已經踩過一次）。
const SIM_SRC = path.join(__dirname, "sim_bangzi_478.js");
const EN_PAGE = path.join(ROOT, "web", "en", "index.html");
let SIM = SIM_SRC;
if (!/underwaterStone/.test(fs.readFileSync(EN_PAGE, "utf8"))) {
  const s = fs.readFileSync(SIM_SRC, "utf8");
  const zh = s.replace(/\n\s*\{ label: "en", file: path\.join\(ROOT, "web", "en", "index\.html"\) \},/, "");
  if (zh === s) throw new Error("生成 zh 變體失敗：找不到 en 的 PAGES 條目");
  SIM = path.join(__dirname, "_bangzi_zh.js");
  fs.writeFileSync(SIM, zh);
}
const original = fs.readFileSync(PAGE, "utf8");

const MUTANTS = [
  ["點數少一個（4 只給 3 點，不符 Pan 的「一下＋三次」）",
   "const n = Math.max(1, count) - 1;", "const n = Math.max(1, count) - 2;"],
  ["由快到慢變成等速",
   "const BANGZI_SLOWDOWN = 1.24;", "const BANGZI_SLOWDOWN = 1.0;"],
  ["由快到慢變成由慢到快",
   "const BANGZI_SLOWDOWN = 1.24;", "const BANGZI_SLOWDOWN = 0.8;"],
  ["起頭那一記不是重音（梆子沒有板）",
   "const out = [{ at: 0, accent: true,", "const out = [{ at: 0, accent: false,"],
  ["重音比點還弱（板被眼蓋過去）",
   "const BANGZI_ACCENT = { intensity: 165, duration: 78 };",
   "const BANGZI_ACCENT = { intensity: 40, duration: 78 };"],
  ["點的強度不遞減（機械等強度）",
   "intensity: Math.round(BANGZI_TICK_MAX - (BANGZI_TICK_MAX - BANGZI_TICK_MIN) * k),",
   "intensity: BANGZI_TICK_MAX,"],
  ["拍子快到跟不上（節律不再比使用者慢）",
   "const BANGZI_UNIT_MS = 900;", "const BANGZI_UNIT_MS = 120;"],
  ["拍子慢到失去 4-7-8 的形狀",
   "const BANGZI_UNIT_MS = 900;", "const BANGZI_UNIT_MS = 4000;"],
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

for (const [desc, from, to] of MUTANTS) {
  if (!original.includes(from)) {
    escaped.push(`${desc}  ← 找不到要改的字串（變異腳本自己過期了）`);
    console.log(`  ?  ${desc}  ← 找不到目標字串`);
    continue;
  }
  fs.writeFileSync(PAGE, original.replace(from, to));
  let died = false, detail = "";
  try {
    execFileSync("node", [SIM], { stdio: "pipe" });
  } catch (e) {
    died = true;
    const m = e.stdout.toString().match(/  ✗ .*/);
    detail = m ? m[0].trim().slice(0, 76) : "";
  } finally {
    fs.writeFileSync(PAGE, original);
  }
  if (died) { caught++; console.log(`  ✓  ${desc}\n         → ${detail}`); }
  else { escaped.push(desc); console.log(`  ✗  ${desc}  ← 沒被抓到！`); }
}

console.log("\n" + "=".repeat(60));
console.log(`${caught}/${MUTANTS.length} 個變異被抓到。`);
if (escaped.length) {
  console.log("\n逃掉的變異（測試在這些地方沒有效力）：");
  escaped.forEach(e => console.log("  ✗ " + e));
  process.exit(1);
}
console.log("測試對所有變異都有效力。");
