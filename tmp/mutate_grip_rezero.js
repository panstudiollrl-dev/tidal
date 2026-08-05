#!/usr/bin/env node
/**
 * 變異測試：證明 tmp/sim_grip_rezero.js 真的抓得到東西。
 *
 * 一支「全部通過」的測試如果把碼改壞了還是通過，那它測的就不是它宣稱的東西。
 * 這支腳本把 index.html 裡的關鍵行逐一改壞（每次一個），跑 sim_grip_rezero.js，
 * 要求**每個變異都至少讓一項斷言失敗**。
 *
 * 用法：node tmp/mutate_grip_rezero.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const PAGE = path.join(ROOT, "web", "index.html");
// en 頁還沒同步這批改動之前，用只跑 zh 的變體（同一支測試，只是少一個 PAGES 條目）。
// 每次都重新生成，不要留一份手動維護的副本——那份會過期，於是變異測試量的是舊測試。
const SIM_SRC = path.join(__dirname, "sim_grip_rezero.js");
const EN_PAGE = path.join(ROOT, "web", "en", "index.html");
let SIM = SIM_SRC;
// 判斷條件要用**最新**同步過去的東西，不是最舊的：GRIP_HIST_MIN_MS 從 2026-08-04 就在 en 頁了，
// 拿它當條件的話 2026-08-05 這批（GRIP_SETTLE_*）還沒同步時也會被當成「已同步」，
// 於是變異測試會去跑一個 en 頁根本沒有那段碼的測試＝基準就掛掉。改成檢查最新的那個常數。
if (!/GRIP_SETTLE_MS/.test(fs.readFileSync(EN_PAGE, "utf8"))) {
  const s = fs.readFileSync(SIM_SRC, "utf8");
  const zh = s.replace(/\n\s*\{ label: "en", file: path\.join\(ROOT, "web", "en", "index\.html"\) \},/, "");
  if (zh === s) throw new Error("生成 zh 變體失敗：找不到 en 的 PAGES 條目");
  SIM = path.join(__dirname, "_sim_zh.js");
  fs.writeFileSync(SIM, zh);
}
const original = fs.readFileSync(PAGE, "utf8");

// 每個變異：[說明, 原字串, 改成什麼]
const MUTANTS = [
  ["整段零點修正拿掉（回到 Pan 遇到的 bug）",
   "if(this.rezeroCount === 0 && now - this.firstReportAt < GRIP_REZERO_MS){",
   "if(false){"],
  ["零點修正的窗縮到幾乎沒有",
   "const GRIP_REZERO_MS = 8000;", "const GRIP_REZERO_MS = 200;"],
  ["門檻拉到比窗還長（等於永遠湊不滿）",
   "const GRIP_HIST_MIN_MS = 1500;", "const GRIP_HIST_MIN_MS = 20000;"],
  ["門檻縮到 0.2 秒（數拍的一握就會被當成零點錯）",
   "const GRIP_HIST_MIN_MS = 1500;", "const GRIP_HIST_MIN_MS = 200;"],
  ["挑戰者不含鄰格（手抖跨格邊界 → 佔用時間被切兩半）",
   "for(let b = bin - 1; b <= bin + 1; b++){", "for(let b = bin; b <= bin; b++){"],
  ["佔用時間不設上限",
   "const dtMs = this.lastHistAt == null ? 0 : Math.min(100, now - this.lastHistAt);",
   "const dtMs = this.lastHistAt == null ? 0 : (now - this.lastHistAt);"],
  ["換零點時不重設 edge（＝積著的邊一起認列）",
   "this.edge.armed = true; this.edge.floor = 0; this.edge.peak = 0; this.edge.pulse = false;\n        this.holdRun = 0; this.healing = false;",
   "this.holdRun = 0;"],
  ["換零點時不歸零水位",
   "this.level = 0;                                               // 水位也歸零：舊零點算出來的水位是假的",
   "// (mutant) 水位不歸零"],
  ["換零點時不重設平滑器",
   "this.smRaw = raw;                                             // 平滑器也重新起算，不要拖著舊零點的殘影",
   "// (mutant) 平滑器不重設"],
  ["允許反覆換零點（拿掉一次性守門）",
   "if(this.rezeroCount === 0 && now - this.firstReportAt < GRIP_REZERO_MS){",
   "if(now - this.firstReportAt < GRIP_REZERO_MS){"],
  ["零點挪動門檻設成 0（一點雜訊就換零點）",
   "const GRIP_REZERO_MIN_SHIFT = 90;", "const GRIP_REZERO_MIN_SHIFT = 0;"],
  ["不反應期拿掉（＝bang 好幾次）",
   "if(e.lastFireAt == null || now - e.lastFireAt >= GRIP_BEAT_REFRACTORY_MS){",
   "if(true){"],
  ["不反應期長到吃掉真的拍（1 拍/秒 會被吃掉一半）",
   "const GRIP_BEAT_REFRACTORY_MS = 400;", "const GRIP_BEAT_REFRACTORY_MS = 1600;"],
  ["不反應期內連解除武裝都擋掉（這一握不會結束 → 後面全測不到）",
   "e.armed = false; e.peak = posDelta; e.floorAtFire = e.floor; this.holdRun = 0; this.healing = false;",
   "if(e.pulse){ e.armed = false; e.peak = posDelta; e.floorAtFire = e.floor; this.holdRun = 0; this.healing = false; }"],
  ["極性又開始猜了（拿掉 Math.abs）",
   "const dev = Math.abs(rawDev);", "const dev = Math.max(0, rawDev);"],
  // 2026-08-04 真的踩到過（用 tmp/_dbg.js beats 發現）：只要求「待滿門檻」而不要求
  // 「贏過零點那一格」，連續數拍就會把零點搬到握著的值 → 放開後水位卡在 0.8。
  ["挑戰者不必贏過零點那一格（數拍會把零點偷走）",
   "if(ms >= GRIP_HIST_MIN_MS && ms > baseMs && n > 0", "if(ms >= GRIP_HIST_MIN_MS && n > 0"],
  ["現任者的佔用時間算錯格（拿零點以外的格去比）",
   "const baseBin = Math.round(this.baseline / GRIP_HIST_BIN);",
   "const baseBin = Math.round(raw / GRIP_HIST_BIN);"],
  // ── 零點下方的平台（2026-08-05）：Pan 回報「握了再放掉會一直停留在半滿」的修法 ──
  ["整段平台偵測拿掉（回到 Pan 2026-08-05 遇到的三方死鎖）",
   "if(below >= GRIP_SETTLE_MIN_SHIFT){", "if(false){"],
  ["平台改成雙向（Math.abs）＝會把 4-7-8 的長握當成錯零點",
   "const below = this.baseline - raw;", "const below = Math.abs(this.baseline - raw);"],
  ["平台方向反過來（只看零點上方）＝救不到錯零點、反而吃長握",
   "const below = this.baseline - raw;", "const below = raw - this.baseline;"],
  ["平台時間拉到 30 秒（使用者體感還是「卡住」）",
   "const GRIP_SETTLE_MS = 600;", "const GRIP_SETTLE_MS = 30000;"],
  ["平台時間縮到 0（一筆雜訊就搬零點）",
   "const GRIP_SETTLE_MS = 600;", "const GRIP_SETTLE_MS = 0;"],
  ["平台位移門檻設成 0（雜訊搬來搬去）",
   "const GRIP_SETTLE_MIN_SHIFT = 60;", "const GRIP_SETTLE_MIN_SHIFT = 0;"],
  ["平台位移門檻拉到死區之上（死區內的錯零點救不到）",
   "const GRIP_SETTLE_MIN_SHIFT = 60;", "const GRIP_SETTLE_MIN_SHIFT = 400;"],
  ["不要求平台「停住」（慢慢滑下去的漂移也會被當成平台）",
   "if(this.plateauAt == null || Math.abs(raw - this.plateauRaw) > GRIP_HIST_BIN){",
   "if(this.plateauAt == null){"],
  ["採用平台時忘了搬 restRef（放開分支又把零點拉回錯的地方）",
   "this.restRef = this.plateauRaw;", "// (mutant) restRef 不搬"],
  ["採用平台時不重設 edge（＝突然 bang 好幾次）",
   "this.edge.armed = true; this.edge.floor = 0; this.edge.peak = 0; this.edge.pulse = false;\n          this.holdRun = 0; this.healing = false;",
   "this.holdRun = 0;"],
  ["平台機制被關在 8 秒窗裡（Pan 的症狀正是握超過 8 秒才放開）",
   "if(below >= GRIP_SETTLE_MIN_SHIFT){",
   "if(below >= GRIP_SETTLE_MIN_SHIFT && now - this.firstReportAt < GRIP_REZERO_MS){"],
  ["平台機制加上一次性額度（放開幾次就該救幾次）",
   "if(below >= GRIP_SETTLE_MIN_SHIFT){",
   "if(below >= GRIP_SETTLE_MIN_SHIFT && this.settleCount === 0){"],
];

let caught = 0;
const escaped = [];

// 先確認乾淨的碼是通過的——不然「變異被抓到」沒有意義
try {
  execFileSync("node", [SIM], { stdio: "pipe" });
  console.log("基準：乾淨的 index.html 通過測試 ✓\n");
} catch (e) {
  console.log("基準就失敗了，先修測試再跑變異：\n" + e.stdout.toString());
  process.exit(1);
}

for (const [desc, from, to] of MUTANTS) {
  if (!original.includes(from)) {
    escaped.push(`${desc}  ← 找不到要改的字串（測試腳本自己過期了）`);
    console.log(`  ?  ${desc}  ← 找不到目標字串`);
    continue;
  }
  const mutated = original.replace(from, to);
  fs.writeFileSync(PAGE, mutated);
  let died = false, detail = "";
  try {
    execFileSync("node", [SIM], { stdio: "pipe" });
  } catch (e) {
    died = true;
    const out = e.stdout.toString();
    const m = out.match(/  ✗ .*/);
    detail = m ? m[0].trim().slice(0, 74) : "";
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
