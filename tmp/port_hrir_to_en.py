#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
把 web/index.html 的實測 HRIR 定位改動同步到 web/en/index.html。

兩頁的音訊結構是一樣的，所以程式與註解原封不動搬過來；只有**使用者看到的字**換成
英文（兩句 log()、HUD 的 [H] 提示）。en 版的程式註解本來就是中文，維持現況。

每個 replace 都 assert count == 1：對不到就當場停下來，而不是靜默漏掉一處。
用法：python3 tmp/port_hrir_to_en.py
"""
import io

ZH = "web/index.html"
EN = "web/en/index.html"

zh = io.open(ZH, encoding="utf-8").read()
s = io.open(EN, encoding="utf-8").read()


def sub1(old, new):
    global s
    assert s.count(old) == 1, "對不到或不唯一（%d 次）：%r" % (s.count(old), old[:80])
    s = s.replace(old, new, 1)


# ── 1. 常數 + HrirBank + HrirSource：整塊從 zh 版搬過來 ──
block = zh[zh.index("/* ═══"):zh.index("class OceanEngine {")]
assert "class HrirSource" in block and "class HrirBank" in block and len(block) > 5000
block = block.replace(
    'log(`已載入實測 HRIR：水平面 ${this.azimuths.length} 個方位角（空間定位）。`);',
    'log(`Loaded measured HRIR: ${this.azimuths.length} horizontal azimuths (spatial imaging).`);')
block = block.replace(
    'log("未載入 HRIR，空間定位先用瀏覽器內建 HRTF（海仍成立）。");',
    'log("HRIR not loaded; spatial imaging falls back to the built-in HRTF (the sea still holds).");')
sub1("class OceanEngine {", block + "class OceanEngine {")

# ── 2. HrirBank 初始化 ──
sub1("""    this.ctx = ctx;
    this.master = ctx.createGain();""",
"""    this.ctx = ctx;
    this.hrir = new HrirBank(ctx);
    this.spatialSources = [];
    this.hrirEnabled = true;
    this.master = ctx.createGain();""")

# ── 3. 主匯流排走實測 HRIR（makeup = 1，補償在各層自己身上）──
sub1("""    this.busIn = ctx.createGain();
    this.busIn.connect(this.panner);
    this.panner.connect(this.dry);""",
"""    // 主浪聲源：實測 HRIR 卷積，退回內建 panner。makeup 放在**各層自己**身上
    // （surge / foam / pebble 混在同一條匯流排上，但三者需要的補償不一樣：
    //  3.11 / 0.85 / 3.61，掛在匯流排上只會有一個值，一定有兩層是錯的），
    // 所以這裡的 HrirSource 用 makeup = 1。
    this.mainSpatial = new HrirSource(ctx, this.hrir, 1, this.panner);
    this.spatialSources.push(this.mainSpatial);
    this.busIn = this.mainSpatial.input;
    this.mainSpatial.connect(this.dry);""")
sub1("    this.panner.connect(this.convolver);",
     "    this.mainSpatial.connect(this.convolver);")

# ── 4. 非阻塞載入（聲音永遠成立）＋ 載完補設固定方位 ──
sub1("""    this.loadIR(["../assets/ir/room.wav", "/assets/ir/room.wav", "assets/ir/room.wav", "../../assets/ir/room.wav"]);""",
"""    this.loadIR(["../assets/ir/room.wav", "/assets/ir/room.wav", "assets/ir/room.wav", "../../assets/ir/room.wav"]);
    // 不 await：載入期間先用內建 HRTF，聲音永遠成立。
    // 載完要**重設一次固定方位的聲源**（左右岸浪只在建構時設一次角度，那時 bank 還沒好；
    // 主浪與氣泡在 loop() 裡每幀都設，會自己接上，不需要處理）。
    this.hrir.load().then(ok => { if(ok) this.reapplyFixedDirections(); });""")

# ── 5. 各層的 makeup 補償節點 ──
sub1("    this.surgeGain.connect(this.busIn);",
"""    this.surgeGain.connect(this.surgeMk);
    this.surgeMk.connect(this.busIn);""")
sub1("    this.foamGain.connect(this.busIn);",
"""    this.foamGain.connect(this.foamMk);
    this.foamMk.connect(this.busIn);""")
sub1("    this.pebbleGain.connect(this.busIn);",
"""    this.pebbleGain.connect(this.pebbleMk);
    this.pebbleMk.connect(this.busIn);""")

# makeup 節點要建在對應 gain 之後、connect 之前
sub1("    this.surgeGain.connect(this.surgeMk);",
"""    // makeup：HRIR 在 LP800 頻帶內掉 9.9dB（見 assets/hrir/README.md）
    this.surgeMk = ctx.createGain();
    this.surgeMk.gain.value = SPATIAL_MAKEUP.surge;
    this.surgeGain.connect(this.surgeMk);""")
sub1("    this.foamGain.connect(this.foamMk);",
"""    // foam 是唯一在 1.5kHz 以上的層，HRIR 在那裡反而 +1.4dB，所以補償小於 1
    this.foamMk = ctx.createGain();
    this.foamMk.gain.value = SPATIAL_MAKEUP.foam;
    this.foamGain.connect(this.foamMk);""")
sub1("    this.pebbleGain.connect(this.pebbleMk);",
"""    // makeup：HRIR 在 LP700 頻帶內掉 11.2dB。（pebble 是立體聲來源，卷積前會被
    // HrirSource 攤平成 mono——那是必要的，見那個 class 的註解第 2 點。）
    this.pebbleMk = ctx.createGain();
    this.pebbleMk.gain.value = SPATIAL_MAKEUP.pebble;
    this.pebbleGain.connect(this.pebbleMk);""")

# ── 6. 氣泡層 ──
sub1("""    this.bubbleGain.connect(this.bubblePanner);
    this.bubblePanner.connect(this.dry);
    this.bubblePanner.connect(this.convolver);""",
"""    this.bubbleGain.connect(this.bubbleSpatial.input);
    this.bubbleSpatial.connect(this.dry);
    this.bubbleSpatial.connect(this.convolver);""")
sub1("    this.bubble.connect(this.bubbleBP);",
"""    // bubble 是最吃補償的一層：BP320 頻帶內掉 13.7dB（4.82×）。這也是 Pan 在 bench
    // 裡 solo 來聽差異的那一層。
    this.bubbleSpatial = new HrirSource(ctx, this.hrir, SPATIAL_MAKEUP.bubble, this.bubblePanner);
    this.spatialSources.push(this.bubbleSpatial);
    this.bubble.connect(this.bubbleBP);""")

# ── 7. shimmer 刻意不過 HRIR ──
sub1("""    this.shimmerGain.connect(this.dry);
    this.shimmerGain.connect(this.convolver);        // 帶空間""",
"""    // shimmer 刻意**不**過 HRIR / panner：它是「一片」水光而不是一個點聲源，
    // 過點聲源定位反而會把它收成一個方向（跟 sub / wide 同樣的理由）。
    // 因此它也不需要 makeup 補償——沒經過 HRIR，就沒有要補的低頻損失。
    this.shimmerGain.connect(this.dry);
    this.shimmerGain.connect(this.convolver);        // 帶空間（房間殘響）""")

# ── 8. 岸浪道（固定方位）──
sub1("""    g.connect(pan);
    pan.connect(this.dry);
    pan.connect(this.convolver);""",
"""    // makeup：HRIR 在 LP640 頻帶內掉 12.3dB
    const sp = new HrirSource(ctx, this.hrir, SPATIAL_MAKEUP.shore, pan);
    this.spatialSources.push(sp);
    sp.setDirection(side * (60 / 90), 3.2, 0.01);     // ±60°：pan 單位是 ±1＝±90°
    g.connect(sp.input);
    sp.connect(this.dry);
    sp.connect(this.convolver);""")
sub1("    return { src, lp, g, pan };",
"""    return { src, lp, g, pan, sp, side };
  }

  // HRIR 載完後補設一次固定方位的聲源（見 constructor 裡 hrir.load() 的註解）。
  // 第一次抓 IR 時 buffer 還沒 decode 完，所以要重試幾次；抓不到就一直用內建 HRTF。
  reapplyFixedDirections(tries = 0){
    let allSet = true;
    for(const s of [this.sideL, this.sideR]){
      if(!s || !s.sp) continue;
      s.sp.setDirection(s.side * (60 / 90), 3.2, 0.01);
      if(!s.sp.usingIr) allSet = false;
    }
    if(!allSet && tries < 20) setTimeout(() => this.reapplyFixedDirections(tries + 1), 250);
  }

  // H 鍵：實測 HRIR ←→ 瀏覽器內建 HRTF 的即時 A/B（Pan 想再確認一次選對了）
  setHrirEnabled(on){
    this.hrirEnabled = !!on;
    for(const s of this.spatialSources) s.setEnabled(this.hrirEnabled);
    return this.hrirEnabled;""")

# ── 9. loop()：氣泡與主浪改用 setDirection ──
sub1("""    this.bubblePanner.positionX.setTargetAtTime(Math.sin(bRad) * bDist, now, 0.12);   // 逐幀平滑移動
    this.bubblePanner.positionZ.setTargetAtTime(-Math.cos(bRad) * bDist, now, 0.12);""",
"""    // 逐幀平滑移動（HrirSource 內部同時更新退回用的 panner 與實測 IR 的角度選擇）
    this.bubbleSpatial.setDirection(clamp(this.gripPan, -1, 1), bDist, 0.12);""")
sub1("    const bRad = clamp(this.gripPan, -1, 1) * Math.PI / 2;               // 質量中心方位\n", "")
sub1("""    this.panner.positionX.setTargetAtTime(Math.sin(rad) * dist, now, 0.4);
    this.panner.positionZ.setTargetAtTime(-Math.cos(rad) * dist, now, 0.4);""",
"""    this.mainSpatial.setDirection(panAz, dist, 0.4);""")
sub1("    const rad = panAz * Math.PI / 2;\n", "")

# ── 10. shimmer 相對音量（Pan 2026-08-04）──
sub1("    const causticAmt = clamp(0.012 + 0.044 * energy + 0.012 * swell);",
"""    // SHIMMER_LEVEL：Pan 2026-08-04「shimmer 的相對音量可以再大點」→ 1.6×（+4.1dB）。
    // 乘在整條上（不是只加基底）＝保持「隨能量起伏」的動態，只是整體抬高；不動 caustic
    // 的形狀，波光還是會呼吸。要再調就只改這個數字。
    const causticAmt = clamp(SHIMMER_LEVEL * (0.012 + 0.044 * energy + 0.012 * swell));""")

io.open(EN, "w", encoding="utf-8").write(s)
print("web/en/index.html：套用完成（%d → %d bytes）" % (len(io.open(EN, encoding='utf-8').read()), len(s)))
