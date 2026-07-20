# 修正說明：握力校正與連線回歸（2026-07-17，給 Codex）

> 用途：Claude 今天一連串改動把握力校正/連線越改越糟，Pan 決定改由 Codex 依此文件修正。
> 以程式為準；本檔給根因、位置與建議修法。**動握力偵測前先跑 node 模擬＋jsdom（見 §6）**。

## 0. 現況
- Repo：`github.com/panstudiollrl-dev/tidal`，主檔 `web/index.html`（單檔）。
- 目前 HEAD＝`6d54839`。今天的相關 commit：`9d79ca2`(Pan 調校，換球前很好) → `a6b9683`(漂移修) → `3aa1391`(span 鎖定+三態 baseline+D 面板) → `27b5659`(audio 首次手勢) → `5d39338`(換球 ghost 處理) → `6d54839`(polarity 自動偵測)。
- 兩顆球都是 **MB01**（VID:PID `08E2:0101`）。Pan 換掉了其中一顆。
- 執行：`cd Tidal && python3 -m http.server 8000` → 桌面 Chrome/Edge 開 `http://localhost:8000/web/index.html`（WebHID 需安全情境）。線上：GitHub Pages（見 §5）。

## 1. 目前症狀（Pan 實測，依急迫度）
1. **【最急】一顆球一直被清掉**：連上後又被移除，反覆循環。
2. **水位倒反**：沒握球水位高、握下去反而變低（換球後才出現）。
3. **按 D 診斷面板沒反應**。
4. （較早）**兩手不對稱**：一手一碰就全滿、一手很用力連一半都不到。
5. （較早）**握持中水位一直降**（穩定用力卻下沉，尤其 4-7-8 憋氣）。
6. （較早）**準備等待太長 / 答題還沒答就自動跳關**（跟數值漂移有關）。

---

## 2. 逐項根因與建議修法

### 症狀 1：一顆球一直被清掉（先修這個，其他症狀可能是它的連鎖）
- **位置**：`watchHidLiveness()`（約 line 2633–2655），特別是 `age > HID_FORGET_STALE_MS` 區塊（約 line 2646–2653）。
- **成因**：Claude 在 `5d39338` 加了「stale 超過 `HID_FORGET_STALE_MS`(6.5s) → `forgetBallSlot()` + `ghost.forget()`(撤銷 WebHID 授權) + `syncBalls()`」。問題：
  - `ghost.forget()` 是 **async 沒 await**，緊接的 `syncBalls()` 又立刻 `getDevices()` 抓到同一顆（授權還沒真的撤銷）→ 反覆 register/forget＝**一直被清掉**。
  - 對「只是短暫沒回報的真球」直接撤銷授權，等於把好球踢掉，要重新配對。
- **建議修法**：把該區塊還原成「只 `forgetBallSlot(slot, "沒有回應")`」，**移除** `ghost.forget()` 與 watchdog 內的 `syncBalls()` 呼叫。撤銷授權只保留在 `syncBalls()` 內「`open()` 真的失敗」那條 catch（約 line 2626–2629，那裡的 `dev.forget?.()` 是安全的：只有實體不在、開不起來才撤銷）。
- **另檢查**：`HID_FORGET_STALE_MS` 是否太短，讓真球短暫掉包就被清；可放寬，或改成「連續 N 次 sendModeCommand 重喚醒後仍無回報才清」。

### 症狀 2：水位倒反（握壓極性 polarity）
- **位置**：`class GripCalibrator`（約 line 928–956）；`onReport` 的 `rawDelta`（約 line 2680）；`finishHandCue` 內的 `lock()` 呼叫（line 2249–2250）。
- **成因**：MB01 有兩種極性——握下去 raw **上升** 或 **下降**。換上的新球極可能是「下降型」。歷來（含已知良好的 `9d79ca2`）都寫死「raw 高於 baseline＝握壓」（`posDelta=max(0, smRaw−baseline)`、baseline 三態用 `smRaw<baseline` 當放開）。遇到下降型：握＝raw 降→被當成「放開」快速歸零；放開＝raw 回升→被當成「握」→**水位在放開時衝高＝倒反**。（視覺沒錯：`--session-water = gripWater` 是正映射，見約 line 2999/3073。）
- **Claude 已加 sign 自動偵測**（`6d54839`）：校正未鎖定時記錄 `upMax/downMax`，`lock()` 時定 `sign = upMax>=downMax?1:-1`，之後一律用 `dev=(smRaw−baseline)*sign`（握＝正）。**理論正確、node 模擬兩種極性都對**，但實機「更糟」，最可能是被症狀 1 拖累：球一直被 `forgetBallSlot`→`calib[slot]=new GripCalibrator()`（見 `forgetBallSlot` 約 line 2534）不斷重建→`sign/upMax/downMax` 一直歸零、校正永遠無法 `lock()`→方向偵測不穩。
- **建議修法**：
  1. 先修症狀 1，再驗 polarity。
  2. 讓 sign 判定更保險：**預設 +1（上升＝握，MB01 常態）**，只有 `downMax` 明顯大於 `upMax`（例如 `downMax > upMax + 60` 且 `downMax > 60` raw）才判 −1，避免雜訊把上升型誤反轉。未鎖定前用同一條 margin 規則當即時 provisional（下降型球在校正第一握就會翻到 −1，才不會卡校正）。
  3. **務必讓使用者完整做完左右手三握校正**，`sign` 才在 `lock()` 定案；別讓流程在校正未完成就進 session。
- **診斷**：D 面板已顯示每顆球 `raw / base / d(握方向 delta) / sign / lvl`。正確時：不握 `lvl≈0`；握下去 `d` 變正、`lvl` 上升；`sign` 顯示 +1 或 −1＝該球方向。

### 症狀 3：按 D 沒反應
- **位置**：keydown handler（約 line 3606–3614）；`updateDiag()`（約 line 3629）；`<div id="diag">`（line 626）。
- **狀況**：程式看起來正確（listener 綁在 window、div 存在、`display none↔block` toggle）。實機沒反應。
- **最可能**：瀏覽器 console 有 **runtime error**（很可能就是症狀 1 的反覆 forget/syncBalls 迴圈或某處丟例外），或反覆清球把主執行緒卡住。**先開 DevTools Console 看紅字**；多半修好症狀 1 後 D 就正常。
- **保險做法**：把診斷面板也接一個畫面上的小按鈕（不只靠鍵盤 D）；確認 keydown 沒被別的 handler `preventDefault/stopPropagation`。

### 症狀 4/5/6（較早的校正問題，一起處理更好）
- **4 兩手不對稱**：固定 `GRIP_MIN_SPAN` 地板對「弱球」(很用力也只 +300) 太高→最多到 ~0.43；對「敏感球」第一握 span 還沒追上→輕碰就滿。Claude 方向：**校正三握學每顆球的 span，`finishHandCue` 對兩球 `lock()`，鎖定後只慢擴張**；並把 `GRIP_MIN_SPAN 520→250`。方向對，需在症狀 1 修好後才驗得準。
- **5 握持水位下沉**：baseline 在「握持中」不該吸收。Claude 用**三態 baseline**：放開(dev<0)快歸零 0.3／閒置(shaped<0.06)吸漂移 0.05／握持(shaped≥0.06)近乎凍結 0.0005。
- **6 漂移害卡準備/跳關**：舊版 baseline 漂移是閘控式（`level<0.16 && delta<span*0.18` 才吸收），漂移一超過門檻就不吸收→殘留成「假握壓」→撐住 arm 門檻(`AFTER_OFF=0.07`)放不開＝卡準備；在 `AFTER_ON=0.14` 附近抖動→heldMs 一直歸零→5.2s 逾時自動記 0＝沒答就跳關。Claude 改成三態/非對稱吸收解決。
- 這三項的目標行為與模擬測法見 §6。

---

## 3. 請保留、不要動（今天有效的部分）
- **audio 首次手勢啟動** `ensureAudioOnGesture()`（約 line 3963 + 其下 `pointerdown/keydown/touchstart` 綁定）：解決「不必按『啟動聲音』」。Pan 要保留此行為。
- **English 版** `web/en/index.html`、根目錄 `.nojekyll`、兩頁 `<h1>` 的語言切換連結。
- **GitHub Pages**（§5）。
- **D 診斷面板**、**R 重新配對鍵** `repairBalls()`、**syncBalls 的 try/catch**（只有 open 失敗才 forget，這是安全的）。

## 4. 中英雙語同步
- `web/en/index.html` 是用「對最大 CJK run 整檔取代」翻譯生成的英文版。**改完 `web/index.html` 的邏輯後要同步英文版**：
  - 若只動程式邏輯、沒動使用者可見中文字串 → 把相同差異手動套到 `web/en/index.html` 對應位置即可。
  - 若動到文案 → 需重跑翻譯（把新中文字串加進對照表）。
- 兩個檔要一致；`english-us-demo` 分支目前 = main（可保持同步或忽略）。

## 5. 線上網址（GitHub Pages，從 main 發佈）
- 中文：`https://panstudiollrl-dev.github.io/tidal/web/`
- English：`https://panstudiollrl-dev.github.io/tidal/web/en/`

## 6. 驗證協定（動握力偵測前必做）
1. **語法**：抽出 `<script>` 內容跑 `node --check`。
2. **node 模擬 calibrator**：至少涵蓋
   - up-going 與 down-going 兩種球；
   - 輕/中/重握 + 校正三握後鎖定；
   - 7 秒持續握持（4-7-8 憋氣）；
   - 靜止 + 感測器漂移（例 +14~28 raw/秒）。
   目標：靜止 `level≈0`（低於 arm 0.07）、握下去高、放開回 0、握持中不明顯下沉、兩種極性都正確。（Claude 的暫存腳本 `/tmp/calib_pol.js`、`/tmp/calib3.js` 是這個測法的範例，可自行重建。）
3. **jsdom 載入**：stub AudioContext/canvas/navigator.hid，載入頁面確認 init 0 錯誤（中英各一）。
4. **真機**：Pan 用 D 面板回報 `raw/base/d/sign/lvl`。

## 7. 最保險的退路（若想先回到 Pan 說「很好」的水位手感）
把 `class GripCalibrator`（line 928）與常數（line 803–812）還原成 `9d79ca2`（附錄 A），移除 `finishHandCue` 的 `lock()`（line 2249–2250）與症狀 1 的 watchdog 撤銷。
**注意**：`9d79ca2` 版仍寫死「上升＝握」，對「下降型的新球」水位仍會倒反。要支援新球，仍得加 polarity 偵測（§2）。也就是說退路能救「用回舊球」，救不了「新球極性相反」。

---

## 附錄 A：`9d79ca2` 已知良好的 GripCalibrator（水位正確，但假設「上升＝握」）
常數：`GRIP_MIN_SPAN=520, GRIP_MAX_SPAN=1400, GRIP_HEADROOM=1.35, GRIP_SPAN_DECAY=0.99975, GRIP_GAMMA=0.78, GRIP_DEADZONE=0.10`

```js
class GripCalibrator {
  constructor(){ this.baseline = null; this.span = GRIP_MIN_SPAN; this.level = 0; }
  update(raw){
    if(this.baseline === null){ this.baseline = raw; return 0; }
    const delta = raw - this.baseline;
    const posDelta = Math.max(0, delta);
    this.span = Math.max(posDelta, this.span * GRIP_SPAN_DECAY);
    this.span = clamp(this.span, GRIP_MIN_SPAN, GRIP_MAX_SPAN);
    if(this.level < 0.16 && delta < this.span * 0.18) this.baseline += (raw - this.baseline) * 0.07;
    const effScale = this.span * GRIP_HEADROOM;
    let rawLevel = clamp(posDelta / effScale);
    rawLevel = rawLevel <= GRIP_DEADZONE ? 0 : clamp((rawLevel - GRIP_DEADZONE) / (1 - GRIP_DEADZONE));
    const shaped = Math.pow(rawLevel, GRIP_GAMMA);
    this.level += (shaped - this.level) * 0.12;
    return this.level;
  }
}
```

## 附錄 B：建議的正確方向（整合版，供 Codex 參考，不是硬性）
一個能同時解 2/4/5/6 的 calibrator 應具備：
1. **極性 sign**：校正三握學方向，預設 +1、只有明確下降才 −1（§2）。
2. **每球 span 由校正三握決定並鎖定**：解兩手不對稱（弱球也到得了滿、敏感球不會一碰就滿）。`GRIP_MIN_SPAN` 降到約 250 當防雜訊地板。
3. **baseline 三態（以「握＝正」的 dev 判斷）**：放開快歸零、閒置吸漂移、握持凍結——解「準備卡住/跳關」與「握持下沉」。
4. 全程 `dev = (smRaw − baseline) * sign`；`posDelta=max(0,dev)`；`level` 經 deadzone + `pow(., GAMMA)` + 平滑。
5. **先修症狀 1（別再清球），否則 calibrator 一直被重建，什麼都驗不準。**
