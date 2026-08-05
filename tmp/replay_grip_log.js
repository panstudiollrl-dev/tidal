#!/usr/bin/env node
/**
 * 用 Pan 的**真實硬體 log** 重播 GripCalibrator（不是人造訊號）。
 *
 * 為什麼需要這支：tmp/sim_grip_rezero.js 用的是人造 raw 序列（REST=300、GRIP=+900、
 * 正弦雜訊）。那能驗邏輯，但**不能驗刻度**——`GRIP_FULL_SCALE` 一直被標成
 * 「唯一要調的數字，等實機」。這支拿真的 log 來量，把那個問號關掉。
 *
 * log 來源：EEG 根目錄的 `tidal_grip_log_live.ndjson`（Pan 2026-07-22 的 session，
 * 28 分鐘、兩顆 MB01、30Hz）。**那份 log 是 2026-08-04 改版之前錄的**，所以裡面的
 * baseline/level 欄位是舊校正算的，不能直接拿來當答案；這支只取
 * **`raw` 與 `tMs`**（硬體事實），其餘全部用現在的碼重算。
 *
 * ⚠️ log 不在 repo 裡（隱私：AGENTS.md 規定 session 紀錄只存本機、不上傳）。
 * 用 --log 指定路徑，預設找 /tmp/griplog.ndjson。找不到就直接說，不要假裝跑過。
 *
 * 用法：
 *   node tmp/replay_grip_log.js [--log <path>] [--slot 1|2]
 */
const fs = require("fs");
const path = require("path");

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
const LOG = arg("--log", "/tmp/griplog.ndjson");
const ONLY_SLOT = arg("--slot", null);

if (!fs.existsSync(LOG)) {
  console.error(`找不到 log：${LOG}`);
  console.error("這份 log 刻意不進 repo（session 紀錄只存本機）。用 --log 指定路徑。");
  process.exit(2);
}

const ROOT = path.join(__dirname, "..");
const src = fs.readFileSync(path.join(ROOT, "web", "index.html"), "utf8");

// 跟 sim/_dbg 一樣：抽**真正的**常數與 class，不重寫
const names = ["GRIP_FULL_SCALE", "GRIP_BASELINE_MS", "GRIP_HEADROOM", "GRIP_LEVEL_ATTACK",
  "GRIP_LEVEL_RELEASE", "GRIP_REST_MARGIN", "EDGE_ON_FRAC", "EDGE_ON_MIN_RAW", "EDGE_REARM_FRAC",
  "EDGE_FLOOR_RISE", "GRIP_GAMMA", "GRIP_DEADZONE", "GRIP_HIST_BIN", "GRIP_HIST_MIN_MS",
  "GRIP_REZERO_MS", "GRIP_REZERO_MIN_SHIFT", "GRIP_BEAT_REFRACTORY_MS"];
const K = {};
const consts = names.map(n => {
  const m = src.match(new RegExp(`const ${n} = ([\\d.]+)`));
  if (!m) throw new Error(`抽不到常數 ${n}——index.html 改過了，這支要跟著更新`);
  K[n] = Number(m[1]);
  return `const ${n} = ${m[1]};`;
}).join("\n");
const cls = src.match(/class GripCalibrator \{[\s\S]*?\n\}/)[0];
const mk = () => {
  const clock = { t: 0 };
  const { GripCalibrator } = new Function("clock",
    `const clamp=(v,lo=0,hi=1)=>Math.min(hi,Math.max(lo,v));const performance={now:()=>clock.t};${consts}\n${cls}\nreturn {GripCalibrator};`)(clock);
  return { clock, c: new GripCalibrator() };
};

// ── 讀 log：只取 raw 與 tMs（硬體事實），其餘欄位是舊校正算的，不採用 ──────────
const bySlot = {};
let bad = 0;
for (const line of fs.readFileSync(LOG, "utf8").split("\n")) {
  if (!line) continue;
  let o; try { o = JSON.parse(line); } catch (e) { bad++; continue; }
  if (o.event !== "report" || o.raw == null || o.slot == null) continue;
  (bySlot[o.slot] = bySlot[o.slot] || []).push({ t: o.tMs, raw: o.raw, phase: o.phase, step: o.step });
}
console.log(`log：${path.basename(LOG)}${bad ? `（${bad} 行解析失敗，略過）` : ""}`);
console.log(names.map(n => `${n}=${K[n]}`).join(" ") + "\n");

const q = (v, p) => v[Math.floor(p * (v.length - 1))];
const slots = Object.keys(bySlot).sort().filter(s => !ONLY_SLOT || s === ONLY_SLOT);
const devSeq = {};   // 保持**時間順序**的偏差序列（allDev 會被排序，不能用來看「持續多久」）

for (const slot of slots) {
  const rows = bySlot[slot];
  // 真實時間戳有斷線造成的巨大跳躍（實測 max 1370 秒）。斷線之後裝置狀態不連續，
  // 硬接下去會讓「佔用時間」與 restRef 拖著一段不存在的歷史，所以切成 session。
  const SEGMENT_GAP_MS = 5000;
  const segs = [[]];
  for (let i = 0; i < rows.length; i++) {
    if (i && rows[i].t - rows[i - 1].t > SEGMENT_GAP_MS) segs.push([]);
    segs[segs.length - 1].push(rows[i]);
  }

  console.log(`═══ slot ${slot}：${rows.length} 筆、切成 ${segs.length} 段（斷線 >${SEGMENT_GAP_MS}ms 切開）═══`);

  let allDev = [], allLv = [], beats = 0, rez = 0, pegged = 0, total = 0;
  const seqDev = [];
  for (const seg of segs) {
    if (seg.length < 30) continue;
    const { clock, c } = mk();
    let t0 = seg[0].t;
    for (const r of seg) {
      clock.t = r.t - t0 + 1;
      const lv = c.update(r.raw);
      if (c.baseline != null) {
        allDev.push(Math.abs(r.raw - c.baseline));
        seqDev.push(Math.abs(r.raw - c.baseline));
        allLv.push(lv);
        total++;
        if (lv >= 0.999) pegged++;
      }
      if (c.edge && c.edge.pulse) beats++;
    }
    rez += c.rezeroCount;
  }
  devSeq[slot] = seqDev;
  allDev.sort((a, b) => a - b);
  const lvS = allLv.slice().sort((a, b) => a - b);
  const f0 = v => v.toFixed(0);
  console.log(`  |raw − 零點|：中位 ${f0(q(allDev, .5))}  p90 ${f0(q(allDev, .9))}  p99 ${f0(q(allDev, .99))}  p99.9 ${f0(q(allDev, .999))}  max ${f0(allDev[allDev.length - 1])}`);
  console.log(`  水位：中位 ${q(lvS, .5).toFixed(3)}  p90 ${q(lvS, .9).toFixed(3)}  p99 ${q(lvS, .99).toFixed(3)}  max ${lvS[lvS.length - 1].toFixed(3)}`);
  console.log(`  觸頂(≥0.999) ${pegged} 筆 ＝ ${(pegged / total * 100).toFixed(2)}%｜重取零點 ${rez} 次｜算成拍 ${beats} 次`);

  // GRIP_FULL_SCALE 該多大？
  // ⚠️ 不要拿 p99.9 或 max 當滿刻度——那是「使用者最用力的一握」，把它定成滿刻度就等於
  // 「水位全滿幾乎碰不到」。滿刻度的意思是「**紮實地握**就該讀成全滿」，所以刻意讓
  // 最用力的那幾下**超出**刻度、被 clamp 掉。要看的是飽和比例：在握的幀裡多少已達滿刻度。
  const dz = K.GRIP_FULL_SCALE * K.GRIP_DEADZONE;
  const gripping = allDev.filter(d => d > dz);
  const sat = gripping.filter(d => d >= K.GRIP_FULL_SCALE).length;
  console.log(`  在握(>死區 ${dz.toFixed(0)})的 ${gripping.length} 幀裡，${sat} 幀（${(sat / gripping.length * 100).toFixed(1)}%）達到滿刻度 ${K.GRIP_FULL_SCALE}`);
  console.log(`  → 飽和 <10% ＝ 全滿碰得到、又沒有把大半動態範圍壓平：${sat / gripping.length < 0.10 ? "合理 ✓" : "偏低，考慮調大"}`);
  // 「持續」的偏差才是真的握（滑動窗最小值：單筆雜訊尖峰活不過窗）
  const held = (rowsDev, w) => {
    let best = 0;
    for (let i = 0; i + w <= rowsDev.length; i++) {
      let m = Infinity;
      for (let j = i; j < i + w; j++) m = Math.min(m, rowsDev[j]);
      best = Math.max(best, m);
    }
    return best;
  };
  const seq = devSeq[slot];
  console.log(`  持續 0.5s 以上的最大偏差 ${held(seq, 15).toFixed(0)}、持續 1.0s ${held(seq, 30).toFixed(0)}`
    + `（30Hz；用來確認上面的尖峰是真的握，不是單筆壞報告）`);
}

console.log(`
註：這份 log 錄於 2026-07-22，**早於** 2026-08-04 的改版，所以 log 裡的
baseline/level/sign 欄位是舊校正算的，本腳本一律不採用，只吃 raw 與 tMs。
兩顆球的靈敏度本來就不同（見上），所以 GRIP_FULL_SCALE 是個折衷值——
真要各球獨立就得改成 per-slot，那是另一個決策，留給 Pan。`);
