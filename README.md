# Tidal — 雙握力球 × 海浪聲景 × Spatial Audio

> 放鬆導向的即時海浪聲景。兩顆握力球分別控制「方向」與「潮汐強度」，
> 平時是可安住的海濤環境音，但保留「浪拍礁石」的較強烈互動。
> 承接 Merry Grip Ball × Thomas READ/ENGINE/WRITE 框架，是 `Gripball/nature_loop` 之後的第二個聲景原型。

**狀態：可執行體驗版（web/index.html），持續依 Pan 實測回饋迭代中。**
最後更新：2026-07-14

### 開發進度（2026-07-14，詳細逐步紀錄見 `AGENTS.md` 交接紀錄）

- **聲音**：程序式海浪（surge/foam/impact）＋ MeshRIR `room.wav` 空間著色（HRTF panner→convolver）。拍石改為「蓄積 swell + 長殘響尾巴（隨時間變暗）」。新增**鵝卵石大圓石低頻滾動**（阿朗壹風）＋**非定位低頻包覆床**。依 Pan 的阿朗壹現場錄音做**頻譜對齊**（合成 vs 錄音：sub 20% vs 21%、centroid 439 vs 428Hz、幾乎無高頻）。潮汐動態放慢、加入有界隨機漫步去機械感。
- **視覺**：海仍是主視覺，但最新方向改為**站在岸邊往海看**：遠方青綠海面、近處白浪/水膜、濕沙與海玻璃色系。中央圓球是主要焦點；握力越大，球越小，像被手擠壓成更密的內核，光與水位仍增強。
- **控制**：兩顆球握壓角色可置換（現 Ball 1＝潮汐、Ball 2＝鵝卵石＋空間），揮動＝方向。**浮動握力校正**（自動追蹤各球施力範圍）。2026-07-14 修正「一開始不管怎麼握水位都貼頂」：`GRIP_HEADROOM` 0.82→1.15，滿刻度＝觀察到的最大握力 ×1.15，最用力 ~87%，一般握照力道呈現不同水位（真球仍建議再校準）。左右手對應 cue 必須**先放開、球亮後再按**才算成功。震動全域關閉（`HAPTICS_ENABLED=false`），唯一例外是 4-7-8 主動握拍的一次短震（`force=true`）。
- **紀錄 / Arrival**：Arrival 抵達流程包含左右手自然對應、30 秒自然呼吸覺察（吸氣握著、吐氣放下）、1.2 秒「用握力表達緊張的程度」、小 report、使用者握力符合度確認、依自我檢測建議呼吸場景與本機匿名 CSV；`dominant_mode` 僅背景寫入研究欄位。
- **4-7-8**：已改成**手動握拍**：球心顯示大數字，球心上方顯示「現在吸氣 / 現在憋氣 / 現在吐氣」，每數一下就握一下球；每次有效握壓才扣一拍（4→1、7→1、8→1），每拍有短震＋相位色明滅。預留語音檔接口 `audio/478-inhale.wav`、`audio/478-hold.wav`、`audio/478-exhale.wav`。**⚠ 待辦：`web/audio/` 目錄與這三個語音檔尚未建立，`play478Voice` 目前會靜默失敗；要嘛補檔、要嘛先移除語音呼叫。**
- **可讀性 / 字級（2026-07-14）**：文字曾被亮海面/白浪蓋住看不清，已為所有引導文字加深色描邊光暈＋中央文字區柔和深色底，並整體放大字級（含 in-app browser 矮視窗）。
- **美學/理論依據**：`AESTHETIC.md`（Berman 環境神經科學＋碎形流暢）、`RHYTHMANALYSIS.md`（Lefebvre 節奏分析）。

---

## 這是什麼

- **一句話**：兩顆握力球即時塑形一片海。左右手各管一組有界參數，聲音永遠成立、永不懲罰使用者。
- **為什麼**：延續 `Gripball/NATURE_LOOP_V0.1.md` 的「先做好聲音、再談生理訊號」原則。Tidal 把互動從「兩軌田野錄音的音量／寬度」升級為 **程序式海浪物理模型 + 空間化**，讓「方向感」與「潮汐」成為可被身體直接感覺的維度。
- **新的概念框架**：Tidal 不是單純「偵測狀態→播放音樂」，而是**節奏調和系統**：觀察身體、握力、揮動、聲場與未來 EEG 指標的多重節奏，幫助使用者恢復節奏彈性。詳見 [`RHYTHMANALYSIS.md`](./RHYTHMANALYSIS.md)。
- **不是什麼**：不是自由生成音樂、不做診斷、不宣稱療效。這是 wellness / supportive 的聲景工具。（與整個 EEG 專案的對外定位一致，見上層 `HANDOFF.md`。）

## 控制對應（預設）

| 握力球 | 角色 | 控制的維度 |
|---|---|---|
| Ball 1（第一顆偵測到的 serial） | **方向 Direction** | 浪來的方位角（左↔右環繞）、聽者在聲場中的位置 |
| Ball 2（第二顆） | **潮汐 Tide** | 潮汐能量：湧浪週期、浪高、拍岸強度、遠近 |

- **握力（grip pressure）**＝連續、平滑的主控訊號（漲潮 / 加強）。
- **甩動 / IMU（shake）**＝觸發單次「浪拍礁石」的強拍事件（rare、有界、不刺耳）。
- **雙手放鬆**＝海變得低沉、遠、慢，但**永不消失**。

完整訊號流與參數範圍見 [`DESIGN.md`](./DESIGN.md)。

## 技術路線（兩條，可並行）

1. **Web（主線，建議先做）**：`web/index.html` — WebHID 連握力球 + Web Audio 程序式合成 + spatial（PannerNode / Convolver）。
   延續 `Gripball/nature_loop_web.html` 已驗證的 WebHID 骨架，桌面 Chrome / Edge 執行，零安裝。
2. **Max/MSP + gen~（副線，聲音探索用）**：`maxmsp/` — 給聲音設計時快速試 DSP、之後把定案參數搬回 Web。

聲音物理模型參考 **Andy Farnell《Designing Sound》** 的海浪 / 水體章節；空間化用 **MeshRIR** 的實測室內脈衝響應（RIR）做 convolution。理由與細節見 [`RESEARCH.md`](./RESEARCH.md)。

## 檔案結構

```
Tidal/
├── README.md              ← 你在這裡：總覽、快速上手、狀態
├── AGENTS.md              ← 跨 AI（Claude / Codex / Antigravity）協作準則，接手前必讀
├── DESIGN.md              ← 聲音引擎架構、握力球對應、潮汐狀態機、spatial 設計
├── AESTHETIC.md           ← 音畫美學語言：Berman 環境神經科學 + 碎形流暢背書、Endel 取原則不抄、低階特徵→聲/畫映射
├── RHYTHMANALYSIS.md      ← Lefebvre 節奏分析：身體/聲場/EEG 的概念框架與 session 記錄建議
├── BREATHING.md           ← 呼吸引導 × 聲景對應（實作規格）：呼吸法→聲景、自適應先接再引、Session 流程
├── READING.md             ← 思想導讀：握力↔健康、節奏/共振、Lefebvre、呼吸的文獻地圖
├── RESEARCH.md            ← Farnell 海浪合成法、MeshRIR、spatial audio 選項、參考文獻
├── GRIPBALL_PROTOCOL.md   ← 握力球 HID 協定速查（不必回頭讀 Python 即可接線）
├── web/
│   ├── index.html         ← WebHID + Web Audio 可執行骨架（synth/spatial 有 TODO）
│   └── README.md          ← 如何跑、瀏覽器需求、已知限制
├── maxmsp/
│   └── README.md          ← gen~ 海浪 patch 的設計筆記與待建清單
└── assets/
    └── ir/                ← 放 MeshRIR 匯出的 IR（.wav），見 RESEARCH.md 的匯出步驟
```

## 快速上手（Web 骨架）

WebHID 需要安全情境，**不要用 `file://` 直接開**：

```bash
cd Tidal            # 從 Tidal/ 這層開，room.wav 才吃得到（見下方註）
python3 -m http.server 8000
# 用桌面版 Chrome / Edge 開 http://localhost:8000/web/index.html
```

> ⚠️ **從 `Tidal/` 開 server，不要從 `web/`**：`index.html` 載 `../assets/ir/room.wav`；若從 `web/` 開，`../` 逃出 server 根目錄會 404，MeshRIR 空間著色靜默載不到（海仍會響，只是少空間著色）。`loadIR` 已會試多個候選路徑，但 `assets/` 實體在 `Tidal/` 下，所以 server 根至少要在 `Tidal/`。

沒有握力球時，按住空白鍵＝模擬握壓，可先聽聲音設計。細節見 [`web/README.md`](./web/README.md)。

## 接手者請先讀

1. [`AGENTS.md`](./AGENTS.md) — 跨 AI 協作與不可破壞的原則。**這是無縫接軌的關鍵，任何 AI（Codex / Antigravity / Claude）動手前都要遵循。**
2. [`DESIGN.md`](./DESIGN.md) — 要實作什麼、參數在哪、邊界是什麼。
3. [`RHYTHMANALYSIS.md`](./RHYTHMANALYSIS.md) — 為什麼把 Tidal 改寫成「節奏調和系統」，以及 session/EEG 該怎麼接。
4. [`RESEARCH.md`](./RESEARCH.md) — 為什麼這樣做、原始資料與連結。

## 與上層 EEG 專案的關係

Tidal 是 EEG 自適應音樂專案下的一個聲景原型，對齊 Thomas 的 READ / ENGINE / WRITE：
握力＝READ，有界 recipe＝ENGINE，海浪聲場＝WRITE，聆聽時間 / 前後緊張度＝MEASURE。
EEG 在此僅為**探索性量測通道**，不解讀為放鬆的證明。整體專案脈絡見上層資料夾的 `HANDOFF.md`。
