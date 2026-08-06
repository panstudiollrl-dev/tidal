#!/usr/bin/env node
/**
 * 突變測試：驗證 tmp/test_grip_thresholds.js 真的會擋下錯誤，而不是只會通過。
 *
 * 做法：把頁面複製一份、注入一個**真實可能犯的**錯、跑測試、看它是否失敗。
 * 每個突變都是「寫成這樣不會報錯、只會在實機上壞掉」的那種——正是需要測試守門的。
 *
 * 重點：第一組突變就是 Pan 2026-08-06 回報的那個 bug 本身（門檻寫回裸水位）。
 * 如果哪天有人「順手把它改回比較好讀的 0.24」，這支必須立刻抓到。
 *
 * 用法：node tmp/mutate_grip_thresholds.js [--log <path>]
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PAGE_FILES = [path.join(ROOT, "web", "index.html"), path.join(ROOT, "web", "en", "index.html")];
const ORIG = PAGE_FILES.map(f => fs.readFileSync(f, "utf8"));
const argv = process.argv.slice(2);
const logArg = (() => { const i = argv.indexOf("--log"); return i >= 0 ? ["--log", argv[i + 1]] : []; })();

const MUTANTS = [
  // ── Pan 2026-08-06 的 bug 本身：門檻寫回裸水位 ────────────────────────────
  ["AFTER_ON 改回裸水位 0.24（＝Pan 回報的「478 結束後握力球沒反應」）",
   s => s.replace("const AFTER_ON = gripLevelForRaw(300);", "const AFTER_ON = 0.24;")],
  ["AFTER_ON 用裸水位但寫成看起來很小的 0.14（仍然是 342raw，弱球還是答不出）",
   s => s.replace("const AFTER_ON = gripLevelForRaw(300);", "const AFTER_ON = 0.14;")],
  ["AFTER_ON 的 raw 抬到 460（數字形式對、力道錯＝同一個 bug 換個寫法）",
   s => s.replace("gripLevelForRaw(300)", "gripLevelForRaw(460)")],
  ["分級改回寫死 0.33/0.66（弱球表達不出「很明顯」＝「有一顆球幾乎沒有效用」）",
   s => s.replace("return v >= AFTER_BAND_CLEAR ? 3 : v >= AFTER_BAND_SOME ? 2 : v >= AFTER_ON ? 1 : 0;",
                  "return v >= 0.66 ? 3 : v >= 0.33 ? 2 : v >= AFTER_ON ? 1 : 0;")],
  ["「很明顯」的 raw 抬到 1094（＝0.66@1400，弱球用力握也到不了）",
   s => s.replace("const AFTER_BAND_CLEAR = gripLevelForRaw(700)", "const AFTER_BAND_CLEAR = gripLevelForRaw(1094)")],
  ["相符程度分級改回寫死 0.66/0.33",
   s => s.replace("return a >= AGREE_BAND_CLOSE ? 2 : a >= AGREE_BAND_SOME ? 1 : 0;",
                  "return a >= 0.66 ? 2 : a >= 0.33 ? 1 : 0;")],
  ["MANUAL_478_ON 改回裸水位 0.20（弱球按不動「握一下開始」）",
   s => s.replace(/const MANUAL_478_ON = gripLevelForRaw\(\d+\);[^\n]*/, "const MANUAL_478_ON = 0.20;")],
  ["ARRIVAL_PRESS_ON 改回裸水位 0.28",
   s => s.replace(/const ARRIVAL_PRESS_ON = gripLevelForRaw\(\d+\);[^\n]*/, "const ARRIVAL_PRESS_ON = 0.28;")],
  ["HARD_GRIP 改回裸水位 0.7",
   s => s.replace(/const HARD_GRIP = gripLevelForRaw\(\d+\);[^\n]*/, "const HARD_GRIP = 0.7;")],
  // ── 換算函式本身被改壞 ────────────────────────────────────────────────────
  ["gripLevelForRaw 漏掉死區（殘壓會被讀成答案）",
   s => s.replace("if(r <= GRIP_DEADZONE) return 0;\n  return Math.pow((r - GRIP_DEADZONE) / (1 - GRIP_DEADZONE), GRIP_GAMMA);",
                  "return Math.pow(r, GRIP_GAMMA);")],
  ["gripLevelForRaw 漏掉 GRIP_HEADROOM（每個門檻的力道都差 1.22 倍）",
   s => s.replace("const r = raw / (GRIP_FULL_SCALE * GRIP_HEADROOM);", "const r = raw / GRIP_FULL_SCALE;")],
  ["gripLevelForRaw 漏掉 GAMMA 曲線（與 GripCalibrator 的曲線不一致）",
   s => s.replace("return Math.pow((r - GRIP_DEADZONE) / (1 - GRIP_DEADZONE), GRIP_GAMMA);",
                  "return (r - GRIP_DEADZONE) / (1 - GRIP_DEADZONE);")],
  ["gripLevelForRaw 沒有上限（超過滿刻度會回傳 >1，水位條會爆出去）",
   s => s.replace("const GRIP_FULL_SCALE = 1400;", "const GRIP_FULL_SCALE = 100;")],
  // ── 遲滯 ──────────────────────────────────────────────────────────────────
  ["AFTER_OFF 抬到跟 ON 一樣（沒有遲滯＝作答被抖動打斷）",
   s => s.replace("const AFTER_OFF = gripLevelForRaw(250);", "const AFTER_OFF = gripLevelForRaw(300);")],
  ["AFTER_OFF 壓到死區以下（永遠偵測不到「放開」＝卡在鬆開握力球）",
   s => s.replace("const AFTER_OFF = gripLevelForRaw(250);", "const AFTER_OFF = gripLevelForRaw(100);")],
  ["ON/OFF 反過來（放開門檻高於作答門檻）",
   s => s.replace("const AFTER_ON = gripLevelForRaw(300);", "const AFTER_ON = gripLevelForRaw(200);")],
  // ── 滿刻度回退（會把所有門檻的力道再次悄悄改掉）──────────────────────────
  ["GRIP_FULL_SCALE 回退成 900（驗證門檻現在不再隨它跑掉；水位貼頂會回來）",
   s => s.replace("const GRIP_FULL_SCALE = 1400;", "const GRIP_FULL_SCALE = 900;")],
  // ── 鵝卵石開場靜音（Pan 2026-08-06：「請把一開始的滾石聲完整去除」）────────
  ["底量淡入係數初值改成 1（開場又聽到滾石聲＝Pan 明確要求去除的那個聲音）",
   s => s.replace("this.pebbleFloorAmt = 0;", "this.pebbleFloorAmt = 1;")],
  ["底量沒有乘上淡入係數（改動等於沒生效）",
   s => s.replace("(PEBBLE_FLOOR * this.pebbleFloorAmt + 0.52 * stoneAmt)", "(PEBBLE_FLOOR + 0.52 * stoneAmt)")],
  ["把 PEBBLE_FLOOR 直接刪成 0（違反「聲音永遠成立」＋ Pan 2026-08-04「pebble 幾乎聽不到」）",
   s => s.replace("const PEBBLE_FLOOR = 0.14;", "const PEBBLE_FLOOR = 0;")],
  ["第一次握球不打開底量（整場都沒有鵝卵石底量＝把 2026-08-04 的修法弄回去）",
   s => s.replace("if(!this.pebbleFloorOpen && level >= MANUAL_478_ON) this.pebbleFloorOpen = true;", "")],
  ["淡入變成瞬間打開（喀一聲跳出來，違反「平滑不跳變」）",
   s => s.replace(/const PEBBLE_FLOOR_RAMP_S = [\d.]+;/, "const PEBBLE_FLOOR_RAMP_S = 0.001;")],
  ["連握出來的石頭聲也被淡入係數擋住（第一次握球沒有石頭聲）",
   s => s.replace("(PEBBLE_FLOOR * this.pebbleFloorAmt + 0.52 * stoneAmt)",
                  "(PEBBLE_FLOOR + 0.52 * stoneAmt) * this.pebbleFloorAmt")],
];

const restore = () => PAGE_FILES.forEach((f, i) => fs.writeFileSync(f, ORIG[i]));

let caught = 0, total = 0;
const escaped = [];

for (const [label, mut] of MUTANTS) {
  // 每個突變在**兩頁**各注入一次：只改 zh 版是這個專案最容易發生的漏同步。
  for (let i = 0; i < PAGE_FILES.length; i++) {
    total++;
    const tag = `(${i === 0 ? "zh" : "en"}) `;
    const next = mut(ORIG[i]);
    if (next === ORIG[i]) {
      escaped.push(`${tag}${label}  ← 突變沒套用（regex 對不到，兩頁可能不同步）`);
      continue;
    }
    fs.writeFileSync(PAGE_FILES[i], next);
    let died = false;
    try {
      execFileSync("node", [path.join(__dirname, "test_grip_thresholds.js"), ...logArg], { stdio: "pipe" });
    } catch { died = true; }
    restore();
    if (died) { caught++; console.log(`  ✓ 擋下  ${tag}${label}`); }
    else escaped.push(tag + label);
  }
}

console.log("\n" + "=".repeat(60));
console.log(`${caught}/${total} 個突變被擋下。`);
if (escaped.length) {
  console.log("\n漏掉的：");
  escaped.forEach(e => console.log("  ✗ " + e));
  process.exit(1);
}
