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
- **浮動滿刻度（Tidal web，更新 2026-07-20 晚）**：目前程式正在除錯階段，**不可視為穩定校正方案**。Pan 最新回饋：4-7-8 會卡住；校正效果不大；數字/水位有時像反向；同一顆球有時很敏感、有時正常。為了分析真球，`web/index.html` 已新增操作 log（按 **L** 下載、`localStorage` key `tidal_grip_operation_log_v1`），每筆 report 記 raw、baseline、sign、span、level、cue state。請以 log 判斷，不要只憑感覺調常數。
  - `GRIP_MIN_SPAN = 250`：為了讓弱球也有明顯水位而降低，但可能放大低端漂移/輕觸。
  - `GRIP_MAX_SPAN = 1500`
  - `GRIP_HEADROOM = 1.35`：舒適最大握力不會立刻被映射成 100%。
  - `GRIP_GAMMA = 0.78`
  - `GRIP_DEADZONE = 0.10`
  - `GRIP_SPAN_DECAY = 0.99985`
  - `GRIP_POLARITY_MARGIN = 45`：校正 cue 期間收集 rest / press raw median，用 `press-rest` 判斷 polarity。若使用者 cue 前已握著、或某顆球低端漂移，仍可能判錯。
  - baseline 漂移目前仍是 heuristic，不是完整 per-ball estimator；4-7-8 卡住時，先看 log 中放鬆後 `level` 是否仍高於 `MANUAL_478_OFF`，以及握下去 `delta` 是否為正。

  接手者測試時請確認：只是拿起球不刻意握時水位應接近 0；舒適握應有明顯但不滿格的反應；很用力才接近滿水位。若要再做 per-ball span lock，請不要直接回到 2026-07-17 後段那套已造成流程混亂的版本，而要另寫小步模擬與真球測試。
- **更新 2026-07-20 深夜（Claude）**：上面段落描述的四個問題已各自定位並修正（sign 無 margin 亂跳／未鎖定 baseline 快追吃掉下降型證據／span 鎖定後仍衰減到地板＝越玩越敏感／478 全域 level 門檻卡拍）。修法與 18 項 node 模擬紀錄見 `AGENTS.md` 2026-07-20 (e)。4-7-8 現在走 per-ball edge detector（rest floor＋相對 span 遲滯），殘壓不用回到 0 也數得到拍。**尚待真球驗證**：跑一輪→按 L 下載 log→`python3 tools/analyze_grip_log.py <log>` 自動判讀。

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

Web 版以授權/連線順序分成 **Ball 1 / Ball 2**，再用左右手 cue 學 `handMap.left/right`。不要假設 Ball 1 永遠是左手或永遠是某顆 serial。
每顆各自維護 baseline、polarity sign、span 與 level，互不干擾；球可在執行中加入或離開。

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
- 目前 4-7-8 仍會卡住，表示「全域 level ON/OFF」不足。較合理的下一步是 per-ball relative edge detector：以最近 rest floor、短窗 raw 變化、個人 span 和 release state 判斷「握一下」，而不是要求 level 回到絕對 0。
