#!/usr/bin/env node
/**
 * 變異測試：證明 tmp/check_grip_trust.js 真的抓得到東西。
 *
 * 這一項特別需要變異測試，因為 `trustedHeld()` 壞掉的時候**畫面上看不出來**：
 * 水位顯示走的是 `Math.max(state.grip…)`（沒經過信任判定），所以水位照樣滿，
 * 只有「作答」那條路默默失效、`agreement` 被記成 0。純看畫面驗不出這一項。
 *
 * 只注入 zh 頁：en 頁本來就沒有這套機制（它用原始的 `Math.max(state.grip…)`），
 * check_grip_trust.js 的 [8] 負責釘住這個差異。
 *
 * 用法：node tmp/mutate_grip_trust.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
const SIM = path.join(__dirname, "check_grip_trust.js");
const PAGE = path.join(ROOT, "web", "index.html");
const ORIG = fs.readFileSync(PAGE, "utf8");
if (!/const gripStuckSince = /.test(ORIG)) throw new Error("web/index.html 還沒有 gripStuckSince");

const MUTANTS = [
  // ── 回到舊 bug 本身 ────────────────────────────────────────────────────────────
  ["回到舊寫法：記「上次放開的時刻」＋初值 0（＝Pan 的症狀）",
   `const gripStuckSince = { 1: null, 2: null };`,
   `const gripStuckSince = { 1: 0, 2: 0 };`],
  ["初值改成 0（沒有證據被當成「在時間 0 放開過」）",
   `function ballTrusted(slot, now = performance.now()){
  const since = gripStuckSince[slot];
  return since == null || now - since <= GRIP_TRUST_MS;   // null＝還沒有「卡住」的證據 ⇒ 給信任`,
   `function ballTrusted(slot, now = performance.now()){
  const since = gripStuckSince[slot] || 0;
  return now - since <= GRIP_TRUST_MS;`],
  ["把 null 判成不可信（等於預設不信任每顆新連上的球）",
   `  return since == null || now - since <= GRIP_TRUST_MS;   // null＝還沒有「卡住」的證據 ⇒ 給信任`,
   `  return since != null && now - since <= GRIP_TRUST_MS;`],
  // ── 計時的更新規則 ────────────────────────────────────────────────────────────
  ["每幀都重設卡住起點（＝永遠不會逾時，phantom 球防護失效）",
   `  else if(gripStuckSince[slot] == null) gripStuckSince[slot] = performance.now();`,
   `  else gripStuckSince[slot] = performance.now();`],
  ["放開時不清掉計時（一旦被判死就永久不可信）",
   `  if(level <= AFTER_OFF) gripStuckSince[slot] = null;
  else if(gripStuckSince[slot] == null) gripStuckSince[slot] = performance.now();`,
   `  if(gripStuckSince[slot] == null && level > AFTER_OFF) gripStuckSince[slot] = performance.now();`],
  ["整段信任更新拿掉（狀態永遠是 null＝永遠信任，phantom 球回來）",
   `  if(level <= AFTER_OFF) gripStuckSince[slot] = null;
  else if(gripStuckSince[slot] == null) gripStuckSince[slot] = performance.now();`,
   `  // (mutant) 不更新信任狀態`],
  ["判定反過來：放開才開始計時",
   `  if(level <= AFTER_OFF) gripStuckSince[slot] = null;`,
   `  if(level > AFTER_OFF) gripStuckSince[slot] = null;`],
  // ── 窗口長度 ─────────────────────────────────────────────────────────────────
  ["窗口縮到 1 秒（正常握一下就被判成不可信）",
   `const GRIP_TRUST_MS = 25000;`, `const GRIP_TRUST_MS = 1000;`],
  ["窗口拉到一小時（phantom 球實際上永遠不會被擋掉）",
   `const GRIP_TRUST_MS = 25000;`, `const GRIP_TRUST_MS = 3600000;`],
  // ── trustedHeld 本身 ─────────────────────────────────────────────────────────
  ["不管信任，直接取兩顆的最大值（phantom 球又能卡住問答）",
   `    if(ballTrusted(s, now)) h = Math.max(h, state.grip[s] || 0);`,
   `    h = Math.max(h, state.grip[s] || 0);`],
  ["永遠回 0（Pan 回報的症狀的極端版：回顧那段完全沒反應）",
   `function trustedHeld(){
  const now = performance.now();`,
   `function trustedHeld(){
  if(true) return 0;
  const now = performance.now();`],
  ["只看 ball1（另一手完全不能作答）",
   `  for(const s of [1, 2]){
    if(ballTrusted(s, now)) h = Math.max(h, state.grip[s] || 0);`,
   `  for(const s of [1]){
    if(ballTrusted(s, now)) h = Math.max(h, state.grip[s] || 0);`],
  // ── 換球要重設 ───────────────────────────────────────────────────────────────
  ["換球時不清掉卡住紀錄（新插上的球繼承上一顆的壞紀錄）",
   `  gripStuckSince[slot] = null;    // 重新插上的球要從「可信」開始，不繼承上一顆的卡住紀錄\n`,
   ``],
];

let caught = 0;
const escaped = [];

try {
  execFileSync("node", [SIM], { stdio: "pipe" });
  console.log("基準：乾淨的碼通過測試 ✓\n");
} catch (e) {
  console.log("基準就失敗了，先修測試再跑變異：\n" + e.stdout.toString());
  process.exit(1);
}

for (const [desc, from, to] of MUTANTS) {
  if (!ORIG.includes(from)) {
    escaped.push(`${desc}  ← 找不到要改的字串（變異腳本過期）`);
    console.log(`  ?  ${desc}  ← 找不到目標字串`);
    continue;
  }
  fs.writeFileSync(PAGE, ORIG.replace(from, to));
  let died = false, detail = "";
  try {
    execFileSync("node", [SIM], { stdio: "pipe" });
  } catch (e) {
    died = true;
    const out = e.stdout.toString();
    const m = out.match(/  ✗ .*/);
    detail = m ? m[0].trim().slice(0, 76) : (out.match(/Error: .*/) || [""])[0].slice(0, 76);
  } finally {
    fs.writeFileSync(PAGE, ORIG);
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
