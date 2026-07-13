# Max/MSP + gen~ — 海浪 patch 設計筆記（副線）

> 副線用途：聲音設計時快速試 DSP。定案的音色 / 參數 / 結構寫回 `../DESIGN.md`，再實作到 Web 主線。非必須，Web 才是交付主線。

## 為什麼用 gen~

`gen~` 能寫 sample-level 的 DSP（`noise`、`filter`、`phasor`、`accum`、自訂運算），適合逼真試海浪的濾波與包絡，比拉一堆物件快。定案後把演算法翻成 Web Audio 節點即可。

## 待建 patch（對應 DESIGN.md §4 的三層）

1. **surge.gendsp** — 白噪音 → 可變 lowpass，截止與音量由多個不可公約週期的慢 `cycle~`（或 `phasor~`）相加調變（wave sets）。輸入：`tide`(0–1)。
2. **foam.gendsp** — 白噪音 → highpass，gain 由湧浪包絡上升段 gate。輸入：`tide`、`swellPhase`。
3. **impact.gendsp** — 觸發式 bandpass 噪音爆破 + 快起慢落包絡 + 短殘響。輸入：trigger、`tide`。稀疏、限幅。
4. **主 patch** — 三層加總 → `tanh`（softclip）→ 空間化（`spat5~` 或 pan）→ `ezdac~`。

## 輸入來源

- 握力球在 Max 端可走 OSC：`gripV2HID.py` 已內建 `SimpleUDPClient("127.0.0.1", 8000)`，可改成送 grip/IMU 到 Max 的 `[udpreceive 8000]`。
- 對應：Ball 1 → 方位 / 聽者位置；Ball 2 → tide energy；IMU shake → impact trigger。詳見 `../DESIGN.md` §2。

## 空間化

Max 端可用 IRCAM `spat5~` 或 `vbap` / ambisonics 物件。若要與 Web 主線一致地用 **MeshRIR** IR，可在 gen~ / `buffir~` / `mc.` convolution 載入匯出的 IR（見 `../RESEARCH.md` §3）。

## 交付原則

Max patch 是白板，**不是交付物**。任何在此定案的參數，回填 `../DESIGN.md` 的參數表並在 `../AGENTS.md` 交接紀錄註明，才算完成。
