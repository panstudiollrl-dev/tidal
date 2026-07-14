# Tidal Web — 節奏調和版執行說明

`index.html` 是單檔的 WebHID + Web Audio 海浪聲景體驗頁，已接上 `../RHYTHMANALYSIS.md` 的「節奏調和」框架：握力球即時塑形海浪、Arrival 抵達流程、session 前後自評並可下載 CSV。

## 怎麼跑

WebHID 需要安全情境，**不能用 `file://` 直接開**：

```bash
cd Tidal            # 從 Tidal/ 這層開（不是 web/），room.wav 才載得到
python3 -m http.server 8000
```

用**桌面版 Chrome 或 Edge** 開 <http://localhost:8000/web/index.html>（Safari / Firefox 不支援 WebHID）。

> ⚠️ **root 要在 `Tidal/`**：`index.html` 抓 `../assets/ir/room.wav`；若從 `web/` 開 server，`../` 逃出根目錄會 404（MeshRIR 空間著色靜默載不到，海仍會響）。`loadIR` 已會依序試多個候選路徑，但 `assets/` 實體在 `Tidal/` 底下，所以 server 根至少要到 `Tidal/`。

## 操作

1. 打開頁面後會自動準備 Web Audio；海浪保持靜音，等第一次真的按下握力球/空白鍵時才慢慢 fade in。
2. 若兩顆握力球之前都已授權且已開啟，頁面會自動接回並跳過連線幕；若只開到一顆，會停在連線幕要求再連另一顆。GRIP RAW 是否回報只作背景偵測，不阻擋換幕，後面的亮暗 cue 會確認左右手是否真的有回應。
3. 連線後先做左右手對應：畫面依序顯示左手、右手；中央符號亮起時按住約 1.8 秒、暗下時放開，兩次之間停約 2.5 秒，各三次。**必須先放開、球亮後重新按下才算成功**，避免使用者提早按住時被誤判。按成功時中央符號會像有水灌入，並給一個溫和的空間拍浪回饋。這段不顯示「校正」或技術說明。
4. 左右手對應後進入 5 秒前導倒數。
5. 接著進入 30 秒呼吸倒數。請自然呼吸；**吸氣時握著，吐氣時放下**。不要求準，只記錄使用者覺察到的呼吸節奏。
6. 30 秒結束後才進入第二個任務畫面：**用握力表達緊張的程度**。用握力球握住 1.2 秒，表示此刻的緊張、情緒或能量強度。這段同時記錄施力曲線、穩定度、峰值與上升速度，並自然更新握力範圍。
7. session 中左右手握力重心會帶動聲源左右偏移；兩手平均時置中。中央圓球會跟握力互動：**握力越大，球越小**，像被擠壓成更密的內核；光、水位與海潮能量仍會增強。
8. 看完小 report 後，系統會依第一段的呼吸標記 pattern、握力峰值、上升速度、握持穩定度與左右手力道差異，建議一個引導場景；按「進入：海潮 / 左右潮 / 4-7-8」開始體驗。引導 session 仍可手動切換四個場景：海潮、左右潮、4-7-8、風箱。4-7-8 目前是**手動握拍**：球心顯示大數字，球心上方顯示「現在吸氣 / 現在憋氣 / 現在吐氣」，每數一下就握一下球，握一下才扣一拍；可接 Pan 自錄語音檔 `audio/478-inhale.wav`、`audio/478-hold.wav`、`audio/478-exhale.wav`。
9. 按「結束」後填寫結束後緊張度、被節奏推著走、能停留、agency 與一句筆記；按「儲存這次紀錄」後可「下載 CSV」。
10. 沒有球時鍵盤模擬：**空白鍵**＝Ball 1 握力、**Shift**＝Ball 2 握力、**方向鍵**＝揮動、按住空白鍵再按 **Enter**＝拍石。戴耳機最佳。

## 現況與待補（TODO(agent)）

已可跑：程序式三層海浪（surge / foam / impact）、多 LFO 疊加的湧浪動態、PannerNode(HRTF) + **MeshRIR ConvolverNode（dry/wet）空間鏈**、揮動跟隨方向、**用力握+揮動才觸發的拍石**（蓄積 swell + 長殘響尾巴）、WebHID 讀 GRIP RAW／IMU、自動校正、鍵盤模擬、**Arrival 抵達流程**（左右手對應 + 30 秒吸握吐放呼吸覺察 + 1.2 秒緊張程度握持 + 小 report + 使用者確認 + 依自我檢測建議呼吸場景 + CSV 欄位）、**引導 session preset**（海潮 / 左右潮 / 4-7-8 / 風箱：呼吸相位×握力水位×心跳海色）、**4-7-8 手動握拍**（球心數字 + 階段文字 + 每握一下扣一拍 + 可接語音）、**海作為主視覺**（最新為站在岸邊看出去的青綠海面、近岸白浪/水膜）、**中央圓球**（握力越大越被擠小，光與水位增強）、**鵝卵石大圓石低頻滾動**（阿朗壹風，Ball2 grip 主控捲動量、退浪相位給節奏）＋**低頻包覆床**、session 自評與 CSV 匯出。

> 註：頁面上的「即時節奏」顯示已移除（Pan 2026-07-09：聽覺感覺不到、無實質意義）。`dominant_mode` 仍在背景計算、只寫進 CSV 供研究，不顯示給使用者。

待接手補完（程式中以 `TODO(agent)` 標記）：

- ~~**放 IR**~~：**已完成（2026-07-08）**。`../assets/ir/room.wav` 已由 MeshRIR S1-M3969（.mat 版）匯出（中心左右一對接收點、48kHz stereo、0.55s、RT60≈0.38s）。程式啟動自動載入、convolver 濕聲啟用。要換不同接收點/房間可重跑 `../assets/ir/export_room_ir.py`。
- **閾值校準**：`HARD_GRIP` / `SWING_MIN` / `STRONG_SWING` 與揮動強度單位需在真實球上校準（`handleSwing`）。IMU 加速度單位（g 或 m/s²）未知，目前用「偏離慢基線」估揮動強度。
- **觸覺參數**：目前全域 `HAPTICS_ENABLED=false`，不要恢復自動震動。唯一例外是 4-7-8 使用者主動握一下時以 `sendHapticAll(..., true)` 給一次短確認回饋；需真球確認強度與時長。
- ~~**impact 細修**~~：**已完成（2026-07-08）**。浪拍礁石現在走專屬 HRTF panner（觸發當下定位在當前揮動方位、比底床近一點）＋短合成殘響尾巴（`impactVerb` convolver，指數衰減 0.9s），經獨立 `fxBus` 進 master tanh 限幅。已用 mock AudioContext 驗證訊號鏈到達輸出。
- ~~**session 流程 / CSV**~~：**已完成（2026-07-09）**。欄位包含 `pre_tension`、`post_tension`、`felt_pushed`、`felt_able_to_stay`、`agency`、`rhythm_note`、`dominant_mode`、impact count、平均握力與平均揮動。此紀錄仍為探索性，不作療效宣稱。
- **節奏狀態校準**：目前 `dominant_mode` 由簡單 heuristics 判斷（poly/eu/arry/iso），適合 prototype 與質性訪談；真實研究前需用 session 資料與訪談校準。
- **Arrival report / 建議校準**：目前小 report 使用呼吸標記數、標記間距 pattern（最短間隔、過近比例、連續過近、前後段漂移）、1.2 秒握持峰值、平均值、AUC、time-to-peak、穩定度、上升斜率與左右手力道差異，產生自然語言線索與下一段呼吸場景建議。這些不是診斷或情緒分類，需用真實 session 與訪談校準語言。

## 已知限制

- macOS 有時獨占已配對的藍牙 HID，導致 `requestDevice` 列不到或 `open()` 失敗。若發生，回退用 Python `../../Gripball/nature_loop.py`，Web 版當純聲音 demo。（同 `nature_loop_web.html` 的註記。）
- 聲音參數是設計起點，須在真實握力球上校準（見 `../DESIGN.md` §6 參數表）。
