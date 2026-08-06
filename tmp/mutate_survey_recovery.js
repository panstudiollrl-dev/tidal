#!/usr/bin/env node
/**
 * 變異測試：證明 tmp/test_survey_recovery.js 真的抓得到東西。
 *
 * 這一批特別重要，因為 Pan 2026-08-06 的症狀（「整個問卷都不能繼續做而卡住」）在**畫面上
 * 看不出原因**：使用者只看到一顆不動的球。而且「修到一半」的每一種形狀都能通過
 * 「問卷跑得完 4/4」這種粗略的檢查——差別只在**分數被記成什麼**。
 * 所以下面有一整組「不卡住了，但答案被吃掉」的變異（AF-3/AF-4 那兩個我自己先寫錯的形狀）。
 *
 * 用法：node tmp/mutate_survey_recovery.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const TEST = path.join(__dirname, "test_survey_recovery.js");
const PAGE_FILES = [path.join(ROOT, "web", "index.html"), path.join(ROOT, "web", "en", "index.html")];
const ORIG = PAGE_FILES.map(f => fs.readFileSync(f, "utf8"));

const MUTANTS = [
  // ── ① 看門狗撤銷授權（Pan 回報的「連線就消失了」的根因）──────────────────
  ["看門狗又無條件撤銷授權（＝Pan 回報的連線消失，之後不可能自動接回）",
   'if(state.phase === "before" && state.arrival.step === "connect"){\n          try{ ghost && ghost.forget && ghost.forget(); }catch(_){ /* 舊瀏覽器沒有 forget */ }\n        } else {',
   'if(true){\n          try{ ghost && ghost.forget && ghost.forget(); }catch(_){ /* 舊瀏覽器沒有 forget */ }\n        } else {'],
  ["條件放寬成「只要不在 after」（478 途中仍然會被撤銷）",
   'if(state.phase === "before" && state.arrival.step === "connect"){',
   'if(state.phase !== "after"){'],
  ["條件只看 phase、不看是不是還在連線畫面",
   'if(state.phase === "before" && state.arrival.step === "connect"){',
   'if(state.phase === "before"){'],
  ["保留授權那條路變得靜悄悄（log 拿掉＝查不出發生過什麼）",
   "        } else {\n          log(`Ball ${slot} 沒有回應——保留授權，會持續嘗試自動接回。`);\n        }",
   "        } else {\n        }"],
  ["撤銷之後不重新掃描（清掉 slot 就沒人遞補）",
   "        syncBalls().catch(() => {});\n      }\n    }\n  });\n  updateHidStatus();",
   "      }\n    }\n  });\n  updateHidStatus();"],

  // ── ② 開窗閘門沒有逾時保險（Pan 的「卡住」本身）────────────────────────
  ["開窗閘門的逾時保險被拿掉（＝回到 Pan 回報的卡住）",
   "    } else if(now - a.armWaitFrom >= AFTER_ARM_GRACE_MS){",
   "    } else if(false){"],
  ["保險常數宣告了但閘門裡沒用到（看起來有、其實沒有）",
   "now - a.armWaitFrom >= AFTER_ARM_GRACE_MS",
   "now - a.armWaitFrom >= Infinity"],
  ["保險等太久（使用者早就以為壞了）",
   "const AFTER_ARM_GRACE_MS = 4000;", "const AFTER_ARM_GRACE_MS = 30000;"],
  ["保險太短（正常的「放開」會被誤判成卡住）",
   "const AFTER_ARM_GRACE_MS = 4000;", "const AFTER_ARM_GRACE_MS = 200;"],
  ["armWaitFrom 每幀重設（永遠等不到逾時）",
   "    if(a.armWaitFrom == null) a.armWaitFrom = now;", "    a.armWaitFrom = now;"],

  // ── ③ 「不卡住了，但答案被吃掉」——AF 修法最容易做壞的地方 ─────────────
  ["地板取開窗**那一刻的瞬時值**（我第一版的錯：使用者正在握就把答案記成殘壓 ⇒ 永遠 0 分）",
   "      a.afterFloor = clamp(a.afterRest);   // 記住殘壓地板：要比它再高一截才算新的握",
   "      a.afterFloor = clamp(raw);   // 記住殘壓地板：要比它再高一截才算新的握"],
  ["地板不取最低值、改成取最高值（更嚴重的同一種錯）",
   "    a.afterRest = Math.min(a.afterRest == null ? raw : a.afterRest, raw);",
   "    a.afterRest = Math.max(a.afterRest == null ? raw : a.afterRest, raw);"],
  ["地板不會往下修（殘壓退掉之後這一題門檻還是偏高）",
   "  if(a.afterFloor > 0 && raw < a.afterFloor) a.afterFloor = raw;",
   "  // (mutant) 地板不往下修"],
  ["地板往**上**修（握越久門檻越高＝握不到答案）",
   "  if(a.afterFloor > 0 && raw < a.afterFloor) a.afterFloor = raw;",
   "  if(a.afterFloor > 0 && raw > a.afterFloor) a.afterFloor = raw;"],
  ["回應窗又從 questionAt 算（開窗保險把 5200ms 吃掉 4000ms ⇒ 反應慢的人記成 0）",
   "  } else if(held < AFTER_ON && now - windowFrom >= AFTER_RESPONSE_MS){",
   "  } else if(held < AFTER_ON && now - a.questionAt >= AFTER_RESPONSE_MS){"],
  ["讀題期又從 questionAt 算（提示還沒出現就開始倒數）",
   "  const windowFrom = Math.max(a.questionAt, a.armedAt || 0);\n  if(now - windowFrom < AFTER_READ_MS){",
   "  const windowFrom = Math.max(a.questionAt, a.armedAt || 0);\n  if(now - a.questionAt < AFTER_READ_MS){"],
  ["armedAt 沒記（windowFrom 退化成 questionAt）",
   "    if(a.armed) a.armedAt = now;   // 回應窗從「真的可以回答了」算起，不是從上一題結束算起",
   "    // (mutant) 不記 armedAt"],
  ["windowFrom 只看 armedAt（正常球第一題 armedAt=0 ⇒ 窗口從開頁算）",
   "  const windowFrom = Math.max(a.questionAt, a.armedAt || 0);",
   "  const windowFrom = a.armedAt || 0;"],
  ["換題不重設地板（上一題的殘壓地板被下一題繼承）",
   "  a.armWaitFrom = null; a.afterFloor = 0; a.afterRest = null; a.armedAt = 0;   // 每一題重新等「先放開」，逾時保險也重新起算",
   "  a.armWaitFrom = null;   // 每一題重新等「先放開」，逾時保險也重新起算"],
  // 2026-08-06 的取樣器也屬於「每一題重新起算」（Pan：太敏感那一輪改版）
  ["換題不重設取樣器（上一題還沒放開的那段握變成下一題的答案）",
   "  if(a.sampler) a.sampler.reset(); else a.sampler = new AnswerSampler();       // 取樣也要重新起算（不繼承上一題的握）\n",
   ""],
  ["beginAfter 不建取樣器（靠 afterSurveyStep 的防禦路徑補＝正常路徑沒被走到）",
   "    sampler: new AnswerSampler(),   // 一段握壓 → 一個答案（Pan 2026-08-06：太敏感）\n",
   ""],
  ["beginAfter 沒初始化 afterRest（Math.min(undefined) ⇒ NaN 地板）",
   "    armWaitFrom: null, afterFloor: 0, afterRest: null, armedAt: 0,   // 開窗逾時保險（Pan 2026-08-06：問卷卡住）",
   "    armWaitFrom: null, afterFloor: 0,   // 開窗逾時保險（Pan 2026-08-06：問卷卡住）"],

  // ── ④ 用「編一個分數」換到不卡住（資料完整性）──────────────────────────
  ["地板整個不扣（殘壓本身被讀成答案＝憑空編分數）",
   "  const held = floor > 0 ? clamp((raw - floor) / Math.max(0.2, 1 - floor)) : raw;",
   "  const held = raw;"],
  ["逾時開窗時順手把答案定案（自動填一個分數）",
   "      log(\"握力球沒有回到放開狀態——先開始作答，會以現在的水位當基準。\");",
   "      afterFixAnswer(a, clamp(raw));"],

  // ── ⑤ 鍵盤退路（球靜掉的那段時間）─────────────────────────────────────
  ["slotLive 退化成只看 connected（球靜掉之後 6.5s 內鍵盤完全無效）",
   "  if(!state.ready[slot]) return false;                     // 看門狗判定 stale 之後就不算活著\n  const at = state.lastGripReportAt[slot];\n  return !!at && performance.now() - at <= HID_STALE_MS;   // 還在 30Hz 串流中才算活著",
   "  return true;"],
  ["slotLive 不看 report 時間（只看 connected + ready）",
   "  const at = state.lastGripReportAt[slot];\n  return !!at && performance.now() - at <= HID_STALE_MS;   // 還在 30Hz 串流中才算活著",
   "  return true;"],
  ["slotLive 的窗口大到沒有意義",
   "  return !!at && performance.now() - at <= HID_STALE_MS;   // 還在 30Hz 串流中才算活著",
   "  return !!at && performance.now() - at <= 600000;"],
  ["空白鍵的後援又只看 connected",
   "  if(!slotLive(1)) setGrip(1, sim.space ? 0.68 : 0);",
   "  if(!state.connected[1]) setGrip(1, sim.space ? 0.68 : 0);"],
  ["Shift 的後援又只看 connected",
   "  if(!slotLive(2)) setGrip(2, sim.shift ? 0.68 : 0);",
   "  if(!state.connected[2]) setGrip(2, sim.shift ? 0.68 : 0);"],
  ["兩顆都不活時畫面不寫出退路（使用者對著不動的畫面猜）",
   "    if(!slotLive(1) && !slotLive(2))",
   "    if(false)"],
];

// en 頁的 **UI / log 字串**是英文的，引擎碼與註解則兩頁相同（見 AGENTS.md 的同步規則）。
// 所以只有涉及字串的變異需要換一份 zh→en 的目標，其餘的 from 兩頁通用。
const EN_TARGET = new Map([
  ["          log(`Ball ${slot} 沒有回應——保留授權，會持續嘗試自動接回。`);",
   "          log(`Ball ${slot} is not responding — keeping permission, will keep trying to reconnect.`);"],
  ['      log("握力球沒有回到放開狀態——先開始作答，會以現在的水位當基準。");',
   '      log("The grip ball has not returned to a released state — starting anyway, using the current level as the baseline.");'],
]);
// 把一段 zh 目標字串翻成該頁實際的形狀（逐條套用上面的對照表）
const forPage = (s, pageIdx) => {
  if (pageIdx === 0) return s;
  let out = s;
  for (const [zh, en] of EN_TARGET) out = out.split(zh).join(en);
  return out;
};

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
    const f = forPage(from, i), t = forPage(to, i);
    if (!ORIG[i].includes(f)) {
      escaped.push(`${tag}${desc}  ← 突變沒套用（對不到目標字串，兩頁可能不同步）`);
      console.log(`  ?  ${tag}${desc}  ← 找不到目標字串`);
      continue;
    }
    fs.writeFileSync(page, ORIG[i].replace(f, t));
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
