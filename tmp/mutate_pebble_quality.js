#!/usr/bin/env node
/**
 * 變異測試：證明 tmp/check_pebble_quality.js 真的抓得到東西。
 *
 * pebbleBuffer 的三個缺陷（Pan 2026-08-05「pebble 的聲音品質非常差」）全都是
 * 「改了不會報錯、只會聽起來很差」的那種，所以那支測試必須是**量出來的**而不是 regex。
 * 這裡把它逐一改壞，要求每個變異都至少讓一項斷言失敗。
 *
 * 兩頁各注入一次（漏同步是這個專案最常見的錯）。
 *
 * 用法：node tmp/mutate_pebble_quality.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SIM = path.join(__dirname, "check_pebble_quality.js");
const PAGE_FILES = [path.join(ROOT, "web", "index.html"), path.join(ROOT, "web", "en", "index.html")];
const ORIG = PAGE_FILES.map(f => fs.readFileSync(f, "utf8"));
for (const [i, f] of PAGE_FILES.entries()) {
  if (!/const PEBBLE_RATE = /.test(ORIG[i])) throw new Error(`${f} 還沒有 PEBBLE_RATE——兩頁要先同步`);
}

const MUTANTS = [
  // ── ① 循環接縫（每 4.5 秒一次喀聲）───────────────────────────────────────────
  ["不繞回開頭（尾巴被 len 硬切＝每次循環一次喀聲，這就是舊版的 bug）",
   "          const k = (start + j) % len;",
   "          const k = start + j; if(k >= len) break;"],
  ["繞回寫成夾住（尾巴全部堆在最後一格）",
   "          const k = (start + j) % len;",
   "          const k = Math.min(len - 1, start + j);"],
  // ── ② 密度（糊成一片低頻嗡嗡）─────────────────────────────────────────────────
  ["密度回到舊版的量級（~34 顆/秒＝聽不出一顆一顆）",
   "const PEBBLE_RATE = 11;", "const PEBBLE_RATE = 34;"],
  ["密度稍微調高就好（22：仍然糊）",
   "const PEBBLE_RATE = 11;", "const PEBBLE_RATE = 22;"],
  ["密度太低（2 顆/秒＝不是石灘，是零星敲擊）",
   "const PEBBLE_RATE = 11;", "const PEBBLE_RATE = 2;"],
  ["顆數不吃常數（又寫死）",
   "      const n = Math.max(1, Math.round(dur * PEBBLE_RATE));",
   "      const n = Math.max(1, Math.round(dur * 34));"],
  // ── ③ 接觸瞬態（只剩低頻噗）────────────────────────────────────────────────────
  ["拿掉石頭互撞的「喀」（回到只有低頻正弦＋雜訊）",
   "          d[k] += (0.46 * tone + 0.40 * clack + 0.14 * grit) * amp * a;",
   "          d[k] += (0.86 * tone + 0.14 * grit) * amp * a;"],
  ["「喀」的衰減拉長成鈴聲（不是碰撞）",
   "        const cd  = rate * 0.008;", "        const cd  = rate * 0.30;"],
  ["「喀」的頻率拉到高頻（變成沙灘的沙沙，不是大圓石）",
   "        const fc  = 650 + Math.random() * 1150;",
   "        const fc  = 4000 + Math.random() * 3000;"],
  // ── 其他會聽出來的破壞 ───────────────────────────────────────────────────────
  ["石頭的低頻共振拉高（不再是「大圓石」）",
   "        const f   = 110 + Math.random() * 250;",
   "        const f   = 900 + Math.random() * 250;"],
  ["每顆拉得很長（互相重疊 ⇒ crest 塌回去，糊成持續噪音）",
   "        const dl  = Math.floor(rate * (0.026 + Math.random() * 0.058));",
   "        const dl  = Math.floor(rate * (0.5 + Math.random() * 0.5));"],
  // ⚠️ from 字串必須夠獨特：`const d = buf.getChannelData(ch);` 在 index.html 裡有四處，
  // 而 String.replace 只換**第一處**（那是別的函式）⇒ 變異注入到了無關的地方、當然不會被抓到。
  // 這是我自己踩到的坑，帶上下一行讓它唯一。
  ["兩聲道用同一份（立體聲塌成單點）",
   "      const d = buf.getChannelData(ch);\n      const n = Math.max(1, Math.round(dur * PEBBLE_RATE));",
   "      const d = buf.getChannelData(0);\n      const n = Math.max(1, Math.round(dur * PEBBLE_RATE));"],
  ["拿掉正規化（峰值失控＝限幅保護沒了）",
   "      if(pk > 0){ const kk = 0.7 / pk; for(let k = 0; k < len; k++) d[k] *= kk; }",
   "      // (mutant) 不正規化"],
  ["正規化到 1.0（下游還要疊 makeup 與其他層，會爆）",
   "const kk = 0.7 / pk;", "const kk = 1.0 / pk;"],
  // 0.5ms 的起音坡（24 個取樣）是防禦性細節：實測拿掉之後**量不出差別**（最大跳變/峰值
  // 兩者都是 0.396，中位數 0.312 vs 0.344＝seed 雜訊的量級）。所以這一項只能用結構斷言守，
  // 而測試裡也是這樣標註的——不假裝它是量出來的。
  ["起音拿掉（每顆石頭從滿幅開始）",
   "          const a = j < atk ? j / atk : 1;", "          const a = 1;"],
  // ── 底量（不能順手把 2026-08-04 那次修正弄掉）──────────────────────────────────
  ["把 pebble 的底量拿掉（Pan 之前回報「pebble 的聲音幾乎都是沒有的」）",
   "const PEBBLE_FLOOR = 0.14;", "const PEBBLE_FLOOR = 0.0;"],
];

let caught = 0;
const escaped = [];

try {
  execFileSync("node", [SIM], { stdio: "pipe" });
  console.log("基準：乾淨的兩頁通過測試 ✓\n");
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
