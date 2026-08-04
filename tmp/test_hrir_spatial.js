#!/usr/bin/env node
/**
 * 對拍測試：web/index.html 的實測 HRIR 空間定位（Pan 2026-08-04 在 bench 選了 C 路）。
 *
 * 沿用 tmp/sim_grip_nocalib.js / tmp/test_foa_encode.js 的模式：regex 從 index.html
 * 抽**真正的**常數與函式出來跑，並且**讀真的 IR 檔**當真值——不在這裡重寫一份邏輯，
 * 也不用假資料（重寫的話測的就不是上線的碼了）。
 *
 * 兩件事是「寫錯不會報錯、只會聽起來怪」的，所以是這支測試的重點：
 *   1. **方位角慣例**：這個資料集是逆時針遞增的，所以「右邊」要對到 360−角度。
 *      搞反的話聲音完全正常、只是左右相反——沒有測試絕對抓不到。
 *   2. **makeup 補償係數**：抄錯或漏掉，低頻層會整體掉 10–14dB＝悄悄把 Pan 依阿朗壹
 *      錄音調好的平衡改掉。這裡直接從真 IR 重算一次，跟碼裡的常數對。
 *
 * 用法：node tmp/test_hrir_spatial.js
 */
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const HRIR = path.join(ROOT, "assets", "hrir");
// 中文版與英文版的音訊結構必須一致（Pan 每次都要求「同步」），所以同一組結構斷言
// 對兩個頁面各跑一次。差異只允許出現在使用者看到的字（log 訊息、HUD 提示）。
const PAGES = [
  { label: "zh", file: path.join(ROOT, "web", "index.html") },
  { label: "en", file: path.join(ROOT, "web", "en", "index.html") },
];
for (const p of PAGES) p.src = fs.readFileSync(p.file, "utf8");
const src = PAGES[0].src;

let passed = 0;
const failures = [];
let pageTag = "";                 // 跑雙頁斷言時，失敗訊息要標出是哪一頁
function ok(cond, label, detail) {
  if (cond) { passed++; return; }
  failures.push(pageTag + label + (detail ? `  ← ${detail}` : ""));
}
function near(a, b, tol, label) {
  ok(Math.abs(a - b) <= tol, label, `${a.toFixed(3)} 不在 ${b}±${tol}`);
}

// ── 讀真的 WAV（float32 stereo；不用任何套件，跟 duck-hunt 的 test_hrir_loudness 一樣）──
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
  const tag = fmt.readUInt16LE(0), ch = fmt.readUInt16LE(2), sr = fmt.readUInt32LE(4);
  const bits = fmt.readUInt16LE(14);
  if (tag !== 3 || bits !== 32) throw new Error(`${path.basename(p)} 不是 float32：tag=${tag} bits=${bits}`);
  const n = data.length / 4;
  const chans = Array.from({ length: ch }, () => []);
  for (let i = 0; i < n; i++) chans[i % ch].push(data.readFloatLE(i * 4));
  return { sr, chans };
}

console.log("=== 實測 HRIR 空間定位 對拍測試 ===\n");

// ─────────────────────────────────────────────────────────────────────────────
console.log("[1] 資料集在、而且是真的 HRIR（不是房間 IR）");
const manifest = JSON.parse(fs.readFileSync(path.join(HRIR, "manifest.json"), "utf8"));
{
  ok(manifest.length === 90, "manifest 應有 90 個水平面方位角", `${manifest.length} 個`);
  ok(manifest.every(e => e.ele === 0), "只收 ele=0（Tidal 的層都在水平面）");
  const missing = manifest.filter(e => !fs.existsSync(path.join(HRIR, e.name)));
  ok(missing.length === 0, "manifest 列的檔案都要真的在", missing.map(m => m.name).join(","));
  // 涵蓋完整 360°：Tidal 的聲源會繞到後面（不像 duck-hunt 的鴨子只在前方）
  const az = manifest.map(e => e.azi).sort((a, b) => a - b);
  ok(az[0] === 0 && az[az.length - 1] >= 355, "要涵蓋完整 360°", `${az[0]}..${az[az.length - 1]}`);
  let maxGap = 0;
  for (let i = 1; i < az.length; i++) maxGap = Math.max(maxGap, az[i] - az[i - 1]);
  ok(maxGap <= 5, "相鄰方位角間距不超過 5°（繞圈才不會有階梯感）", `最大 ${maxGap}°`);

  // 這批是不是真的 HRIR？duck-hunt 的 .gitignore 把來源池標成「MeshRIR」，但 MeshRIR
  // 是房間麥克風陣列（全向麥克風、沒有頭），ILD 會接近 0。真 HRIR 在 90° 有大 ILD。
  const at = (a) => readIr(path.join(HRIR, `ir_azi${String(a).padStart(3, "0")}_ele000.wav`));
  const energy = (d) => d.reduce((s, v) => s + v * v, 0);
  const ild = (r) => 10 * Math.log10(energy(r.chans[0]) / energy(r.chans[1]));
  const peak = (d) => d.reduce((bi, v, i, arr) => Math.abs(v) > Math.abs(arr[bi]) ? i : bi, 0);
  const itdUs = (r) => (peak(r.chans[1]) - peak(r.chans[0])) / r.sr * 1e6;

  const a0 = at(0), a90 = at(90), a270 = at(270);
  ok(Math.abs(ild(a0)) < 4, "正前方的 ILD 要接近 0", `${ild(a0).toFixed(1)}dB`);
  ok(ild(a90) > 12, "90° 要有大的耳間音量差＝這是人頭量的，不是全向麥克風對",
     `${ild(a90).toFixed(1)}dB`);
  ok(ild(a270) < -12, "270° 的 ILD 要反號（左右對稱）", `${ild(a270).toFixed(1)}dB`);
  // ITD 要在人頭的量級：太大就代表不是頭（或是 phase-wrap 假影）
  ok(itdUs(a90) > 300 && itdUs(a90) < 800, "90° 的 ITD 要落在人頭量級（300–800µs）",
     `${itdUs(a90).toFixed(0)}µs`);
  near(itdUs(a270), -itdUs(a90), 120, "270° 的 ITD 要跟 90° 反號且對稱");
  // 90° 是**左耳**——這是整個角度慣例的錨點（duck-hunt 也是量出來的，不是猜的）
  ok(energy(a90.chans[0]) > energy(a90.chans[1]), "90° 是左耳（角度慣例的錨點）");
  ok(a0.sr === 48000, "取樣率要是 48kHz", `${a0.sr}`);
  ok(a0.chans[0].length === 256, "256 taps", `${a0.chans[0].length}`);
}

// ─────────────────────────────────────────────────────────────────────────────
// [2]~[6] 是結構斷言：中文版與英文版**各跑一次**（兩頁必須同步）
PAGES.forEach((page, pi) => {
  pageTag = `(${page.label}) `;
  if (pi === 0) console.log("[2] 角度慣例：pan 正值＝右邊＝資料集的 360−角度");
  {
    const src = page.src;
    // 從 index.html 抽**真的** nearest()，不重寫
    const bankSrc = src.match(/nearest\(target\)\{[\s\S]*?\n  \}/);
    ok(!!bankSrc, "要找得到 HrirBank.nearest()");
    const azimuths = manifest.map(e => e.azi).sort((a, b) => a - b);
    const nearest = new Function("azimuths", `
      const self = { azimuths, ${bankSrc[0].replace(/^nearest\(target\)\{/, "nearest(target){")} };
      return (t) => self.nearest(t);`)(azimuths);

    // 這是 setDirection 裡的真實轉換（一起抽出來對，避免我在測試裡自己寫一份而寫對了）
    const conv = src.match(/const azDeg = [^\n]*\n\s*const want = this\.bank\.nearest\(([^)]*)\)/);
    ok(!!conv, "要找得到 pan → 方位角的轉換");
    ok(/360\s*-\s*azDeg/.test(conv[1]), "轉換必須是 360−azDeg（這個資料集逆時針遞增）", conv[1]);

    const forPan = (pan) => {
      const azDeg = Math.max(-1, Math.min(1, pan)) * 90;
      return nearest(((360 - azDeg) % 360 + 360) % 360);
    };
    const energy = (d) => d.reduce((s, v) => s + v * v, 0);
    const earsOf = (name) => {
      const r = readIr(path.join(HRIR, name));
      return { L: energy(r.chans[0]), R: energy(r.chans[1]) };
    };
    // 決定性的一項：pan=+1（右）挑到的 IR，右耳必須比左耳大聲。
    const right = earsOf(forPan(1));
    ok(right.R > right.L, "pan=+1（右）挑到的 IR，右耳要比左耳大聲（左右搞反的唯一守門）",
       `L=${right.L.toExponential(2)} R=${right.R.toExponential(2)}`);
    const left = earsOf(forPan(-1));
    ok(left.L > left.R, "pan=-1（左）挑到的 IR，左耳要比右耳大聲");
    ok(forPan(1) === "ir_azi270_ele000.wav", "pan=+1 要挑到 270°", forPan(1));
    ok(forPan(-1) === "ir_azi090_ele000.wav", "pan=-1 要挑到 90°", forPan(-1));
    ok(forPan(0) === "ir_azi000_ele000.wav", "pan=0 要挑到正前方 0°", forPan(0));
    // 單調：從左掃到右，ILD（右耳−左耳，dB）要一路變大——這才是「聽起來往右移」的量。
    //
    // 注意這裡量的是 ILD 而**不是**右耳的絕對能量：各方向 IR 的總能量本來就參差不齊
    // （這正是碼裡要做 per-IR L2 正規化的原因），拿絕對能量當單調性判準會誤判。
    //
    // 而且只驗到 |pan| ≤ 0.8：真實 HRTF 的 ILD 極大值出現在 80° 附近而非正 90°
    // （頭部遮蔽 / bright-spot），90° 反而略降。那是量到的生理現象，不是接線錯。
    const ildOf = (name) => {
      const e = earsOf(name);
      return 10 * Math.log10(e.R / e.L);
    };
    let prev = -Infinity, badAt = null;
    for (let i = -80; i <= 80; i++) {
      const v = ildOf(forPan(i / 100));
      if (v < prev - 1e-9) { badAt = i / 100; break; }
      prev = Math.max(prev, v);
    }
    ok(badAt === null, "|pan|≤0.8 內，ILD 要嚴格單調遞增（聲音一路往右移）",
       badAt === null ? "" : `在 pan=${badAt.toFixed(2)} 反轉`);
    // 側邊仍要維持強烈的偏側感（即使不是極大值）
    ok(ildOf(forPan(1)) > 15, "pan=+1 的 ILD 仍要 >15dB（強烈偏右）", `${ildOf(forPan(1)).toFixed(1)}dB`);
    ok(ildOf(forPan(-1)) < -15, "pan=-1 的 ILD 仍要 <−15dB（強烈偏左）", `${ildOf(forPan(-1)).toFixed(1)}dB`);
    // 繞圈：358° 距離 2° 只有 4°，不能挑到頭的另一邊
    ok(nearest(359) === "ir_azi358_ele000.wav" || nearest(359) === "ir_azi000_ele000.wav",
       "359° 要挑到 358 或 0（繞圈處理）", nearest(359));
    ok(/Math\.min\(Math\.abs\(a - target\), 360 - Math\.abs\(a - target\)\)/.test(bankSrc[0]),
       "nearest 必須用繞圈距離（不然正面附近會挑到頭的另一邊）");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[3] makeup 補償係數：從真 IR 重算，跟碼裡的常數對");
  {
    const src = page.src;
    const mkSrc = src.match(/const SPATIAL_MAKEUP = \{[^}]*\}/);
    ok(!!mkSrc, "要找得到 SPATIAL_MAKEUP");
    const MK = new Function("return " + mkSrc[0].replace("const SPATIAL_MAKEUP = ", ""))();

    const HRIR_MATCH = Number((src.match(/const HRIR_MATCH = ([\d.]+)/) || [])[1]);
    const HRIR_MIN_NORM = Number((src.match(/const HRIR_MIN_NORM = ([\d.]+)/) || [])[1]);
    ok(HRIR_MATCH > 0.5 && HRIR_MATCH < 1.5, "HRIR_MATCH 要在合理範圍", String(HRIR_MATCH));

    // 每層的頻帶＝index.html 裡**真正的**濾波器設定
    const bands = {
      surge: [120, 800], foam: [1500, 6000], pebble: [120, 700], bubble: [220, 460], shore: [120, 640],
    };
    // 檢查頻帶真的對應到碼裡的濾波器（不然這張表會跟程式脫節）
    ok(/this\.surgeLP\.frequency\.value = 800/.test(src), "surge 濾波器是 LP800");
    ok(/this\.foamHP\.frequency\.value = 1500/.test(src), "foam 濾波器是 HP1500");
    ok(/this\.pebbleBP\.frequency\.value = 700/.test(src), "pebble 濾波器是 LP700");
    ok(/this\.bubbleBP\.frequency\.value = 320/.test(src), "bubble 濾波器是 BP320");
    ok(/lp\.frequency\.value = 640/.test(src), "shore 濾波器是 LP640");

    const files = manifest.map(e => e.name);
    const cache = files.map(n => {
      const r = readIr(path.join(HRIR, n));
      let sum = 0;
      for (const d of r.chans) for (const v of d) sum += v * v;
      const norm = Math.sqrt(sum / r.chans.length);
      return { r, gain: HRIR_MATCH / Math.max(norm, HRIR_MIN_NORM) };
    });
    const bandPower = ({ r, gain }, f0, f1, n = 13) => {
      let tot = 0;
      for (let k = 0; k < n; k++) {
        const f = f0 * Math.pow(f1 / f0, k / (n - 1));
        const w = 2 * Math.PI * f / r.sr;
        for (const d of r.chans) {
          let re = 0, im = 0;
          for (let i = 0; i < d.length; i++) { re += d[i] * Math.cos(w * i); im -= d[i] * Math.sin(w * i); }
          tot += (re * gain) ** 2 + (im * gain) ** 2;
        }
      }
      return tot / n;
    };
    const median = (v) => v.slice().sort((a, b) => a - b)[v.length >> 1];
    for (const [layer, [f0, f1]] of Object.entries(bands)) {
      const m = median(cache.map(c => bandPower(c, f0, f1)));
      const want = 1 / Math.sqrt(m);          // 要補回 0dB 的倍數
      ok(MK[layer] !== undefined, `SPATIAL_MAKEUP 要有 ${layer}`);
      // 5% 容忍：常數是 3 位有效位數寫死的
      ok(Math.abs(MK[layer] - want) / want < 0.05,
         `${layer} 的 makeup 要等於真 IR 量出來的值`,
         `碼裡 ${MK[layer]}，量到 ${want.toFixed(2)}`);
    }
    // foam 是唯一在 1.5kHz 以上的層，補償應該小於 1（HRIR 在那裡反而略增）
    ok(MK.foam < 1, "foam 的補償要小於 1（高頻反而略增）", String(MK.foam));
    // 低頻層一定要大幅補
    ok(MK.bubble > 4, "bubble 要補最多（BP320 掉 13.7dB）", String(MK.bubble));
    // 每層都要真的接上 makeup 節點——常數寫對但沒接等於沒補
    for (const layer of ["surge", "foam", "pebble"]) {
      const mk = layer + "Mk";
      ok(new RegExp(`this\\.${mk}\\.gain\\.value = SPATIAL_MAKEUP\\.${layer}`).test(src),
         `${layer} 要把 SPATIAL_MAKEUP.${layer} 指給 ${mk}`);
      ok(new RegExp(`this\\.${layer}Gain\\.connect\\(this\\.${mk}\\)`).test(src),
         `${layer}Gain 要接進 ${mk}`);
      ok(new RegExp(`this\\.${mk}\\.connect\\(this\\.busIn\\)`).test(src),
         `${mk} 要接進 busIn（不接＝補償沒生效）`);
    }
    // bubble / shore 走 HrirSource 的 makeup 參數
    ok(/new HrirSource\(ctx, this\.hrir, SPATIAL_MAKEUP\.bubble/.test(src),
       "bubble 的 HrirSource 要吃 SPATIAL_MAKEUP.bubble");
    ok(/new HrirSource\(ctx, this\.hrir, SPATIAL_MAKEUP\.shore/.test(src),
       "shore 的 HrirSource 要吃 SPATIAL_MAKEUP.shore");
    // 主匯流排的 HrirSource 必須是 1：surge/foam/pebble 混在上面，三者需要的補償不同，
    // 掛在匯流排上只會有一個值＝一定有兩層是錯的。
    ok(/this\.mainSpatial = new HrirSource\(ctx, this\.hrir, 1, this\.panner\)/.test(src),
       "主匯流排的 HrirSource makeup 必須是 1（補償在各層自己身上）");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[4] 訊號鏈的三個硬規則");
  {
    const src = page.src;
    ok(/c\.normalize = false/.test(src),
       "convolver 必須 normalize=false（正規化會抹平實測的 ILD）");
    // 卷積前單聲道化：立體聲來源（pebble / wide）的立體聲影像會汙染 HRIR 的左右耳資訊。
    // 必須連 channelCount 一起檢查——只找 channelCountMode 會被別處的 explicit 蓋過。
    ok(/this\.mono\.channelCount = 1;[\s\S]{0,160}this\.mono\.channelCountMode = "explicit";/.test(src),
       "卷積前要強制單聲道：要同時設 channelCount=1 與 explicit");
    // 聲音永遠成立
    ok(/this\.bypass\.gain\.value = 1/.test(src),
       "旁路預設要開（IR 還沒到時不能沒聲音）");
    ok(/this\.hrir\.load\(\)/.test(src) && !/await this\.hrir\.load\(\)/.test(src),
       "HRIR 載入不能 await（會擋住建圖＝一開始沒聲音）");
    // 交叉淡化：Tidal 的層是持續發聲且會移動的，直接換 buffer 會有喀聲
    ok(/linearRampToValueAtTime\([^)]*now \+ HRIR_FADE\)/.test(src),
       "換角度要交叉淡化（平滑不跳變）");
    const fade = Number((src.match(/const HRIR_FADE = ([\d.]+)/) || [])[1]);
    ok(fade > 0.02 && fade < 0.2, "HRIR_FADE 要在合理範圍（太短會喀、太長會糊）", String(fade));
    // per-IR 增益補償：那批 IR 各方向能量差很多，一個固定倍數不可能對。
    // 兩個進入點都要有：setDirection（換角度）和 setEnabled（H 鍵切回來）。
    // 只驗一處的話，另一處被改掉會漏——突變測試就是這樣抓到的。
    const normSites = (src.match(/HRIR_MATCH \/ Math\.max\(this\.bank\.norm\([^)]*\), HRIR_MIN_NORM\)/g) || []);
    ok(normSites.length >= 2,
       "setDirection 與 setEnabled 兩處都要有 per-IR 的 L2 norm 增益補償",
       `只找到 ${normSites.length} 處`);
    ok(/setDirection\([\s\S]*?HRIR_MATCH \/ Math\.max\(this\.bank\.norm/.test(src),
       "setDirection 裡要做 per-IR 正規化");
    ok(/setEnabled\(on\)\{[\s\S]*?HRIR_MATCH \/ Math\.max\(this\.bank\.norm/.test(src),
       "setEnabled 裡要做 per-IR 正規化（H 鍵切回來時音量才一致）");
    // 非定位層要維持繞過空間化（低頻本就無方向性）
    ok(/this\.subGain\.connect\(this\.clip\)/.test(src), "sub 低頻床要繞過空間化");
    ok(/this\.wideGain\.connect\(this\.clip\)/.test(src), "wide 海床要繞過空間化");
    ok(/this\.shimmerGain\.connect\(this\.dry\)/.test(src),
       "shimmer 是「一片」水光、刻意不過點聲源定位");
  }

  // ─────────────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[5] shimmer 的相對音量（Pan 2026-08-04 的要求）");
  {
    const src = page.src;
    const lvl = Number((src.match(/const SHIMMER_LEVEL = ([\d.]+)/) || [])[1]);
    ok(!Number.isNaN(lvl), "要找得到 SHIMMER_LEVEL");
    ok(lvl > 1, "Pan 要求「再大點」，所以必須 > 1", String(lvl));
    // 有界參數：不能大到蓋掉海（guardrail「有界，不自由生成」）
    ok(lvl <= 2.5, "但要有界：不能大到蓋掉海濤", String(lvl));
    // 必須乘在整條上＝保留隨能量起伏的動態，而不是只把基底墊高（那會變成持續電平音）
    ok(/SHIMMER_LEVEL \* \(0\.012 \+ 0\.044 \* energy \+ 0\.012 \* swell\)/.test(src),
       "SHIMMER_LEVEL 要乘在整個 causticAmt 上（保住呼吸感）");
    // 上限仍受 clamp 保護
    ok(/const causticAmt = clamp\(SHIMMER_LEVEL/.test(src), "causticAmt 仍要被 clamp 限幅");
    // 實際峰值：energy=1、swell=1 的最大情形
    const peak = lvl * (0.012 + 0.044 + 0.012);
    ok(peak < 0.25, "shimmer 峰值增益要遠低於主浪（它是點綴，不是主體）", peak.toFixed(3));
    if (pi === 0) console.log(`      SHIMMER_LEVEL=${lvl} → 峰值 ${peak.toFixed(3)}（原本 ${(peak / lvl).toFixed(3)}，+${(20 * Math.log10(lvl)).toFixed(1)}dB）`);
  }

  // ─────────────────────────────────────────────────────────────────────────────
  if (pi === 0) console.log("[6] 退回與 A/B 對照");
  {
    const src = page.src;
    // 載不到 IR 時要走內建 panner，而且不能沒聲音
    ok(/this\.fallback = fallback/.test(src), "HrirSource 要收一個退回用的 panner");
    ok(/if\(fallback\)\{ this\.bypass\.connect\(fallback\); fallback\.connect\(this\.output\); \}/.test(src),
       "退回路徑要接起來");
    // 載不到要說明（不能靜默降級）。兩頁的字不一樣：這是**應該**不同的部分。
    const fallbackMsg = page.label === "zh" ? /未載入 HRIR/ : /HRIR not loaded/;
    ok(fallbackMsg.test(src), "載不到要在 log 說明（而不是靜默降級）");
    // H 鍵 A/B：Pan 選了 C，但要能再確認一次
    ok(/setHrirEnabled/.test(src), "要有 setHrirEnabled（H 鍵 A/B）");
    ok(/e\.key === "h" \|\| e\.key === "H"/.test(src), "要綁 H 鍵");
    ok(/setEnabled\(on\)\{/.test(src), "HrirSource 要有 setEnabled");
    // 固定方位的聲源在 bank 載完後要補設一次（左右岸浪只在建構時設一次角度）
    ok(/reapplyFixedDirections/.test(src), "要有 reapplyFixedDirections（左右岸浪的固定角度）");
    ok(/this\.hrir\.load\(\)\.then\(ok => \{ if\(ok\) this\.reapplyFixedDirections\(\)/.test(src),
       "載完 HRIR 要重設固定方位的聲源");
    // 一次性音效刻意留在內建 panner——記錄現況，免得下一位以為是漏了
    ok(/impact \/ cue \/ glint）刻意留在內建 HRTF panner/.test(src),
       "一次性音效留在內建 panner 這件事要寫在碼裡（是決定，不是漏掉）");
    ok(/this\.impactPanner\.panningModel = "HRTF"/.test(src), "impact 仍用內建 panner");
    // 主頁不能**依賴** bench 或 Omnitone（tmp/test_foa_encode.js [10] 的原意）。
    // 註解裡提到 spatial_bench.html 是出處紀錄、不是依賴，所以這裡驗的是「有沒有真的
    // 載進來」：script src / import / fetch。舊測試那條 `!/spatial_bench/` 是整檔字串比對，
    // 對註解會誤報——見 AGENTS.md 2026-08-04 (c)，那條要改成同樣的寫法。
    ok(!/omnitone/i.test(src), "主頁不能載入 Omnitone（未選用那條路）");
    const loads = src.match(/(?:src|href)\s*=\s*["'][^"']*spatial_bench[^"']*["']|import[^\n]*spatial_bench|fetch\([^)]*spatial_bench/gi) || [];
    ok(loads.length === 0, "主頁不能載入/引入 bench（註解提及不算）", loads.join(" / "));
  }

  // ─────────────────────────────────────────────────────────────────────────────
});
pageTag = "";

console.log("[7] 引用義務與資料集標示");
{
  const readme = fs.readFileSync(path.join(HRIR, "README.md"), "utf8");
  // duck-hunt 的 .gitignore 把來源標成 MeshRIR，但實測證明不是（見 [1]）。
  // 這件事必須寫下來，否則會傳成錯的引用。兩處說法都要在（用 AND 不是 OR：
  // 只改掉一處的話 OR 會讓錯誤溜過去——突變測試就是這樣抓到的）。
  ok(/標示是錯的/.test(readme), "README 要明說 duck-hunt 那個「MeshRIR」標示是錯的");
  ok(/不是 MeshRIR/.test(readme),
     "README 要說明結論：這批不是 MeshRIR（實測 ILD 20dB ≠ 全向麥克風對）");
  ok(/仍未確認/.test(readme), "README 要誠實說明原始資料集仍未確認");
  ok(/來源待確認/.test(readme), "README 要指出頁面上的引用區塊寫的是「來源待確認」");
  // 反面守門：不能在未確認的情況下把某個資料集寫成事實。
  const claims = readme.match(/[^\n]*(SADIE|ARI|CIPIC|HUTUBS|Listen)[^\n]*/gi) || [];
  const unhedged = claims.filter(l => !/不要|未確認|待確認|比較接近|在確認之前|之前不要/.test(l));
  ok(unhedged.length === 0, "不能在未確認的情況下把某個資料集寫成來源（不要編引用）",
     unhedged.join(" / "));
  ok(/授權/.test(readme), "README 要提到發佈前要確認授權");
  // room.wav 是另一件事，它的 CC BY 4.0 標註不能被搞混或弄掉
  const irReadme = fs.readFileSync(path.join(ROOT, "assets", "ir", "README.md"), "utf8");
  ok(/Koyama/.test(irReadme), "room.wav 的 MeshRIR 標註（CC BY 4.0）要還在");
  ok(/room\.wav 無關|房間殘響/.test(readme), "README 要區分 HRIR（方向）與 room.wav（房間）");
}

// ─────────────────────────────────────────────────────────────────────────────
console.log("\n" + "=".repeat(60));
if (failures.length) {
  console.log(`${passed} 項通過，${failures.length} 項失敗：\n`);
  failures.forEach((f) => console.log("  ✗ " + f));
  process.exit(1);
}
console.log(`全部通過：${passed} 項斷言。`);
