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
- **浮動滿刻度（Tidal web，2026-07-09）**：不同球／使用者的握力範圍差很多（有些球很用力也只 +380）。`web/index.html` 的 `GripCalibrator` 不用固定 `+1250`，改成**追蹤你觀察到的最大握力**（`this.span`，有界 300–1400、慢衰減自動適應），滿刻度＝`span×0.82`，再過 `pow(level, 0.75)` 響應曲線。可調常數：`GRIP_MIN_SPAN/MAX_SPAN/HEADROOM/SPAN_DECAY/GAMMA`。

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
