# AGENTS.md — Tidal 跨 AI 協作準則

> 本檔給所有接手這個子專案的 AI（Claude、Codex、Antigravity、Cursor 等）與人類共同遵循。
> 目的：不同工具之間**無縫接軌**——任何一方接手時，讀完本檔＋`DESIGN.md` 就能繼續，不會推翻既有決策或破壞聲音品質。
> 若你是被指派接手的 AI：**先讀 `README.md` → 本檔 → `DESIGN.md` → `RESEARCH.md`，再動手。**

本檔規範「怎麼做事」；`DESIGN.md` 規範「要做什麼」。兩者衝突時，以本檔的**不可破壞原則**為最高優先。

---

## 0. 一分鐘上手

- 專案：雙握力球控制的放鬆海浪聲景，Web（WebHID + Web Audio）為主線。
- 現況：規格定稿、程式為骨架。你的工作多半是**把 `web/index.html` 裡標記 `TODO(agent)` 的 DSP / spatial 補完**，或依 `DESIGN.md` 擴充。
- 硬體協定不要自己猜：全部在 [`GRIPBALL_PROTOCOL.md`](./GRIPBALL_PROTOCOL.md)。
- 跑法：`cd Tidal && python3 -m http.server 8000`，桌面 Chrome/Edge 開 `http://localhost:8000/web/index.html`，不能用 `file://`。

## 1. 不可破壞原則（Guardrails，最高優先）

這些是聲景的價值核心，改了就不是這個產品。任何一項都**不可**在未經人類（Pan）確認下更動：

1. **聲音永遠成立、永不消失**。任何輸入組合、放鬆或無輸入下，輸出仍是一片可安住的海。沒有靜音、沒有刺耳、沒有「你做錯了」的懲罰性回饋。
2. **放鬆導向優先於刺激**。「浪拍礁石」的強互動是點綴，不是主體；預設偏向低喚起（low-arousal）。強拍事件要**稀疏、有界、有平滑起落**，峰值受限幅（見下）。**浪拍礁石只在「用力握 + 揮動」雙條件同時成立時觸發**，不自發、不因單一條件觸發（Pan 2026-07-08）。
   - **觸覺規則（不可違反）**：揮動中給輕度、跟隨的震動；浪拍礁石給一次強脈衝；**放下、無明顯揮動時絕不震動**。震動絕不用作懲罰或催促。
     - ⏸ **現況（Pan 2026-07-09）：所有震動回饋暫時撤掉**（`web/index.html` 的 `HAPTICS_ENABLED=false`，`sendHaptic` 直接 return），Pan 之後再想過。程式與規則保留，設回 `true` 即恢復。不要在未經 Pan 確認下重新啟用。
3. **有界參數，不自由生成**。所有可調維度都有明確上下限與轉場時間常數（見 `DESIGN.md` 參數表）。不引入無界的隨機或自由生成。
4. **限幅保護**。所有軌加總後過一級 soft-clip（`tanh` 或等效），雙手同時最大力也不爆音。這條沿用 `Gripball/nature_loop_web.html` 的既定作法。
5. **平滑，不跳變**。握力 level 與所有音訊參數都要時間平滑（Web Audio 用 `setTargetAtTime`；不要逐樣本硬跳）。避免破音與突兀。
6. **不診斷、不宣稱療效**。UI 文案與註解都用 wellness / supportive 語氣。EEG／生理訊號若接入，僅為探索性量測，不解讀為「已放鬆」的證明。
7. **隱私與同意**：任何 session 紀錄（CSV 等）只存本機，不上傳；欄位維持匿名（serial / 時間 / 評分），不加可識別個資。
8. **節奏彈性優先於強制同步**。Tidal 的新概念框架是 rhythmanalysis / 節奏調和：幫助使用者恢復可呼吸、可停留、可塑形的節奏彈性。不要做固定節拍催促、分數化壓力、或把 EEG/握力解讀成單一「正確狀態」。

如果某個需求與以上衝突，**停下來、在交接筆記裡提出，讓 Pan 決定**，不要自行取捨。

## 2. 工作流程

- **小步、可執行**：每次改動都讓 `web/index.html` 仍能在瀏覽器打開並發聲。不要留下半破狀態就交接。
- **保留既有結構**：`web/index.html` 是從已驗證的 `Gripball/nature_loop_web.html` 演化來的。互動核心（自動校正、慢漂移歸零、握壓節律、session 流程）已被 17 項對拍測試驗證過，**沿用、不要重寫**。
- **DSP 先在 Max/MSP 試，再搬 Web**（可選）：若要探索新音色，`maxmsp/` 是白板；定案的參數與結構寫回 `DESIGN.md` 再實作到 Web。
- **測試**：純邏輯（校正、對應、狀態機）盡量抽成可測函式。沿用 `Gripball/` 用 Node 跑對拍測試的模式。DSP 用耳朵 + 波形檢查。
- **不要引入重依賴**：兩人團隊、資源有限。Web 端優先用原生 Web Audio；spatial 若需函式庫，先評估 `Omnitone` / `JSAmbisonics`（見 `RESEARCH.md`），並在交接筆記說明理由。

## 3. 交接紀錄（每次工作結束都要寫）

在本檔最底部的 **## 交接紀錄** 追加一段（最新在最上）：

```
### YYYY-MM-DD — <你的工具名，如 Codex>
- 做了什麼：
- 現在能跑到哪 / 怎麼驗證：
- 未完成 / 卡住：
- 給下一位的建議或待 Pan 決策的問題：
```

不要刪別人的紀錄。決策若改變了 `DESIGN.md`，同時更新該檔並在此註明。

## 4. 檔案與路徑慣例

- 程式與文件放在 `Tidal/` 內；大型二進位（IR、音檔）放 `assets/`，不要塞進 git 或雲端同步的熱路徑。
- 不要把 Python venv、`node_modules`、下載的 MeshRIR 原始資料放進 Google Drive 同步資料夾（會拖慢同步）。放 `$HOME` 下或加 ignore。
- 路徑、指令要能跨 Pan 的兩台 Mac 使用（不要寫死個人絕對路徑）。

## 5. 溝通語言

- 文件與註解：**繁體中文為主**，技術術語可保留英文。與上層 EEG 專案一致。
- 對 Pan 回報：重視可驗證的引用、避免誇大宣稱；不確定就標記為待確認，不要編造數據或連結。

---

## 交接紀錄

### 2026-07-13 — Codex｜握力球停報 watchdog + 自動重送模式
- 做了什麼：Pan 回饋「有一顆一度有抓到，後來就不見了」。新增 HID liveness watchdog：每秒檢查每顆已連接球的 `lastGripReportAt`，超過 `HID_STALE_MS=2500` 但 HID 尚連著時，不清掉 device，只把 `ready` 降回 false、握力歸零、狀態顯示為「等待回應」，並以 `HID_MODE_RESEND_MS=1400` 節流重送 `MODE_9DOF_GRIP`。`updateHidStatus()` 現在逐顆顯示「回應中 / 等待回應」，避免看起來像球消失。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過，localhost `http://localhost:8001/web/index.html` 回 200。真球測試時若某顆停報，應看到「等待回應」並自動嘗試喚醒；重新收到 report 5 後會變回「回應中」。
- 未完成 / 卡住：若停報是藍牙/HID 實際斷線或 OS 獨占，重送模式不一定能救；需要使用者重新連線或重開球。若仍常發生，要參考 Sonic Squid 的連線策略或檢查模式封包。
- 給下一位的建議或待 Pan 決策的問題：不要再把「HID connected」和「握力資料 ready」混在一起；UI 可以不顯示 debug，但內部狀態必須分開。

### 2026-07-13 — Codex｜修 4-7-8 命名、arrival 聲音與焦慮度停留
- 做了什麼：依 Pan 回饋，將 `hold478` 顯示標題從「懸止的長吐」改成「4-7-8 呼吸」，文案改成吸四拍、停七拍、吐八拍。30 秒自我呼吸覺察的吸握/吐放現在會給溫和 cue wave：吸氣握下時依左右手定位播入浪，吐氣放開時播較輕的退浪。焦慮/情緒強度畫面不再 1.2 秒閃走，改為進畫面先停 1.8 秒讓使用者讀題，握住 1.8 秒後提示「可以放開了」，放開後才進小小回顧。haptic phase key 改用 cycle + phase index，避免 4-7-8 震動排程混亂；`setBreathPreset()` 也只在 session 內強制 update，避免尚未進 session 時提前排震。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過，localhost `http://localhost:8001/web/index.html` 回 200。需 Pan 用真球確認 arrival cue 聲音是否有被聽見、焦慮度畫面是否不再閃走、4-7-8 震動是否變得可讀。
- 未完成 / 卡住：震動仍依 HID duration/intensity 封包假設；若真球實測仍亂，下一步要回到 Gripball protocol 或 Sonic Squid 的 haptic 實作核對封包。
- 給下一位的建議或待 Pan 決策的問題：不要再用詩性標題替代呼吸法本名；練習標題要直白，詩性留在場景描述或聲音/視覺。

### 2026-07-13 — Codex｜月下海潮視覺 + 更明確的觸覺提示
- 做了什麼：依 Pan 回饋，調整中央符號質感，從陰沉水核改往「明月在海面上」：提高暖色月光、降低暗黑水感，canvas 新增月光反射與海面亮紋。新增左右手各自牽動的潮線：左手/右手握力分別平滑成 `__leftWave` / `__rightWave`，可同時、錯拍或單側湧上岸再退。4-7-8 與其他 preset 的 haptic 強度加大；4-7-8 吸氣雙短震更清楚、屏氣單震更明確，吐氣改成 330ms 間隔連續長震串，避免提示太細碎不明。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過，localhost `http://localhost:8001/web/index.html` 回 200。需 Pan 用真球確認視覺是否更有生命力、左右潮線是否能看出兩手不同步、觸覺是否足夠明確但不煩。
- 未完成 / 卡住：未做自動截圖 QA；視覺與觸覺都需要實機手感和眼睛校準。若震動仍不明確，下一步可能要調整 HID haptic report 格式或做更長 duration 的連續觸覺 envelope。
- 給下一位的建議或待 Pan 決策的問題：海潮主視覺應保留「月亮/海面/潮線」方向，不要退回暗色儀表或抽象球。左右手要能各自有時間性，不只是一個合成後的中心值。

### 2026-07-13 — Codex｜吸握吐放 + 4-7-8 觸覺節奏 + 找回拍石/低頻湧動
- 做了什麼：依 Pan 回饋，30 秒 arrival 呼吸覺察從「吸/吐各按一下」改為「吸氣時握著，吐氣時放下」，資料層以 `inhale` / `exhale` 狀態變化記錄，兩手同時握不會變成兩個靠很近的標記。重新開啟 haptics（`HAPTICS_ENABLED=true`），並在 guided session 依 phase 排程觸覺：4-7-8 的吸氣＝每單位兩個短震、四組；屏氣＝七個單震；吐氣＝八段較長震。海潮、左右潮、風箱也有對應的低侵入觸覺節奏。聲音上加強握力對低頻湧動、surge、pebble rolling 的影響；任一手握住都能推動海底湧動。拍石聲降低等待感、提高峰值，並新增明確用力跨過門檻時觸發（保留冷卻），不只依賴揮動。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過，localhost `http://localhost:8001/web/index.html` 回 200。需要真球驗證 haptic report 封包在兩顆球上是否符合手感，尤其 4-7-8 的雙短震是否太密或太強。
- 未完成 / 卡住：觸覺強度與 duration 是 prototype 起點；真球上可能需要調 `intensity/duration` 與 haptic 最短間隔。拍石聲現在也會被強握觸發，若太刺激需調高冷卻或門檻。
- 給下一位的建議或待 Pan 決策的問題：此版正式改變先前「暫停震動」決策，因 Pan 明確要呼吸法觸覺引導。若做健康/放鬆版，仍要保留有界、低侵入，不要把震動做成催促或懲罰。

### 2026-07-13 — Codex｜修 report 進不去 session 的 CSS 疊層 bug
- 做了什麼：Pan 回饋「開始 4-7-8 / 進入 4-7-8」重複且點了進不去。移除 report 內的第二顆動態 action button，只留固定主按鈕「進入這段練習」。同時修正 CSS：原本 `.guide-panel { display:grid }` 會覆蓋 `.phase { display:none }`，導致非 active 幻燈片仍可能在版面中干擾點擊或看起來像沒換幕；新增 `.phase.guide-panel:not(.active){display:none}` / `.phase.guide-panel.active{display:grid}`。主按鈕同時綁 `pointerdown` 與 `click`，降低 click 被吃掉的機率。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過，localhost `http://localhost:8001/web/index.html` 回 200。
- 未完成 / 卡住：尚未用真球完整走一次 arrival → report → 推薦 session；Pan 需重新整理 localhost 後實測。
- 給下一位的建議或待 Pan 決策的問題：幻燈片式介面要小心 CSS cascade，任何 `.phase` 類的顯示/隱藏規則都要比共用 panel 類更強。

### 2026-07-13 — Codex｜Arrival report 改成身心狀態 + 呼吸標記去重
- 做了什麼：依 Pan 回饋，呼吸標記新增 `BREATH_MARK_MIN_GAP_MS=900`，同一次吸/吐若兩手一起按或連續誤觸，太靠近的第二次按壓不再進入 arrival events。小小回顧畫面不再顯示「力道 / 用力速度 / 穩定度」這些內部 feature，改為「呼吸狀態 / 身體張力 / 停留感 / 接下來」。推薦列新增「開始 海潮 / 左右潮 / 4-7-8」按鈕，直接帶入推薦 preset 進 session；底部「進入：...」也會帶入同一 preset。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過，localhost `http://localhost:8001/web/index.html` 回 200。4-7-8 推薦現在有獨立 action button，不只是文字。
- 未完成 / 卡住：900ms 去重窗是 prototype 值，需用真人呼吸標記資料校準；若有人呼吸非常快，可能會略保守。
- 給下一位的建議或待 Pan 決策的問題：使用者畫面應呈現「狀態」與「下一步陪伴」，不要把 feature name 或百分比直接當 report。技術 feature 保留在 CSV。

### 2026-07-13 — Codex｜Arrival 自我檢測 → 呼吸法建議
- 做了什麼：依 Pan 新想法，把第一段自我檢測接到第二段呼吸引導選擇。`buildArrivalReport()` 現在會依呼吸標記 pattern、握力峰值、上升速度、握持穩定度與左右手力道差異產生 `recommended_preset` / `recommended_reason`，report 多一列「接下來」，按鈕改成「進入：海潮 / 左右潮 / 4-7-8」。`startSession()` 會讀這個建議自動切 preset；CSV 新增 `arrival_recommended_preset`、`arrival_recommended_reason`、`arrival_hold_balance_delta`。
- 現在能跑到哪 / 怎麼驗證：建議邏輯目前保守：高峰值/快上升/不穩 → 4-7-8；左右差異大 → 左右潮；呼吸標記太少/太近/前後漂移大 → 海潮；風箱仍保留手動切換，不自動推薦。`node` script 語法檢查通過；localhost `http://localhost:8001/web/index.html` 回 200。
- 未完成 / 卡住：推薦規則是 prototype heuristic，還沒有真實資料校準。之後可以把使用者「像/不像」確認也納入推薦權重。
- 給下一位的建議或待 Pan 決策的問題：建議文案要維持「可以先試」而不是「你應該做」；避免把自我檢測變成分類/診斷。

### 2026-07-13 — Codex｜引導 session 互動版：呼吸相位 × 握力水位 × 心跳海色
- 做了什麼：依 Pan 與 Claude 新增的 `BREATHING.md`，把 `web/index.html` 的 session 從單純文字頁改成可切換的互動引導場景。新增四個 preset：海潮呼吸（共振慢呼吸）、左右潮（Nadi Shodhana 空間發想）、4-7-8 懸止長吐、風箱（Bhastrika 提振型、仍有界）。呼吸相位會驅動中央內核與海浪 swell 週期；握力成為內核水位與 agency；「心跳」目前先做成 `heartWeather` 慢變代理，主要映射到海浪色澤/霧感，而不是做心跳聲，避免焦慮化。CSV 新增 `guided_preset`、`avg_breath_phase`、`avg_heart_weather`，session samples 也記錄 guided phase。
- 2026-07-13 補強：Pan 覺得第一版互動變化不夠大，因此加強 session 視覺：中央內核放大，呼吸直接改變內核尺度與環形旋轉；左右潮推動內核與海面焦點左右移動；心跳海色即使沒有真實 HR 也以慢變代理自走，握力/揮動會把海色推暖、霧變厚；4-7-8 停屏加厚霧，風箱模式讓浪帶更亮、更短促。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過（`scripts ok 1`），localhost `http://localhost:8001/web/index.html` 回 200。Playwright 套件此環境沒有，未做自動截圖；需 Pan 用瀏覽器實看四個 preset 的節奏、文字密度、海色變化是否自然。
- 未完成 / 卡住：目前 `heartWeather` 不是實際心率/HRV，只是由握力與 motion 推估的慢變視覺天氣；日後接真實心跳時應讓 HR/HRV 控制海色與透明度，不做直接 heartbeat ping。4-7-8 的停屏目前是視覺/週期懸止，尚未加專屬駐音層。
- 給下一位的建議或待 Pan 決策的問題：心跳最好繼續作「海色/霧/透明度」而非聲音事件；風箱模式要明確留在 Activate/提振語境，不當預設。若 Pan 喜歡這個方向，下一步是調每個 preset 的聲音差異與讓 Arrival report 自動建議 preset。

### 2026-07-13 — Codex｜呼吸練習入口修正 + 呼吸標記 pattern 分析
- 做了什麼：Pan 回饋「進不到不同呼吸練習」後，修正入口流程。新增 viewport 固定的「呼吸練習」按鈕，避免 in-app browser 矮視窗把入口擠出可視區；`enterGuidedPractice()` 改為先切 session，再嘗試啟動音訊，且 `startAudio()` 在 session 中不再 `resetArrival()`。另新增呼吸標記 pattern 分析，避免只看平均間距：記錄最短間隔、過近標記數/比例、連續過近段、前半/後半平均、前後漂移比例，並在 report 優先指出「標記很靠近」或「前後段差很多」。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過。已用 in-app browser 開 localhost 實測：固定「呼吸練習」入口可見；點擊後 `phaseSession` 變 active；四個 preset 顯示；點 `4-7-8` 可切換為「懸止的長吐」。
- 未完成 / 卡住：Browser 工具因安全政策不能操作 `file://`，以 localhost 驗證同一份檔案。Pan 若直接開 file 也應看到本地改動，但 WebHID/IR 載入仍建議走 localhost 或 GitHub Pages。
- 給下一位的建議或待 Pan 決策的問題：呼吸標記 close threshold 暫設 1.05 秒，需用真人資料校準；report 語言仍應避免把「亂按」說成失敗。

### 2026-07-10 — Claude (Opus)｜呼吸引導 × 聲景設計規格（新增 BREATHING.md、READING.md）
- 與 Pan 深談後產出兩份文件，未改程式：
  - **`BREATHING.md`**：呼吸引導 × 聲景實作規格（交給 Codex）。核心：海＝**自適應、邀請式**呼吸/握放引導（先接再引、邀請非命令、反 dressage、不醫療化）；呼吸法的三個「音樂簽名」（時間包絡/喚起方向/自身音色）；放鬆組對照（共振→海潮、4-7-8→山谷風+懸止駐音、Nadi Shodhana→左右交替海浪用 azimuth、Ujjayi→海本身、Bhramari→嗡鳴駐音、Sitali→清涼溪）；提振組（**Bhastrika 風箱式**、Kapalabhati）＝**獨立 Activate 模式、非放鬆預設**；握放耦合（PMR：吸握吐放）、放進 Session 1 之後的流程、技術對照與開放問題。
  - **`READING.md`**：握力/節奏/呼吸文獻導讀（PURE、UK Biobank、握力↔憂鬱/腦、Thaut/Large/Jones、Lefebvre、共振呼吸）。
- **Lefebvre 立場**：Rhythmanalysis 當**透鏡非測量儀**；eurhythmia 是方向但只描述不貼標籤；guardrail＝反 dressage。
- 待 Pan/Codex 決策：握放耦合預設（§7）、停屏聲學（駐音層做「懸止」非「停頓」）、Activate 模式分離、各法目標週期真人校準。族群相關 ≠ 個人療效（守 guardrail 6）。

### 2026-07-10 — Codex｜連線門檻改回兩顆 HID 已開啟
- 做了什麼：參考 Pan 提到的 Sonic Squid 連線方式，修正上一版把 `report_id === 5` 當成換幕硬門檻造成的卡住問題。現在連線幕只要求兩顆不同 HID 裝置已開啟；`readyCount()` / GRIP RAW 回報仍保留為背景狀態與 debug，不再阻擋進入左右手亮暗 cue。新增 `maybeAdvanceFromConnect()` 統一處理手動連線、已授權自動接回與 HID connect event。
- 現在能跑到哪 / 怎麼驗證：兩顆已授權或手動連到兩顆後，應自動進入「左手」亮暗 cue；若只有一顆才停在「再連接另一顆握力球」。待真球現場確認 cue 是否能收到握力 raw 並產生水灌入回饋。
- 未完成 / 卡住：若某些球已開啟但仍完全沒有 GRIP RAW，流程不再卡連線幕，但 cue 成功判定仍會缺少握力資料；必要時可再補 IMU fallback 或重新檢查模式命令。
- 給下一位的建議或待 Pan 決策的問題：不要再把「資料 ready」當成「可以換幕」的前提；Tidal 的互動應以使用者可理解的場景推進，技術確認留在背景。

### 2026-07-10 — Codex｜Arrival report 使用者語言降溫
- 做了什麼：依 Pan 回饋，把「小小回看」改成「小小回顧」。Report 標題從「呼吸標記 / 此刻力道 / 抵達方式 / 停留紋理」改成更直覺的「呼吸 / 力道 / 用力的速度 / 握住時的穩定」。內容也移除「峰值接近高施力區、節奏紋理、穩定度變化」等研究語，改為使用者可理解的描述。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需 Pan 看一次 report 語氣是否還太分析。
- 未完成 / 卡住：CSV 欄位仍保留 technical feature names，這是研究資料層，不顯示給使用者。
- 給下一位的建議或待 Pan 決策的問題：Report 面向使用者的文字要避免「分類」「診斷」「研究術語」；需要技術詞時留在 CSV 或文件。

### 2026-07-10 — Codex｜連線需兩顆都回傳握力資料才進下一幕（已由上一段修正）
- 做了什麼：修正連線判斷過鬆的問題。新增 `state.ready` / `state.lastGripReportAt` / `readyCount()`；裝置 `connected` 只代表 HID 開啟，只有收到 `report_id === 5` 的 GRIP RAW 後才算 ready。連線幕現在必須 `readyCount() >= 2` 才會進入左右手 cue；只連到/只收到一顆資料時會留在連線幕並提示再連另一顆。debug 狀態文字改為「已連接 x / 已回應 x」。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需真球確認：右上角兩顆 connected 但只有一顆 ready 時不會跳幕；兩顆都有 GRIP RAW 後才跳。
- 未完成 / 卡住：若某顆球連上但模式指令未成功送出，會一直 connected 但 not ready；目前只顯示等待另一顆，之後可加「重新連接」或重送模式指令。
- 給下一位的建議或待 Pan 決策的問題：若 ready 判斷太嚴格造成等待，可在 register 後每秒重送 `MODE_9DOF_GRIP` 直到收到 report 5。

### 2026-07-10 — Codex｜cue 節奏放慢 + 成功灌水回饋
- 做了什麼：依 Pan 回饋，左右手 cue 改成更慢且穩定的節奏：每手開始先留 1.8 秒觀看時間；每次亮起 1.8 秒、暗下 2.5 秒，各三次。改用 ready/on/off 節奏避免亮暗間隔看起來亂跳。按成功時曼荼羅用 `--cue-fill` 顯示水從下方灌入，並加 `cue-success` 光暈；成功按壓也會補一個定位 cue wave，避免只靠亮起聲音但使用者聽不到回饋。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需真球確認按成功時水位是否穩定上升、第三次是否完整、聲音是否能可靠聽見。
- 未完成 / 卡住：如果 AudioContext 因瀏覽器限制仍 suspended，第一次 HID input 是否可 resume 要實機確認；目前有 `resume().catch()` 和成功聲補播，但瀏覽器政策可能仍要求明確點擊。
- 給下一位的建議或待 Pan 決策的問題：如果水位太像 UI progress bar，可改成粒子/水紋擴散；如果太不明顯，提高 `cue.fill` 增量或 `cue-success` 對比。

### 2026-07-10 — Codex｜連線幕等待兩顆握力球
- 做了什麼：修正「只連一顆球就進下一幕」的流程 bug。新增 `connectedCount()` 與連線幕文案更新：0 顆時顯示「連接握力球」，1 顆時顯示「再連接另一顆握力球」並停留在連線幕，只有兩顆都連到才進入左右手 cue。已授權裝置仍會自動接回；若頁面載入時只接回一顆，也會停留等待第二顆。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需真球驗證 WebHID chooser 第二次授權另一顆後能進入左右手 cue。
- 未完成 / 卡住：WebHID 不能無手勢授權全新裝置；未授權的第二顆仍需要使用者再按一次連接按鈕。已授權過的第二顆可自動接回。
- 給下一位的建議或待 Pan 決策的問題：若現場兩顆球在 chooser 裡難以辨認，可能要用球身貼紙/顏色或一次授權兩顆的操作引導。

### 2026-07-10 — Codex｜修第三次 cue 被截短 + cue 聲音加空間尾巴
- 做了什麼：修正左右手 cue 第三次看起來很短的問題。原本用 `rep >= HAND_CUE_REPS` 判斷，第三次 on 結束後太快切幕；現在改成跑滿 `HAND_CUE_REPS * (ON+OFF)`，第三次亮 1.2 秒後仍完整暗下並停 2 秒才換幕。cue wave 聲音加上 dry/wet 分流，wet 送入既有 `impactVerb`，讓每次亮起都有溫和、帶空間尾巴的小拍浪聲。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需耳機確認第三次 cue 視覺和聲音都完整，且空間尾巴不過度干擾。
- 未完成 / 卡住：cue wet 目前共用 `impactVerb`，若同時觸發正式 impact 可能共享殘響；目前 cue 階段不會有正式 impact，應可接受。
- 給下一位的建議或待 Pan 決策的問題：如果 cue 聲太像提示音，降低 peak 或增加更暗的 bandpass；如果不夠像拍浪，增加 wet 或延長衰減。

### 2026-07-10 — Codex｜真正滿版換幕 + cue 間隔 2 秒
- 做了什麼：依 Pan 強烈回饋，把體驗外框改成真正 full-screen guided scene：`header/footer/debug controls` 隱藏，`phaseBefore` 滿版置中，頁面不再以長網頁方式滾動。場景切換的暗下/模糊 transition 拉長，讓每一幕更像幻燈片換場。左右手 cue 的暗下間隔從 0.62 秒改為 **2 秒**，每次亮起仍為 1.2 秒。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需用瀏覽器實眼確認是否真的不再像一頁式網頁、換幕是否夠明顯。
- 未完成 / 卡住：目前仍共用 `phaseBefore` 容器切換子場景，不是每幕獨立 route；視覺上已是滿版換幕。若還不夠，可重構成單一 `sceneRoot` template renderer。
- 給下一位的建議或待 Pan 決策的問題：此專案的互動應以「一幕一任務」為原則，避免把下一步文案提前塞到同一屏。

### 2026-07-10 — Codex｜1.2 秒握持 + 左右手 cue 溫和拍浪聲
- 做了什麼：把情緒/緊張握持從 2.5 秒改為 **1.2 秒**，畫面提示改成「握住一下」。左右手三次 cue 也統一為每次亮起 **1.2 秒** 持續握壓，暗下時放開。cue 亮起時新增溫和的 cue wave 聲音：使用前一版拍浪質感但峰值更低、慢 fade in/out，走專用 HRTF panner；左手 cue 偏左、右手 cue 偏右。若聲音尚未淡入，第一次 cue wave 會先觸發 master fade-in。
- 現在能跑到哪 / 怎麼驗證：HTML script 語法檢查通過（`scripts ok 1`）。需要耳機實聽確認 cue wave 是否夠溫和、是否明確有左右定位。
- 未完成 / 卡住：cue wave 目前用合成 noise/bandpass，不是正式 impact 完整殘響鏈；若 Pan 想要更像「拍浪但小聲」，可再把 cue 送一點短殘響或重用 impactVerb。
- 給下一位的建議或待 Pan 決策的問題：1.2 秒可能讓 stability 計算樣本較短，report 語言若太精細可降低對「穩定度」的描述權重。

### 2026-07-10 — Codex｜左右手無文字 cue 分配
- 做了什麼：依 Pan 提議，在握力球連線後、前導倒數前新增左右手對應幕。畫面先顯示「左手」，中央潮汐符號亮起時按住、暗下時放開，共三次；系統只在亮起期間統計哪個 HID slot 有按壓，將其記為左手。下一幕同樣對右手做三次，若判到同一 slot 會自動把另一 slot 分給右手。全程不顯示「校正」「Ball 1/2」或技術說明。左右聲源重心改用 `handMap.left/right`，而非固定 slot。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需兩顆真球實測左右手對應是否穩定，尤其使用者如果沒在亮起時按、或兩顆都動時的 fallback 是否合理。
- 未完成 / 卡住：目前只有視覺 cue，沒有聲音 cue；若 Pan 覺得無文字仍不夠直覺，可加入很輕的聲音/光脈衝。鍵盤測試會跳過左右手對應，仍以 slot 1/2 預設。
- 給下一位的建議或待 Pan 決策的問題：不要把「三次校正」寫成說明文字。若要更隱形，可連「亮起時按住，暗下時放開」都改成首次示範動畫。

### 2026-07-10 — Codex｜幻燈片式導引 + 握力啟動聲音 + 左右聲源重心
- 做了什麼：把入口改成 slideshow/guided scene：頁面載入會自動準備 Web Audio 與掃描已授權握力球；若球已連上就跳過連線幕，否則只顯示「連接握力球」。連上或鍵盤測試後進入 5 秒前導倒數，再進 30 秒呼吸倒數，結束後才進 2.5 秒情緒/緊張握持。第一次真實按壓同時 resume AudioContext、fade in 聲音並默默參與握力範圍適應。新增左右握力重心聲像：Ball 1 偏左、Ball 2 偏右，兩手平均置中，與揮動方向低權重疊加。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查與本地頁面 HEAD。需真球驗證已授權裝置是否能自動跳過連線幕，以及第一次按壓是否可靠觸發 fade-in。
- 未完成 / 卡住：瀏覽器 autoplay 限制仍存在；無使用者手勢時 AudioContext 可能保持 suspended，但連接握力球按鈕/空白鍵/第一次可接受手勢會補 `resume()`。真球 HID input 是否足以 resume 需實測。
- 給下一位的建議或待 Pan 決策的問題：若 Pan 要完全無按鈕自動播放，瀏覽器安全模型可能不允許；比較好的產品設計是讓「連接握力球」或「第一次按壓」成為合法啟動手勢。

### 2026-07-10 — Codex｜聲音延後到第一次按壓才淡入
- 做了什麼：依 Pan 回饋，`啟動聲音` 現在只建立/準備 Web Audio，`OceanEngine.master.gain` 初始為 0。第一次真球或鍵盤握壓達到輕觸閾值時才 `fadeIn()` 到正常音量（約 2.8 秒），避免每次啟動就先冒出拍浪/海浪聲。impact 也加上 `state.audioFadedIn` guard，避免聲音尚未淡入時 Enter 或強揮動突然拍石。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需 Pan 實聽確認 fade-in 時間是否太慢或太快。
- 未完成 / 卡住：若真球連線時校正雜訊讓 level 短暫超過 `ARRIVAL_PRESS_ON`，可能會提早淡入；真球測試後可調淡入閾值或加入「必須在 Arrival 開始後才淡入」規則。
- 給下一位的建議或待 Pan 決策的問題：如果想要「頁面打開就自動啟動聲音」仍受瀏覽器 autoplay 限制，至少需要一次使用者手勢；目前仍保留「啟動聲音」按鈕作為 Web Audio 合法入口。

### 2026-07-10 — Codex｜Arrival 文案拆成單一任務畫面
- 做了什麼：依 Pan 回饋，把 Arrival intro 拆乾淨。第一段畫面只說 30 秒呼吸覺察，中央顯示大倒數與呼吸標記數；不再提前說明後面的情緒/緊張握持。30 秒結束後才切到第二畫面，說明「用手握出此刻情緒或緊張強度」並開始 2.5 秒握持。
- 現在能跑到哪 / 怎麼驗證：待跑 HTML script 語法檢查。需 Pan 實眼確認第一畫面是否足夠清楚、是否仍太多字。
- 未完成 / 卡住：倒數仍顯示呼吸標記數；若 Pan 覺得也是干擾，可再只留大秒數與一句話。
- 給下一位的建議或待 Pan 決策的問題：Arrival 每個畫面只應有一個任務，不要在第一屏預告下一步造成認知負擔。

### 2026-07-10 — Codex｜海回到主視覺 + mandala-inspired 潮汐符號 + Arrival 確認
- 做了什麼：依 Pan 補充回饋修正上一版「海退太後面」的方向：海仍是主視覺，但改成暗色、厚霧、低對比的潮汐場與寬幅暗流，不再畫人工正弦波線。中央圓形物件改成受 mandala / 唐卡圓形秩序感啟發的潮汐符號，用於聚焦與回應握力，不直接複製宗教圖像。Arrival 小 report 後新增陪伴式確認：「你覺得像嗎？」Ball 1/空白鍵＝像，Ball 2/Shift＝不太像；結果寫入 `arrival_confirmation`。
- 現在能跑到哪 / 怎麼驗證：用 Node 抽出 HTML script 語法檢查通過（`scripts ok 1`）。本地 server `http://localhost:8001/web/index.html` 回 200。此段主要是視覺與互動語氣調整，CSV 欄位已加。
- 未完成 / 卡住：需 Pan 實眼判斷新海面是否比較接近想要的海岸感，以及 mandala-inspired 符號是否太宗教、太圖案化或太弱。
- 給下一位的建議或待 Pan 決策的問題：若做海岸聲紋 preset，先下載 CC/公有領域 field recording，分析頻譜/事件密度/節奏後轉成合成參數；不要直接把未授權錄音塞進產品。

### 2026-07-10 — Codex｜中央內核球 + 沉浸式 Arrival 畫面
- 做了什麼：依 Pan 回饋移除主畫面的 dashboard 感，把原本右側握力數值/狀態面板從視覺前景隱藏（DOM 保留供程式與 CSV 使用）。畫面改為單一中央引導：內核球與文字在正中央，握力/潮汐/揮動以球的大小、光暈、內部紋理與輕微位移低侵入回應。Canvas 海浪改為暗色、低對比、慢變的潮汐場，不再畫人工波線，讓海成為環境而非主圖像。
- 現在能跑到哪 / 怎麼驗證：用 Node 抽出 HTML script 語法檢查通過（`scripts ok 1`）。本地 server 仍可用 `http://localhost:8001/web/index.html`（若 8001 被占用，從 `tidal/` 另開 port）。
- 未完成 / 卡住：未用瀏覽器截圖工具做視覺 QA；需 Pan 實眼確認內核球質感、配色、動態是否足夠「內核」且不刺眼。握力與海浪聲音的關聯仍可能需要聲音引擎 mapping 再調，這次主要先修畫面與互動焦點。
- 給下一位的建議或待 Pan 決策的問題：不要把握力百分比、潮汐讀數、即時狀態分類放回主畫面。若需要 debug，做隱藏開關或 URL flag。後續可把 session 中的文字再做成更像引導語的慢節奏段落，而不是固定一句話。

### 2026-07-10 — Codex｜Arrival 抵達流程第一版
- 做了什麼：把 `web/index.html` 的「開始前」改成自然對話式 Arrival：30 秒呼吸覺察點按（發現吸氣/呼氣就按一下）→ 2.5 秒情緒/緊張握持 → 小 report → 進入原本 session。這段同時記錄呼吸標記數/頻率/間距、握持峰值/平均/AUC/time-to-peak/穩定度/上升斜率，並寫入 CSV。語言避免「校正」「診斷」「分數化」，但內部仍利用 2.5 秒握持更新握力範圍。
- 現在能跑到哪 / 怎麼驗證：用 Node 抽出 HTML script 語法檢查通過（`scripts ok 1`）。無球可用空白鍵完成呼吸點按與 2.5 秒握持；真球需 Pan 實測手感與 report 語言。
- 未完成 / 卡住：尚未用真實握力球校準 Arrival 的 `ARRIVAL_PRESS_ON/OFF`、2.5 秒握持是否過長/過短、report 語言是否過度解讀。未做「結束後也用握力表示狀態」的對稱流程。
- 給下一位的建議或待 Pan 決策的問題：先用 5–10 次真實 session 看小 report 是否像「被理解」而不是「被評分」。若成立，再考慮把 after 也改成握力表達，形成 pre/post grip recovery 比較。

### 2026-07-09 (j) — Claude (Opus)｜修「兩顆球 mapping 成同一顆」+ 動態偵測
- Bug：舊 `connectBall` 用 `devs[0]` + `++ballCount`，無去重；chooser 第二次常回傳同一顆 device，devices[1]/[2] 指到同一物件 → 一顆球同時驅動兩個 slot。
- 重寫連線：`syncBalls()` 用 `navigator.hid.getDevices()` 列出已授權的球，`deviceSlot()` 去重（同一 device 不佔兩 slot），`freeSlot()` 分配；每顆 device 只綁一次 inputreport，依 `e.device` **動態路由**到正確 slot。每次 register 給該 slot 一個**全新 GripCalibrator**（各自自適應施力範圍）。
- 動態偵測：`navigator.hid` 的 `connect`/`disconnect` 事件自動接回／釋放 slot（斷線清 slot、歸零、更新狀態）；頁面載入即 `syncBalls()` 接回先前授權的球。
- 限制：WebHID **不提供 serialNumber**，故以 device 物件識別去重；兩顆球外觀相同時，chooser 要挑「不同的那一顆」，挑同一顆兩次只會連到一顆（但不再假性複製）。
- 驗證：node --check 過、無 ballCount 殘留、頁面 200。無實機無法端到端測，需 Pan 用兩顆真球確認各自獨立。

### 2026-07-09 (i) — Claude (Opus)｜浮動握力校正（很用力才 30% 的修正）
- 問題：Pan 很用力握只到 30%（固定 `AUTO_FULL_SCALE=1250` 對這顆球太高）。
- 改成**浮動滿刻度**：`GripCalibrator` 追蹤觀察到的最大 posDelta（`this.span`，有界 300–1400、慢衰減 `GRIP_SPAN_DECAY` 自動適應），滿刻度＝`span*GRIP_HEADROOM(0.82)`；再過響應曲線 `pow(rawLevel, GRIP_GAMMA=0.75)`（中低握就有感）。慢漂移門檻改成 `span*0.15`（相對值，小範圍球不會被吃掉太多）。
- 可調常數集中在檔頭：`GRIP_MIN_SPAN / GRIP_MAX_SPAN / GRIP_HEADROOM / GRIP_SPAN_DECAY / GRIP_GAMMA`，都有中文註解。
- 驗證：以「hard grip=+380」模擬——舊制 30%，新制 +60→30%、+120→50%、+190→70%、+320→100%，全程覆蓋 0–100%。node --check 過、頁面 200。
- 註：這是自動、每次適應（非「每次要手動校準」），仍可與 Pan 做一次校準訓練微調 GAMMA/HEADROOM 手感。sim（鍵盤）不受影響。

### 2026-07-09 (h) — Claude (Opus)｜依 Pan 阿朗壹現場錄音對齊聲場
- Pan 上傳 `036-2011-09-10 …阿朗壹海邊.wav`（立體聲 44.1k、105s），要這個聲場/感覺。程式分析得到目標指紋：**頻譜很暗**——spectral centroid ~428Hz；能量分佈 sub(20-120Hz) ~21%、120-500 ~37%、500-2000 ~34%、2-6kHz 僅 1.3%、6k+ ~0%；浪的振幅週期 ~4-5s 但很不規則（autocorr 只 0.17）；石頭撞擊 ~47/s；L/R 相關 0.88、side/mid ~0.28。
- 據此retune 引擎：surge cutoff 大降（`250 + 700*energy*(…) + 200*sp`，天花板 ~1250Hz）；foam 幾乎關（gain 0.16→0.045、HP 2200→1500，因錄音幾乎無高頻）；sub 包覆床加強（`0.13 + 0.26*energy*(…)`、LP 110→130）；pebble 壓更低（LP `380+420*stoneAmt`）、grain 密度調到 ~40/s（8–38ms 間隔）；swellPeriod 18-5*tide → 11-3*tide（~8-11s，比全 18s 接近現場又不嚇人）。
- 驗證：離線模擬合成頻譜 vs 錄音——sub 20.2% vs 20.9%、120-500 44% vs 37%、500-2k 31.8% vs 34%、2-6k 1.0% vs 1.3%、centroid 439 vs 428Hz。node --check 過、頁面 200。未動 guardrail。
- 註：低頻包覆在封閉耳機最明顯，開放式智能眼鏡會弱很多。錄音檔在 uploads（暫存），durable 的是上面這組量測數字。

### 2026-07-09 (g) — Claude (Opus)｜兩球控制置換 + 對齊頁面文字
- Pan：把兩顆球的握壓角色互換，並修頁面上還沒改到的文字。
- 置換（唯一功能差在 grip 映射；揮動→方向兩球皆可）：`setGrip` slot1→`setTide`、slot2→`setSpread`。故 **Ball 1 grip＝潮汐能量；Ball 2 grip＝鵝卵石捲動（+空間）**。
- 對齊文字：球標籤 Ball1「潮汐/能量」、Ball2「鵝卵石/空間」；操作提示（空白鍵=Ball1 潮汐、Shift=Ball2 石頭）；狀態面板「潮汐」讀數改讀 `grip[1]`；`analyzeMode` eu 條件的「潮汐低」改判 g1；引擎註解更新。DESIGN §2 已重寫成置換後版本（Ball1 潮汐 / Ball2 鵝卵石+空間 / 方向=揮動）。
- 待對齊（下一位可順手）：`RHYTHMANALYSIS.md` §3.3 仍寫 Ball1=外在/空間、Ball2=內在/潮汐，置換後語意相反，需更新或加註。
- 驗證：node --check 過、頁面 200、grep 確認映射/標籤/讀數一致。未動 guardrail。

### 2026-07-09 (f) — Claude (Opus)｜阿朗壹大圓石低頻 + 低頻包覆 + Ball1→石頭 + 移除即時節奏顯示
- 石頭音色改「大圓石」（阿朗壹／南田石）：`pebbleBuffer` 每顆石＝低頻共振（70–330Hz 衰減正弦）＋顆粒摩擦、較長較悶、密度較疏；`pebbleBP` 改 **lowpass ~520–940Hz**。整體更低沉。
- 新增**低頻包覆床** `sub`：noise→lowpass 110Hz→subGain→**直接進 clip（不過 panner）**，非定位→裹住整個聲場（阿朗壹「被低頻與天地包圍」）。由 energy×swell 緩慢調變，有界。
- **Ball1 grip 改為主控鵝卵石捲動量**（Pan：原本 spread 效果不顯著）：`stoneAmt=pow(spread,0.6)` 決定石頭量，退浪相位 `roll` 給節奏；仍保留 sp 對聲場遠近的微調為輔。DESIGN §2 已更新。
- **移除頁面「即時節奏」顯示**（Pan：聽覺感覺不到、無實質意義）：拿掉 orb + modeLabel + modeDetail 及 render 中對應更新；`analyzeMode()` 保留、僅在背景寫 `state.dominantMode` 供 session CSV 研究欄位（不顯示給使用者，符合 RHYTHMANALYSIS「arrhythmia 等詞留研究層」）。狀態面板保留 session/拍石/揮動/潮汐 讀數。
- 驗證：node --check 過、無殘留 DOM 參照、頁面 200。仍守 guardrail（有界、平滑、tanh、聲音不消失）。待 Pan 真頁面確認石頭低頻量、包覆感、Ball1 手感。

### 2026-07-09 (e) — Claude (Opus)｜鵝卵石聲景 + 撤觸覺 + 潮汐放慢（Pan 回饋）
- Pan 要的海岸：**鵝卵石沿岸**——每次潮汐捲動大量石頭、夾帶能量從海底湧上、與海濤呼應。新增 shingle 層：`OceanEngine.pebbleBuffer()`（密集短促噪音撞擊的循環紋理，立體聲去相關）→ `pebbleBP`(bandpass ~1.6–3kHz，能量高→更亮) → `pebbleGain`，由**退浪閘門** `drawg=clamp((0.52-swell)*2.2)*energy` 調變（水退時石頭最盛，與 foam 湧上相位呼應）。見 DESIGN.md §4.4。
- **撤掉所有震動回饋**（Pan：之後再想過）：`HAPTICS_ENABLED=false`，`sendHaptic` early return；impact() 仍照觸發（只是沒觸覺）。guardrail 2 加註暫停狀態，設回 true 即恢復。已徵得 Pan 同意，非擅自違反。
- **潮汐動態放慢**（Pan：太快有點可怕）：`setTide` easing 0.05→0.018；`swellPeriod` 14-6*tide → 18-5*tide（更慢呼吸）；視覺 `__seaScroll` 0.015+0.28*tide → 0.010+0.16*tide。
- 驗證：node --check 過；pebbleBuffer 產出合理（~69% 非零、peak 0.7）。仍需 Pan 真頁面確認石頭聲的量/亮度、潮汐是否夠慢。
- 待接手：石頭聲或可加對應視覺（近岸石灘微光，用 metrics.pebble）；閾值校準；EEG record-only。

### 2026-07-09 (d) — Claude (Opus)｜第一人稱海面 + 有界隨機層疊（去機械感）
- Pan 決策：把對話原型的**第一人稱海面**做進 `web/index.html`，取代原本側看的機械版；並依 Pan「浪是千層的、充滿隨機性、有一個和握力球對齊的焦點中心，抽掉隨機就顯機械」加入有界隨機。先前用 Schertz & Berman 的 soft fascination 把整體調柔（慢、低對比、收斂暗角/光暈）。
- 視覺（`drawSea` 全改）：透視海面，浪從地平線朝觀者捲來，`__seaScroll` 速度隨 tide（握→湧近、放→遠去）；方位 az＝焦點中心（地平線光暈 + 浪整排斜切 + splash 定位）。22 層浪、每道浪用 `seaHash(id)` 給不同振幅/波長/相位、3 octave 碎形細波 → 有機非機械。柔和暗角＝包覆感。讀 `engine.tide/azimuth/metrics(swell,foam,rw)`、`state.lastImpactAt`。
- 聲音：加**有界隨機漫步** `rw/rw2`（均值回歸+限幅），微擾 cutoff/surgeGain/foam gate 與 swell 週期/振幅；`swell()` 疊更多不可公約 LFO（47/71/113s + 較慢浪組）。仍守 guardrail：全部有界、setTargetAtTime 平滑、過 master tanh、聲音不消失。
- 也修過 server 路徑：`loadIR` 多候選 + README 改從 Tidal/ 開（見 (b)）。
- 驗證：node --check 過；本機 server web/index.html 200、room.wav 200；canvas#sea 為 fixed 全螢幕背景。**需 Pan 在真頁面用眼睛/耳朵確認**手感（湧來/遠去強度、隨機量、方向清晰度）。
- 待接手：真球控制映射已在（Ball2 grip→tide、Ball1 swing→az、Ball1 grip→spread）；閾值/觸覺實機校準；EEG record-only。

### 2026-07-09 (c) — Claude (Opus)｜拍石音色 + Ball1 grip 手感（依 Pan 實測回饋）
- Pan 回饋：拍石殘響太短沒質感、且「一開始就拍擊」太硬；Ball1 要很用力握才有一點點反應。
- 拍石殘響：`reverbIR` 0.9s→3.4s，改指數長衰減 + 尾巴隨時間變暗（一極 lowpass 係數遞減）+ 正規化；加 `impactPre`（40ms 前置延遲）讓尾巴略晚綻放；impactWet 0.45→0.6、impactDry 0.9→0.8。
- 拍石「蓄積感」：`impact()` 包絡改成 **ease-in swell**（0→peak 用 `setValueCurveAtTime`，swellT 0.55s），bandpass 頻率隨蓄積上掃（300→1400Hz）破碎後回落變暗，像管弦樂團鈸 swell / 浪湧上再破碎；峰值略降 0.22+0.22*tide（尾巴變長補回）；視覺濺起時刻對齊「破碎」（lastImpactAt+swellT）。
- Ball1 grip 手感：原本只餵 `spread`、只小幅改 dist（幾乎聽不到）。改成 grip 響應曲線 `sp=pow(level,0.55)`（中握就有感），並讓 grip 明顯塑形空間：更近（dist 6.5→最低1.3）、更開更亮（cutoff +900*sp）、更有存在感（surgeGain +0.12*sp）；放鬆→遠而寬而柔（維持放鬆底床）。全部有界、setTargetAtTime 平滑、過 master tanh。
- 驗證：node --check 過。仍為設計起點，待真球校準。未改 guardrail。

### 2026-07-09 (b) — Claude (Opus)｜修 room.wav 路徑坑 + server 指令
- 問題：`index.html` 抓 `../assets/ir/room.wav`；README 教「從 web/ 開 server」會讓 `../` 逃出 root → room.wav 404，MeshRIR 空間著色靜默載不到（海仍成立，只是少著色）。實測從 web/ 開 assets 404、從 Tidal/ 開 200。
- 修法：① `loadIR()` 改吃候選路徑陣列，依序試 `../assets/ir/room.wav`、`/assets/ir/room.wav`、`assets/ir/room.wav`、`../../assets/ir/room.wav`，找到即載入、全失敗才退乾聲並在 log 提示「需從 Tidal/ 開 server」。② README.md 與 web/README.md 指令改成 `cd Tidal && python3 -m http.server 8000` → 開 `http://localhost:8000/web/index.html`，並加 root 位置警告。
- 驗證：node --check 過；本機 server 實測 web/index.html 200、/assets/ir/room.wav 200（audio/x-wav）。未動聲音引擎與 guardrail。
- 註：assets/ 實體在 Tidal/ 下，所以 server root 至少要在 Tidal/；路徑 fallback 只解決頁面深度差異，不能讓「從 web/ 開」也載到（檔案不在該 root 下）。

### 2026-07-09 — Codex｜web/index.html 節奏調和互動版
- 做了什麼：重做 `web/index.html` 為可直接體驗的節奏調和版。保留 Web Audio 程序式海浪、HRTF、MeshRIR `room.wav` 載入、impact 專屬 panner/reverb、haptic 規則與鍵盤模擬；新增 canvas 海面、即時節奏狀態（多層流動/可以停留/能量釋放/有點鎖住）、開始前/結束後評分、`felt_pushed`、`felt_able_to_stay`、`agency`、`rhythm_note`、session samples 與 CSV 匯出。
- 現在能跑到哪 / 怎麼驗證：用 bundled Node 抽出 HTML script 做語法解析，結果 `scripts ok 1`。頁面跑法仍是 `cd tidal/web && python -m http.server 8000`，開 `http://localhost:8000/index.html`。無球可用鍵盤模擬；真球需 Chrome/Edge WebHID。
- 未完成 / 卡住：尚未在真實握力球上校準 `HARD_GRIP` / `SWING_MIN` / `STRONG_SWING`，`dominant_mode` 目前是 heuristic，不是研究級分類器。尚未接 EEG record-only 欄位。
- 給下一位的建議或待 Pan 決策的問題：請先用真球體驗 3–5 次，觀察「能量釋放」是否太容易出現、haptic 是否太強、Ball 1/2 的身體語意是否自然。若要接 EEG，先把 EEG feature 只寫進 samples/CSV，不要立刻控制聲音。

### 2026-07-09 — Codex｜Rhythmanalysis 框架與讀書建議
- 做了什麼：依 Pan 指定閱讀 Zone Sound Creative〈在舊港島練習節奏分析：從 Lefebvre 的 Rhythmanalysis 談起〉，新增 `RHYTHMANALYSIS.md`，把 Tidal 改寫為「節奏調和系統」：不是單純 EEG state → music，而是 body / grip / swing / soundfield / EEG 的多重節奏調和。同步更新 `README.md`、`DESIGN.md`、`RESEARCH.md` 與本檔 guardrail。
- 現在能跑到哪 / 怎麼驗證：本次只改文件，未改程式。可驗證：`RHYTHMANALYSIS.md` 已含文章分析、Lefebvre 四節奏對應、session/CSV 欄位建議、最小可行實驗與延伸閱讀。
- 未完成 / 卡住：尚未把節奏分析欄位實作進 `web/index.html` 的 session/CSV；尚未加 EEG record-only 欄位。
- 給下一位的建議或待 Pan 決策的問題：下一步優先補 session/CSV，欄位至少包含 `felt_pushed`、`felt_able_to_stay`、`agency`、`rhythm_note`、`dominant_mode`。EEG 先 record-only，再考慮低權重慢變控制。

### 2026-07-08 (f) — Claude (Opus)｜sonification/視覺方向 + 音畫美學研究
- Pan 決策：視覺做在**同一個網頁**，正式版拿掉 slider、改握力球驅動，畫面只剩海與聲音。聲音與畫面讀**同一組 `getState()`**（sonification = 共享狀態/事件匯流排，視覺是第二個 WRITE）。
- 依 Pan 要求，回到「environmental lab」（= Marc Berman **環境神經科學實驗室**）做了一輪研究+想像，新增 **`AESTHETIC.md`**：以 Berman 低階自然特徵（曲線邊緣、碎形自相似、色相變異、水→沉思、sound object recognition）+ Taylor 碎形流暢（中碎形 D≈1.3–1.5）為背書；Endel 取原則（恢復非娛樂、連續、稀疏、自適應）不抄外觀；並給「低階特徵→聲/畫映射」表與一個原創研究角度（用可調參數+MEASURE/EEG 測哪組最恢復）。
- 已做音畫原型（在對話中的 live widget，非 index.html）：canvas 海面隨 swell 起伏、foam 微光、浪跟方位跑、拍石濺起漣漪，與 audio 同步。**尚未搬進 web/index.html**——待美學定案再把「狀態匯流排 + canvas 視覺」一起 commit，避免真檔案留半成品。
- 待接手：把 getState()/事件匯流排 + canvas 視覺正式加進 web/index.html（含 presentation 模式：隱藏控制、只剩海與聲音）；session/CSV 移植；閾值/觸覺實機校準（等球）。

### 2026-07-08 (e) — Claude (Opus)｜impact 殘響尾巴 + 定位（web/index.html:197 TODO 結案）
- 浪拍礁石不再只是丟進共用 busIn。新增：`OceanEngine.reverbIR()`（立體聲、指數衰減 0.9s 合成 IR）；constructor 建 `fxBus→clip`、`impactPanner`(HRTF)、`impactVerb`(convolver)、impactDry 0.9 / impactWet 0.45。`impact()` 觸發當下把 impactPanner 定位在**當前 azimuth**、dist=2.5（比底床近），訊號走 g→impactPanner→(dry+verb)→fxBus→master tanh。
- 驗證：node --check 語法過；另寫 mock AudioContext 追圖，確認 impact 源頭經 impactPanner + impactVerb + 主 clip(waveshaper) 到 destination。guardrail 全守（有界峰值、tanh 限幅、快起慢落平滑）。
- widget playable 版也同步更新（Pan 可先拖方向再按拍石聽尾巴從該方位散開）。
- 剩：session/CSV 移植；閾值/觸覺實機校準（等 Pan 有球）。

### 2026-07-08 (d) — Claude (Opus)｜room.wav 產出完成
- Pan 的 MeshRIR 下載完成的是 **.mat 版**（`S1-M3969_mat.zip`，單一聲源、3969 顆麥克風、每檔 ir_<idx>.mat 變數 'ir' shape=(1,32768)、48kHz）。npy 版當時還在下載，故改走 .mat。
- 直接產出 **`assets/ir/room.wav`**：取中心平面左右一對接收點（mic#1981 @ x=-0.15、mic#1987 @ x=+0.15，間距 0.3m）→ 正規化 peak 0.9 → -60dB 裁尾 → 48kHz 32-bit float stereo，時長 0.550s，RT60≈0.38s，L/R 有實際差異（空間寬度）。已驗證檔頭正確、無 NaN、無 clip。web/index.html 啟動即自動載入、convolver 濕聲啟用。
- **更新 `export_room_ir.py`**：現在同時支援 .npy 與 .mat（MAT 5.0，需 scipy），且只讀需要的兩顆麥克風（不整包載 3969）。腳本輸出與手動產出的 room.wav byte 相同（已驗）。
- 排程任務 `tidal-meshrir-export-room-ir` 已停用（改為當場執行）。
- 待接手：impact 殘響尾巴+定位（web/index.html:197）；session/CSV 移植；閾值/觸覺實機校準（等 Pan 有球）。可選：npy 版下載完後不需重跑，room.wav 已足夠；若要多接收點切換再依 assets/ir/README 產更多 IR。

### 2026-07-08 (c) — Claude (Opus)｜接手＋MeshRIR 匯出腳本＋播放情境決策
- 讀完 AGENTS/README/DESIGN/RESEARCH/GRIPBALL_PROTOCOL＋web 骨架，正式接手。未改聲音引擎，維持可跑狀態。
- **Pan 新決策**：① 播放情境＝**耳機 或 智能眼鏡**（頭戴 binaural，走 HRTF，不需喇叭串音消除；開放式眼鏡外化不同，實機微調）→ 已更新 `DESIGN.md §5`、`RESEARCH.md §6`（該開放問題結案）。現有訊號鏈 panner(HRTF)→MeshRIR convolver 即符合，無需改碼。② 閾值不做「每次校準」，改之後與 Pan 一起做一次校準訓練；Pan 目前無球。
- **新增** `assets/ir/export_room_ir.py`：MeshRIR .npy → `room.wav`（僅依賴 numpy，stdlib 手寫 48kHz 32-bit float stereo；自動找/解壓資料集、挑單一聲源、取左右接收點、正規化裁尾）。已用合成資料測過；修掉一個浮點誤差導致左右塌成同點的 bug。
- **MeshRIR 資料**在 Pan 的 ORICO 外接碟（下載中，約 1.16GB＋src.zip=repo 工具）。排了一次性排程任務 `tidal-meshrir-export-room-ir`（2026-07-08 14:08）自動跑腳本產生 `assets/ir/room.wav`；解壓工作區留在 ORICO（不進 Drive，守 §4 guardrail）。
- 待接手：確認排程產出的 room.wav 聽感；impact 殘響尾巴+定位（web/index.html:197 TODO）；session/CSV 移植；閾值/觸覺實機校準（等 Pan 有球）。仍開放：揮動強度用加速度模長還是角速度。

### 2026-07-08 (b) — Claude (Fable)｜套用 Pan 的四項決策
- 決策來源：Pan。① 空間化第一版就上 **MeshRIR convolution**（web 已建 panner→dry/wet(convolver)→clip 鏈，啟動時自動載 `assets/ir/room.wav`，缺檔則暫全乾）。② 浪拍礁石只在 **grip≥HARD_GRIP 且 swing≥STRONG_SWING** 觸發，不自發。③ 觸覺：揮動中輕震、拍石強震、**靜止不震**（`sendHaptic`，cmd 11，節流 100ms）。④ **方向由揮動帶動**，海浪跟著球揮動方向跑，停揮緩回中。
- 改了哪些檔：`DESIGN.md`（§2 球角色重寫＋拍石雙條件＋觸覺表、§3 impact、§5 MeshRIR-first、§6 參數表）、`AGENTS.md`（guardrail 2 加觸覺規則）、`RESEARCH.md`（§6 開放問題→已定決策）、`web/index.html`（convolver dry/wet + loadIR、setSwing/setSpread、handleSwing 揮動偵測與閘門、sendHaptic、鍵盤模擬更新）、`web/README.md`、`assets/ir/README.md`。
- 待接手：放 `assets/ir/room.wav`；在真實球上校準 `HARD_GRIP / SWING_MIN / STRONG_SWING` 與 IMU 揮動強度單位；調觸覺強度/時長手感。

### 2026-07-08 (a) — Claude (Fable)
- 做了什麼：建立 Tidal 子專案骨架與全部文件（README / AGENTS / DESIGN / RESEARCH / GRIPBALL_PROTOCOL）＋ `web/index.html` 可執行骨架 ＋ `maxmsp/`、`assets/ir/` 佔位。海浪合成法整理自 Farnell《Designing Sound》；spatial 定為 MeshRIR RIR convolution（CC BY 4.0，已核實 repo 與 Zenodo DOI）。
- 現在能跑到哪 / 怎麼驗證：`cd web && python3 -m http.server 8000` 可開頁；骨架含 WebHID 連線、程序式海浪 synth 的第一版、方向/潮汐對應與空白鍵模擬。`TODO(agent)` 標出待補的 convolution spatial 與浪拍事件細修。
- 未完成 / 卡住：MeshRIR 原始資料需人工下載並匯出成 IR wav（步驟見 RESEARCH.md）；spatial convolution 尚未接上真實 IR。
- 給下一位的建議：先在真實握力球上校準 Ball1/Ball2 的方向/潮汐手感，再細修浪拍事件的稀疏度與限幅；spatial 建議先用單顆 PannerNode 做方位，再評估是否需要 MeshRIR convolution 的沉浸感。
