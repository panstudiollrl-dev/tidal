# 握力球 HID 協定速查（Grip Ball V2）

> 從 `Gripball/gripV2HID.py`（Python 參考實作）與 `nature_loop_web.html`（WebHID 實作）整理。
> 目的：接手者不必回頭讀原始 Python，就能連線、讀握力、觸發觸覺。以程式碼為準；本檔如與程式衝突，回去看那兩個檔。

## 裝置識別

| 項目 | 值 |
|---|---|
| Vendor ID | `0x08E2` |
| Product ID | `0x0101` |
| 傳輸 | 藍牙 HID |
| serial | 每顆球唯一，但 **WebHID 不一定暴露給頁面**。目前 Web 版不依賴 serial，而是用 vendor/product 篩選、依授權/連線順序分配 Ball 1 / Ball 2，再由左右手 cue 學手的對應。|

## 開啟資料傳輸

連線後要送一個「設定模式」指令才會開始收到資料。使用 **模式 3 = 9DoF Value + GRIP RAW**：

- 送 `command`，`cmd_id = 1`，data = 單一 byte `0x03`。
- Python：`send_command(dev, cmd_id=1, data_bytes=struct.pack("<B", 3))`

### send_command 封包格式

```
report_id (1 byte, = 0x01) | cmd_id (1 byte) | data (25 bytes, 不足補 0x00)
```
Python：`struct.pack("<BB25s", report_id=1, cmd_id, padded_data)` → `device.write(list(packet))`

## 讀取資料（依 report_id 分流）

裝置回傳的第一個 byte 是 `report_id`：

### report_id == 3 → IMU / 9DoF
- payload 格式：`"<Lfffffffff"`（1 個 uint32 時間戳 + 9 個 float）
- 欄位順序：`time, acc_x, acc_y, acc_z, gyr_x, gyr_y, gyr_z, mag_x, mag_y, mag_z`
- 用途：**甩動 / shake 偵測**（加速度突增）→ 觸發「浪拍礁石」強拍事件。

### report_id == 5 → GRIP RAW（主控訊號）
- payload = `data[1:51]`（50 bytes）
- 結構：
  - `frame_counter`：`uint16`（`payload[0:2]`）
  - `frame1`：12 × `uint16`（`payload[2:26]`）
  - `frame2`：12 × `uint16`（`payload[26:50]`）
- **握力值 = `frame1[0]`**（其餘通道目前未使用，保留）。

#### 握力數值特性（實測，來自 nature_loop）
- 待機 relaxed 值約 `34000`（因球而異，**務必自動校正 baseline**，不要寫死）。
- 用力握相對 baseline 約 `+1250`（`auto_full_scale`）即可視為滿刻度，讓整個聲音映射不必用蠻力就達得到。
- 舊原型的固定觸發值為 `37000`（`grip_sound_demo.py` 仍用），但 Tidal 沿用 nature_loop 的**自動校正 + 慢漂移歸零**：緩慢變化視為感測器漂移、併入 baseline；快速上升才算一次握壓 onset。
- **現行做法：不校正、固定滿刻度（Tidal web，2026-08-04 起）** ← 這是目前上線的版本
  - 只量**一次零點**：連上球後頭 `GRIP_BASELINE_MS = 700` ms 內 raw 的**中位數**＝零點（中位數不是平均，取樣中手抖一下的尖峰拉不走它）。零點定案前水位一律回 0。
  - 滿刻度**寫死**：`GRIP_FULL_SCALE = 1400`（raw，相對零點），不再學、不再浮動。這是**唯一需要調的數字**——若真球偏硬（全力握到不了 900），只調它，其餘都不用動；按 **D** 開診斷面板會顯示 `full1400`。
  - **方向不猜**：用 `Math.abs(rawDev)`。不論這顆球握下去 raw 是升是降，握＝水位上升，在定義上不可能倒反。
  - `GRIP_HEADROOM = 1.22`、`GRIP_GAMMA = 0.78`、`GRIP_DEADZONE = 0.13`（死區 143 raw，蓋得住拿起球的殘壓 62 raw、又不吃掉輕握 188 raw）。
  - 左右手指派固定為 `handMap = { left: 1, right: 2 }`。兩顆球長得一樣、WebHID 也拿不到序號，本來就無從分辨；唯一差別是左右聲道可能互換，對放鬆聲景沒有對錯。
  - 對照表（滿刻度 1400 ⇒ effScale 1708、死區 222raw）：輕拿殘壓 62raw→0.00、輕握 188raw→0.00、舒適握 700raw→0.41、明確握 1200raw→0.72、很用力 1900raw→1.00。正是本節上面要求的「只拿著不刻意握≈0、舒適握明顯但不滿格、很用力才接近滿」。
  - ⚠️ **900 → 1400（Pan 2026-08-05）**：900 是**照本文件上面那句「firm grip ≈ +1250 raw」推**的，不是量真球量出來的，而 Pan 的真球大約是它的兩倍。Pan 回報「從自我覺察呼吸這邊水位顯示就很糟糕了」，重跑他 291 秒的紀錄（只用 `raw` + `tMs`）發現：**刻意握一下的 dev 峰值是 1009–2831 raw**（中位數 ball1 1225／ball2 2369），而舊的 effScale 只有 900×1.22 = 1098 ⇒ 正常握一下就已經超過滿刻度。breath 段每次握的峰值是 0.98／0.66／0.98／0.81＝幾乎次次貼頂，水位只剩「0 或滿」。改成 1400 後同一份紀錄的 breath 峰值是 0.40–0.84（有起伏了）、貼頂比例 2.6% → 0%，而兩顆球仍然都到得了高水位（ball1 0.76／ball2 0.99）。
  - **兩顆球的動態範圍差約 1.9 倍**（ball1 最高 +1530 raw、ball2 +2875），而畫面取 `Math.max(grip[1], grip[2])`，所以較敏感的那顆會主導顯示。這是選 1400（偏低的那顆附近）而不是選 2400 的理由：讓兩顆都握得到滿，勝過讓其中一顆永遠握不滿。
  - **不要改成「每顆球自己學天花板」**：試過（只長不縮、連續 6 筆超過就抬），它會收斂到偶發的最大尖峰（ball1 1494／ball2 2807），於是**每一次正常的握只剩 0.1–0.4**，「用握力表達緊張」那題會被記成 0 分。學錯比不學更糟——這正是 2026-08-04 移除 cue 校正的同一個理由。`tmp/sim_grip_rezero.js [8]` 有反面守門。
  - 驗證：`node tmp/sim_grip_rezero.js`（一次跑中文＋英文兩頁，194 項斷言）。測試用 regex 從 `index.html` 抽**真正的**常數與 `GripCalibrator` 來跑，不重寫邏輯；`[8]` 專門釘滿刻度的量級（拿真球實測的 +700／+1200／+1900 raw 三檔，要求水位有可分辨的層次）。
  - ⚠️ **弱球風險（誠實記錄）**：`GRIP_FULL_SCALE = 1400` 是為 Pan 手上那兩顆（+1530／+2875 raw）挑的。若某顆球全力握只有 +300 raw（2026-07-17 Pan 曾遇到），全力握只到 0.15。這個取捨沒有消除，只是把它移到了正確的量級上：換一批球就只調這一個數字，按 **D** 看診斷面板的 dev 峰值即可決定。
- ~~**浮動滿刻度（2026-07-20 晚）**~~：**已於 2026-08-04 整段移除**，連同 30.7 秒的左右手 cue 校正。保留這段記錄是為了說明「為什麼不要再走回去」：
  - 那套用 cue 校正學 `span` / `sign` / `handMap`，三樣都學錯了，而且有 Pan 的真實紀錄可證。`record/tidal_record_2026-07-29T06-31-52.json`：ball1 `calibSpan 171`、ball2 `calibSpan 185`，`lockedSpan 143 / 141` ＝幾乎等於當時的地板 `GRIP_MIN_SPAN_LOCKED = 140`。四顆球次裡三顆落在地板上，也就是 30.7 秒之後校正沒提供任何資訊，是那個常數在做事。
  - 算術對得上：`span = 峰值中位數 × GRIP_PEAK_TO_SPAN(0.68)` → 252×0.68=171、273×0.68=185，代表校正期間只量到 250–273 raw，而本節上面實測「用力握」是 **+1250 raw**。
  - 根因是 cue 的提示字**「輕輕握就好」**（2026-07-22 為了讓人不要用力而改的）——使用者最輕的一握被當成了滿刻度。
  - 這正好解釋 Pan 的兩個回饋：span 掉到地板→輕握就滿、殘壓 62raw 被讀成 0.36（高於答題門檻 `AFTER_ON` 0.24 ＝殘壓被當成答案）＝「有時超級敏感」；30.7 秒沒換到東西＝「校正效果不大」。`sign` 也不穩：同一顆 ball2 兩份紀錄一次學成 +1、一次 −1（`pressMinusRest` +98 / −114）＝「水位有時倒過來」。
  - 教訓：**能寫死的就不要學，學錯比沒學更糟。** 與 duck-hunt 的 `QUICK_ENGAGE_FORCE` 同一個想法。
  - 舊常數（`GRIP_MIN_SPAN` / `GRIP_MAX_SPAN` / `GRIP_SPAN_DECAY` / `GRIP_MIN_SPAN_LOCKED` / `GRIP_PEAK_TO_SPAN` / `GRIP_POLARITY_MARGIN` / `HAND_CUE_*`）都已不存在。
- 4-7-8 的「握一拍」仍走 per-ball edge detector（rest floor＋相對滿刻度的遲滯），殘壓不用回到 0 也數得到拍——這部分**沒有**跟著校正一起改。操作 log 仍在（按 **L** 下載、`localStorage` key `tidal_grip_operation_log_v1`），但欄位已隨校正移除而簡化（不再有 `sign` / `calibSpan` / `lockedSpan` / `peakLeft` / `peakRight`）。

## 觸覺回饋（haptic，可選）

球支援震動，用 `cmd_id = 11`。Python 範例：

```python
haptic_payload = struct.pack("<BBBB", 0x00, 0x01, 80, 50)   # 例：強度 80、時長 50
cmd_data = struct.pack("<BB", 0x03, len(haptic_payload)) + haptic_payload
send_command(dev, cmd_id=11, data_bytes=cmd_data)
```
- 建議節流：每 ~100ms 最多送一次，避免藍牙頻寬塞車。
- Tidal 用途：放鬆達到某狀態時輕震做即時 biofeedback（低調、非懲罰）。屬 nice-to-have。

## WebHID 對應（web/index.html 用）

- 連線：`navigator.hid.requestDevice({ filters: [{ vendorId: 0x08E2, productId: 0x0101 }] })`，需使用者手勢觸發，且要安全情境（`https://` 或 `http://localhost`，**不能 `file://`**）。
- 開傳輸：用 `device.sendReport(reportId, dataView)` 送模式 3 指令（對應上面的 `send_command`；reportId=1，第一個 data byte 是 cmd_id）。
- 收資料：`device.addEventListener('inputreport', e => { const rid = e.reportId; const dv = e.data; ... })`，依 `rid` 3/5 解析，數值用 little-endian（`DataView.getUint16(o, true)` / `getFloat32(o, true)`）。
- 觸覺：`device.sendReport(1, <cmd 11 封包>)`。

> ⚠️ macOS 已知風險：已配對的藍牙 HID 有時被系統獨占，導致 WebHID `requestDevice` 列不到或 `open()` 失敗。若發生，回退用 Python `nature_loop.py` 路徑，Web 版當純聲音 demo。（記錄於 `Gripball/NATURE_LOOP_WEB_README.md`。）

## 兩顆球 = 兩隻手

Web 版以授權/連線順序分成 **Ball 1 / Ball 2**。不要假設 Ball 1 永遠是某顆 serial。
`handMap.left/right` 自 2026-08-04 起是**固定預設** `{left: 1, right: 2}`（原本用左右手 cue 學，見上面「不校正」段落——兩顆球本來就分辨不出來，唯一差別是左右聲道可能互換）。
每顆球各自維護零點 baseline、rest 參考位與 level，互不干擾；球可在執行中加入或離開。滿刻度是全域固定常數，不再 per-ball。

## Arrival 校正注意（2026-07-15 實測問題）

> ⚠️ **本節已成歷史（2026-08-04）**：cue 校正整段移除，因此下面關於「三次 cue」「per-ball span lock」的指引**不再是待辦事項**。
> 保留是因為它記錄了兩件仍然有效的教訓：(1) 不要用「降低全域門檻」來讓校正好過；(2) 輕碰不該等於有意圖的握壓——這件事現在由固定死區（143 raw）達成，不需要校正。
> 若未來有人想重做校正，請先讀上面「不校正」段落裡的真實紀錄，再決定是否真的需要。

> 更新（Claude 2026-07-15）：造成「稍微碰到就進下一階」的那個過度敏感版本（Codex 降低全域門檻）**已 revert 回 0dbffa0**，目前左右手 cue 是時間節奏、不會碰一下就跳。以下是**未來要正確重做 per-ball 校正**時的指引（不要再用降全域門檻的方式）。

Pan 實測指出：Codex 那版把校正與 4-7-8 門檻降得太低，導致**稍微碰到球就算成功**，甚至左手尚未真正完成三次、右手尚未測試就跳到下一階。這不是可接受的校正。

接手者請把校正當成 per-ball state estimation，而不是固定常數觸發：

- 每顆球維護自己的 `rest floor / baseline / comfortable press span / release threshold`。
- 三次 cue 的目的不是快速通過，而是逐次學到「這顆球 + 這隻手」的舒適握壓範圍。
- 有效握壓應同時滿足：
  - cue 已亮起，且使用者先前處於可視為放鬆的狀態；
  - 相對 baseline 有明確上升；
  - 到達該顆球當前估計的舒適門檻；
  - 維持一小段時間（建議 450–700ms 起測），避免輕觸、雜訊或瞬間 spike。
- 成功後不要立刻跳下一手；先顯示短確認，再等使用者真的放鬆，才進入下一次 cue。
- 30 秒呼吸覺察與 4-7-8 也應使用校正後的 per-ball threshold + hysteresis，而不是全域低門檻。input 小的球要更友善，但不能把輕碰當成有意圖的握壓。
- 目前 4-7-8 仍會卡住，表示「全域 level ON/OFF」不足。較合理的下一步是 per-ball relative edge detector：以最近 rest floor、短窗 raw 變化、個人 span 和 release state 判斷「握一下」，而不是要求 level 回到絕對 0。
