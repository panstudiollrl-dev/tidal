#!/usr/bin/env node
/**
 * 突變測試：驗證 tmp/test_hrir_spatial.js 與 tmp/check_alangyi_match.js 真的會擋下錯誤，
 * 而不是只會通過。
 *
 * 做法：把 web/index.html 複製一份、注入一個真實可能犯的錯、跑測試、看它是否失敗。
 * 每個突變都是「寫成這樣不會報錯、只會聽起來怪」的那種——正是需要測試守門的。
 *
 * 用法：node tmp/mutate_hrir_spatial.js
 */
const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");

const ROOT = path.join(__dirname, "..");
// 兩個頁面都要突變一次：en 版是複製過去的，最容易發生「只改了 zh 版」的漏同步。
const PAGE_FILES = [path.join(ROOT, "web", "index.html"), path.join(ROOT, "web", "en", "index.html")];
const HRIR = path.join(ROOT, "assets", "hrir");
const ORIG = PAGE_FILES.map(f => fs.readFileSync(f, "utf8"));
const readmePath = path.join(HRIR, "README.md");
const origReadme = fs.readFileSync(readmePath, "utf8");

// 每項：[說明, 改 html 的函式] 或 [說明, null, 改 README 的函式]
const MUTANTS = [
  ["方位角轉換少了 360− ＝ 左右完全相反",
   s => s.replace("this.bank.nearest(((360 - azDeg) % 360 + 360) % 360)",
                  "this.bank.nearest((azDeg % 360 + 360) % 360)")],
  ["nearest 用直線距離、沒處理繞圈 ＝ 正面附近會挑到頭的另一邊",
   s => s.replace("Math.min(Math.abs(a - target), 360 - Math.abs(a - target))",
                  "Math.abs(a - target)")],
  ["convolver 開了 normalize ＝ 抹平實測的 ILD、方向感消失",
   s => s.replace(/c\.normalize = false/g, "c.normalize = true")],
  ["漏掉 channelCount = 1 ＝ 立體聲影像汙染 HRIR 的耳間資訊",
   s => s.replace("this.mono.channelCount = 1;", "")],
  // makeup 的值在 2026-08-04 全部塌回 ~1（傾斜改由 HRIR_TILT_FIX 處理），所以這幾個
  // 突變改成「留著舊的 3–5 倍」＝同一個傾斜被補兩次（低頻轟）。
  ["makeup 還留著舊的 3–5 倍 ＝ 傾斜被修正鏈與 makeup 補了兩次（低頻轟）",
   s => s.replace(/const SPATIAL_MAKEUP = \{[^}]*\}/,
                  "const SPATIAL_MAKEUP = { surge: 3.11, foam: 0.85, pebble: 3.61, bubble: 4.82, shore: 4.10 }")],
  ["surge 完全沒補償（1.02 → 1 之外的極端值）＝ 主浪音量錯",
   s => s.replace("surge: 1.02", "surge: 0.2")],
  ["foam 的補償方向搞反（0.98 → 1.6）",
   s => s.replace("foam: 0.98", "foam: 1.6")],
  // ── 傾斜修正鏈本身（2026-08-04 新增，Pan「頻帶差很多／白噪音很假」的主要修法）──
  ["整條傾斜修正鏈拿掉 ＝ 回到 26.9dB 上斜（Pan 聽到的「白噪音很假」）",
   s => s.replace("g.connect(this.tilt);", "g.connect(this.output);")],
  ["修正鏈的低頻抬升拿掉 ＝ 低頻仍然掉 20dB",
   s => s.replace('{ type: "lowshelf",  f: 250,  q: 0.5, gain: 15.6 }',
                  '{ type: "lowshelf",  f: 250,  q: 0.5, gain: 0 }')],
  ["修正鏈變成把傾斜加倍（增益正負號反了）",
   s => s.replace("gain: 15.6 }", "gain: -15.6 }")],
  ["修正鏈的總 trim 拿掉 ＝ 整體音量差 2.2dB",
   s => s.replace(/const HRIR_TILT_TRIM = [\d.]+/, "const HRIR_TILT_TRIM = 1.0")],
  ["修正鏈接在卷積**之前** ＝ 左右耳各修一次、而且順序錯",
   s => s.replace("this.mono.connect(c); c.connect(g); g.connect(this.tilt);",
                  "this.mono.connect(this.tilt); this.tilt.connect(c); c.connect(g); g.connect(this.output);")],
  // ── pink 噪音（白噪音很假的第二個成因）──
  ["surge 回到白噪音（Pan：「模仿海浪的白噪音很假」）",
   s => s.replace("this.noise = OceanEngine.pinkNoiseSource(ctx)", "this.noise = OceanEngine.noiseSource(ctx)")],
  ["foam 回到白噪音",
   s => s.replace("this.noise2 = OceanEngine.pinkNoiseSource(ctx)", "this.noise2 = OceanEngine.noiseSource(ctx)")],
  // 名字叫 pink、實際輸出卻是平的：−3dB/oct 的斜率全部拿掉（極點都設成 0＝各級變成純增益）。
  ["pink 濾波器其實是白的（名字對、頻譜平）",
   s => s.replace("d[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + w * 0.5362) * 0.11;",
                  "d[i] = w * 0.577;")],
  // ── foam 的頂端蓋子（嘶到聽力上限＝電視雜訊感）──
  ["foam 的頂端蓋子拿掉 ＝ 嘶到 24kHz（阿朗壹 6k+ 幾乎 0%）",
   s => s.replace("this.foamHP.connect(this.foamLP)", "this.foamHP.connect(this.foamGain)")],
  ["foam 的蓋子開到 20kHz ＝ 等於沒有蓋子",
   s => s.replace("this.foamLP.frequency.value = 8000", "this.foamLP.frequency.value = 20000")],
  // ── pebble 的靜止底量（Pan：「pebble 的聲音幾乎都是沒有的」）──
  ["pebble 沒有靜止底量 ＝ 不握球就實質靜音（Pan 說幾乎聽不到）",
   s => s.replace(/const PEBBLE_FLOOR = [\d.]+/, "const PEBBLE_FLOOR = 0.03")],
  ["PEBBLE_FLOOR 定了但沒接上 ＝ 常數寫對、聲音還是沒有",
   s => s.replace("PEBBLE_FLOOR", "0.030")],
  ["surgeMk 建了但沒接進 busIn ＝ 補償等於沒生效",
   s => s.replace("this.surgeMk.connect(this.busIn)", "this.surgeMk.connect(this.dry)")],
  ["surgeGain 直接接 busIn、繞過補償節點",
   s => s.replace("this.surgeGain.connect(this.surgeMk)", "this.surgeGain.connect(this.busIn)")],
  ["主匯流排掛了 makeup ＝ surge/foam/pebble 三層共用一個值，必有兩層錯",
   s => s.replace("this.mainSpatial = new HrirSource(ctx, this.hrir, 1, this.panner)",
                  "this.mainSpatial = new HrirSource(ctx, this.hrir, SPATIAL_MAKEUP.surge, this.panner)")],
  ["shore 的 HrirSource 忘了帶 makeup ＝ 岸浪掉 12.3dB",
   s => s.replace("new HrirSource(ctx, this.hrir, SPATIAL_MAKEUP.shore", "new HrirSource(ctx, this.hrir, 1")],
  ["bubble 的 HrirSource 忘了帶 makeup",
   s => s.replace("new HrirSource(ctx, this.hrir, SPATIAL_MAKEUP.bubble", "new HrirSource(ctx, this.hrir, 1")],
  ["await HRIR 載入 ＝ 擋住建圖，一開始沒聲音",
   s => s.replace("this.hrir.load().then", "await this.hrir.load(); Promise.resolve().then")],
  ["旁路預設關掉 ＝ IR 還沒到時整段靜音（違反「聲音永遠成立」）",
   s => s.replace("this.bypass.gain.value = 1", "this.bypass.gain.value = 0")],
  ["換角度直接設值、不交叉淡化 ＝ 會有喀聲（違反「平滑不跳變」）",
   s => s.replace(/linearRampToValueAtTime\(([^,]*), now \+ HRIR_FADE\)/g, "setValueAtTime($1, now)")],
  ["HRIR_FADE 設成 0 ＝ 等於不淡化",
   s => s.replace(/const HRIR_FADE = [\d.]+/, "const HRIR_FADE = 0")],
  ["拿掉全部 per-IR 的 L2 正規化 ＝ 各方向音量參差不齊、掃過去會忽大忽小",
   s => s.replace(/HRIR_MATCH \/ Math\.max\(this\.bank\.norm\([^)]*\), HRIR_MIN_NORM\)/g, "1")],
  ["shimmer 沒調大（Pan 明確要求「再大點」）",
   s => s.replace(/const SHIMMER_LEVEL = [\d.]+/, "const SHIMMER_LEVEL = 1.0")],
  ["shimmer 調到蓋掉海濤（有界參數的上界）",
   s => s.replace(/const SHIMMER_LEVEL = [\d.]+/, "const SHIMMER_LEVEL = 6")],
  ["shimmer 只把基底墊高、沒乘在整條上 ＝ 失去呼吸感、變持續電平音",
   s => s.replace("clamp(SHIMMER_LEVEL * (0.012 + 0.044 * energy + 0.012 * swell))",
                  "clamp((SHIMMER_LEVEL - 1) * 0.03 + 0.012 + 0.044 * energy + 0.012 * swell)")],
  // 2026-08-05 之後 shimmer 走自己的 dry gain（shimDry），所以這個變異要改打新的接線。
  ["shimmer 被拿去做點聲源定位（它是一片水光，不是點）",
   s => s.replace("shimDry.connect(this.dry)", "shimDry.connect(this.busIn)")],
  // ── shimmer 的距離感（Pan 2026-08-05：「太遠了，幾乎感覺不到」）──────────────
  ["shimmer 又吃回全域的乾濕比（＝回到 Pan 聽到的「太遠」）",
   s => s.replace(/const SHIMMER_DRY = [\d.]+/, "const SHIMMER_DRY = 1.0")
         .replace(/const SHIMMER_WET = [\d.]+/, "const SHIMMER_WET = 1.0")],
  ["用「調小 wet」換距離感（D/R 對了但總能量掉了＝還是感覺不到）",
   s => s.replace(/const SHIMMER_DRY = [\d.]+/, "const SHIMMER_DRY = 1.0")
         .replace(/const SHIMMER_WET = [\d.]+/, "const SHIMMER_WET = 0.15")],
  ["shimmer 變全乾（貼耳的乾硬電子音，失去水面的空間）",
   s => s.replace(/const SHIMMER_WET = [\d.]+/, "const SHIMMER_WET = 0")],
  ["藉乾濕比把 shimmer 偷偷放大成主角（有界參數的上界）",
   s => s.replace(/const SHIMMER_DRY = [\d.]+/, "const SHIMMER_DRY = 8")],
  ["shimmer 的 wet 接線被拿掉（沒有房間＝距離線索全失）",
   s => s.replace("this.shimmerGain.connect(shimWet); shimWet.connect(this.convolver);", "")],
  ["sub 低頻床被送去空間化（低頻本就無方向性）",
   s => s.replace("this.subGain.connect(this.clip)", "this.subGain.connect(this.busIn)")],
  ["載完 HRIR 沒重設固定方位 ＝ 左右岸浪永遠停在退回路徑的角度",
   s => s.replace(/this\.hrir\.load\(\)\.then\(ok => \{ if\(ok\) this\.reapplyFixedDirections\(\);?[^\n]*/,
                  "this.hrir.load();")],
  ["拿掉 H 鍵 A/B ＝ Pan 無法再用耳朵確認這個改動",
   s => s.replace(/e\.key === "h" \|\| e\.key === "H"/, 'e.key === "__never__"')],
  ["退回的 panner 沒接起來 ＝ 載不到 IR 就整段靜音",
   s => s.replace("if(fallback){ this.bypass.connect(fallback); fallback.connect(this.output); }",
                  "if(fallback){ this.fallback = fallback; }")],
  ["把「一次性音效刻意留在內建 panner」的說明刪掉 ＝ 下一位會以為是漏了",
   s => s.replace("（impact / cue / glint）刻意留在內建 HRTF panner", "（略）")],
  ["README 照抄 duck-hunt 的錯標示，說這批是 MeshRIR",
   null,
   r => r.replace(/這個標示是錯的/g, "這個標示沒問題").replace(/不是 MeshRIR/g, "就是 MeshRIR")],
  ["README 編一個沒確認過的引用（把「仍未確認」改成斷言）",
   null,
   r => r.replace(/\*\*但確切的原始資料集仍未確認\*\*/g, "**原始資料集為 SADIE II（University of York）**")
         .replace(/「來源待確認」/g, "「SADIE II」")],
  ["README 只改掉其中一處說法（半套的錯字修訂也要抓到）",
   null,
   r => r.replace("這個標示是錯的", "這個標示沒問題")],
  ["setEnabled 少了 per-IR 正規化 ＝ H 鍵切回來時音量不一致",
   s => s.replace("const irG = on ? HRIR_MATCH / Math.max(this.bank.norm(this.irName), HRIR_MIN_NORM) : 0;",
                  "const irG = on ? 1 : 0;")],
  ["setDirection 少了 per-IR 正規化 ＝ 掃過去會忽大忽小",
   s => s.replace("const g = HRIR_MATCH / Math.max(this.bank.norm(want), HRIR_MIN_NORM);",
                  "const g = 1;")],
];

const restore = () => {
  PAGE_FILES.forEach((f, i) => fs.writeFileSync(f, ORIG[i]));
  fs.writeFileSync(readmePath, origReadme);
};

let caught = 0, total = 0;
const escaped = [];

for (const [label, mutHtml, mutReadme] of MUTANTS) {
  // html 突變在**每一頁**各注入一次（只改 zh 版是最容易發生的漏同步）
  const targets = mutHtml ? PAGE_FILES.map((f, i) => [f, i]) : [[null, -1]];
  for (const [file, i] of targets) {
    total++;
    const tag = file ? `(${i === 0 ? "zh" : "en"}) ` : "";
    if (file) {
      const html = mutHtml(ORIG[i]);
      if (html === ORIG[i]) {
        escaped.push(`${tag}${label}  ← 突變沒套用（regex 對不到，兩頁可能不同步）`);
        continue;
      }
      fs.writeFileSync(file, html);
    } else {
      const readme = mutReadme(origReadme);
      if (readme === origReadme) { escaped.push(`${label}  ← 突變沒套用（regex 對不到）`); continue; }
      fs.writeFileSync(readmePath, readme);
    }
    // 兩支測試都跑：訊號鏈/角度慣例在 test_hrir_spatial.js，頻譜對阿朗壹的還原度在
    // check_alangyi_match.js。任一支失敗就算擋下——它們守的是同一份碼的不同面向。
    let died = false;
    for (const t of ["test_hrir_spatial.js", "check_alangyi_match.js"]) {
      try {
        execFileSync("node", [path.join(__dirname, t)], { stdio: "pipe" });
      } catch { died = true; break; }
    }
    restore();
    if (died) { caught++; console.log(`  ✓ 擋下  ${tag}${label}`); }
    else escaped.push(tag + label);
  }
}

console.log("\n" + "=".repeat(60));
console.log(`${caught}/${total} 個突變被擋下。`);
if (escaped.length) {
  console.log("\n漏掉的：");
  escaped.forEach(e => console.log("  ✗ " + e));
  process.exit(1);
}
