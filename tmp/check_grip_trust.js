#!/usr/bin/env node
/**
 * 對拍測試：`trustedHeld()` 的信任判定（Pan 2026-08-05 指示要修的那一項）。
 *
 * Pan 的原話（2026-08-04 那輪）：「**只有小小回顧的段落的握力跟水位關係是對的**」。
 * 那句話一直被當成「回顧那段沒事」，其實剛好相反——回顧那段是**唯一走 `trustedHeld()`** 的
 * 地方，而 `trustedHeld()` 當時會把水位**歸零**，所以它看起來「乖」是因為它整段沒反應。
 *
 * 舊碼：
 *     const gripTrust = { 1: 0, 2: 0 };                       // 初值 0
 *     if(now - (gripTrust[s] || 0) <= 25000) h = max(h, grip[s]);
 *     if(level <= AFTER_OFF) gripTrust[slot] = performance.now();
 *
 * `gripTrust[s] = 0` 的語意是「**在時間 0 放開過**」，而 `performance.now()` 從**開頁**起算。
 * 所以頁面開著超過 25 秒才連上球（正常操作：讀說明、按連線、戴耳機都要時間），
 * 第一個 report 進來時 `now - 0 > 25000` ⇒ 這顆球**從一開始就不可信** ⇒ `trustedHeld()` 回 0。
 * 「還沒有任何證據」被當成了「證據顯示它壞了」。
 *
 * 這個 bug 會**安靜地損壞資料**：兩顆都不可信 ⇒ held 恆為 0 ⇒ 作答窗逾時自動跳、
 * `agreement` 被記成 0，畫面上完全看不出異常（水位顯示走的是 `Math.max(state.grip…)`，
 * 沒有經過 `trustedHeld()`，所以水位還是滿的——正是 Pan 看到的不一致）。
 *
 * 新碼記的是「**卡在高位多久了**」（`null` ＝ 沒卡住 ⇒ 給信任），所以：
 *   ・沒有證據 → 信任（不再誤判剛連上的球）
 *   ・真的卡滿 25 秒 → 不信任（保住 2026-07-22 那次修的 phantom 球防護）
 *   ・一回到低位 → 立刻恢復
 *
 * 這裡把兩頁**真正的**函式抽出來、用假時鐘跑。en 頁沒有這套機制（它用原始的
 * `Math.max(state.grip…)`），所以 en 只驗「沒有殘留的舊寫法」。
 *
 * 用法：node tmp/check_grip_trust.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const ZH = path.join(ROOT, "web", "index.html");
const EN = path.join(ROOT, "web", "en", "index.html");
const zhSrc = fs.readFileSync(ZH, "utf8");
const enSrc = fs.readFileSync(EN, "utf8");

let passed = 0;
const failures = [];
let tag = "";
const ok = (cond, label, detail) => {
  if (cond) { passed++; return; }
  failures.push(tag + label + (detail ? `  ← ${detail}` : ""));
};

// ── 抽真正的碼出來跑（不重寫一份，否則測的不是上線的邏輯）────────────────────
// ⚠️ 抽取要能容納**壞掉的**寫法，否則 revert / 變異只會讓這支測試「拋例外」而不是
// 「斷言失敗」——那樣就分不出「碼壞了」與「測試自己壞了」。所以這裡的 regex 盡量寬：
// 先抓任何形狀的信任狀態宣告與兩個函式，抓不到才報錯。
function build(src) {
  const grab = (re, what, optional = false) => {
    const m = src.match(re);
    if (!m) {
      if (optional) return "";
      throw new Error("抽不到 " + what);
    }
    return m[0];
  };
  const afterOff = Number((src.match(/const AFTER_ON = [\d.]+, AFTER_OFF = ([\d.]+);/) || [])[1]);
  if (Number.isNaN(afterOff)) throw new Error("抽不到 AFTER_OFF");

  const body = [
    // 新寫法是 gripStuckSince，舊寫法是 gripTrust —— 兩者都收
    grab(/const grip(?:StuckSince|Trust) = \{[^}]*\};/, "信任狀態的宣告"),
    grab(/const GRIP_TRUST_MS = \d+;/, "GRIP_TRUST_MS", true),
    grab(/function ballTrusted\(slot, now = performance\.now\(\)\)\{[\s\S]*?\n\}/, "ballTrusted", true),
    grab(/function trustedHeld\(\)\{[\s\S]*?\n\}/, "trustedHeld"),
  ].filter(Boolean).join("\n");

  // setGrip 太大（會牽動 engine/DOM），只抽它對信任狀態動手的那一段，原文照搬。
  // 新舊兩種形狀都收（舊的是單行 `gripTrust[slot] = performance.now()`）。
  const trustLines = grab(
    /  if\(level <= AFTER_OFF\) gripStuckSince\[slot\] = null;\n  else if\(gripStuckSince\[slot\] == null\) gripStuckSince\[slot\] = performance\.now\(\);|  if\(level <= AFTER_OFF\) gripTrust\[slot\] = performance\.now\(\);/,
    "setGrip 裡的信任更新"
  );

  // trustedHeld 讀的是 `state.grip`，要讓抽出來的閉包看得到同一個物件。
  // `gripStuckSince` / `GRIP_TRUST_MS` 在舊寫法裡可能不存在 ⇒ 用 typeof 探，不要直接引用。
  const clock = { t: 0 };
  const wrapped = new Function("performance", "AFTER_OFF", "clamp", "state", `
    ${body}
    function setGripTrust(slot, level){
      ${trustLines}
    }
    return {
      trustedHeld, setGripTrust,
      stuck: typeof gripStuckSince !== "undefined" ? gripStuckSince : null,
      trustMs: typeof GRIP_TRUST_MS !== "undefined" ? GRIP_TRUST_MS : 25000,
    };
  `);
  const state = { grip: { 1: 0, 2: 0 } };
  const a = wrapped({ now: () => clock.t }, afterOff, (v) => Math.max(0, Math.min(1, v)), state);
  return {
    trustedHeld: a.trustedHeld, setGripTrust: a.setGripTrust,
    gripStuckSince: a.stuck || { 1: null, 2: null },
    GRIP_TRUST_MS: a.trustMs,
    state, clock, afterOff,
  };
}

// 一顆球送一次 report（同時更新水位與信任狀態，順序與 setGrip 一致）
function report(api, slot, level) {
  api.state.grip[slot] = level;
  api.setGripTrust(slot, level);
}

console.log("=== trustedHeld 信任判定 對拍測試 ===\n");

tag = "(zh) ";
const api = build(zhSrc);
const OFF = api.afterOff;

console.log("[1] Pan 的症狀：開頁很久之後才連上球，第一個 report 不能就被判成不可信");
{
  // 這就是重現 bug 的那一步。舊碼在這裡回 0（`now - 0 > 25000`），新碼回真實水位。
  api.clock.t = 90000;                        // 開頁 90 秒後才連上（讀說明＋按連線＋戴耳機）
  report(api, 1, 0.62);                       // 使用者握著 0.62
  const held = api.trustedHeld();
  ok(held > 0.5,
     "開頁 90 秒後才連上的球，第一個 report 就要被信任（舊碼在這裡回 0）",
     `trustedHeld() = ${held.toFixed(2)}`);
  ok(Math.abs(held - 0.62) < 1e-9, "而且要回真實水位，不是被打折的值", held.toFixed(3));
  console.log(`      開頁 90s 才連上、握 0.62 → trustedHeld() = ${held.toFixed(2)}`);
}

console.log("[2] 兩顆球都還沒放開過時，回顧那段不能整段沒反應（Pan：只有那段「對」）");
{
  const a = build(zhSrc);
  a.clock.t = 120000;
  report(a, 1, 0.55);
  report(a, 2, 0.48);
  ok(a.trustedHeld() > 0.5, "兩顆都握著（都還沒放開過）時要讀得到水位", a.trustedHeld().toFixed(2));
  // 這一條是資料正確性：held 恆 0 會讓 agreement / pre_tension 被記成 0
  ok(a.trustedHeld() >= 0.55 - 1e-9, "要取兩顆的較大值（顯示與作答一致）", a.trustedHeld().toFixed(2));
}

console.log("[3] 但 2026-07-22 修的 phantom 球防護要保住：真的卡在高位就不能算");
{
  const a = build(zhSrc);
  a.clock.t = 1000;
  report(a, 1, 0.80);                          // 壞球卡在高位，一直不回落
  ok(a.trustedHeld() > 0.5, "剛卡住的時候還在寬限內（不能一下就不信任）", a.trustedHeld().toFixed(2));
  a.clock.t += a.GRIP_TRUST_MS - 1000;         // 差一點滿 25 秒
  report(a, 1, 0.80);
  ok(a.trustedHeld() > 0.5, "還沒滿 25 秒仍然信任", a.trustedHeld().toFixed(2));
  a.clock.t += 2000;                           // 超過 25 秒
  report(a, 1, 0.80);
  ok(a.trustedHeld() === 0,
     "卡在高位超過 25 秒＝這顆球做不到「放開→握」，不能代表使用者作答",
     a.trustedHeld().toFixed(2));
  console.log(`      卡住 ${((a.GRIP_TRUST_MS + 2000) / 1000).toFixed(0)}s 後 trustedHeld() = ${a.trustedHeld().toFixed(2)}（要為 0）`);
}

console.log("[4] 一回到低位要立刻恢復信任（不能被永久判死）");
{
  const a = build(zhSrc);
  a.clock.t = 1000;
  report(a, 1, 0.80);
  a.clock.t += a.GRIP_TRUST_MS + 5000;
  report(a, 1, 0.80);
  ok(a.trustedHeld() === 0, "先確認它真的被判成不可信");
  report(a, 1, OFF);                            // 放開了 ⇒ 證明它做得到
  ok(a.gripStuckSince[1] === null, "回到 AFTER_OFF 以下要清掉「卡住」的計時");
  a.clock.t += 100;
  report(a, 1, 0.70);                           // 再握
  ok(a.trustedHeld() > 0.5, "放開過之後再握，要立刻恢復信任", a.trustedHeld().toFixed(2));
  console.log(`      卡住→放開→再握：trustedHeld() = ${a.trustedHeld().toFixed(2)}（要恢復）`);
}

console.log("[5] 一顆壞球不能拖累另一顆好球（原本 2026-07-22 的目的）");
{
  const a = build(zhSrc);
  a.clock.t = 1000;
  report(a, 1, 0.85);                           // ball1 卡住
  a.clock.t += a.GRIP_TRUST_MS + 3000;
  report(a, 1, 0.85);
  report(a, 2, OFF);                            // ball2 正常放開
  // 注意：ball2 放開時的水位就是 AFTER_OFF 本身（0.07），它**應該**照實回報——
  // 「放開」不等於「0」。所以這裡要求的是「不超過放開的水位」，不是恆等於 0。
  ok(a.trustedHeld() <= OFF + 1e-9,
     "此刻不該有人貢獻高水位（ball1 不可信、ball2 只是放開的殘量）", a.trustedHeld().toFixed(2));
  a.clock.t += 200;
  report(a, 2, 0.60);                           // ball2 好好地握一下
  ok(Math.abs(a.trustedHeld() - 0.60) < 1e-9,
     "好球的水位要讀得到，不能被壞球的高位蓋掉，也不能被它拖成 0",
     a.trustedHeld().toFixed(2));
  ok(a.trustedHeld() < 0.85, "而且不能讀到壞球那顆卡住的 0.85", a.trustedHeld().toFixed(2));
  console.log(`      ball1 卡 0.85（不可信）＋ ball2 握 0.60 → ${a.trustedHeld().toFixed(2)}`);
}

console.log("[6] 計時只記「第一次跨過」的時刻，不能每幀重設（否則永遠扣不到信任）");
{
  const a = build(zhSrc);
  a.clock.t = 1000;
  report(a, 1, 0.50);
  const first = a.gripStuckSince[1];
  // 要跑過 25 秒才驗得到「會逾時」——迴圈總時長必須大於 GRIP_TRUST_MS（原本只推進 20s，
  // 還在窗內，所以那條斷言看起來失敗其實是我把時間算短了）。
  const steps = Math.ceil((a.GRIP_TRUST_MS + 3000) / 500);
  for (let i = 0; i < steps; i++) { a.clock.t += 500; report(a, 1, 0.50 + i * 0.001); }
  ok(a.gripStuckSince[1] === first,
     "持續握著時「卡住起點」不能被往後推（每幀重設＝永遠不會逾時）",
     `${first} → ${a.gripStuckSince[1]}`);
  ok(a.trustedHeld() === 0, "所以連續握滿 25 秒之後確實會失去信任");
}

console.log("[6b] 窗口長度本身要合理（用絕對秒數驗，不能只跟著常數跑）");
{
  // ⚠️ 上面每一項都拿 `a.GRIP_TRUST_MS` 當時間刻度，所以常數被改動時它們會**一起跟著跑**、
  // 什麼都抓不到（變異測試就是這樣抓到我的：25000→1000 與 25000→3600000 兩個都逃掉了）。
  // 這裡改用**絕對時間**：對照現場的兩個尺度——正常作答節奏 <5 秒、而壞球要在使用者
  // 察覺之前被擋掉。
  const a = build(zhSrc);
  // ① 一個正常長度的握（5 秒，含猶豫）不能被判成不可信
  a.clock.t = 1000;
  report(a, 1, 0.55);
  a.clock.t += 5000;
  report(a, 1, 0.60);
  ok(a.trustedHeld() > 0.5,
     "握 5 秒（正常作答＋猶豫的長度）不能被判成不可信", a.trustedHeld().toFixed(2));
  // ② 但卡住一分鐘一定要被擋掉（否則 phantom 球會卡住整個問答）
  const b = build(zhSrc);
  b.clock.t = 1000;
  report(b, 1, 0.80);
  b.clock.t += 60000;
  report(b, 1, 0.80);
  ok(b.trustedHeld() === 0,
     "卡在高位整整 60 秒一定要被擋掉（phantom 球不能卡住問答）", b.trustedHeld().toFixed(2));
  ok(a.GRIP_TRUST_MS >= 8000 && a.GRIP_TRUST_MS <= 40000,
     "窗口要落在 8–40 秒（短於作答節奏＝誤傷；長於此＝擋不住壞球）",
     `${a.GRIP_TRUST_MS}ms`);
  console.log(`      窗口 ${(a.GRIP_TRUST_MS / 1000).toFixed(0)}s：握 5s 仍可信、卡 60s 被擋掉`);
}

console.log("[7] 結構：不能回到「記上次放開的時刻＋初值 0」的舊寫法");
{
  ok(!/const gripTrust = \{\s*1:\s*0,\s*2:\s*0\s*\}/.test(zhSrc),
     "不能留著 `gripTrust = {1:0, 2:0}`（初值 0＝把「沒證據」當成「在時間 0 放開過」）");
  ok(!/now - \(gripTrust\[s\] \|\| 0\) <= /.test(zhSrc), "不能留著舊的 `now - gripTrust[s]` 判定");
  ok(/gripStuckSince\[slot\] = null;/.test(zhSrc), "放開時要把卡住計時清成 null");
  ok(/else if\(gripStuckSince\[slot\] == null\) gripStuckSince\[slot\] = performance\.now\(\);/.test(zhSrc),
     "只有在還沒計時的時候才記起點（== null 這個守衛不能拿掉）");
  ok(/since == null \|\| now - since <= GRIP_TRUST_MS/.test(zhSrc),
     "沒有證據（null）要判成可信");
  // 換球要重設，否則新球會繼承上一顆的卡住紀錄
  const forget = (zhSrc.match(/function forgetBallSlot\(slot[\s\S]*?\n\}/) || [""])[0];
  ok(/gripStuckSince\[slot\] = null;/.test(forget),
     "forgetBallSlot 要清掉卡住紀錄（重新插上的球要從可信開始）");
}

console.log("[8] en 頁：它沒有這套機制（用原始 Math.max），只要確認沒有殘留的舊寫法");
{
  tag = "(en) ";
  ok(!/gripTrust/.test(enSrc), "en 不該出現 gripTrust（它本來就沒有這條路）");
  ok(!/trustedHeld/.test(enSrc), "en 不該出現 trustedHeld");
  // en 的回顧段用的是原始水位 ⇒ 不會被歸零，本來就沒有這個 bug
  ok(/const held = Math\.max\(state\.grip\[1\], state\.grip\[2\]\);/.test(enSrc),
     "en 的回顧段直接讀兩顆的較大值（所以它沒有這個症狀）");
}
tag = "";

console.log("\n" + "=".repeat(60));
if (failures.length) {
  console.log(`${passed} 項通過，${failures.length} 項失敗：\n`);
  failures.forEach(f => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`全部通過：${passed} 項斷言。`);
