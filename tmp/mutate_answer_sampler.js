#!/usr/bin/env node
/**
 * 變異測試：證明 tmp/test_answer_sampler.js 真的抓得到東西。
 *
 * 這一批的意義特別具體：Pan 2026-08-06 回報「太敏感 輕輕碰就全滿 也很容易滑動去其他區域」
 * 的時候，同一段程式碼**通過了 106 項斷言**——因為那些測試各自寫了一份自己的計分規則，
 * 頁面上真正在算分的那段（峰值定案 + 換級歸零）沒有任何測試看著。所以下面第一批變異就是
 * 把那兩個舊寫法原封不動放回去：如果新測試抓不到它們，這支測試就等於沒寫。
 *
 * 用法：node tmp/mutate_answer_sampler.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TEST = path.join(__dirname, "test_answer_sampler.js");
const PAGE_FILES = [path.join(ROOT, "web", "index.html"), path.join(ROOT, "web", "en", "index.html")];
const ORIG = PAGE_FILES.map(f => fs.readFileSync(f, "utf8"));

// 前提：兩頁都要已經是取樣器版（漏同步的話下面會變成一排「找不到目標字串」的雜訊）
for (const [i, f] of PAGE_FILES.entries()) {
  if (!/class AnswerSampler\{/.test(ORIG[i])) throw new Error(`${f} 沒有 AnswerSampler——兩頁要先同步`);
  if (/const AFTER_HOLD_MS = /.test(ORIG[i])) throw new Error(`${f} 還留著 AFTER_HOLD_MS——兩頁要先同步`);
}

const MUTANTS = [
  // ── ① 把 Pan 回報的那兩個舊寫法放回去（迴歸的正本）────────────────────────
  ["定案又改回峰值（＝Pan 的「輕輕碰就全滿」；一幀尖峰決定整題）",
   "    const s = [...this.buf].sort((a, b) => a - b);\n    const n = s.length;\n    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;",
   "    return Math.max(...this.buf);"],
  ["定案改成平均（比峰值好，但擋不住 3103raw 那種量級的尖峰）",
   "    const s = [...this.buf].sort((a, b) => a - b);\n    const n = s.length;\n    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;",
   "    return this.buf.reduce((x, y) => x + y, 0) / this.buf.length;"],
  ["中位數取錯（偶數筆時取上半的那一筆＝偏高，尖峰又有影響力）",
   "    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2;",
   "    return s[Math.ceil((n - 1) / 2) + 1] ?? s[n - 1];"],
  ["排序方向寫反（中位數還對，但 [2] 的 sort 斷言要看得住形狀）",
   "    const s = [...this.buf].sort((a, b) => a - b);",
   "    const s = [...this.buf].sort((a, b) => b - a);\n    this.buf.length && (s[0] = Math.max(...this.buf));"],
  ["水位顯示又跟著瞬時值（畫面被尖峰推到全滿——Pan 看到的「全滿」就是這個）",
   "  display(level){ return this.buf.length ? this.value() : level; }",
   "  display(level){ return Math.max(level, this.buf.length ? this.value() : 0); }"],

  // ── ② 滯後計時（Pan：「很容易滑動去其他區域」）────────────────────────────
  ["放開的判定改用 ON（沒有遲滯：在門檻上下抖動就會反覆中斷）",
   "    else if(level < AFTER_OFF) this.holding = false;",
   "    else if(level < AFTER_ON) this.holding = false;"],
  ["握的判定改用 OFF（遲滯反過來＝殘壓就進入作答）",
   "    if(level >= AFTER_ON) this.holding = true;",
   "    if(level >= AFTER_OFF) this.holding = true;"],
  ["放開時不清計時（兩段短握會被相加成一次作答）",
   "    if(!this.holding){ this.heldMs = 0; this.buf = []; return false; }",
   "    if(!this.holding){ return false; }"],
  ["放開時清計時但不清取樣（上一段的握混進下一段的答案）",
   "    if(!this.holding){ this.heldMs = 0; this.buf = []; return false; }",
   "    if(!this.holding){ this.heldMs = 0; return false; }"],
  ["沒握也繼續累積（殘壓被讀成答案＝憑空編分數）",
   "    if(!this.holding){ this.heldMs = 0; this.buf = []; return false; }",
   "    if(!this.holding){ this.heldMs = 0; this.buf = []; }"],

  // ── ③ settle ────────────────────────────────────────────────────────────
  ["settle 拿掉（手還在往目標爬的那段被計入 ⇒ 答案被拉低）",
   "    if(this.heldMs > AFTER_SETTLE_MS) this.buf.push(level);",
   "    this.buf.push(level);"],
  ["settle 判斷寫成 <（只取爬升段，握穩之後的完全不取）",
   "    if(this.heldMs > AFTER_SETTLE_MS) this.buf.push(level);",
   "    if(this.heldMs < AFTER_SETTLE_MS) this.buf.push(level);"],
  ["settle 長到吃掉整個取樣窗（永遠定不了案）",
   "const AFTER_SETTLE_MS = 300;", "const AFTER_SETTLE_MS = 2000;"],
  ["settle 短到沒有作用",
   "const AFTER_SETTLE_MS = 300;", "const AFTER_SETTLE_MS = 10;"],

  // ── ④ 定案的時間門檻 ────────────────────────────────────────────────────
  ["取樣時間算成總握壓時間（settle 那段被重複計入 ⇒ 提早定案）",
   "  sampledMs(dtMs){ return this.buf.length * dtMs; }",
   "  sampledMs(dtMs){ return this.heldMs; }"],
  ["取樣時間算成筆數（跟幀率綁在一起，30Hz 下等於只要 1/33 的時間）",
   "  sampledMs(dtMs){ return this.buf.length * dtMs; }",
   "  sampledMs(dtMs){ return this.buf.length; }"],
  ["握一下就定案（回到「輕輕碰就算」）",
   "const AFTER_SAMPLE_MS = 1100;", "const AFTER_SAMPLE_MS = 60;"],
  ["要握到手酸才定案",
   "const AFTER_SAMPLE_MS = 1100;", "const AFTER_SAMPLE_MS = 6000;"],
  ["定案條件寫成 >（差一幀，邊界上握不滿）",
   "    return this.sampledMs(dtMs) >= AFTER_SAMPLE_MS;",
   "    return this.sampledMs(dtMs) > AFTER_SAMPLE_MS * 2;"],
  ["永遠不回報可以定案（問卷會卡住）",
   "    return this.sampledMs(dtMs) >= AFTER_SAMPLE_MS;", "    return false;"],
  ["每一幀都回報可以定案（第一幀就記分）",
   "    return this.sampledMs(dtMs) >= AFTER_SAMPLE_MS;", "    return true;"],

  // ── ⑤ 沒有取樣時的行為（資料完整性）──────────────────────────────────────
  ["沒有取樣時 value() 回 undefined（NaN 會一路流進 CSV）",
   "    if(!this.buf.length) return 0;", "    if(!this.buf.length) return undefined;"],
  ["reset() 沒清乾淨（上一題的握留在取樣器裡）",
   "    this.holding = false;   // 滯後狀態：≥ON 進、<OFF 出（分級變化**不會**影響它）\n    this.heldMs = 0;        // 這一段握了多久（含還在爬的前段）\n    this.buf = [];          // 已計入的取樣（settle 之後的每一幀）",
   "    this.holding = false;   // 滯後狀態：≥ON 進、<OFF 出（分級變化**不會**影響它）\n    this.heldMs = 0;        // 這一段握了多久（含還在爬的前段）\n    this.buf = this.buf || [];"],

  // ── ⑥ 門檻被抬回去（Pan 的抱怨最直覺、也最錯的修法）──────────────────────
  // 抬門檻會把 AE 修好的「有一顆球幾乎沒有效用」弄回來。這一組必須被抓到，
  // 否則以後任何人（包括我）都可能為了「不那麼敏感」順手把門檻往上調。
  ["把 AFTER_ON 抬高（＝把 AE 修的「弱球沒有效用」弄回來）",
   "const AFTER_ON = gripLevelForRaw(300)", "const AFTER_ON = gripLevelForRaw(600)"],
  ["把「有一點」的門檻抬高",
   "const AFTER_BAND_SOME = gripLevelForRaw(380)", "const AFTER_BAND_SOME = gripLevelForRaw(700)"],
  ["把「很明顯」抬到弱球構不到的地方",
   "const AFTER_BAND_CLEAR = gripLevelForRaw(700)", "const AFTER_BAND_CLEAR = gripLevelForRaw(1400)"],
  ["門檻改回裸水位（DESIGN.md §6 的硬規則；GRIP_FULL_SCALE 一動就又悄悄偏掉）",
   "const AFTER_BAND_SOME = gripLevelForRaw(380);", "const AFTER_BAND_SOME = 0.33;"],
  ["相符程度的分級跟問卷分岔（同一種手感、兩套門檻）",
   "const AGREE_BAND_SOME = gripLevelForRaw(380)", "const AGREE_BAND_SOME = gripLevelForRaw(500)"],

  // ── ⑦ 兩處問題共用同一份取樣器（Pan：「回答**各種**問題」）────────────────
  ["問卷不用取樣器、自己記峰值（改一半：只修了回顧那邊）",
   "  const ready = a.sampler.feed(held, dt * 1000);",
   "  a.peak = Math.max(a.peak, held);\n  const ready = (a.heldMs += dt * 1000) >= AFTER_SAMPLE_MS;"],
  ["回顧那邊不用取樣器（改一半：只修了問卷）",
   "    const ready = arrival.agreeSampler.feed(held, dtMs);",
   "    arrival.agreePeak = Math.max(arrival.agreePeak || 0, held);\n    const ready = (now - (arrival.agreeSampleAt || now)) > 1100;"],
  ["問卷換題不重設取樣器（上一題的握變成下一題的答案）",
   "  if(a.sampler) a.sampler.reset(); else a.sampler = new AnswerSampler();",
   "  if(!a.sampler) a.sampler = new AnswerSampler();"],
  ["回顧結束不重設取樣器",
   "  if(state.arrival.agreeSampler) state.arrival.agreeSampler.reset();",
   "  if(false) state.arrival.agreeSampler.reset();"],
  ["「握多久才算」又變成兩個常數（zh/en 當初就是在這裡分岔成 1100/900）",
   "const AFTER_SAMPLE_MS = 1100;",
   "const AFTER_SAMPLE_MS = 1100;\nconst AFTER_HOLD_MS = 900;"],
];

// en 頁只有 UI／log 字串是英文，取樣器與門檻的程式碼兩頁逐字相同，所以這一批不需要 zh→en 對照表。
// 例外：回顧那邊 en 沒有 zh 的 armAgreement()／trustedHeld()，但上面用到的兩行都在共同部分。

try {
  execFileSync("node", [TEST], { stdio: "pipe" });
  console.log("基準：乾淨的兩頁都通過測試 ✓\n");
} catch (e) {
  console.log("基準就失敗了，先修測試再跑變異：\n" + e.stdout.toString());
  process.exit(1);
}

let caught = 0, total = 0;
const escaped = [];
for (const [desc, from, to] of MUTANTS) {
  for (const [i, page] of PAGE_FILES.entries()) {
    total++;
    const tag = `(${i === 0 ? "zh" : "en"}) `;
    if (!ORIG[i].includes(from)) {
      escaped.push(`${tag}${desc}  ← 突變沒套用（對不到目標字串，兩頁可能不同步）`);
      console.log(`  ?  ${tag}${desc}  ← 找不到目標字串`);
      continue;
    }
    fs.writeFileSync(page, ORIG[i].replace(from, to));
    let died = false, detail = "";
    try {
      execFileSync("node", [TEST], { stdio: "pipe" });
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
