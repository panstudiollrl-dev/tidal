#!/usr/bin/env node
/**
 * 對拍測試：握力作答的取樣（AnswerSampler）。
 *
 * Pan 2026-08-06：「我覺得很不錯 只是用握力回答各種問題 目前球都太敏感 輕輕碰就全滿
 *                   也很容易滑動去其他區域 但整個體驗是好的」
 *
 * ⚠️ 這個抱怨最直覺的讀法是「把門檻抬高」，而那是**錯的**：三個門檻（AFTER_ON / BAND_SOME /
 * BAND_CLEAR）在同一天的 AE 才剛從「span 900 時代的裸水位」還原成 300/380/700raw，為的是修
 * Pan 的另一個抱怨「有一顆球幾乎沒有效用」。抬回去就是把 AE revert 掉——兩個抱怨都是真的，
 * 因為它們的成因不同。用真的 GripCalibrator 重播 Pan 2026-07-22 的紀錄，量到成因是兩件事：
 *   ① **峰值定案**：舊碼用 `a.peak`（一段握壓的最高點）定案。真球的 dev p99 是 811(ball1)／
 *      2372(ball2)、max 1643／3103——一次「輕輕碰」裡本來就有幾幀尖峰，而峰值定案讓**任何
 *      一幀**都足以決定整題 ⇒ 實測 ball2 有 30% 的刻意握被記成 10/10（貼頂）。
 *   ② **換級歸零**：舊碼 `if(a.band !== band){ a.heldMs = 0 }`。水位在分級邊界上下游移是常態
 *      （實測一次握之中換級**中位 2 次、最多 18 次**），每換一次計時就重來 ⇒ 使用者感覺
 *      「滑動去其他區域」而且答不出來（實測 ball2 43 次刻意握有 33 次湊不滿 1100ms）。
 *
 * 所以修的是「怎麼從一段握壓算出一個數」，門檻一個都沒動。這支測試就是在釘住那件事：
 *   [1] 滯後計時：≥ON 進、只有 <OFF 才中斷；**分級變化不影響計時**（②）
 *   [2] 中位數定案：少數幀的尖峰影響不到結果（①）
 *   [3] settle：手還在往目標爬的前 300ms 不計入取樣
 *   [4] 分級與改版前一致（穩定力道的答案不能變）＝ AE 的可達性一分不減
 *   [5] 沒握就不能有分數（資料完整性；不可以憑空編）
 *   [6] 門檻真的沒被動到（AE 不可以被 revert）
 *   [7] 兩處問題共用同一份取樣器與同一個 AFTER_SAMPLE_MS（zh/en 兩頁都要）
 *
 * 沿用本專案的做法：regex 從 index.html 抽**真正的** class 出來跑，不在這裡重寫一份。
 *
 * 用法：node tmp/test_answer_sampler.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const PAGES = [
  { label: "zh", file: path.join(ROOT, "web", "index.html") },
  { label: "en", file: path.join(ROOT, "web", "en", "index.html") },
];
for (const p of PAGES) p.src = fs.readFileSync(p.file, "utf8");

let passed = 0;
const failures = [];
let tag = "";
const ok = (cond, label, detail) => {
  if (cond) { passed++; return; }
  failures.push(tag + label + (detail ? `  ← ${detail}` : ""));
};

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const DT = 1000 / 30;          // 真硬體是 30Hz

// ── 從頁面抽真的常數、gripLevelForRaw 的曲線、與 AnswerSampler ────────────────
function build(src) {
  const K = {};
  for (const m of src.matchAll(/const ([A-Z][A-Z0-9_]+) = ([\d.]+);/g)) K[m[1]] = Number(m[2]);
  const FS = K.GRIP_FULL_SCALE * K.GRIP_HEADROOM;
  const g = (raw) => {
    let l = clamp(Math.abs(raw) / FS);
    l = Math.max(0, (l - K.GRIP_DEADZONE) / (1 - K.GRIP_DEADZONE));
    return Math.pow(l, K.GRIP_GAMMA);
  };
  // 門檻要容忍「壞形狀」（裸數字）也抽得到，否則有人把它改回裸水位時這支測試會拋例外
  // 而不是斷言失敗——例外看起來像「測試壞了」，失敗才看得出是「頁面壞了」。
  const lvl = (name) => {
    const m = src.match(new RegExp(`const ${name} = gripLevelForRaw\\((\\d+)\\)`));
    if (m) return { level: g(Number(m[1])), raw: Number(m[1]), byRaw: true };
    const bare = src.match(new RegExp(`const ${name} = ([\\d.]+);`));
    if (bare) return { level: Number(bare[1]), raw: null, byRaw: false };
    throw new Error(`抽不到 ${name}`);
  };
  const T = {};
  for (const n of ["AFTER_ON", "AFTER_OFF", "AFTER_BAND_SOME", "AFTER_BAND_CLEAR",
                   "AGREE_BAND_SOME", "AGREE_BAND_CLOSE"]) T[n] = lvl(n);
  const cls = src.match(/class AnswerSampler\{[\s\S]*?\n\}/);
  if (!cls) throw new Error("抽不到 AnswerSampler");
  const { AnswerSampler } = new Function("AFTER_ON", "AFTER_OFF", "AFTER_SETTLE_MS", "AFTER_SAMPLE_MS",
    `${cls[0]}\nreturn {AnswerSampler};`)(T.AFTER_ON.level, T.AFTER_OFF.level,
                                          K.AFTER_SETTLE_MS, K.AFTER_SAMPLE_MS);
  return { K, g, T, AnswerSampler, clsSrc: cls[0] };
}

// 把一串水位餵進取樣器，回傳定案值（沒定案 ⇒ null）
function run(AnswerSampler, levels, dt = DT) {
  const s = new AnswerSampler();
  for (const v of levels) if (s.feed(v, dt)) return s.value();
  return null;
}
const rep = (v, ms, dt = DT) => Array(Math.round(ms / dt)).fill(v);

console.log("=== 握力作答的取樣（AnswerSampler）對拍測試 ===\n");

PAGES.forEach((page, pi) => {
  tag = `(${page.label}) `;
  const src = page.src;
  const { K, g, T, AnswerSampler, clsSrc } = build(src);
  const ON = T.AFTER_ON.level, OFF = T.AFTER_OFF.level;
  const SOME = T.AFTER_BAND_SOME.level, CLEAR = T.AFTER_BAND_CLEAR.level;
  const bandOf = (v) => v == null ? "答不出來" : v >= CLEAR ? "很明顯" : v >= SOME ? "有一點" : "沒有";

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[1] 滯後計時：分級變化不可以打斷作答（Pan：「很容易滑動去其他區域」）");
  {
    // 這是舊碼 `if(a.band !== band){ a.heldMs = 0 }` 的直接反例：在 SOME 邊界上下游移。
    // 實測真球一次握之中換級中位 2 次、最多 18 次，所以這不是刁難的輸入，是常態。
    const near = g(380);                       // 剛好在「有一點」的門檻上
    const wobble = [];
    for (let i = 0; i < Math.round(4000 / DT); i++) wobble.push(near + (i % 4 < 2 ? 0.02 : -0.02));
    const v = run(AnswerSampler, wobble);
    ok(v !== null, "在分級邊界上下游移的握**必須**答得出來（不能因為換級就重新計時）",
       "答不出來 ⇒ 換級歸零的老毛病回來了");
    // 而且要真的跨過邊界很多次（否則這個情境沒有測到東西）
    let flips = 0;
    for (let i = 1; i < wobble.length; i++) {
      const a = wobble[i - 1] >= SOME, b = wobble[i] >= SOME;
      if (a !== b) flips++;
    }
    ok(flips >= 10, "（前提）這個情境真的反覆跨過分級邊界", `${flips} 次`);

    // 只有掉到 OFF 以下才算放開：ON/OFF 之間的抖動不能中斷
    const dip = [...rep(g(900), 600), ...rep((ON + OFF) / 2, 200), ...rep(g(900), 1500)];
    ok(run(AnswerSampler, dip) !== null,
       "水位掉到 ON/OFF 之間（還沒放開）不可以中斷計時");
    // 真的放開就要中斷，而且下一段要重新起算（不能兩段相加）
    const s = new AnswerSampler();
    for (const v2 of rep(g(900), 700)) s.feed(v2, DT);
    const heldBefore = s.heldMs;
    for (const v2 of rep(g(240), 400)) s.feed(v2, DT);      // 240raw < OFF ⇒ 真的放開
    ok(heldBefore > 0 && s.heldMs === 0, "真的放開（<OFF）要把計時歸零", `heldMs=${s.heldMs}`);
    ok(s.buf.length === 0, "放開也要把已累積的取樣清掉（不然會跟下一段混在一起）");
    // 兩段各 700ms（相加 1400ms > 1100ms）中間放開 ⇒ 不可以定案
    const twoShort = [...rep(g(900), 700), ...rep(g(240), 500), ...rep(g(900), 700)];
    ok(run(AnswerSampler, twoShort) === null,
       "兩段短握中間放開，不可以相加成一次作答", "計時沒有在放開時歸零");
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[2] 中位數定案：一幀尖峰不可以決定整題（Pan：「輕輕碰就全滿」）");
  {
    // 真球實測的尖峰量級：ball2 的 dev p99 = 2372、max = 3103。
    // 輕握 340raw（＜「有一點」的門檻）＋ 一次那種尖峰，答案必須**完全不動**——
    // 舊碼的峰值定案會直接把它記成貼頂的 10/10，那就是 Pan 說的「輕輕碰就全滿」。
    {
      const base = run(AnswerSampler, rep(g(340), 2000));
      ok(base !== null && bandOf(base) === "沒有", "（前提）340raw 的輕握本來應該是「沒有」",
         `記成 ${bandOf(base)}`);
      for (const spike of [1643, 2372, 3103]) {
        const seq = [...rep(g(340), 1000), ...rep(g(spike), 66), ...rep(g(340), 1000)];
        const v = run(AnswerSampler, seq);
        ok(v !== null && Math.abs(v - base) < 1e-9,
           `輕握 340raw ＋ 一次 ${spike}raw 的尖峰，定案值必須與沒有尖峰時完全相同`,
           `記成 ${v === null ? "答不出來" : v.toFixed(3)}（${bandOf(v)}），無尖峰時 ${base.toFixed(3)}`);
      }
      // 連續好幾幀的尖峰（不是單幀）也不該翻級——真球的尖峰常常連著兩三幀
      const seq3 = [...rep(g(340), 1000), ...rep(g(3103), 100), ...rep(g(340), 1000)];
      ok(bandOf(run(AnswerSampler, seq3)) === "沒有",
         "連續 100ms 的尖峰也不可以把「沒有」翻成別的級別",
         `記成 ${bandOf(run(AnswerSampler, seq3))}`);
    }
    // 反面：**持續**握到高位就**必須**是高分（不能為了抗尖峰而把真正的用力也壓掉）
    const hard = run(AnswerSampler, rep(g(1400), 2500));
    ok(hard !== null && hard >= CLEAR,
       "持續握到 1400raw 仍必須記成「很明顯」（抗尖峰不能把真的用力也壓掉）",
       `記成 ${hard === null ? "答不出來" : hard.toFixed(3)}`);
    // 而且定案值要是**中位數**、不是峰值也不是平均。要能分辨三者，輸入的低值必須佔**多數**
    // （剛好各半的話中位數會落在高值上、和峰值同值，那個情境分辨不出東西）：
    // 三幀裡兩幀 500raw、一幀 1400raw ⇒ 中位數＝500raw 的水位、峰值＝1400、平均在兩者之間。
    {
      const lo = g(500), hi = g(1400);
      const mixed = [];
      for (let i = 0; i < Math.round(3000 / DT); i++) mixed.push(i % 3 === 2 ? hi : lo);
      const v = run(AnswerSampler, mixed);
      ok(v !== null && v < hi - 0.05, "定案值不可以是峰值", `${v} vs 峰值 ${hi.toFixed(3)}`);
      const mean = (2 * lo + hi) / 3;
      ok(v !== null && Math.abs(v - mean) > 0.02,
         "定案值也不可以是平均（平均擋不住尖峰——這是本次改版差點選錯的統計量）",
         `${v} vs 平均 ${mean.toFixed(3)}`);
      ok(v !== null && Math.abs(v - lo) < 1e-9, "定案值要等於多數幀的水位（＝中位數）",
         `${v} vs ${lo.toFixed(3)}`);
    }
    ok(/sort\(/.test(clsSrc) && !/Math\.max\(this\.\w+/.test(clsSrc),
       "取樣器裡要真的排序取中位數，不能又用 Math.max 記峰值");
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[3] settle：手還在往目標爬的那段不計入取樣");
  {
    ok(K.AFTER_SETTLE_MS >= 150 && K.AFTER_SETTLE_MS <= 600,
       "AFTER_SETTLE_MS 要在 150–600ms（夠久跳過爬升、又不會吃掉短握）", String(K.AFTER_SETTLE_MS));
    ok(K.AFTER_SETTLE_MS < K.AFTER_SAMPLE_MS, "settle 要短於取樣時間（否則永遠取不到樣）");
    // 從 ON 慢慢爬到高位：如果爬升段被計入，中位數會被拉低
    const ramp = [];
    const rampMs = 900;
    for (let i = 0; i < Math.round(rampMs / DT); i++) ramp.push(ON + (g(1400) - ON) * (i / (rampMs / DT)));
    const v = run(AnswerSampler, [...ramp, ...rep(g(1400), 2000)]);
    ok(v !== null && v >= CLEAR,
       "先慢慢爬升再握穩到 1400raw，仍要記成「很明顯」（爬升段不該把答案拉低）",
       `記成 ${v === null ? "答不出來" : v.toFixed(3)}`);
    // 行為證據：前 SETTLE 只計時、不取樣
    const s = new AnswerSampler();
    let n = 0;
    for (const x of rep(g(900), K.AFTER_SETTLE_MS - DT)) { s.feed(x, DT); n++; }
    ok(s.heldMs > 0 && s.buf.length === 0,
       `前 ${K.AFTER_SETTLE_MS}ms 要只計時、不取樣`, `heldMs=${Math.round(s.heldMs)} buf=${s.buf.length}`);
    // 總共要握 settle + sample 才定案（不能只要 sample）
    const need = K.AFTER_SETTLE_MS + K.AFTER_SAMPLE_MS;
    ok(run(AnswerSampler, rep(g(900), need - 200)) === null,
       `握不到 ${need}ms 不可以定案`, `${need - 200}ms 就定案了`);
    ok(run(AnswerSampler, rep(g(900), need + 200)) !== null,
       `握滿 ${need}ms 就要定案`, `${need + 200}ms 還沒定案`);
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[4] 穩定力道的分級要與改版前完全一致（AE 的可達性不可以退）");
  {
    // 這是本次改版最重要的**不變式**：改的是「怎麼把一段握壓變成一個數」，
    // 不是「多大力算哪一級」。所以任何一個穩定力道算出來的級別都要跟舊碼相同
    // （舊碼＝峰值定案；穩定輸入下峰值≈中位數，兩者本來就該一致）。
    // 分級是**含**門檻的（`v >= AFTER_BAND_SOME`），所以 380raw 與 700raw 這兩個門檻值
    // 本身就落在上面那一級——這正是 AE 把門檻寫成 380/700raw 時的意思。
    const CASES = [
      [300, "沒有"], [340, "沒有"], [379, "沒有"],
      [380, "有一點"],                                  // 門檻值本身＝已達「有一點」
      [420, "有一點"], [500, "有一點"], [600, "有一點"], [699, "有一點"],
      [700, "很明顯"],                                  // 門檻值本身＝已達「很明顯」
      [900, "很明顯"], [1100, "很明顯"], [1400, "很明顯"], [1700, "很明顯"],
    ];
    for (const [raw, want] of CASES) {
      const v = run(AnswerSampler, rep(g(raw), 3000));
      ok(bandOf(v) === want, `穩定握 ${raw}raw ⇒ 「${want}」`, `記成「${bandOf(v)}」`);
    }
    // 三級都要用得到（弱球也要能給最高分＝AE-2 的要求）
    const reach = CASES.map(([raw]) => bandOf(run(AnswerSampler, rep(g(raw), 3000))));
    for (const b of ["沒有", "有一點", "很明顯"]) {
      ok(reach.includes(b), `三個級別都要有力道可以表達（缺「${b}」）`);
    }
    // 單調：力道越大不可以掉級
    const order = { "答不出來": 0, "沒有": 1, "有一點": 2, "很明顯": 3 };
    let mono = true;
    for (let i = 1; i < reach.length; i++) if (order[reach[i]] < order[reach[i - 1]]) mono = false;
    ok(mono, "力道越大，級別不可以往下掉", reach.join(","));
    if (pi === 0) {
      const show = [380, 500, 700, 900, 1400].map(r => {
        const v = run(AnswerSampler, rep(g(r), 3000));
        return `${r}raw→${v === null ? "—" : v.toFixed(2)}(${bandOf(v)})`;
      });
      console.log("      " + show.join("  "));
    }
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[5] 沒握就不可以有分數（資料完整性）");
  {
    for (const raw of [0, 60, 150, 222, 249]) {
      ok(run(AnswerSampler, rep(g(raw), 5000)) === null,
         `${raw}raw（<OFF）握再久也不可以定案`, "殘壓被讀成答案了");
    }
    // 完全沒餵過的取樣器不可以吐出一個值
    const s = new AnswerSampler();
    ok(s.value() === 0, "沒有任何取樣時 value() 要是 0（不可以是 undefined／NaN）", String(s.value()));
    ok(s.display(0.42) === 0.42, "沒有取樣時 display() 要回傳當下水位（畫面不能憑空跳）");
    // display() 有取樣時要回傳取樣值——這是「水位不再被尖峰推到全滿」的機制
    const s2 = new AnswerSampler();
    for (const x of rep(g(380), 1000)) s2.feed(x, DT);
    s2.feed(g(3103), DT);                                  // 一幀尖峰
    ok(s2.display(g(3103)) < SOME + 0.05,
       "有取樣時 display() 要回傳取樣值，一幀尖峰不可以把水位推到全滿",
       `display=${s2.display(g(3103)).toFixed(3)}`);
    // reset() 要真的清乾淨
    s2.reset();
    ok(s2.heldMs === 0 && s2.buf.length === 0 && s2.holding === false, "reset() 要清乾淨");
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[6] 門檻一個都沒被動到（AE 不可以被 revert）");
  {
    // Pan 的抱怨「太敏感」最直覺的修法是抬門檻，而那會把 AE 修的「有一顆球幾乎沒有效用」
    // 弄回來。所以這裡把四個門檻的**力道值**釘死；要改的話必須是 Pan 的決定，不是順手。
    const WANT = { AFTER_ON: 300, AFTER_OFF: 250, AFTER_BAND_SOME: 380, AFTER_BAND_CLEAR: 700,
                   AGREE_BAND_SOME: 380, AGREE_BAND_CLOSE: 700 };
    for (const [name, raw] of Object.entries(WANT)) {
      ok(T[name].byRaw, `${name} 必須寫成 gripLevelForRaw(...)（DESIGN.md §6 的硬規則）`);
      ok(T[name].raw === raw, `${name} 要維持 ${raw}raw（AE 才剛還原，不可以又抬回去）`,
         `實際 ${T[name].raw}raw`);
    }
    ok(T.AFTER_ON.raw > T.AFTER_OFF.raw, "ON 要高於 OFF（遲滯）");
    ok(T.AFTER_BAND_SOME.raw > T.AFTER_ON.raw, "「有一點」要高於 ON");
    ok(T.AFTER_BAND_CLEAR.raw > T.AFTER_BAND_SOME.raw, "「很明顯」要高於「有一點」");
  }

  // ─────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[7] 兩處問題共用同一份取樣器");
  {
    // Pan 說的是「用握力回答**各種**問題」，所以修法必須同時涵蓋兩處：
    // 回顧的「有多貼近」（handleArrivalConfirmation）與結束後問卷的四題（afterSurveyStep）。
    for (const [fn, re] of [["afterSurveyStep", /function afterSurveyStep\(a, dt\)\{[\s\S]*?\n\}/],
                            ["handleArrivalConfirmation", /function handleArrivalConfirmation\([\s\S]*?\n\}/]]) {
      const m = src.match(re);
      ok(!!m, `要找得到 ${fn}`);
      if (!m) continue;
      // ⚠️ 剝註解再比對：這兩處的註解都逐字引用了 Pan 的話並提到舊欄位名，
      // 不剝的話註解會替程式碼作證＝斷言恆真。
      const code = m[0].replace(/\/\/[^\n]*/g, "");
      ok(/AnswerSampler/.test(code) && /\.feed\(/.test(code),
         `${fn} 要用 AnswerSampler.feed() 取樣`);
      ok(/\.value\(\)/.test(code), `${fn} 要用 .value() 定案（不是自己記峰值）`);
      ok(!/Math\.max\(a\.peak|Math\.max\(arrival\.agreePeak/.test(code),
         `${fn} 不可以再自己記峰值`);
      ok(!/heldMs = 0/.test(code) || !/band !== |agreeBand !== /.test(code),
         `${fn} 不可以再「換級就把計時歸零」（Pan：滑動去其他區域）`);
    }
    // 「握多久才算」只能有一個數字（舊碼有兩個：AFTER_HOLD_MS 與 AGREEMENT_FIX_MS，
    // 而且 zh=1100 / en=900 還不一致）。
    ok(!/const AFTER_HOLD_MS = /.test(src), "AFTER_HOLD_MS 要移除（角色由 AFTER_SAMPLE_MS 接手）");
    ok(!/const AGREEMENT_FIX_MS = /.test(src), "AGREEMENT_FIX_MS 要移除（同一個角色不要有第二個常數）");
    ok(!/agreePressedAt/.test(src.replace(/\/\/[^\n]*/g, "")),
       "agreePressedAt 要移除（計時改由取樣器負責）");
    ok(K.AFTER_SAMPLE_MS >= 800 && K.AFTER_SAMPLE_MS <= 1600,
       "AFTER_SAMPLE_MS 要在 0.8–1.6s（握得住、又不用握到手酸）", String(K.AFTER_SAMPLE_MS));
    // 兩處都要有 reset 的路徑（不然上一段的握會變成下一題的答案）。
    // ⚠️ 斷言要連「有沒有真的會執行」一起看：只比對 `reset()` 這幾個字的話，
    // 用 `if(false)` 包起來的形狀會照樣通過（變異測試就是這樣抓到我第一版的）。
    const bare = src.replace(/\/\/[^\n]*/g, "");
    ok(/if\(a\.sampler\) a\.sampler\.reset\(\);/.test(bare)
       || /^\s*a\.sampler\.reset\(\);/m.test(bare), "問卷換題要重設取樣器（而且不可以被關掉）");
    ok(/if\(state\.arrival\.agreeSampler\) state\.arrival\.agreeSampler\.reset\(\);/.test(bare),
       "進入回顧的評估時要重設取樣器（而且不可以被關掉）");
  }
});

// ─────────────────────────────────────────────────────────────────────
tag = "";
console.log("[8] zh / en 兩頁必須完全一致");
{
  const A = build(PAGES[0].src), B = build(PAGES[1].src);
  // 取樣器本體是引擎碼（含中文註解），兩頁應該逐字相同
  ok(A.clsSrc === B.clsSrc, "兩頁的 AnswerSampler 要逐字相同（引擎碼不分語言）");
  for (const k of ["AFTER_SETTLE_MS", "AFTER_SAMPLE_MS"]) {
    ok(A.K[k] === B.K[k], `兩頁的 ${k} 要相同`, `${A.K[k]} vs ${B.K[k]}`);
  }
  for (const k of Object.keys(A.T)) {
    ok(A.T[k].raw === B.T[k].raw, `兩頁的 ${k} 要相同`, `${A.T[k].raw} vs ${B.T[k].raw}`);
  }
  // 行為一致：同一串輸入在兩頁要得到同一個答案
  for (const raw of [380, 500, 700, 900, 1400]) {
    const a = run(A.AnswerSampler, rep(A.g(raw), 3000));
    const b = run(B.AnswerSampler, rep(B.g(raw), 3000));
    ok(a !== null && b !== null && Math.abs(a - b) < 1e-9,
       `穩定握 ${raw}raw 在兩頁要得到同一個答案`, `${a} vs ${b}`);
  }
}

console.log("\n" + "=".repeat(60));
if (failures.length) {
  console.log(`${passed} 項通過，${failures.length} 項失敗：\n`);
  failures.forEach(f => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`全部通過：${passed} 項斷言。`);
