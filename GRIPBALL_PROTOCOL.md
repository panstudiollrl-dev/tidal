# 握力球 HID 協定速查（Grip Ball V2）

> 從 `Gripball/gripV2HID.py`（Python 參考實作）與 `nature_loop_web.html`（WebHID 實作）整理。
> 目的：接手者不必回頭讀原始 Python，就能連線、讀握力、觸發觸覺。以程式碼為準；本檔如與程式衝突，回去看那兩個檔。

## 裝置識別

| 項目 | 值 |
|---|---|
| Vendor ID | `0x08E2` |
| Product ID | `0x0101` |
| 傳輸 | 藍牙 HID |
| serial | 每顆球唯一（例：`10013802`、`feab61a2e9b1`）。用 serial 區分「第一顆 / 第二顆」。|

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
- **浮動滿刻度（Tidal web，更新 2026-07-17）**：不同球／使用者的握力範圍差很多（有些球很用力也只 +380）。`web/index.html` 的 `GripCalibrator` 不用固定 `+1250`，改成**追蹤你觀察到的最大握力**（`this.span`，有界 `520–1400`、慢衰減自動適應），並以 `span × GRIP_HEADROOM` 作為有效滿刻度。最新參數是：
  - **滿刻度改「校正鎖定」（更新 2026-07-17 b）**：`GripCalibrator` 新增 `locked`／`lock()`。校正三握（左右手 cue）期間 span＝即時學到的最大握壓；**校正完成時 `finishHandCue` 對兩顆球各自 `lock()`**，之後 span 只慢慢擴張（`+=(posDelta-span)*0.02`）不再即時追峰值。這樣**每顆球的滿刻度＝它自己校正時的舒適握壓**，解決 Pan 2026-07-17 實測的兩手不對稱：一手一碰就滿（span 被瞬時追高/地板太高）、一手很用力連一半都不到（弱球被 520 地板壓住）。
  - `GRIP_MIN_SPAN = 250`（原 520）：地板調低讓**弱球**（很用力也只 +300 的球）也能校到接近滿；仍保留防雜訊放大的底線。
  - `GRIP_MAX_SPAN = 1500`
  - `GRIP_HEADROOM = 1.35`：舒適最大握力不會立刻被映射成滿水位。
  - `GRIP_GAMMA = 0.78`：比舊版 `0.55` 少放大低端小壓力。
  - `GRIP_DEADZONE = 0.10`：低端死區，把「拿起來／輕碰」留給 0 附近。
  - **baseline 漂移改為非對稱 rest-floor（更新 2026-07-17，取代舊的 `level<0.16 && delta<span*0.18 → 0.07` 閘控式漂移）**：先對 raw 做輕平滑 `smRaw += (raw-smRaw)*0.3`；`smRaw < baseline`（正在放開）→ `baseline += (smRaw-baseline)*0.3` 快速歸零；`smRaw > baseline`（漂移或握持）→ `baseline += (smRaw-baseline)*0.008` 慢慢吸收。span 上升改 attack 限速 `span += (posDelta-span)*0.04`（不追一次尖峰），閒置才 `*GRIP_SPAN_DECAY`。
  - smoothing：`level += (shaped - level) * 0.2`。

  舊閘控式漂移的問題（Pan 2026-07-17 實測）：感測器數值**慢慢往上飄**時，一旦 `level` 超過 0.16 就不再吸收，漂移殘留成「假握壓」。實測讓抵達/結束後的**答題卡在「準備」**（arm 門檻 `AFTER_OFF=0.07` 一直被假握壓壓著、放不開）以及**還沒答題就自動跳關**（假 level 在 `AFTER_ON=0.14` 附近抖動，heldMs 一直歸零 → 5.2s response window 逾時自動記 0）。新的非對稱 baseline 讓閒置 level 穩定回到 ~0（模擬：感測器漂移 14–28/秒時閒置 level ≤0.03，仍低於 arm 0.07），真實握壓（重/中/輕）仍分別到 ~0.63/0.36/0.21，peak 保留。**未改** `GRIP_HEADROOM/GAMMA/DEADZONE/MIN_SPAN/MAX_SPAN` 的手感值。
  - 早先調整（HEADROOM 1.35 等）的理由：Pan 實測一拿起球水位幾乎全滿，代表低端被曲線過度放大。接手者測試時請確認：只是拿起球不刻意握時水位應接近 0；舒適握應有明顯但不滿格的反應；非常用力才接近滿水位。

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

第一顆偵測到的 serial → **Ball 1（方向）**；第二顆 → **Ball 2（潮汐）**。
每顆各自維護 baseline 與 level，互不干擾；球可在執行中加入或離開（nature_loop 每秒掃描一次）。

## Arrival 校正注意（2026-07-15 實測問題）

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
