#!/usr/bin/env node
/**
 * 對拍測試：改動後的引擎輸出頻譜，要比改動前更接近阿朗壹海岸錄音的頻帶指紋。
 *
 * Pan 2026-08-04：「這些聲音跟我當時阿朗壹海岸錄音的頻帶差很多，這個版本的模仿海浪的
 * 白噪音很假，這不是個好現象 然後 shimmer 和 pebble 的聲音幾乎都是沒有的」
 *
 * 阿朗壹的指紋是 2026-07-09 (h) 那次實測寫在 AGENTS.md 裡的（錄音本身不在 repo）：
 *   spectral centroid ~428Hz；sub(20–120) 20.9%、120–500 37%、500–2000 34%、
 *   2–6k 1.3%、6k+ ~0%。
 *
 * 這支測試從 index.html regex 抽**真正的**濾波器設定、增益常數與 HRIR_TILT_FIX，
 * 再讀**真的** IR 檔算方向平均響應，組出整條鏈的頻率響應——不重寫一份邏輯。
 *
 * 用法：node tmp/check_alangyi_match.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HRIR = path.join(ROOT, "assets", "hrir");
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

// 阿朗壹指紋（AGENTS.md 2026-07-09 (h)）
const ALANGYI = { "20-120": 20.9, "120-500": 37.0, "500-2000": 34.0, "2000-6000": 1.3, "6000+": 0.2 };
const ALANGYI_CENTROID = 428;

function readIr(p) {
  const raw = fs.readFileSync(p);
  let o = 12, fmt = null, data = null;
  while (o + 8 <= raw.length) {
    const cid = raw.toString("latin1", o, o + 4);
    const sz = raw.readUInt32LE(o + 4);
    if (cid === "fmt ") fmt = raw.subarray(o + 8, o + 8 + sz);
    else if (cid === "data") data = raw.subarray(o + 8, o + 8 + sz);
    o += 8 + sz + (sz & 1);
  }
  const ch = fmt.readUInt16LE(2), sr = fmt.readUInt32LE(4);
  const n = data.length / 4;
  const chans = Array.from({ length: ch }, () => []);
  for (let i = 0; i < n; i++) chans[i % ch].push(data.readFloatLE(i * 4));
  return { sr, chans };
}
function coef(type, f0, Q, gainDb, SR) {
  const w0 = 2 * Math.PI * f0 / SR, cw = Math.cos(w0), sw = Math.sin(w0);
  const A = Math.pow(10, gainDb / 40);
  let b0, b1, b2, a0, a1, a2;
  if (type === "peaking") {
    const al = sw / (2 * Q);
    b0 = 1 + al * A; b1 = -2 * cw; b2 = 1 - al * A;
    a0 = 1 + al / A; a1 = -2 * cw; a2 = 1 - al / A;
  } else if (type === "lowshelf" || type === "highshelf") {
    const al = sw / 2 * Math.sqrt((A + 1 / A) * (1 / Q - 2) + 2);
    const t = 2 * Math.sqrt(A) * al, hi = type === "highshelf" ? -1 : 1;
    b0 = A * ((A + 1) - hi * (A - 1) * cw + t);
    b1 = 2 * hi * A * ((A - 1) - hi * (A + 1) * cw);
    b2 = A * ((A + 1) - hi * (A - 1) * cw - t);
    a0 = (A + 1) + hi * (A - 1) * cw + t;
    a1 = -2 * hi * ((A - 1) + hi * (A + 1) * cw);
    a2 = (A + 1) + hi * (A - 1) * cw - t;
  } else if (type === "lowpass") {
    const al = sw / (2 * Q);
    b0 = (1 - cw) / 2; b1 = 1 - cw; b2 = (1 - cw) / 2;
    a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
  } else if (type === "highpass") {
    const al = sw / (2 * Q);
    b0 = (1 + cw) / 2; b1 = -(1 + cw); b2 = (1 + cw) / 2;
    a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
  } else if (type === "bandpass") {
    const al = sw / (2 * Q);
    b0 = al; b1 = 0; b2 = -al;
    a0 = 1 + al; a1 = -2 * cw; a2 = 1 - al;
  } else throw new Error(type);
  return [b0 / a0, b1 / a0, b2 / a0, a1 / a0, a2 / a0];
}
function bqDb([b0, b1, b2, a1, a2], f, SR) {
  const w = 2 * Math.PI * f / SR;
  const c1 = Math.cos(w), s1 = Math.sin(w), c2 = Math.cos(2 * w), s2 = Math.sin(2 * w);
  const nr = b0 + b1 * c1 + b2 * c2, ni = -(b1 * s1 + b2 * s2);
  const dr = 1 + a1 * c1 + a2 * c2, di = -(a1 * s1 + a2 * s2);
  return 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
}

console.log("=== 阿朗壹頻帶對拍測試 ===\n");

// ── 方向平均 HRIR 響應（讀真檔）──
const manifest = JSON.parse(fs.readFileSync(path.join(HRIR, "manifest.json"), "utf8"));
const src0 = PAGES[0].src;
const HRIR_MATCH = Number(src0.match(/const HRIR_MATCH = ([\d.]+)/)[1]);
const HRIR_MIN_NORM = Number(src0.match(/const HRIR_MIN_NORM = ([\d.]+)/)[1]);
const irs = manifest.map(e => {
  const r = readIr(path.join(HRIR, e.name));
  let sum = 0;
  for (const d of r.chans) for (const v of d) sum += v * v;
  return { r, gain: HRIR_MATCH / Math.max(Math.sqrt(sum / r.chans.length), HRIR_MIN_NORM) };
});
const SR = irs[0].r.sr;
const GRID = [];
for (let k = 0; k <= 300; k++) GRID.push(20 * Math.pow(20000 / 20, k / 300));
const HDB = GRID.map(f => {
  const w = 2 * Math.PI * f / SR;
  let tot = 0, n = 0;
  for (const { r, gain } of irs) for (const d of r.chans) {
    let re = 0, im = 0;
    for (let i = 0; i < d.length; i++) { re += d[i] * Math.cos(w * i); im -= d[i] * Math.sin(w * i); }
    tot += (re * re + im * im) * gain * gain; n++;
  }
  return tot / n;
});
const hrirDb = (f) => {
  if (f <= GRID[0]) return 10 * Math.log10(HDB[0]);
  if (f >= GRID[GRID.length - 1]) return 10 * Math.log10(HDB[HDB.length - 1]);
  let i = 1; while (GRID[i] < f) i++;
  const t = (Math.log(f) - Math.log(GRID[i - 1])) / (Math.log(GRID[i]) - Math.log(GRID[i - 1]));
  return 10 * Math.log10(HDB[i - 1]) + t * (10 * Math.log10(HDB[i]) - 10 * Math.log10(HDB[i - 1]));
};

PAGES.forEach((page, pi) => {
  tag = `(${page.label}) `;
  const src = page.src;

  // ── 從碼裡抽真常數 ──
  const num = (re, label) => {
    const m = src.match(re);
    ok(!!m, `要找得到 ${label}`);
    return m ? Number(m[1]) : NaN;
  };
  const TILT = new Function("return " + src.match(/const HRIR_TILT_FIX = \[[\s\S]*?\n\];/)[0]
    .replace("const HRIR_TILT_FIX = ", "").replace(/;$/, ""))();
  const TRIM = num(/const HRIR_TILT_TRIM = ([\d.]+)/, "HRIR_TILT_TRIM");
  const MK = new Function("return " + src.match(/const SPATIAL_MAKEUP = \{[^}]*\}/)[0]
    .replace("const SPATIAL_MAKEUP = ", ""))();
  const SHIMMER = num(/const SHIMMER_LEVEL = ([\d.]+)/, "SHIMMER_LEVEL");
  const PEBFLOOR = num(/const PEBBLE_FLOOR = ([\d.]+)/, "PEBBLE_FLOOR");
  // shimmer 自己的乾濕比（2026-08-05）。其餘層吃全域的 dry 0.4 / wet 0.8（見 loadIR），
  // shimmer 這一層自己接兩個 gain，所以它到 clip 的總量必須另外算，否則這支測試會用錯的
  // 權重去評 shimmer 在 500-2000Hz 的貢獻——那正是 Pan 說「太遠、幾乎感覺不到」的頻帶。
  const SHIM_DRY = num(/const SHIMMER_DRY = ([\d.]+)/, "SHIMMER_DRY");
  const SHIM_WET = num(/const SHIMMER_WET = ([\d.]+)/, "SHIMMER_WET");
  const GLOBAL_DRY = num(/this\.dry\.gain\.setTargetAtTime\(([\d.]+)/, "全域 dry");
  const GLOBAL_WET = num(/this\.wet\.gain\.setTargetAtTime\(([\d.]+)/, "全域 wet");
  // 到 clip 的總量：其他層 = 1×dry + 1×wet；shimmer = SHIM_DRY×dry + SHIM_WET×wet
  const BUS_OTHER = GLOBAL_DRY + GLOBAL_WET;
  const BUS_SHIM = SHIM_DRY * GLOBAL_DRY + SHIM_WET * GLOBAL_WET;
  const flp = num(/this\.foamLP\.frequency\.value = (\d+)/, "foamLP 頻率");

  if (pi === 0) console.log("[1] 傾斜修正鏈本身要把方向平均響應拉平");
  const tiltDb = (f) => TILT.reduce((s, st) => s + bqDb(coef(st.type, st.f, st.q, st.gain, SR), f, SR), 0)
                        + 20 * Math.log10(TRIM);
  {
    const band = GRID.filter(f => f >= 45 && f <= 12000);
    const before = band.map(hrirDb);
    const after = band.map(f => hrirDb(f) + tiltDb(f));
    const spanB = Math.max(...before) - Math.min(...before);
    const spanA = Math.max(...after) - Math.min(...after);
    ok(spanB > 20, "修正前的落差確實很大（記錄現況）", `${spanB.toFixed(1)}dB`);
    ok(spanA < 6, "修正後 45Hz–12kHz 的落差要小於 6dB", `${spanA.toFixed(1)}dB`);
    ok(Math.max(...after.map(Math.abs)) < 4, "修正後每一點都要在 ±4dB 內",
       `最大 ${Math.max(...after.map(Math.abs)).toFixed(1)}dB`);
    // 低頻是重點：Pan 的錄音 21% 能量在 20–120Hz
    for (const f of [60, 120, 220, 320]) {
      ok(Math.abs(hrirDb(f) + tiltDb(f)) < 4, `${f}Hz 修正後要在 ±4dB 內`,
         `${(hrirDb(f) + tiltDb(f)).toFixed(1)}dB（修正前 ${hrirDb(f).toFixed(1)}dB）`);
    }
    if (pi === 0) console.log(`      落差 ${spanB.toFixed(1)}dB → ${spanA.toFixed(1)}dB`);
  }

  if (pi === 0) console.log("[2] makeup 要跟修正鏈一致（塌回 ~1，不是還留著 3–5 倍）");
  {
    // 傾斜已經被拉平，如果 makeup 還留著舊的 3–5 倍，等於整個低頻層被重複補償一次＝轟。
    for (const [layer, v] of Object.entries(MK)) {
      ok(v > 0.7 && v < 1.5, `${layer} 的 makeup 要在 0.7–1.5（修正鏈已經拉平傾斜）`, String(v));
    }
    // 而且要真的等於「用該層自己的濾波器加權」量出來的殘差
    const LAYERS = {
      surge: [["lowpass", 800, 0.7]], foam: [["highpass", 1500, 0.7], ["lowpass", 8000, 0.7]],
      pebble: [["lowpass", 700, 0.6]], bubble: [["bandpass", 320, 0.9]], shore: [["lowpass", 640, 0.7]],
    };
    for (const [layer, filt] of Object.entries(LAYERS)) {
      let withH = 0, without = 0;
      for (let i = 0; i < GRID.length - 1; i++) {
        const f = GRID[i], bw = GRID[i + 1] - GRID[i];
        if (f < 30 || f > 16000) continue;
        const wP = Math.pow(10, filt.reduce((s, [t, ff, q]) => s + bqDb(coef(t, ff, q, 0, SR), f, SR), 0) / 10) * bw;
        without += wP;
        withH += wP * Math.pow(10, (hrirDb(f) + tiltDb(f)) / 10);
      }
      const want = Math.pow(10, -(10 * Math.log10(withH / without)) / 20);
      ok(Math.abs(MK[layer] - want) / want < 0.08,
         `${layer} 的 makeup 要等於修正後量到的殘差`, `碼裡 ${MK[layer]}，量到 ${want.toFixed(2)}`);
    }
  }

  if (pi === 0) console.log("[3] 白噪音的三個成因都要處理掉");
  {
    // ① foam 要有頂端的蓋子（原本 HP1500 沒有上限＝嘶到 24kHz）
    ok(/this\.foamLP\.type = "lowpass"/.test(src), "foam 要有 lowpass 蓋住頂端");
    ok(flp >= 5000 && flp <= 10000, "foam 的蓋子要在 5–10kHz（阿朗壹 6k+ ≈ 0%）", String(flp));
    ok(/this\.foamHP\.connect\(this\.foamLP\)/.test(src), "foamHP 要真的接進 foamLP");
    ok(/this\.foamLP\.connect\(this\.foamGain\)/.test(src), "foamLP 要接進 foamGain");
    // ② surge / foam 要用 pink 而不是白噪音
    ok(/this\.noise = OceanEngine\.pinkNoiseSource\(ctx\)/.test(src), "surge 要用 pink 噪音");
    ok(/this\.noise2 = OceanEngine\.pinkNoiseSource\(ctx\)/.test(src), "foam 要用 pink 噪音");
    ok(/static pinkNoiseSource\(ctx\)\{/.test(src), "要有 pinkNoiseSource");
    // ③ pink 產生器要是真的 −3dB/oct，而且 RMS 有正規化（不然既有音量常數全走鐘）
    const pinkSrc = src.match(/static pinkNoiseSource\(ctx\)\{[\s\S]*?\n  \}/)[0];
    ok(/0\.99886|0\.0555179/.test(pinkSrc), "要用 Paul Kellet 的係數（公認的 pink 近似）");
    ok(/const rms = Math\.sqrt\(sum \/ len\)/.test(pinkSrc), "pink 要正規化 RMS（既有音量常數才不用重調）");
    // ④ 真的**跑一次**產生器、量它輸出的頻譜斜率。
    //    只檢查係數在不在（上面那兩項）擋不住「係數留著、但輸出那一行改成 d[i] = w」——
    //    名字、係數、註解全對，聽起來還是白的。所以這裡把 buffer 真的算出來做 DFT。
    {
      const gen = new Function("ctx", "return (" +
        pinkSrc.replace(/^\s*static pinkNoiseSource/, "function pinkNoiseSource") +
        ")(ctx);");
      // 假 ctx：只要 createBuffer / createBufferSource 的最小形狀，取得 buffer 就好
      let captured = null;
      const fakeCtx = {
        sampleRate: 48000,
        createBuffer: (nch, len) => {
          const chans = [new Float32Array(len)];
          captured = chans[0];
          return { getChannelData: () => chans[0], length: len, numberOfChannels: nch };
        },
        createBufferSource: () => ({ buffer: null, loop: false, start(){}, connect(){} }),
      };
      gen(fakeCtx);
      ok(!!captured && captured.length > 1000, "pink 產生器要真的填出 buffer");
      if (captured) {
        // Goertzel 逐頻點量功率（buffer 很長，用抽樣窗就夠看斜率）
        const N = Math.min(captured.length, 1 << 16);
        const pow = (f) => {
          const w = 2 * Math.PI * f / fakeCtx.sampleRate;
          let re = 0, im = 0;
          for (let i = 0; i < N; i++) { re += captured[i] * Math.cos(w * i); im -= captured[i] * Math.sin(w * i); }
          return (re * re + im * im) / N;
        };
        // 用 1/3 八度的平均擋掉單點的隨機起伏
        const bandDb = (fc) => {
          let tot = 0, n = 0;
          for (let k = -4; k <= 4; k++) { tot += pow(fc * Math.pow(2, k / 36)); n++; }
          return 10 * Math.log10(tot / n);
        };
        const d250 = bandDb(250), d1k = bandDb(1000), d4k = bandDb(4000);
        // pink＝每八度 −3dB。250→4000 是 4 個八度 ⇒ 應該掉 ~12dB。
        // 白噪音會是 ~0dB，所以門檻取 −6dB：足以區分 pink 與白，又容得下 Kellet 近似的誤差。
        ok(d4k - d250 < -6, "pink 產生器的輸出要真的往下斜（250Hz→4kHz 至少 −6dB）",
           `250Hz ${d250.toFixed(1)}dB → 4kHz ${d4k.toFixed(1)}dB（差 ${(d4k - d250).toFixed(1)}dB）`);
        ok(d1k < d250 && d4k < d1k, "斜率要單調（不是只有兩端剛好對）",
           `${d250.toFixed(1)} / ${d1k.toFixed(1)} / ${d4k.toFixed(1)}dB`);
        // RMS 正規化要真的生效：既有各層音量常數是照白噪音的 0.577 調的
        let sum = 0;
        for (let i = 0; i < captured.length; i++) sum += captured[i] * captured[i];
        const rms = Math.sqrt(sum / captured.length);
        ok(Math.abs(rms - 0.577) < 0.03, "pink 的 RMS 要正規化到 ~0.577（白噪音的 RMS）",
           `量到 ${rms.toFixed(3)}`);
        if (pi === 0) console.log(`      pink 實測：250Hz ${d250.toFixed(1)}dB → 4kHz ${d4k.toFixed(1)}dB（${(d4k - d250).toFixed(1)}dB / 4 oct）、RMS ${rms.toFixed(3)}`);
      }
    }
  }

  if (pi === 0) console.log("[4] shimmer 與 pebble 要真的聽得到（Pan：「幾乎都是沒有的」）");
  {
    ok(SHIMMER > 1.6, "shimmer 要比上一版(1.6)再大", String(SHIMMER));
    ok(SHIMMER <= 3.2, "但仍要有界（不能蓋掉海濤）", String(SHIMMER));
    const shimmerPeak = SHIMMER * (0.012 + 0.044 + 0.012);
    ok(shimmerPeak < 0.35, "shimmer 峰值仍要低於主浪（它是點綴）", shimmerPeak.toFixed(3));
    ok(PEBFLOOR >= 0.10, "pebble 的靜止底量要 ≥0.10（DESIGN.md §4.4：它是本聲景的定位聲）",
       String(PEBFLOOR));
    ok(PEBFLOOR <= 0.25, "但底量要有界（放鬆時不能變成石頭噪音牆）", String(PEBFLOOR));
    // 2026-08-06 起底量多乘一個開場淡入係數（Pan：「一開始的滾石聲完整去除」），故容許
    // `PEBBLE_FLOOR * this.pebbleFloorAmt`——重點仍是「用常數 PEBBLE_FLOOR，不是寫死的 0.030」。
    ok(/\(PEBBLE_FLOOR(?: \* this\.pebbleFloorAmt)? \+ 0\.52 \* stoneAmt\)/.test(src),
       "pebbleGain 要用 PEBBLE_FLOOR 當常數項（而不是寫死的 0.030）");
    // 握力仍要有作用（不是把它變成固定電平）
    ok(/0\.52 \* stoneAmt/.test(src), "握力仍要主控石頭的量（底量只是墊高，不是取代）");

    // ── shimmer 的距離感（Pan 2026-08-05：「shimmer 的聲音太遠了，幾乎感覺不到」）──
    // 這裡守的是**推理**，不只是數字：距離感由 direct-to-reverberant ratio 決定，
    // 所以要 (a) D/R 轉正、且 (b) 總能量不減。少了 (b) 就會有人用「調小 wet」交換距離感，
    // 而 Pan 的抱怨正是「幾乎感覺不到」——拿音量換距離感等於沒解決。
    const drDb = 20 * Math.log10((SHIM_DRY * GLOBAL_DRY) / (SHIM_WET * GLOBAL_WET));
    const drBefore = 20 * Math.log10(GLOBAL_DRY / GLOBAL_WET);
    ok(drBefore < 0, "（前提）全域乾濕比本身是殘響大於直達聲＝每一層都被推遠",
       `全域 D/R ${drBefore.toFixed(1)}dB`);
    ok(drDb > 6, "shimmer 的 D/R 要明顯轉正（近場），不能吃全域那個 −6dB",
       `D/R ${drDb.toFixed(1)}dB`);
    ok(BUS_SHIM >= BUS_OTHER * 0.95,
       "但總能量不能因此變小（Pan 說的是「幾乎感覺不到」，不可以拿音量換距離感）",
       `shimmer 匯流量 ${BUS_SHIM.toFixed(2)} vs 其他層 ${BUS_OTHER.toFixed(2)}`);
    ok(BUS_SHIM <= BUS_OTHER * 1.6, "也不能藉這個把 shimmer 偷偷放大成主角",
       `${BUS_SHIM.toFixed(2)} vs ${BUS_OTHER.toFixed(2)}`);
    ok(SHIM_WET > 0.1, "仍要留一點房間（全乾會變成貼耳的乾硬電子音）", String(SHIM_WET));
    // 接線本身：必須是自己的兩個 gain，不能又接回全域那對
    ok(/this\.shimmerGain\.connect\(shimDry\); shimDry\.connect\(this\.dry\)/.test(src),
       "shimmer 要經自己的 dry gain 才進全域 dry");
    ok(/this\.shimmerGain\.connect\(shimWet\); shimWet\.connect\(this\.convolver\)/.test(src),
       "shimmer 要經自己的 wet gain 才進 convolver");
    if (pi === 0) console.log(`      shimmer D/R：全域 ${drBefore.toFixed(1)}dB → 這一層 ${drDb.toFixed(1)}dB；匯流量 ${BUS_SHIM.toFixed(2)}（其他層 ${BUS_OTHER.toFixed(2)}）`);
  }

  if (pi === 0) console.log("[5] 整條鏈的輸出頻帶 vs 阿朗壹");
  {
    // 各層在「放鬆底床」狀態的音量（energy≈0.12、swell≈0.5、無握壓）——Pan 聽到的就是這個
    const pink = (f) => -10 * Math.log10(f / 1000);     // −3dB/oct，1kHz 當 0dB
    const L = [
      { g: 0.15, sp: true, mk: MK.surge, pink: true, filt: [["lowpass", 800, 0.7]] },
      { g: 0.060, sp: true, mk: MK.foam, pink: true, filt: [["highpass", 1500, 0.7], ["lowpass", flp, 0.7]] },
      { g: PEBFLOOR * 0.68, sp: true, mk: MK.pebble, pink: false, filt: [["lowpass", 700, 0.6]] },
      { g: 0.06, sp: true, mk: MK.bubble, pink: false, filt: [["bandpass", 320, 0.9]] },
      { g: 0.06, sp: true, mk: MK.shore, pink: false, filt: [["lowpass", 640, 0.7]] },
      { g: 0.14, sp: false, mk: 1, pink: false, filt: [["lowpass", 110, 0.4]] },
      { g: 0.10, sp: false, mk: 1, pink: false, filt: [["lowpass", 520, 0.7]] },
      // shimmer 的權重要用它**自己**的乾濕比（BUS_SHIM / BUS_OTHER＝相對其他層的匯流量）。
      { g: SHIMMER * 0.019 * (BUS_SHIM / BUS_OTHER), sp: false, mk: 1, pink: false, filt: [["lowpass", 1200, 0.55]] },
    ];
    const respAt = (f) => L.reduce((s, l) => {
      let db = l.filt.reduce((a, [t, ff, q]) => a + bqDb(coef(t, ff, q, 0, SR), f, SR), 0);
      db += 20 * Math.log10(l.g * l.mk);
      if (l.pink) db += pink(f);
      if (l.sp) db += hrirDb(f) + tiltDb(f);
      return s + Math.pow(10, db / 10);
    }, 0);
    const B = { "20-120": [20, 120], "120-500": [120, 500], "500-2000": [500, 2000], "2000-6000": [2000, 6000], "6000+": [6000, 16000] };
    const out = {}; let tot = 0, cn = 0, cd = 0;
    for (const [k, [f0, f1]] of Object.entries(B)) {
      let p = 0;
      for (let i = 0; i < GRID.length - 1; i++) {
        const f = GRID[i], bw = GRID[i + 1] - GRID[i];
        if (f < f0 || f >= f1) continue;
        const e = respAt(f) * bw;
        p += e; cn += e * f; cd += e;
      }
      out[k] = p; tot += p;
    }
    for (const k of Object.keys(out)) out[k] = out[k] / tot * 100;
    const centroid = cn / cd;
    if (pi === 0) {
      console.log("      頻帶          阿朗壹      這一版");
      for (const k of Object.keys(ALANGYI))
        console.log(`      ${k.padEnd(12)} ${ALANGYI[k].toFixed(1).padStart(6)}% ${out[k].toFixed(1).padStart(10)}%`);
      console.log(`      centroid     ${String(ALANGYI_CENTROID).padStart(6)}Hz ${centroid.toFixed(0).padStart(9)}Hz`);
    }
    // 最關鍵的兩項：高頻不能是主體、centroid 要落在錄音的量級
    ok(out["6000+"] < 5, "6kHz 以上不能超過 5%（阿朗壹 ≈0%；這是「白噪音很假」的量化判準）",
       `${out["6000+"].toFixed(1)}%`);
    ok(out["2000-6000"] < 12, "2–6kHz 要壓在 12% 以下（阿朗壹 1.3%）", `${out["2000-6000"].toFixed(1)}%`);
    ok(out["20-120"] + out["120-500"] > 40, "低頻＋低中頻要過半數的量級（阿朗壹 58%）",
       `${(out["20-120"] + out["120-500"]).toFixed(1)}%`);
    ok(centroid < 1200, "spectral centroid 要落在錄音的量級（阿朗壹 428Hz）", `${centroid.toFixed(0)}Hz`);
    const err = Object.keys(ALANGYI).reduce((s, k) => s + Math.abs(out[k] - ALANGYI[k]), 0);
    ok(err < 60, "頻帶絕對誤差合計要小於 60%", `${err.toFixed(1)}%`);
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
