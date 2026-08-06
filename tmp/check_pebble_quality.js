#!/usr/bin/env node
/**
 * 對拍測試：鵝卵石紋理（pebbleBuffer）的音質。
 *
 * Pan 2026-08-05：「pebble 的聲音品質非常差」。
 *
 * 這支測試存在的理由，是那三個問題**沒有一個抓得到於 regex**：常數、註解、函式名全都對，
 * 聽起來還是很差。所以這裡把 index.html 裡**真正的** pebbleBuffer 抽出來、真的跑一次、
 * 量它產生的 buffer：
 *   ① 循環接縫的跳變（pebble 是 loop=true，接縫不連續＝每 4.5 秒一次喀聲）
 *   ② 顆粒密度（太高就糊成一片低頻嗡嗡，聽不出「一顆一顆石頭」）
 *   ③ crest factor（瞬態對比：石頭是打擊聲，不是持續噪音）
 *   ④ 過下游 pebbleBP 之後的頻帶分布（要落在阿朗壹的低-中頻主體）
 *
 * ⚠️ 亂數敏感：單跑一次的數字會抖（實測跨 seed 差到 2 倍），所以每一項都跑多個 buffer 取
 * 中位數／最壞值。門檻是照著「舊版 vs 新版」的實測差距訂的，寫在各項旁邊。
 *
 * 用法：node tmp/check_pebble_quality.js
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

const SR = 48000;
const DUR = 4.5;               // 與 index.html 的 pebbleBuffer(ctx, 4.5) 一致
const SEEDS = 8;               // 亂數敏感 → 多跑幾次取統計

// 決定性的亂數（不吃 Math.random 的話結果不可重現，而 Date.now 在這裡也用不上）
function mulberry(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 從 index.html 抽**真正的** pebbleBuffer，用假 ctx 跑起來（不重寫一份邏輯）
function makePebble(src, seed) {
  const body = src.match(/static pebbleBuffer\(ctx, dur\)\{[\s\S]*?\n  \}/);
  if (!body) throw new Error("抽不到 pebbleBuffer");
  const rateM = src.match(/const PEBBLE_RATE = ([\d.]+)/);
  if (!rateM) throw new Error("抽不到 PEBBLE_RATE");
  const fn = new Function("Math", `
    const PEBBLE_RATE = ${rateM[1]};
    ${body[0].replace(/^static pebbleBuffer/, "function pebbleBuffer")}
    return pebbleBuffer;
  `)(Object.assign(Object.create(Math), { random: mulberry(seed) }));
  const ctx = {
    sampleRate: SR,
    createBuffer(ch, len) {
      const data = Array.from({ length: ch }, () => new Float64Array(len));
      return { length: len, numberOfChannels: ch, getChannelData: (i) => data[i] };
    },
  };
  return fn(ctx, DUR);
}

// 下游真正的濾波器（pebbleBP：lowpass，握滿時 380→800Hz。用最亮的那一端，最寬鬆）
function lowpass(x, f0, Q) {
  const w0 = 2 * Math.PI * f0 / SR, cw = Math.cos(w0), al = Math.sin(w0) / (2 * Q);
  const b0 = (1 - cw) / 2 / (1 + al), b1 = (1 - cw) / (1 + al), b2 = b0;
  const a1 = -2 * cw / (1 + al), a2 = (1 - al) / (1 + al);
  const y = new Float64Array(x.length);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < x.length; i++) {
    const v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1; x1 = x[i]; y2 = y1; y1 = v; y[i] = v;
  }
  return y;
}
// Goertzel：單一頻率的能量（與 check_alangyi_match.js 同一招）
function bandPower(d, f0, f1, n = 15) {
  let tot = 0;
  for (let k = 0; k < n; k++) {
    const f = f0 * Math.pow(f1 / f0, k / (n - 1));
    const w = 2 * Math.PI * f / SR;
    let re = 0, im = 0;
    for (let i = 0; i < d.length; i++) { re += d[i] * Math.cos(w * i); im -= d[i] * Math.sin(w * i); }
    tot += (re * re + im * im) / (d.length * d.length);
  }
  return tot / n;
}
const median = (v) => v.slice().sort((a, b) => a - b)[v.length >> 1];

console.log("=== 鵝卵石紋理 音質對拍測試 ===\n");

PAGES.forEach((page, pi) => {
  tag = `(${page.label}) `;
  const src = page.src;
  const bufs = Array.from({ length: SEEDS }, (_, i) => makePebble(src, 12345 + i * 7919));
  const chans = bufs.map(b => b.getChannelData(0));

  if (pi === 0) console.log("[1] 循環接縫：pebble 是 loop=true，頭尾不連續就是每 4.5 秒一次喀聲");
  {
    // 這是 Pan 說「音質非常差」最刺耳的那一項。
    //
    // ⚠️ 量法我第一次訂錯，記下來免得下一位重踩：不能拿「接縫跳變 vs 整個 buffer 的最大跳變」
    // 當判準。這個紋理裡有寬頻顆粒雜訊，所以只要有石頭橫跨接縫，那裡本來就會有一個
    // 「跟別處一樣大」的單樣本步階——那是正常訊號，不是喀聲。新版量到 0.66 也是這個原因。
    //
    // 喀聲的定義是「接縫處的跳變比它**附近**的任何跳變都大」＝一個突兀的階躍。所以量的是
    // 接縫跳變 ÷ 接縫兩側各 5ms 之內的最大跳變。跨 60 顆 buffer（120 聲道）實測：
    //   舊版（往前撒、尾巴被 len 硬切）最壞 3.28×、p95 2.39×，**27% 的接縫超過 1.0**；
    //   新版（(start+j)%len 繞回開頭）最壞 0.64×、p95 0.44×，**0% 超過 1.0**。
    // 門檻取 0.9：兩者之間乾淨地分開，而且不會因為某個 seed 剛好有石頭壓在接縫上就誤報。
    const W = Math.round(SR * 0.005);                 // 接縫兩側各 5ms
    const ratios = [];
    for (const b of bufs) {
      for (let ch = 0; ch < b.numberOfChannels; ch++) {
        const d = b.getChannelData(ch), L = d.length;
        const seam = Math.abs(d[0] - d[L - 1]);
        let local = 0;
        for (let i = 1; i < W; i++) local = Math.max(local, Math.abs(d[i] - d[i - 1]));
        for (let i = L - W; i < L - 1; i++) local = Math.max(local, Math.abs(d[i + 1] - d[i]));
        ratios.push(local > 1e-12 ? seam / local : (seam > 1e-12 ? Infinity : 0));
      }
    }
    const worst = Math.max(...ratios);
    ok(worst < 0.9,
       "接縫的跳變不能比它附近的跳變還大（否則每次循環都聽到一次喀）",
       `最壞 ${worst.toFixed(2)}×（舊版最壞 3.28×、27% 的接縫 >1.0）`);
    if (pi === 0) console.log(`      接縫/鄰域跳變：中位 ${median(ratios).toFixed(2)}×、最壞 ${worst.toFixed(2)}×（門檻 0.9）`);
    // 而且必須是**繞回**達成的，不是把尾巴淡出（淡出會在接縫留下一段沒有石頭的空白）。
    // 註解裡引用了舊寫法，所以比對前要把註解去掉——否則這一條永遠失敗。
    const body = src.match(/static pebbleBuffer\(ctx, dur\)\{[\s\S]*?\n  \}/)[0]
      .split("\n").filter(l => !/^\s*\/\//.test(l)).join("\n");
    ok(/%\s*len/.test(body), "寫入位置要用 % len 繞回開頭（尾巴接到頭上）");
    ok(!/while\s*\(\s*i\s*<\s*len\s*\)/.test(body), "不能回到舊的「往前撒到 len 為止」寫法");
  }

  if (pi === 0) console.log("[2] 顆粒密度：要聽得出「一顆一顆石頭」，不是一片低頻嗡嗡");
  {
    const rate = Number(src.match(/const PEBBLE_RATE = ([\d.]+)/)[1]);
    ok(!Number.isNaN(rate), "要有 PEBBLE_RATE");
    // 上界是這次修正的重點：舊版 ~34 顆/秒糊成一片。下界守「聲音永遠成立」——
    // 太稀就不是石灘了，會變成零星的敲擊。
    ok(rate >= 6 && rate <= 16, "密度要在 6–16 顆/秒（舊版 ~34 太糊）", `${rate} 顆/秒`);
    ok(/Math\.round\(dur \* PEBBLE_RATE\)/.test(src),
       "顆數要由 PEBBLE_RATE × 時長算出（不能又寫死間隔）");
    // 真的數一次峰值：包絡上的局部極大應該落在同一個量級（證明常數真的生效，不是只放在那裡）
    const counts = chans.map(d => {
      const win = Math.round(SR * 0.01);                  // 10ms 包絡
      const env = [];
      for (let i = 0; i + win <= d.length; i += win) {
        let p = 0;
        for (let j = 0; j < win; j++) p = Math.max(p, Math.abs(d[i + j]));
        env.push(p);
      }
      const thr = median(env) * 2.2;
      let n = 0;
      for (let i = 1; i < env.length - 1; i++)
        if (env[i] > thr && env[i] >= env[i - 1] && env[i] > env[i + 1]) n++;
      return n / DUR;
    });
    const hits = median(counts);
    ok(hits > 2 && hits < rate * 2.2,
       "量到的撞擊事件密度要跟 PEBBLE_RATE 同量級（常數要真的生效）",
       `量到 ${hits.toFixed(1)}/秒 vs 設定 ${rate}/秒`);
    if (pi === 0) console.log(`      設定 ${rate} 顆/秒 → 量到 ${hits.toFixed(1)}/秒`);
  }

  if (pi === 0) console.log("[3] crest factor：石頭是打擊聲，要有瞬態對比");
  {
    // 舊版實測 crest 只有 14.9dB＝峰值幾乎沒有高出 RMS，聽起來就是持續噪音而不是打擊。
    // 新版 ~21dB。這一項是「密度太高」的獨立證據：即使 PEBBLE_RATE 寫對，
    // 若每顆的衰減被拉長成互相重疊，crest 還是會塌回去。
    const crests = chans.map(d => {
      let pk = 0, sum = 0;
      for (const v of d) { const a = Math.abs(v); if (a > pk) pk = a; sum += v * v; }
      return 20 * Math.log10(pk / Math.sqrt(sum / d.length));
    });
    const cr = median(crests);
    ok(cr > 17, "crest 要 > 17dB（舊版 14.9dB＝糊成持續噪音）", `${cr.toFixed(1)}dB`);
    // 上界：太高就代表整片幾乎是靜音、只有零星幾顆爆音（也不是石灘）
    ok(cr < 32, "但也不能高到只剩零星爆音", `${cr.toFixed(1)}dB`);
    if (pi === 0) console.log(`      crest 中位 ${cr.toFixed(1)}dB`);
    // 限幅保護：正規化到 0.7，不能有超過 1 的樣本（下游還要疊 makeup 與其他層）
    let peak = 0;
    for (const b of bufs) for (let ch = 0; ch < b.numberOfChannels; ch++)
      for (const v of b.getChannelData(ch)) peak = Math.max(peak, Math.abs(v));
    ok(peak <= 0.75, "峰值要被正規化在 0.7 附近（guardrail：限幅保護）", peak.toFixed(3));
    ok(peak > 0.5, "但也要真的有訊號（不能整片近靜音）", peak.toFixed(3));
    // 0.5ms 的起音坡：這一項**只能**用結構斷言守，因為實測量不出差別（拿掉之後最大跳變/峰值
    // 兩者都是 0.396，中位數 0.312 vs 0.344＝seed 雜訊的量級）。24 個取樣的坡對「每顆石頭
    // 不從滿幅開始」是便宜的保險，但它不是可量測的音質指標——不假裝它是。
    ok(/const atk = Math\.max\(1, Math\.floor\(rate \* 0\.000\d\)\)/.test(src),
       "每顆石頭要有短起音坡（防禦性，量不出來、但便宜）");
    ok(/const a = j < atk \? j \/ atk : 1;/.test(src), "起音坡要真的用上");
  }

  if (pi === 0) console.log("[4] 立體聲去相關：兩聲道不能一樣（否則塌成單點）");
  {
    const cors = bufs.map(b => {
      const L = b.getChannelData(0), R = b.getChannelData(1);
      let sl = 0, sr = 0, sc = 0;
      for (let i = 0; i < L.length; i++) { sl += L[i] * L[i]; sr += R[i] * R[i]; sc += L[i] * R[i]; }
      return sc / Math.sqrt(sl * sr);
    });
    const c = Math.max(...cors.map(Math.abs));
    ok(c < 0.3, "兩聲道的相關性要低（各自獨立撒石頭）", `最大 |r| = ${c.toFixed(3)}`);
    // 每聲道各自迴圈是這件事的來源，被改成共用一份就會塌掉
    ok(/for\(let ch = 0; ch < 2; ch\+\+\)/.test(src), "要逐聲道各撒一次（去相關的來源）");
  }

  if (pi === 0) console.log("[5] 過下游 pebbleBP 之後的頻帶：要落在阿朗壹的低-中頻主體");
  {
    // ⚠️ 這一項的量測點很重要，我第一次量錯過：pebbleBP 是 lowpass 380–800Hz
    // （index.html:2261 `380 + 420 * stoneAmt`），所以「500–2000Hz 幾乎沒有能量」是**設計**
    // （DESIGN.md：「被水吃掉高頻」），不是缺陷。在濾波器**之前**量會得到完全相反的結論。
    const f0 = Number((src.match(/setTargetAtTime\((\d+) \+ \d+ \* stoneAmt, now, 1\.0\)/) || [])[1]);
    const Q = Number((src.match(/this\.pebbleBP\.Q\.value = ([\d.]+)/) || [])[1]);
    ok(!Number.isNaN(f0) && !Number.isNaN(Q), "要抽得到 pebbleBP 的設定");
    const filtered = chans.map(d => lowpass(d, f0 + 420, Q));   // 握滿（最亮）那一端
    const bands = { "20-120": [20, 120], "120-500": [120, 500], "500-2000": [500, 2000], "2000+": [2000, 8000] };
    const pct = {};
    for (const [name, [a, b]] of Object.entries(bands))
      pct[name] = median(filtered.map(d => bandPower(d, a, b)));
    const tot = Object.values(pct).reduce((s, v) => s + v, 0);
    for (const k of Object.keys(pct)) pct[k] = pct[k] / tot * 100;
    if (pi === 0) console.log("      " + Object.entries(pct).map(([k, v]) => `${k}: ${v.toFixed(1)}%`).join("  "));
    // 石頭是**低頻共振**（f0 110–360Hz），能量要集中在 120–500，這是「大圓石」而不是「沙沙」
    ok(pct["120-500"] > 30, "120–500Hz 要是主帶（大圓石的低頻共振）", `${pct["120-500"].toFixed(1)}%`);
    ok(pct["20-120"] + pct["120-500"] > 65,
       "能量要集中在 500Hz 以下（阿朗壹的主體 + 被水吃掉高頻）",
       `${(pct["20-120"] + pct["120-500"]).toFixed(1)}%`);
    ok(pct["2000+"] < 5, "2kHz 以上要幾乎沒有（不然會變成沙灘的沙沙聲）", `${pct["2000+"].toFixed(1)}%`);
    // 接觸瞬態：濾波前必須有中頻分量（就是被濾掉的那一部分），否則只剩「低頻噗」。
    // 在濾波**前**量，因為它的作用是提供起音的清脆度，濾波後只留一點點。
    const pre = median(chans.map(d => bandPower(d, 650, 1800)));
    const low = median(chans.map(d => bandPower(d, 110, 360)));
    ok(pre / low > 0.02, "濾波前要有中頻的接觸瞬態（「喀」，不能只有低頻的「咚」）",
       `中頻/低頻 = ${(pre / low).toFixed(3)}`);
    // 而且它在碼裡要是**快速衰減**的分量（慢衰減會變成鈴聲，不是碰撞）
    const body = src.match(/static pebbleBuffer\(ctx, dur\)\{[\s\S]*?\n  \}/)[0];
    const cd = body.match(/const cd\s+= rate \* ([\d.]+);/);
    ok(cd && Number(cd[1]) <= 0.02, "接觸瞬態的衰減要 ≤20ms（碰撞，不是鈴聲）", cd ? `${Number(cd[1]) * 1000}ms` : "?");
  }

  if (pi === 0) console.log("[6] 底量仍在（Pan 之前的回饋：「pebble 的聲音幾乎都是沒有的」）");
  {
    // 這次修的是音質，不能順手把 2026-08-04 為了「聽得到」而加的底量弄掉。
    const floor = Number(src.match(/const PEBBLE_FLOOR = ([\d.]+)/)[1]);
    ok(floor >= 0.10, "PEBBLE_FLOOR 要維持 ≥0.10（放鬆時石頭仍在＝聲音永不消失）", String(floor));
    // 底量要跟握力對應的量加在**同一條**上（同一個 gain 節點），不是另外開一路。
    // 2026-08-06 之後底量多乘一個開場淡入係數 pebbleFloorAmt（Pan：「一開始的滾石聲完整去除」），
    // 所以這裡允許 `PEBBLE_FLOOR * this.pebbleFloorAmt`；但 0.52×stoneAmt 那一項不可以被乘到。
    ok(/\(PEBBLE_FLOOR(?: \* this\.pebbleFloorAmt)? \+ 0\.52 \* stoneAmt\)/.test(src),
       "底量要加在握力對應的整條上");
  }
});
tag = "";

console.log("\n" + "=".repeat(60));
if (failures.length) {
  console.log(`${passed} 項通過，${failures.length} 項失敗：\n`);
  failures.forEach(f => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`全部通過：${passed} 項斷言。`);
