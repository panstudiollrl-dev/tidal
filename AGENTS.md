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
     - ⏸ **現況（Pan 2026-07-14）：自動震動回饋暫時撤掉**（`web/index.html` 的 `HAPTICS_ENABLED=false`，一般 `sendHaptic` 直接 return），Pan 之後再想過。唯一例外：4-7-8 手動握拍時可用 `sendHapticAll(..., true)` 給一次短確認回饋。不要在未經 Pan 確認下重新啟用自動 haptic pattern。
3. **有界參數，不自由生成**。所有可調維度都有明確上下限與轉場時間常數（見 `DESIGN.md` 參數表）。不引入無界的隨機或自由生成。
4. **限幅保護**。所有軌加總後過一級 soft-clip（`tanh` 或等效），雙手同時最大力也不爆音。這條沿用 `Gripball/nature_loop_web.html` 的既定作法。
5. **平滑，不跳變**。握力 level 與所有音訊參數都要時間平滑（Web Audio 用 `setTargetAtTime`；不要逐樣本硬跳）。避免破音與突兀。
6. **不診斷、不宣稱療效**。UI 文案與註解都用 wellness / supportive 語氣。EEG／生理訊號若接入，僅為探索性量測，不解讀為「已放鬆」的證明。
7. **隱私與同意**：任何 session 紀錄（CSV 等）只存本機，不上傳；欄位維持匿名（serial / 時間 / 評分），不加可識別個資。
8. **節奏彈性優先於強制同步**。Tidal 的新概念框架是 rhythmanalysis / 節奏調和：幫助使用者恢復能呼吸、能安住在當下、能用雙手塑形的節奏。不要做固定節拍催促、分數化壓力、或把 EEG/握力解讀成單一「正確狀態」。
9. **中文介面要說人能懂的話**。`arrival` 可以保留為內部工程流程名稱，但中文使用者不會自然理解「抵達」在這裡的意思。介面和對外文案應使用「正式開始前，練習自我覺察」、「聽見呼吸」、「用握力表達緊張的程度」、「小小回顧」等直接描述使用者正在做什麼的語言；避免翻譯腔，例如「可停留」應改成「身心能安住在當下」或「呼吸變得比較順」。

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

### 2026-07-20 (g) — Claude｜第二份真球 log：修「還是要滿用力」＋「水位大起大落」
- **Pan 回饋**：比之前好非常多，但①還是要滿用力、②水位大起大落。第二份 log（91s，覆蓋第一份）判讀：
  1. **校正中位數被跨手污染拉垮**：observeCalibration 對兩顆球在「兩隻手」的 cue 期間都收 press 樣本＋整段 cueOn 中位數被反應延遲稀釋 → Ball1 pMinusR=87、Ball2=131（實際自己手的峰值 267/1148）→ 兩球都鎖地板 250。Ball2（真實力道 ~700-1150）套 250 span＝一觸即發＝**大起大落**。
  2. **Ball1 是很硬的球**：自己手 cue 峰值只有 ~120-270 raw。就算校正正確，250 的地板也讓它永遠「要滿用力」。
- **修法**：①校正改記「每隻手、每一握的峰值」（`pressPeaks.left/right`，相對 rest 中位數、帶正負）；`lock()` 取「峰值中位數絕對值較大的那隻手」＝這顆球自己的手（另一手 cue 時它是放著的，天然分離），span＝`|峰值中位| × GRIP_PEAK_TO_SPAN(0.75)`（持續握力≈峰值 3/4，舒適握落 ~0.8 水位）。舊 median 路徑保留為 fallback。②新增 `GRIP_MIN_SPAN_LOCKED=140`：校正完成的球允許較低地板（未校正仍 250）。③level 平滑改**快起慢落**（attack 0.14／release 0.05，33Hz 下 ~0.2s 起、~0.6s 落）＝浪退比湧慢，也吃掉手抖高頻——解「大起大落」。snapshot 加 `peakLeft/peakRight`。
- **驗證**：模擬全面改版 v3（校正擬真兩手輪流＋過衝）25 項全過，含回歸：硬球（峰值 120/180/267）平常力道 +150 → 0.80（原本 ~0.2）；跨手污染 +135 不再拉垮 span（677 vs 之前 250）；手抖 ±15% level 波動 0.05（原本 >0.3）；放開 0.55s 退到 0.1 以下；放手偏移球（第一份 log）拿起仍 0.00。node --check、jsdom 0 錯誤。
- 給下一位：`GRIP_PEAK_TO_SPAN`/`GRIP_LEVEL_RELEASE` 是現在最主要的手感旋鈕（想更輕鬆→調低前者；想更平穩→調低後者）。一樣：先看 log（新欄位 peakLeft/peakRight 直接顯示校正學到什麼），不要盲調。

### 2026-07-20 (f) — Claude｜第一份真球 log 分析＋修「一顆一拿就滿、一顆很用力才一半」
- **Pan 真球 log（77s，`tools/analyze_grip_log.py` 判讀）**：兩顆球極性都是上升型、sign 判對、校正有完成。問題在別處：
  1. **敏感球（Ball2）＝放手偏移**：它有三個 raw 狀態——完全放開 ≈32917、拿著不握 ≈34777（差 **1860**）、握 35400+。baseline 在 dev<0 時快追到「完全放開」的地板 → 拿起來光手掌貼上就 +1860 ≫ 滿刻度＝一拿就全滿。Ball1 兩狀態只差 46 所以沒事。這是球體個體差異，任何寫死的常數都救不了。
  2. **遲鈍球（Ball1）＝span 被尖峰灌水**：lock 用「校正期間瞬間最大值」（Ball1 中位數 581 卻鎖 693；Ball2 中位數 620 鎖 1482=MAX 蓋頂）→ 舒適握只到一半。
  3. 進校正的 720ms 轉場中 `maybeAdvanceFromConnect` 沒被擋 → `handCue:begin` 連打 47 次（有害性低但反覆重置 cue state）。
- **修法**：①lock() 記 `restRef`（校正 rest 中位數＝「拿著不握」參考位）；鎖定後 dev<0 的快歸零只追到 `restRef ± 0.1*span`，不追到完全放開的地板；restRef 在 smRaw 回到附近時以 0.02 慢速跟漂移（手張開時凍結）。②lock() 的 span 改用 press-rest **中位數**（不再與 running-max 取 max）。③`maybeAdvanceFromConnect` 加 `transitionTo` guard。snapshot 加 `restRef` 欄位。
- **驗證**：原 18 項模擬＋7 項「依 log 參數重建兩顆真球」的回歸全過：Ball2 放下再拿起 level 0.000（原本全滿）、舒適握 0.76、猛握滿；Ball1 span 鎖 580（不再 693）、舒適握 0.76（原本 ~0.5）、猛握 +1057 → 滿。node --check、jsdom 0 錯誤。
- 給下一位：真球 log 在 Drive 根目錄 `tidal_grip_operation_log.json`（此次分析的原始數據）。若 Pan 還覺得手感不對，先重跑 analyze_grip_log.py 看 restRef/span 欄位，別動常數。

### 2026-07-20 (e) — Claude｜修 GripCalibrator 四個機械性 bug（sign margin / baseline 解耦 / span 下限 / 478 edge detector）＋log 分析器
- **根因分析（讀完 (d) 的程式後找到，均與 Pan 症狀對得上）**：
  1. 未鎖定 sign 用 `upMax >= downMax ? 1 : -1` **沒有 margin**——靜止雜訊下 upMax≈downMax，sign ±1 亂跳→漂移被當握壓、水位偶爾倒反（FIX_BRIEF §2.2 的 margin 規則在 7/20 回撈時遺失了）。
  2. 未鎖定時 baseline 在 `dev<0` 以 0.3 快追——握「下降型」球時 rawDev 被吸掉、downMax 長不大→**sign 永遠翻不到 −1**（極性學習與 baseline 耦合）。
  3. 鎖定後 span 每筆 report `*0.99985` 衰減、無下限——50–100Hz 下 **1–2 分鐘腰斬**、崩到 MIN_SPAN 250→「同一顆球剛校完正常、幾分鐘後超敏感」的主因（9d79ca2 手感好是因為地板 520 高，蓋住了這條）。
  4. 4-7-8 用全域 level 門檻（ON 0.20/OFF 0.09）——殘壓讓 level 降不回 OFF→不 re-arm→**卡在 4**。
- **修法（`web/index.html`）**：①`provisionalSign()`：預設 +1，只有 `downMax > upMax+GRIP_SIGN_MARGIN(60)` 才 −1；②未鎖定時 baseline 只在 `|rawDev|<45` 慢吸（0.04）、偏離大近凍結（0.005），鎖定後才用三態；③`lock()` 記 `lockedSpan`，之後 span 衰減下限＝lockedSpan 不再崩回 250；鎖定後慢擴張 0.02→0.002（原值 1 秒內追掉峰值→「更用力反而不滿」）；握持凍結 0.0005→0.00005（原值 7 秒吸掉 ~19% 握壓＝憋氣水位下沉）；④新增 per-ball `updateEdge()`（rest floor 追蹤＋相對 span 遲滯，殘壓 ~1s 被 floor 吸收，**不要求 level 回到絕對 0**），onReport 觸發 `trigger478Press("edge")`；原 level 遲滯路徑保留給鍵盤模擬，兩路經 `trigger478Press` 的 380ms refractory 去重。log snapshot 加 `lockedSpan/edgeArmed/edgeFloor`。
- **驗證**：node --check 過；node 模擬 18 項全過（上升/下降球、靜止 10s sign 零翻轉、7s 握持跌幅 <2%、靜置 3min span 不崩、+24raw/s 漂移 60s level=0、478 殘壓 35–40% 連四拍全數到、8s 長握只 1 拍、弱球 +280 有感）；jsdom 載入 0 錯誤。**尚未真球測——請 Pan 跑一輪，按 L 下載 log。**
- **新工具**：`tools/analyze_grip_log.py <log.json>`——自動判讀每球極性/sign 是否相符、span 是否崩、殘壓是否高於 478 門檻、478 拍距，並畫 raw/baseline/delta/span/level 時序圖。之後所有調參以這個為準，不憑感覺。
- 給下一位：英文版 `web/en/index.html` 仍未同步（依 (c) 的決定，等中文真球穩定）。commit 前一版是 Codex 7/20 working state 的 checkpoint（`aa4aef3`），要回滾直接 reset 到它。

### 2026-07-20 (d) — Codex｜目前版交接：4-7-8 卡住、校正不穩、已加真球操作 log
- 做了什麼：依 Pan 要求先停止繼續硬調握力校正。`web/index.html` 目前在 `GripCalibrator` 加了校正觀察資料：左右手 cue 期間分別收集每顆球的 rest/press raw median，用 `press-rest` 判斷該球 polarity；另新增握力球操作 log ring buffer（`state.gripLog`），每筆 `inputreport` 會記 raw、smRaw、baseline、delta、sign、span、level、當前 phase/arrival step、handCue 狀態、handMap。按 **L** 下載 `tidal_grip_operation_log.json`；按 **D** 看診斷面板；按 **R** 重新配對。log 也會寫入 `localStorage` key `tidal_grip_operation_log_v1`。已同步更新 `web/README.md`、`GRIPBALL_PROTOCOL.md`、`RESEARCH.md`。
- 現在能跑到哪 / 怎麼驗證：`web/index.html` script 語法 OK、`git diff --check` OK、localhost `http://localhost:8001/web/index.html` 回 200。Chrome 控制工具一度斷線，未能由 Codex 自動 reload；Pan 需手動重新整理頁面後再測。測試時請先按 D 觀察兩顆球：握下去 `delta` 應為正、`level` 應上升；操作一輪後按 L 下載 log。
- 未完成 / 卡住：Pan 最新回饋是 **4-7-8 卡住**，校正效果不大，數字有時倒過來，有時握力球非常敏感、有時又正常。這表示目前 per-ball polarity / baseline / span 仍未可靠；不要把這版視為穩定手感。4-7-8 手動握拍依賴 `MANUAL_478_ON/OFF` 與 `state.guided.manual478Pressed` re-arm，若某顆球低端漂移或 sign 反，會卡住或誤判。
- 給下一位：請先用新 log 分析最後一次真球操作，不要再憑感覺調常數。優先判讀：① 哪顆球握下去 raw 是上升或下降；② `sign` 是否與 raw 方向相符；③ 放鬆時 `level` 是否仍高於 `MANUAL_478_OFF` / `ARRIVAL_PRESS_OFF`；④ `span` 是否太小導致輕碰滿水，或太大導致很用力才有反應。若要修，建議把 4-7-8 的「握一下」改成 per-ball relative edge detector（以最近 rest floor + 個人 span 的短窗變化判斷），不要只看全域 level 門檻。

### 2026-07-20 (c) — Codex｜依 Pan 要求回撈上週三到週四中午較好的握力校正/控制版本
- 做了什麼：Pan 明確回饋 2026-07-20 這串即時調教「都很差」，要求回去撈上週三到週四中午的 commit。已將 `web/index.html` 回復到 `95c5137`（Thu Jul 16 09:42:54 2026：波光 shimmer + breath awareness sea rises/recedes with grip），也就是週五換球/極性/低端校正一連串混亂前、週四早上最後一個較完整版本。
- 現在能跑到哪 / 怎麼驗證：`web/index.html` script 語法 OK、`git diff --check` OK、localhost `http://localhost:8001/web/index.html` 回 200。此版握力手感回到 `GRIP_MIN_SPAN=300`、`GRIP_HEADROOM=1.0`、`GRIP_GAMMA=0.55` 的早期曲線，校正/呼吸反應應比 7/20 即時調教自然。
- 未完成 / 卡住：這次只回復 `web/index.html`，文件中部分 7/20 調教紀錄仍保留作為失敗路徑紀錄；若 Pan 確認 `95c5137` 手感較好，再決定是否只小幅補「已授權兩球自動接回」或「反相球支援」，不要再把 7/20 那套 per-ball span 調教直接搬回。
- 給下一位：若要再加新球 polarity，務必以 `95c5137` 為基底，小步加、真球測；不要從 7/20 已污染的版本繼續調。

### 2026-07-20 (b) — Codex｜修「有一顆連上但校正階段完全沒反應」的連線可觀測性與喚醒
- 做了什麼：針對 Pan 真球回報「有一顆連上，但校正階段完全沒反應」，補三個小修：① `registerDevice()` 先綁 `inputreport` listener 再送 mode command，對齊 `Gripball/nature_loop_web.html`；② listener 來源用 `e.device || e.target || dev`，避免某些 WebHID 事件來源差異讓 report 進來卻找不到 slot；③ 新連線後若尚未 ready，於 320/1100/2400ms 補送 mode command。另把 watchdog 改成只標記等待與重送 mode，不再自動 `forgetBallSlot()` 踢掉 open 但暫時沒回報的真球。
- 診斷/操作：補回 **D** 診斷面板，顯示每顆球 `open/ready/age/raw/base/d/sign/span/lvl`；補回 **R** 手動重新配對，會撤銷目前 MB01 授權並要求重新選球。這次 R 是人工逃生口，不是 watchdog 自動循環。
- 驗證：`web/index.html` script 語法 OK、`git diff --check` OK、up-going/down-going calibrator node 模擬 OK。尚待 Pan 真球看 D 面板：若該球 `ready:N` 或 `age` 持續增加，代表沒收到 GRIP RAW；若 `raw` 有變但 `lvl` 不動，才是校正/映射問題。
- 給下一位：遇到「連上但沒反應」先看 D 面板，不要先調門檻。沒有 raw 就修 WebHID/mode；有 raw 無 lvl 才修 calibrator。

### 2026-07-20 — Codex｜重讀 md，回到換球前穩定手感作為基底，再補新球 polarity / 音訊喚醒 / 4-7-8 卡住
- 做了什麼：依 Pan 判斷「後面的版本都很亂，換握力球之前比較好」，`web/index.html` 以 `9d79ca2` 系列手感為基礎，不沿用 2026-07-17 後段的激進 span lock / watchdog forget 版本。保留必要修補：`GripCalibrator` 加 per-ball polarity 偵測（預設 raw 上升＝握，只有下降幅度明顯大於上升才判 -1），左右手 cue 全部完成後 `lock()` 方向；`syncBalls()` 只在 `open()` 失敗時撤銷舊授權，`watchHidLiveness()` 不再反覆 `forget()` 真球；首次 DOM 手勢先喚醒 AudioContext，真握力輸入再 fade in；4-7-8 使用較低門檻與 residual-pressure re-arm，避免殘壓回不乾淨時卡在 4。
- 現在能跑到哪 / 怎麼驗證：已跑 `web/index.html` script 語法、`git diff --check`、Node 模擬 up-going / down-going 兩種球（握下去 level 上升、放開回接近 0）、4-7-8 殘壓連續四拍模擬，皆通過。尚未用 Pan 的真球端到端實測聲音與流程。
- 未完成 / 卡住：英文版 `web/en/index.html` 這輪先未同步，因目前中文主線還在救握力流程；確認中文真球穩定後再同步英文版。D 診斷面板與 R 重新配對鍵沒有從較晚版本帶回，若真機仍難排查，可小步補回但不要帶回 watchdog 反覆撤授權那段。
- 給下一位的建議或待 Pan 決策的問題：不要再直接套用 2026-07-17 後段版本；若要重做 per-ball estimator，先用小型模擬覆蓋上升/下降型、殘壓、漂移、連續握持，再請 Pan 真球確認。文件已同步 `GRIPBALL_PROTOCOL.md`、`web/README.md`，以目前程式為準。

### 2026-07-17 (e) — Claude｜修「換球後水位倒反」＝握壓方向 polarity 自動偵測
- **症狀（Pan）**：換球後水位倒過來——沒握水位高、握了反而低。換球前很好。
- **根因**：`GripCalibrator` 之前寫死「raw 高於 baseline＝握壓」（`posDelta=max(0,smRaw-baseline)`、baseline 三態用 `smRaw<baseline` 當放開）。但握力球有兩種極性：有的握下去 raw **上升**、有的 **下降**。換上的那顆是下降型 → 握＝raw 降→被當成「放開」快速歸零→放開時 raw 回升→被當成「握」→水位在放開時衝高＝倒反。視覺沒錯（`--session-water=gripWater` 正映射），是 calibrator 輸出被倒。
- **修法**：calibrator 加**握壓方向 sign**。校正（未鎖定）期間記錄 rawDev 的最大正/負偏移 `upMax/downMax`；`lock()` 時 `sign = upMax>=downMax?1:-1`（未鎖定時即時猜）。之後一律用 `dev = (smRaw-baseline)*sign`（握＝正），span/shaped/baseline 三態全部以 dev 判斷 → **兩種極性都正確**。audio fade 的 rawDelta 與 D 面板也改用 sign（面板新增顯示 `sign` 與方向 delta）。
- **驗證（node 模擬 `/tmp/calib_pol.js`）**：up-going 與 down-going 兩種球，校正後 REST≈0、GRIP≈0.74–0.77、RELEASE≈0，皆正確。中英 node --check + jsdom 0 錯誤。
- 註：sign 在校正三握時學到最準；若跳過校正，未鎖定會即時猜，第一握後就會對。請 Pan 用 D 面板確認 `sign` 是否 = 該球方向（握下去 d 應變正、往上升）。

### 2026-07-17 (d) — Claude｜換球後卡在連線幕（stale grant 鬼影）
- **症狀（Pan）**：換掉一顆握力球後卡在開頭。兩顆都是 MB01（同 08E2:0101，白名單沒問題）。
- **根因**：被換掉的舊球「授權」還在（Chrome WebHID 權限持久），`getDevices()` 仍回傳它＝鬼影。`syncBalls` 逐顆 `await registerDevice`（內含 `dev.open()`）**沒有 try/catch**，鬼影 open() 失敗一拋錯就中斷整個迴圈，後面真的在的球都沒 register → connectedCount<2 → 卡在連線幕。
- **修法**：① `syncBalls` 每顆 registerDevice 包 try/catch，開不起來就 `dev.forget?.()` 撤銷該授權並跳過，讓真的球拿到 slot。② `watchHidLiveness` 對「一直不回應」的 slot 除了 forgetBallSlot 再 `ghost.forget()` 撤授權＋重新 `syncBalls()`（處理「鬼影 open 成功但永不回報」的迴圈）。③ 加 **R 鍵 `repairBalls()`**：撤銷所有握力球授權→清 slot→重新 `connectBall()`，換球卡住的逃生口。④ D 診斷面板加每顆球 `productName vid:pid rdy:Y/N` 與 `granted:N`，方便看鬼影。
- 驗證：中英 node --check + jsdom 0 錯誤；EN 重新生成（新 log 字串已加進翻譯表；一句 mid-line 區塊註解仍中文＝非使用者可見）。未改 guardrail。

### 2026-07-17 (c) — Claude｜校正鎖定（兩手對稱）＋握持不下沉＋診斷面板；no-sound 待查
- **Pan 實測三症狀**：① 一手太敏感一碰就全滿、另一手很用力連一半都不到；② 答題/呼吸時「握下去水位頓升、之後穩定用力水位卻一直降」；③ 沒聲音。
- **② 是我 (b) 版的回歸**：非對稱 baseline 的「向上吸收 0.008」太快，會把持續數秒的握持（尤其 4-7-8 憋氣 7 秒）當漂移吃掉→水位下沉。改成 **baseline 三態**：放開快速歸零(0.3)／閒置吸收漂移(0.05，shaped<0.06)／**握持中近乎凍結(0.0005)**。模擬 7 秒握持只從 ~0.78 微降到 ~0.68（弱球幾乎不降），漂移仍讀 0。
- **① 兩手不對稱 = 尺標問題**：舊版 span 用即時最大值＋固定地板 520。敏感球第一握就把 span 追高／或地板讓輕碰就滿；弱球（max 只 +300）被 520 地板壓住最多到 ~0.43。**改成校正鎖定**：三握 cue 期間即時學 span，`finishHandCue`（右手完成）對兩球 `lock()`；鎖定後只慢擴張。滿刻度＝各球自己校正的舒適握壓。`GRIP_MIN_SPAN 520→250`、`SPAN_DECAY 0.99975→0.99985`、MAX→1500。模擬：敏感球輕碰 0.26／舒適 0.77，弱球用力 0.82（不再卡半），兩手一致。HEADROOM/GAMMA/DEADZONE 未動。
- **診斷面板**：按 **D** 開關右上角 overlay，即時顯示每顆球 raw/base/Δ/span(鎖定顯示*)/lvl、audio engine/ctx/fadedIn、handMap。為了和 Pan 一起校準真球用（memory 早記過「閾值要與 Pan 一起校準」）。純顯示、中英文版都英文標籤。
- **③ 沒聲音：已修**。Pan 回報：Pages 線上版、這次才沒、沒按「啟動聲音」。根因＝球已授權會自動接回、跳過連線幕，Pan 直接點「開始抵達」；但 `startArrival` 不 resume ctx，握球是 WebHID 不是 DOM 手勢，瀏覽器 autoplay 政策讓 ctx 一直 suspended → 沒聲音。Pan 要「不必按啟動聲音」。修法：加**全域首次互動監聽**（`pointerdown/keydown/touchstart`, capture）→ `ensureAudioOnGesture()` 只要 ctx 非 running 就 `startAudio({resume:true})`。任何點按/觸控/按鍵都會補啟動＋resume，符合手勢政策。（歷史：9bbe5c0 曾有 pointerdown、53dc96c 移除，但那其實只是按鈕 handler，非全域 kick。）
- 驗證：中英 node --check + jsdom 0 錯誤；calib 模擬 `/tmp/calib3.js`。未改 guardrail。**注意**：span 現在鎖定，若接手要改回即時追峰值需一併處理兩手不對稱。

### 2026-07-17 (b) — Claude｜修 GripCalibrator 漂移（解「準備卡住／還沒答就跳關」）
- **症狀（Pan）**：準備等待太長；反饋（抵達小小回顧＋結束後問卷）還沒答題就被帶往下一階段。Pan 直覺與握力球數值飄移有關——正確。
- **根因**：舊 `GripCalibrator` 的 baseline 漂移是閘控式（`level<0.16 && delta<span*0.18 → baseline+=0.07`）。感測器慢慢往上飄時，一旦 level 超過 0.16 就停止吸收 → 漂移殘留成「假握壓」。模擬證實：僅 +14/秒的漂移就讓閒置 level 衝到 **0.154**，同時超過 arm 門檻 `AFTER_OFF=0.07`（→ 放不開、卡「準備」）與答題門檻 `AFTER_ON=0.14`（→ 在門檻附近抖動使 heldMs 一直歸零，5.2s response window 逾時自動記 0 跳關）。span 又用「瞬時最大值＋極慢衰減」，一次尖峰讓之後同樣握力都變弱。
- **修法**：`GripCalibrator.update` 改**非對稱 rest-floor baseline**——`smRaw` 輕平滑後，低於基線（放開）快速歸零 `*0.3`、高於基線（漂移/握持）慢吸收 `*0.008`；span 上升改 attack 限速 `*0.04`、閒置才衰減。**未動** HEADROOM/GAMMA/DEADZONE/MIN/MAX 手感值。
- **驗證（node 模擬 `/tmp/calib_fix2.js`）**：漂移 14 與 28/秒下閒置 level ≤0.03（<arm 0.07）；重/中/輕握分別到 ~0.63/0.36/0.21（皆 >answer 0.14），peak 保留。真檔 node --check + jsdom 載入 0 錯誤（中英各一）。中英雙語同步（重新生成 web/en）。細節見 `GRIPBALL_PROTOCOL.md` 校正段。
- 未改聲音引擎與 guardrail。註：answer/arm 的固定時窗（AFTER_RESPONSE_MS=5200 等）未動——漂移修好後 arm 會即時放開、band 不再抖動，兩症狀應一併解除；若真機仍覺 5.2s 太短再議。

### 2026-07-17 — Claude｜校正整體檢查 + 英文完整同步版 + GitHub Pages 上線
- **校正穩定性檢查（Pan：校正感覺不穩）**：通讀後判斷校正分三層，最大不穩來源在 `GripCalibrator`：`span = Math.max(posDelta, span*0.99975)` 用**瞬時最大值當滿刻度**，衰減極慢（~40–90s 半衰期，視 report 率）。後果：①握越用力 span 同步變大、水位被壓縮（越握越沒反應）；②一次用力/雜訊尖峰後約一分鐘同握力都變弱（前後不一致）；③`HEADROOM=1.35` 讓峰值恆為 ~0.74，滿水位達不到、頂端無解析。次要：baseline 漂移 `level<0.16 && delta<span*0.18 → 0.07/report`（~0.3s）會吃掉穩定輕握；baseline 初始化用第一筆 raw（連線時手在球上會偏高）。左右手指派 `cue.scores[slot]` 只在跨 `ARRIVAL_PRESS_ON=0.28` 的 edge 累加，弱球（有些球很用力也只 +380）可能整回合 0 分→靠 fallback；單球情境易誤指。**建議（尚未實作，等 Pan 決定）**：把 onset 參考（穩定 baseline）與顯示滿刻度分離、span 改 attack 限速上升別追瞬時峰值、HEADROOM 降到 ~1.05、baseline 漂移放慢/加閘、左右手指派容忍弱球/單球。
- **英文完整同步版（Pan 要中英文都要）**：`english-us-demo` 分支原落後 main 16 個 commit。改採「單一發佈分支、雙語子路徑」：以現行 main `web/index.html` 為基底，用 Python 對「最大中日韓字元 run」做整檔取代（只動中文字＋全形標點，不碰程式/引號/標籤）翻譯出 **`web/en/index.html`**（231 個 user-facing run 全譯，英文用 typographic ’ 避免破壞單引號字串）。兩頁 `<h1>` 加語言切換連結（中↔EN）。`english-us-demo` 分支已 reset 對齊 main（兩分支都含中英雙語）。驗證：node --check 語法 OK、jsdom 載入 0 錯誤（中英各一）、user-facing 殘留中文 = 0。程式碼註解仍為中文（非使用者可見，未譯）。
- **GitHub Pages**：已在 main 上線並確認可讀取。中文 <https://panstudiollrl-dev.github.io/tidal/web/>、英文 <https://panstudiollrl-dev.github.io/tidal/web/en/>。加了根目錄 `.nojekyll`。IR 路徑靠 `loadIR` 的相對 fallback（`../assets` 與 `../../assets`）在 web/ 與 web/en/ 兩種深度都載得到。
- 小瑕疵（未修）：英文版隱私句 "…nothing is uploaded.EEG/If physiological signals…" 的 `EEG/` 前後少空格（沿用原文 `。EEG/生理訊號` 的緊排）；幾處 `${var}` 旁有雙空格，HTML 會收合。未改聲音引擎與 guardrail。

### 2026-07-16 — Claude｜波光 shimmer/粼光電子音（Luc Ferrari 風）＋覺察呼吸海潮隨握力漲退
- 做了什麼（依 Pan 回饋）：
  1. **波光聲層**（Pan 上傳 4 個 .aif、指名 0004＝Luc Ferrari「Sea Hole」風：人聲/鳥/電子＋水，像陽光在水面波光嶙峋）。分析 0004（40s）：主體 500–2000Hz 71%、centroid ~3kHz（亮）、spectral flatness 在 0.24（電子/人聲音高）↔0.77（水/噪音）間擺盪、高頻粼光事件 ~1.2/s、電子音峰約 527/624/785/882/1055/1184/1335…Hz。據此新增：`shimmer`（明亮帶通噪音 ~1.5–2.7kHz＋慢 twinkle LFO＝波光明滅）＋ `glint(freq,pan,amp)`（明亮電子鐘聲：三個輕微非諧正弦、快起音短衰減、走 HRTF＋殘響）。loop 內稀疏排 glint（~1/s、能量越高越密），音高取中頻五聲音階，與 caustics 視覺對位。有界、過 tanh。engine mock 測試通過。
  2. **覺察呼吸：海潮隨握力漲退**（Pan：呼吸時球有縮放很好，但背景海要跟著——吸氣海潮漲近岸、吐氣退，現在畫面讓人緊張）。`drawSea` 水面線 `waterTop` 改隨 tide 升降（握＝水漲上升靠近、放＝退），caustics 亮度/密度對 tide 的反應**調小**（握力主要表現在水面上升，不是把光紋弄得更busy＝不緊張）。
  3. **覺察呼吸指示上球**：「吸氣時握著，吐氣時放下」→ 球上「吸氣握　吐氣鬆」；下方文字隱藏。
- 驗證：語法 OK；engine mock（shimmer/glint 建構、glint=3 osc）；jsdom 0 錯誤；render 對照確認握力→水面上升、caustics 仍柔和。真機請 Pan 聽 shimmer/glint 音量密度是否對、看呼吸海潮漲退手感。上傳音檔在 uploads（暫存），durable 的是上面的分析數字。

### 2026-07-15 — Claude｜沉浸式結束：字幕問句在球上、工作人員名單式結果分析、鼓勵、整幕淡出
- 依 Pan：結束流程要像電影。重寫 phaseAfter：
  1. **問句＝球上字幕**（`#afterOrbPrompt.after-caption`），淡入淡出；**握越緊水位越高（＝越符合）**，**連續握住 `AFTER_HOLD_MS=1500ms` 自動紀錄**（不用放開/按鈕），字幕淡出換下一題。四題短句：還緊繃嗎／節奏受催促嗎／靜得下來嗎／與海同調嗎。下方不再放小字。frame-driven（`updateAfter`→`afterSurveyStep`），移除 `handleAfterGrip`/滑桿。
  2. **工作人員名單式結果**（`#afterCredits`）：呈現四個數值＋整體分析（比開始緊張升降＋停留＋同調），置中淡入，停 8 秒。
  3. **換幕鼓勵**：顯示「你已做 N 回 4-7-8、M 次握放」＋握力對身體好處（非醫療、wellness）。`state.grip478Count`（advanceManual478 累加、startSession 歸零）、`completedCycles`。停 ~11 秒。
  4. **整幕淡出**→ summary phase。`saveAfter` 仍寫 CSV，但**不再自己換 phase**（交給淡出流程）。
- 驗證：語法 OK；jsdom 0 錯誤；after 狀態機模擬（4 題自動紀錄→results，含輕握低分）。真機請 Pan 確認節奏（1.5s 自動紀錄、8s/11s 停留是否合適）。

### 2026-07-15 — Claude｜修評估頁誤跳/緊張球殘留「請放鬆」、頌缽不晚一拍、結束問卷改握力一題一幕
- 做了什麼（依 Pan 回饋）：
  1. **評估頁還沒壓就跳走**：上一步「表達緊張」那一握殘留進評估頁被當成作答→自動定案跳走。修：`agree` 子步驟加 `agreeArmed`＝**必須先放開才開始收握壓**（同 4-7-8 進場防殘握）；未 armed 時球上顯示「先放開球」、水位不動。
  2. **緊張步驟球中間一直「請放鬆」**：校正 cue 的球上提示 `#cueOrbPrompt` 沒清掉，殘留到後面。修：`finishHandCue` 移除 `show-cue-text` 並清空文字；breath/hold 步驟也主動移除。
  3. **頌缽晚一個數字**：改成「數字出現的那一下」響——吸氣第一次握（看到4）響；**把數字換成 7/8/下一輪4 的那一下**（`advanceManual478` 進入新段時）立刻響，不再等到下一次握。每回仍三聲。
  4. **結束後問卷比照前面、握力一題一幕**（Pan：前後風格一貫）：移除滑桿/文字框，改成 `beginAfter/handleAfterGrip/answerAfter/updateAfter`：四題（緊張/被推著走/能停留/可塑形），每題**握力＝答案(0–10)、水位在球上顯示、放開定案、scene-dim 換幕到下一題**，最後自動 `saveAfter()`。門檻 `AFTER_ON=0.14/OFF=0.07`（低分也能輕握表達）。文字筆記 `rhythm_note` 暫移除（改空字串）。
- 驗證：語法 OK；jsdom 0 錯誤；after 問卷模擬 4 題全程正確（含防殘握、低分）；4-7-8 頌缽/評估 armed 邏輯。真機請 Pan 確認：評估頁要壓才作答、緊張球不再顯示請放鬆、頌缽與數字同步、結束問卷四題一幕一題。

### 2026-07-15 — Claude｜評估頁的相符程度用球水位＋球上文字表示
- Pan：「聽見呼吸後的評估頁，要用握力表達敘述是否相符，但水位沒表現出相符程度；最下方小字也要移到球上、對應水位，否則是失敗設計。」
- 做了什麼：`report` 的 `agree` 子步驟現在把**相符程度映到中央球水位**（`--cue-fill` 平滑跟握力，握越用力＝越貼近），並把標籤（很貼近／有點像／不太像／握出有多貼近）放到**球上**（`#cueOrbPrompt`）。隱藏原本的橫條 `#agreeMeter` 與底部 `#reportHint`。定案（`finalizeAgreement`）時水位停在最終相符程度、球上顯示對應標籤，下方才出現建議。
- 驗證：語法 OK；jsdom 0 錯誤。真機請 Pan 確認：評估頁握力→球水位＝相符程度、文字在球上對應。

### 2026-07-15 — Claude｜海面改成「清澈淺海＋水下 caustics」（IMG_9778）、校正提示語移到球上
- 做了什麼（依 Pan 回饋）：
  1. **海面視覺改成參考圖風格（IMG_9778）**：Pan 上傳過/下海面照——粉紫黃昏天空、模糊沙色地平線、清澈青綠淺海、水下白色 caustics 折射光網（越前景越大越亮）。`drawSea()` **移除原本站在岸邊的白浪/泡沫/漣漪畫法**，改成：粉紫天空漸層 + 沙色地平線霧帶 + 水體（上青綠→下淺沙奶白）+ **離屏逐像素算的 caustics 光網**（`ensureCaustic`/`renderCaustic`，200×150 offscreen，domain-warp 兩層 sin 取零交越＝有機光網，drawImage 放大自帶柔化，screen 疊加）。**握力(tide)→caustics 亮度/密度增強、水色更飽和青綠**；呼吸相位微動水面。render_preview（`caustic_calm`/`caustic_grip`）確認接近參考圖。
  2. **4-7-8 頌缽時機**：Pan 澄清「壓下去看到 4/7/8 時各響一下」＝每段第一次握（remaining===phase.count）響一聲。0dbffa0 已是這行為，維持（Pan 之前看到的是 Codex 版）。
  3. **校正提示語移到球上**：`請握起/請放鬆` 從獨立文字改成顯示在中央球內（`#cueOrbPrompt` + `.orb-cue-text` + `#guideOrb.show-cue-text`），獨立 `#handCuePrompt` 隱藏。
- 驗證：語法 OK；jsdom 0 錯誤（caustic offscreen 在無 createImageData 環境會 graceful 停用）；render_preview 兩圖看過達標。真機請 Pan 確認 caustics 手感（握力→光網更亮更密）與校正提示在球上。
- 註：caustics 是逐像素離屏（每兩幀更新一次省效能）；若某些裝置卡頓，可降 offscreen 尺寸或更新頻率。AESTHETIC #11 的方向已落地。

### 2026-07-15 — Claude｜救援：把 web/index.html revert 回驗證過的 0dbffa0（Codex 版本改壞了）
> Pan：「已請 Codex 接手，但他弄了好多錯誤，請讀 md 挽救。」
- **做了什麼**：`git checkout 0dbffa0 -- web/index.html`，把程式**還原到 Codex 接手前、我最後驗證過的狀態**（commit 0dbffa0）。其他 md 檔保留（Codex 在 GRIPBALL_PROTOCOL/DESIGN/AESTHETIC/web-README 加的是**真實的 Pan 回饋與未來方向，值得留**——見下）。
- **為什麼 revert（Codex 在 index.html 的問題）**：Codex 在 0dbffa0..(其 7 個 commit) 對握力偵測大改（`GRIP_MIN_SPAN 300→80`、`MANUAL_478_ON 0.20→0.10`、`OFF 0.09→0.035`、加 per-slot rise/release delta、`HAND_CUE_PRESS_ON=0.16`、新 observeRest/observePress），把校正與 4-7-8 門檻降太低 → **稍微碰球就進下一階、左手沒做完就跳、輕觸誤判**（Pan 實測）。這推翻了我已用模擬驗證過的：死區 + 單純遲滯 + 時間節奏 cue。
- **還原後驗證**：語法 OK；jsdom 0 錯誤；校正曲線（放開→0.002、輕握→0.49、中握→0.72）；4-7-8 模擬（進場殘握 0 誤觸、12 握→12 拍 3 頌缽）。0dbffa0 的左右手 cue 是**時間節奏**（每手固定時長跑 3 次 on/off，時間到才換手），不會「碰一下就跳」。
- **保留 Codex md 記的有效回饋（＝下一步該做的，但要做對）**：
  1. **校正要當 per-ball state estimation**（不是全域低門檻）：三次 cue 逐次學每顆球的 rest/baseline/舒適握壓 span/release threshold；有效握壓＝相對 baseline 明確上升＋到個人化門檻＋維持 ~450–700ms；成功後短確認、等真的放鬆才進下一手；左手三次完成才進右手。**這是有價值的方向，但上次 Codex 實作得太敏感壞了——下次要用「per-ball 估計＋穩定 hold」而不是「降全域門檻」。**（GRIPBALL_PROTOCOL §Arrival 校正、DESIGN §7.0.1、web/README 緊急項）
  2. **新視覺參考 IMG_9778：不要畫浪，畫光穿過水**（AESTHETIC #11）：清澈淺海、水下 caustics 折射光紋、沙底、粉紫天空；握力改變光紋亮度/密度/流向與內核壓縮，而非人工海浪。
  3. 4-7-8 手動握拍、只導引 4-7-8、屏住呼吸用語等，0dbffa0 都已有，維持。
- **給下一位（含 Codex）**：動握力偵測前先跑 `node` 模擬（見本檔前幾則的測法）＋ jsdom；**不要為了小 input 的球把全域門檻降到輕碰就觸發**——那正是這次壞掉的原因。要做 per-ball 估計就好好做、加穩定 hold 條件。

### 2026-07-14 — Claude｜屏住呼吸、4-7-8 開頭顯示4、頌缽更明顯、低頻海潮近/遠包覆
- 做了什麼（依 Pan 回饋）：
  1. **「憋氣」→「屏住呼吸」**（全部三處：copy、BREATH_PRESETS、MANUAL_478_PHASES）。
  2. **4-7-8 開頭數字先出現**：intro 狀態現在顯示 orbCount = 4、orbPhaseLabel「現在吸氣」＋「現在要開始了，握一下開始」；使用者**握下第一下才發頌缽並開始數**（不是空白）。
  3. **頌缽更明顯**：`singingBowl` peak 0.13→0.22（仍有界過 tanh）。
  4. **低頻海潮近/遠包覆**：Pan「低頻音量一致，浪靠近岸的包覆感、退去的遠感都出不來」。`subGain` 改成 `0.06 + 0.56*tide*(...)`（去掉高 floor、加大 tide 動態），時間常數 0.95→0.55 跟得上；`subLP` 隨 tide 打開（近＝飽滿、遠＝只剩很深一點）。近＝飽滿包覆、退＝明顯變小變遠。
- **待辦 / 卡住（Pan 指定、我目前做不到）**：Pan 要我看他 GitHub 的 **「solarmix spatial audio」** 專案、把裡面的 **MeshRIR** 拿來做 OBA（現在氣泡空間效果不好）。**本次 web 存取受限（搜尋額度用完、github fetch 回空），沒能打開該 repo。** 下一位（或我下次）需要：Pan 提供 repo URL / 指定哪些 MeshRIR 檔與作法；把 MeshRIR 的位置相依 IR 用到氣泡 OBA（位置→選/內插對應 IR 卷積），取代目前「單一 HRTF panner＋單一 room.wav convolver」。這是較大的一塊。
- 驗證：語法 OK；jsdom 0 錯誤。真機請 Pan 確認：4-7-8 開頭看到 4、握才發頌缽且更明顯、低頻隨浪近遠有包覆變化。

### 2026-07-14 — Claude｜debug 4-7-8 卡住/自動扣一拍、加「現在要開始了」換幕引導
- 修的 bug（Pan：什麼都沒做就聽到頌缽、卡在 3、倒數不動）：
  1. **進場那一握直接扣一拍**：從 report「握/甩動進入」的握力，殘留到 session 第一幀，被當成第一次握 → 4→3＋頌缽。修：`resetManual478` 進場設 `manual478Pressed=true`（先當已握），必須真正**放開再握**才開始數。
  2. **卡住數不動**：壓縮曲線（GAMMA 0.55）把殘壓放大到 ~0.1，永遠 > OFF 0.09 → 放開偵測不到 → 無法重新武裝。根因修在 `GripCalibrator`：加**底部死區** `rawLevel<0.05→0`＝真正放開就是 0（驗證：放到 baseline level 0.002、殘壓 +12→0.000；輕/中握仍 0.49/0.72 有反應）。4-7-8 改回**單純遲滯** ON 0.20 / OFF 0.09（之前的相對峰值 re-arm 會被衰減中的殘握重新觸發，已移除）。
  3. 模擬驗證：進場殘握 0 誤觸；12 次握＝12 拍、剛好 3 聲頌缽（每段第一握一聲）。
  4. **「現在要開始了」換幕引導**：4-7-8 進場先進 `intro` 狀態（orb 顯示「準備好就握一下」、「現在要開始了」，不顯示數字），第一次真正握才開始數；`startSession` 進場加 scene-dim 淡入模糊轉場＝換幕感。
- 驗證：語法 OK；GripCalibrator 死區/曲線數值測試；jsdom 0 錯誤。真機請 Pan 確認：進 4-7-8 先看到「現在要開始了」、放開再握才從 4 開始數、每握確實 −1、每段一聲頌缽。

### 2026-07-14 — Claude｜抵達期球水位（覺察呼吸＋表達緊張）、緊張暖色、OBA 氣泡聲源跟質量中心
- 做了什麼（依 Pan 回饋）：
  1. **抵達期中央球也要有水位**：「聽見你的呼吸」(breath) 與「用握力表達緊張程度」(hold) 兩步，中央球 `--cue-fill` 現在平滑跟著握力（`updateArrival` 內驅動），使用者看得到自己握出多少。
  2. **表達緊張＝溫柔暖色**：水位顏色用 CSS 變數 `--fill-r/g/b`；hold 步驟切成暖色 (240,178,138)＝對應緊張，但**刻意柔和不刺激**（app 不希望使用者緊張）；breath 步驟維持海玻璃青 (110,224,226)。
  3. **OBA 水底氣泡湧動**：新增 `bubble` 層＝帶通噪音＋慢 LFO（像水下翻騰），走 **HRTF panner**。**聲源位置＝兩手握力的動態質量中心**（`this.gripPan=(R−L)/(R+L)`，`setGripCenter(pan,total)` 逐幀更新），距離隨總力道（越用力越近）。這就是 Pan 說的 object-based audio：質量中心 → 氣泡聲源位置 → 空間感。音量隨握力湧起。
  4. **文案**：移除 impression 尾巴 settleClause「還有一點停不太住/收得下來」（Pan：沒明確指向身心，只是施力在變）。
- 驗證：語法 OK；OceanEngine mock（bubble 建構＋loop＋setGripCenter）；jsdom 0 錯誤。真機請 Pan 確認：呼吸/緊張兩步球有水位、緊張是暖色且不刺激、雙手握力平衡改變時氣泡聲源左右移動有空間感。

### 2026-07-14 — Claude｜4-7-8 數拍門檻降低、頌缽改「每段第一次握一聲」、只導引 4-7-8、修卡住與文案
- 做了什麼（依 Pan 回饋）：
  1. **4-7-8 數拍門檻太高修正**：之前為修抵達握持把 ARRIVAL_PRESS_ON/OFF 拉到 0.28/0.16，連帶讓 4-7-8「很用力握也沒減少」（放開偵測不到、無法重新武裝）。新增**專屬 4-7-8 門檻** `MANUAL_478_ON=0.20 / OFF=0.09`，且用**兩手 max 握力**判斷（任一手握都算），放開＝都降到 0.09 以下重新武裝。
  2. **頌缽改由握力觸發、每段只一聲**：Pan「晃動偵測太敏感、一次好幾聲很凌亂；改用抓握」。**移除晃動→頌缽**；改成 `advanceManual478` 裡**每一段的第一次握**（`remaining === phase.count`）擊發一聲 `singingBowl()`，不重複。每回 4-7-8＝三聲（吸/憋/吐各一）。方位＝`playBowlForHands()` 用兩手力道向量中心 `(R−L)/(R+L)`（單手偏那側）、遠近＝總力道，映到 HRTF。
  3. **頌缽包覆感**：`singingBowl` 除了 dry＋room convolver，再送 `impactPre→impactVerb`（長殘響尾巴）＝更好的空間包覆。
  4. **只導引 4-7-8**：`recommendBreathPreset` 現在一律回 `hold478`（Pan：其他先放著就好，海潮/左右潮/風箱不移除、只是不主動導引）。
  5. **文案修**：「身體的能量在中間，有點收著」→「身體的能量適中」；「留在這個力道裡，讓它穩一下」→「請保持片刻」。（Pan 還會再找其他不順的句子。）
  6. **抵達握持卡住**（前一併）：ON/OFF 拉高 + 3.5s 安全逾時自動繼續。
- 驗證：語法 OK；OceanEngine mock（頌缽 8 partials＋1 panner＋長殘響送出）；jsdom 0 錯誤。真機請 Pan 確認：4-7-8 一般握就能數、每段第一握一聲頌缽且有方位、不再一次好幾聲。

### 2026-07-14 — Claude｜校正階段加引導語＋水位跟握力、自我覺察呼吸＝浪湧向岸
- 做了什麼（依 Pan 回饋）：
  1. **校正階段有明確引導 + 水位跟著握力**：Pan「很用力握水位才 1/4；校正要引導『請握起/請放鬆』三回，不然使用者會漏掉」。左右手 cue 現在：大字提示在「請握起」/「請放鬆」間切換（`#handCuePrompt`，各三回），標題「校正 · 左/右手」，說明用**你覺得舒適的力量**握（不是用力握緊——Pan 指定用語，別改回「握緊」）。orb 水位改成**平滑直接跟著握力**（`cue.fill += (grip - cue.fill)*0.25`），握起水灌高、放鬆退掉，不再用會卡在 1/4 的累加。校正即用舒適握力把 span 拉到你的滿刻度。
  2. **自我覺察呼吸＝新的浪湧向岸、放鬆退去**：Pan「隨握力帶來新的浪打到岸邊，越用力越靠近岸，到峰頂後隨手放鬆逐漸退去，很重要」。`setTide` 改**非對稱 easing**（漲 0.11 快、退 0.028 慢）＝握起浪快速湧向岸、放鬆慢慢退。海岸 `nearPush` 的握力係數 0.34→0.62、`nearLine` 範圍 0.18→0.30＝握力把白浪推到更近岸、放鬆退更遠。render_preview 對照圖確認：放鬆時浪在遠處低、用力時白浪湧到近岸。
- 驗證：語法 OK；jsdom 0 錯誤；render_preview `shore_relaxed` vs `shore_gripped` 對照確認浪的遠近。真機請 Pan 確認校正引導清楚、水位跟手、握力帶浪到岸的手感。
- 註：`GRIP_HEADROOM=1.0`、`GRIP_GAMMA=0.55`（Stevens 曲線，見前一則＋READING.md §四·六）配合舒適握力校正，session 內舒適握≈滿水位。

### 2026-07-14 — Claude｜殺持續駐音、握力自然曲線(Stevens)、orb 能量水位、頌缽甩動(HRTF)
- 做了什麼（依 Pan 回饋）：
  1. **殺掉持續低音「cycle tone」**：駐音層原本有 floor `0.010`（永遠有一點）＋純 104Hz 正弦＝持續低音。**移除 droneOscA/B 純正弦（只留帶通噪音、Q 2.2→0.8 airy）**，並把 floor 拿掉＝`0.16*drone`，**只有 4-7-8 停屏才有駐音、平時完全靜**。（前一則已移除 subOsc/thump 純正弦。）
  2. **握力校正「要很用力才有反應」修正 + 自然曲線**：`GRIP_HEADROOM 1.15→1.0`（滿刻度＝觀察到的最大握力，不必超過），`GRIP_GAMMA 0.75→0.55`（更壓縮）。依 **Stevens 冪定律**（握力是其經典連續量）做知覺補償曲線＝Max/MSP `scale` 的 exponent 作用；文獻與 Max 對應寫進 `READING.md §四·六`。數值：輕握+100→49%、中+200→72%、最用力→100%（自然、不必死命握）。前面各握三下的 cue 仍是拉 span 到你的舒適最大。
  3. **orb 能量水位看得到**：`--session-water`／`--cue-fill` 的填色從暗藍 .38 改成**亮 aqua .55–.60 ＋ waterline 亮線**，握力越大水灌越高、明顯可見升降。
  4. **頌缽甩動（Pan 新需求）**：4-7-8 數數時**甩動**擊發 `singingBowl()`＝模態合成物理建模（(2,0) 主模＋非諧泛音 [1,2.75,5.38,8.90]＋每模微失諧 beating＋敲擊噪音瞬態＋長衰減，有界過 tanh）。**空間**：方位＝兩手力道加權中心 `(R−L)/(R+L)`，沒握力時用甩動的那手；遠近＝總力道；都映到 HRTF panner→dry/wet。左右手可獨立、兩手一起取向量中心。冷卻 0.35s。mock 測試：8 partials＋1 panner、冷卻正確。
- 驗證：語法 OK；OceanEngine mock 煙霧測試（頌缽、無 subOsc/droneOsc）；jsdom 全頁 0 錯誤；握力曲線數值測試。真機請 Pan 確認：持續低音消失、orb 水位可見、握力不必很用力、4-7-8 甩動出頌缽且方位跟著手。
- 待辦（延續）：練習後「呼吸平均程度＋時長」狀態摘要＋HRV 圖（未做）；`web/audio/478-*.wav` 語音檔不存在；海潮視覺再逼近 Pan 參考照可用 `tools/render_preview.js`。

### 2026-07-14 — Claude｜移除低頻「電平聲」純正弦、4-7-8 完成目標輪數才淡出
- 做了什麼（依 Pan 回饋）：
  1. **移除低頻純正弦「電平聲」**：Pan「海浪低頻有個太低太大的聲音像電平聲，4-7-8 每按一下就冒出來；喜歡以前海底湧動氣泡感」。根因＝純正弦低頻層：**刪除 `subOsc`（52Hz sine，隨握力/湧浪 gain 起伏＝每次握壓冒出的嗡音）**；**impact 的 `thump`（58Hz sine）改成低通噪音爆**（body 感但非純音）；**駐音層 `droneOscMix` 0.42→0.14**（懸止改以帶通噪音為主）。低頻湧動改回只靠 `sub` 噪音床（bubbly，Pan 要的）＋略降其 gain（Pan 說太大）。OceanEngine mock 煙霧測試通過。**下一位別再加純正弦低頻層當「湧動」——用濾波噪音。**
  2. **4-7-8 完成目標輪數才淡出**：Pan「4-7-8 要讓他完全結束才 fade out」。新增 `MANUAL_478_TARGET_CYCLES=4`（約一分鐘上下，可調），`advanceManual478` 完成第 4 輪後呼叫 `complete478()`：顯示「完成了/✓」、停 2 秒再 `endSession()` 淡出到結束後，不半途切斷。orb 上方 metric 顯示「第 X / 4 輪」。同時記錄每次握壓間距 `m.pressGaps`（給下面的評估用）。
- **待 Codex/Pan（Pan 明講的下一步）**：
  - **練習後狀態評估**：Pan「根據呼吸平均程度和時間長判斷狀況，以後用心律變化(HRV)圖表判讀」。groundwork 已備：4-7-8 有 `pressGaps`（按壓節奏，可算平均/變異＝呼吸平均程度）＋ `sessionSeconds()`（時長）。要做的是在「結束後」畫面呈現一個溫和的狀態摘要（非診斷、非分數化，守 guardrail），HRV 是之後接感測器的事。其他 preset（海潮/左右潮/風箱）目前是**手動按「結束」**才淡出，沒有自動 60s 結束；若 Pan 要「每個約一分鐘自動淡出」再加 timed auto-end（4-7-8 例外，走輪數）。
  - 語音檔 `web/audio/478-*.wav` 仍不存在（見上一則）。
- 驗證：語法 OK；OceanEngine mock 煙霧測試通過（無 subOsc、noise body impact）；jsdom 全頁載入 0 非 canvas 錯誤。真機請 Pan 用空白鍵/真球確認低頻不再有電平嗡音、4-7-8 第 4 輪後會自己淡出。

### 2026-07-14 — Claude｜接續 Codex 版：修握力校正貼頂、文字被海浪蓋住、字太小（給 Codex 續接）
> 情況：本次工作開始時，工作目錄的 `web/index.html` 與多個 md 已是 **Codex 未 commit 的版本**（站在岸邊往海看的海岸視覺 + 4-7-8 手動握拍 + orb 大數字）。我在 Codex 版本上**只修 Pan 回報的三個 bug**，未動 Codex 的視覺與 4-7-8 互動架構。這次一起 commit（把 Codex 的工作也進 git）。
- 做了什麼：
  1. **握力校正貼頂修正**（Pan：一開始不管怎麼握水位都一樣高）：`GripCalibrator` 原本 `effScale = span * 0.82`，而 `span = max(posDelta,…)` 使 `posDelta/span ≈ 1` → 每次握都貼到 ~100%。改 `GRIP_HEADROOM 0.82 → 1.15`（滿刻度＝觀察到的最大握力 ×1.15），最用力也只到 ~87%，一般握照力道呈現不同水位。數值驗證：hard 0.90 / half 0.58 / light 0.39（原本全 ~1.0）。真球上仍可能要再微調 HEADROOM/GAMMA。
  2. **文字被海浪白色蓋住看不清修正**：所有引導文字（arrival/session/report/orb 標籤）加深色描邊光暈 `text-shadow`，白字在亮海面/白浪上也讀得到；中央文字區（arrival 各步、`.session-stage`）再加一層柔和深色 radial 底。
  3. **字級整體放大**：desktop 與 `@media (max-height:680px)`（in-app browser 矮視窗）都調大——arrival-copy 16→clamp(18,,22)、hint 13→15、breath-word 也放大；mobile query 一併調大（Pan：使用者反應看不清）。
- 未動但確認可用：4-7-8 手動握拍（`advanceManual478`：每次握壓 edge → 震動 force + beatPulse 相位色 + 數字-1，歸零換段 4→7→8 迴圈；orb 大數字 `#orbCount`、上方 `#orbPhaseLabel`「現在吸氣/憋氣/吐氣」、小字「每數一下就握一下球」）。HAPTICS 全域關、4-7-8 用 `force=true` 短震 42ms。
- **待 Codex/Pan 處理（重要）**：
  - **語音檔不存在**：`MANUAL_478_PHASES` 指向 `audio/478-inhale.wav|hold|exhale.wav`，但 `web/audio/` 目錄不存在，`play478Voice` 會靜默失敗。要嘛放進語音檔、要嘛先拿掉語音。
  - **海潮視覺再逼近 Pan 參考圖**：Pan 本次又貼兩張俯視海浪/白浪/沙灘照，說「我要的海潮是這樣的」。現況是站在岸邊看的版本；若要更接近照片（俯視、翻騰白浪紋理），需再迭代 `drawSea()`。**可用 `tools/render_preview.js`（@napi-rs/canvas 無頭渲染成 PNG）邊改邊看**，不要盲改。
  - **中文文案 Pan 要一起潤**：Pan 說「我會再帶你一起修改中文」，先不要大改文案。
  - 握力校正最好與 Pan 用真球做一次校準訓練（見 [[tidal-grip-calibration]] 記憶）。
- 驗證：script 語法 OK；jsdom 全頁載入 0 非 canvas 錯誤；GripCalibrator 比例測試通過；render_preview 五圖看過（Codex 海岸視覺，青綠海+白浪+淺沙）。

### 2026-07-14 — Codex｜海岸視覺改版、Arrival/4-7-8 手動握拍、聲音喚醒與校正修正
- 做了什麼：
  1. **視覺方向重設**：Pan 上傳兩張海潮參考圖（`~/Downloads/IMG_9765.jpg`, `~/Downloads/IMG_9766.jpg`），先做過一版俯視岸線；Pan 回饋「不一定要俯視，喜歡站在海岸往海邊看的感覺，顏色不錯但海岸太假」。目前 `drawSea()` 改成**站在岸邊往海看**：遠方青綠海面、近處白浪/水膜、保留濕沙/海玻璃色系，不再畫左沙灘/右海水的硬切岸線。
  2. **中央球互動物理修正**：Pan 指出「握力越大球越小，因為球被擠壓」。已把 `--core-scale` / `--session-scale` 改成握力越大越收縮；光、水位、glow 仍隨握力增強，呈現「被壓縮成更密的內核」，不是變沒反應。
  3. **Arrival 文案修正**：「把現在交給手」改為**「用握力表達緊張的程度」**。這是 Pan 明確語感決策，不要再換回詩性句子。
  4. **Arrival 左右手對應/默默校正 bug 修正**：校正 cue 現在必須**先放開、再在球亮起後按下**才計入成功。實作：`handCue.armed` + `pressEdge`，避免球一亮就把已經按著的狀態吃進去。亮起期間若使用者先放開，會重新 armed，可同一輪再按。
  5. **聲音喚醒修正**：新增 `requestAudioFadeIn()`，只有真正嘗試 resume AudioContext 後才 fade in，避免先把 `audioFadedIn=true` 但瀏覽器仍未解鎖聲音，造成後續完全沒聲音。第一次握壓/空白鍵仍是聲音 fade in 的觸發點。
  6. **震動政策更新**：全域 `HAPTICS_ENABLED=false`，自動震動/揮動震動/自動呼吸震動都不再啟用。唯一例外：**4-7-8 使用者主動握一下時，`sendHapticAll(..., true)` 給一次短短確認回饋**。這是互動確認，不是系統排程催促。
  7. **4-7-8 改為手動握拍，不再自動倒數**：`MANUAL_478_PHASES` + `manual478` 狀態。畫面球心顯示大數字，球心上方顯示「現在吸氣 / 現在憋氣 / 現在吐氣」，下方文字為「每數一下就握一下球」。每次有效 rising-edge 握壓才扣一拍：吸氣 4→1、憋氣 7→1、吐氣 8→1，扣完切下一階段。空白鍵也可模擬。
  8. **4-7-8 語音接口預留**：切換階段時會嘗試播放 `audio/478-inhale.wav`、`audio/478-hold.wav`、`audio/478-exhale.wav`；檔案不存在時不會壞。Pan 可能會自己錄音做語音引導，下一位可直接放檔或調整檔名。
  9. **工具接好**：Claude 新增的 `tools/render_preview.js` 原本缺 `@napi-rs/canvas`。已在 `/tmp` 安裝，`node tools/render_preview.js` 可輸出 canvas 預覽（注意中央 DOM 球不在預覽內，需真瀏覽器看）。
- 現在能跑到哪 / 怎麼驗證：
  - `tmp=$(mktemp /tmp/tidal-script.XXXXXX.js); node -e 'const fs=require("fs"); const html=fs.readFileSync("web/index.html","utf8"); const m=html.match(/<script[^>]*>([\s\S]*?)<\/script>/); fs.writeFileSync(process.argv[1], m[1]);' "$tmp" && node --check "$tmp"; rm -f "$tmp"` 通過。
  - in-app browser reload `http://localhost:8001/web/index.html` 無 console error；`#orbCount` / `#orbPhaseLabel` 存在，header hidden，Arrival hold title 正確。
  - `node tools/render_preview.js` 可跑；預覽只檢查 canvas 海面，不含中央球/文字。
- 未完成 / 卡住：
  - 目前未用真球完整測 4-7-8 握一下扣一拍與強制短震；需要 Pan 實機確認 haptic 封包是否足夠明確但不煩。
  - 語音檔尚未錄製；`audio/` 資料夾與三個 wav 可由 Pan/Claude 補。
  - 海面視覺已從假俯視岸線轉成站岸邊視角，但仍偏程式繪圖；下一步若 Pan 還覺得假，建議改成更抽象的水膜/光影，不要回到硬畫岸線。
  - 本輪還未 commit。
- 給下一位的建議或待 Pan 決策的問題：
  - 不要把 4-7-8 改回系統自動震動或自動倒數；Pan 要的是「自己握一下，系統回一下，數字減一」。
  - 4-7-8 必須讓使用者同時知道階段與拍數：球心數字 + 「現在吸氣/憋氣/吐氣」。
  - 中央球的握力物理是**越握越小**，不是越握越大。
  - Arrival 手 cue 不能吃預先按住的力道；一定要 rising-edge。
  - 全域震動保持關閉，只有 4-7-8 主動握拍可短震確認，除非 Pan 再明確改決策。

### 2026-07-14 — Claude｜能「看見」視覺了：無頭渲染工具 + 相位色/漣漪/beat/曼陀羅重修
- **關鍵**：純盲改視覺失敗多次。新增 `tools/render_preview.js`：用 `@napi-rs/canvas`（免編譯）跑真正的 `drawSea()` 輸出 PNG 到 `preview/`，AI/人可實際看畫面再改。**下一位改視覺前先跑它、看圖**。限制：中央曼陀羅是 DOM 元素，不在此 canvas；要看它需真瀏覽器。
- 用渲染圖確認並修好（Pan 回饋）：
  1. **4-7-8 相位色原本完全看不出**：把相位色從「中心淡淡 screen wash」改成**直接染進水體底色**（base gradient 中 mix 相位色 amt 0.4–0.46）。渲染確認：吸＝青綠、停＝暖金、吐＝靛藍，三段一眼可辨、差異極明顯。
  2. **短震太長 + 吸氣沒提示 + 要能分辨換段**：4-7-8 震動縮短到 26–70ms；三段各用不同節奏 pattern，**每段第一拍是獨特轉場 marker**（吸＝三快上行、停＝一下沉穩、吐＝三快下行），後續拍為單短 tick（吸升/吐降/停穩）。吸氣現在有明確 marker。
  3. **每拍畫面明滅看不到**：新增 `beatPulse()` + drawSea 的 beat 渲染（中央亮起＋一圈快速外擴，相位色），渲染確認明顯可見。每拍與震動同步。
  4. **海潮/漣漪沒做出來**：漣漪改成穩定潮汐節律（每 ~2.8–3.4s 一組）＋浪頭明顯較亮（alpha 0.42）＋四道後浪，渲染確認中央同心漣漪可見、有浪頭後浪到岸散去。
  5. **曼陀羅太數位化**：移除 core-orb 的 conic-gradient 放射線與 repeating-radial 同心環、以及 ::before 的硬內圈 inset 陰影；改成柔和珍珠斜光（radial sheen + blur），去幾何感。（此為 DOM，未經渲染驗證，需 Pan 真瀏覽器看。）
- 驗證：語法 OK；jsdom 全頁載入 0 非 canvas 錯誤；render_preview 五張圖（idle/resonance/inhale/hold/exhale/beat）都看過、達標。
- 待 Pan：曼陀羅新樣子要真瀏覽器確認；相位色/漣漪強度可再調；「空間感」若指音訊，仍是既有 wide/side 空間層，未動。

### 2026-07-14 — Claude｜修一半握力消失、4-7-8 改回短震＋相位色、視覺 improvisation（月霧海）
- 做了什麼（依 Pan 回饋）：
  1. **修「用一半握力感測就消失」**：`GripCalibrator` 的慢漂移歸零原本會把持續握到一半當成漂移吃掉（感測器 relaxation 讓 delta 掉進漂移區→baseline 吃掉→歸零）。改成**只在幾乎放開時（this.level < 0.12）才重新歸零**，握持中的中等力道不再消失。jsdom 驗證：持續半握 400 幀維持 ~0.82（原本會歸零）。
  2. **4-7-8 改回短震計數＋刪掉低頻音**：Pan 說看不出相位光澤、海潮效果不好、計數的低頻音要刪、改回短震。移除 `shoreWave()`（計數海潮低頻音，整個方法刪除）與 `pulseCountGlow`；4-7-8 三相位改回**短震計數**（吸＝每拍雙短震強度漸升、停＝每拍單震、吐＝每拍較長震強度漸降）。
  3. **4-7-8 三階段用「明顯不同的顏色」**：吸＝青綠[78,206,178]、停＝暖金[236,190,120]、吐＝靛藍[116,138,224]。整個海面（canvas 從中心 screen 染色 alpha~0.24）＋中央核心（drop-shadow 相位色）＋漣漪都染成該相位色，一眼可辨現在吸/停/吐。CSS 變數 `--phase-r/g/b/--phase-glow`（非 4-7-8 時 glow=0 不染色）。
  4. **視覺 improvisation → 月霧海**：Pan 兩次不喜歡（綠黑、青綠珊瑚），這次整組改成**銀藍月霧 × 珍珠白**：低飽和、低對比、簡明柔和，暖只留地平線一絲遠火。改了 :root 色票（--sea 柔藍、--foam 珍珠白）、canvas 底色/地平線霧/核心光/月光反射/海帶/左右潮/亮暗 blob 全部改銀藍珍珠，core-orb DOM 漸層由金/珊瑚改珍珠/柔藍，scrim 與按鈕暖金 accent 一併換掉。
- 驗證：script 語法檢查通過；jsdom drawSea 多幀 0 錯誤；GripCalibrator 半握測試通過。**配色、相位色是否夠明顯、漣漪柔和度都要 Pan 開 localhost 用眼睛/真球確認。**
- 待 Pan 決策：① 月霧海若還是不喜歡，下一步請 Pan 給 2-3 個色票或參考圖，不要再盲調；② 4-7-8 相位色 alpha（目前 0.24）與三色選擇可調；③ 停屏的 104Hz 駐音層仍在（不是計數音，是「懸止」ambience）——若 Pan 也覺得那是多餘低頻，再拿掉。

### 2026-07-14 — Claude｜曼陀羅周圍潮汐漣漪（浪頭／後浪／到岸散去）
- 做了什麼：依 Pan「海潮可以是平面漣漪、分佈在曼陀羅周圍，簡明柔和，但要有真實潮汐感——浪頭、後浪、到岸能量散去」。在 `drawSea()` 新增潮汐漣漪系統（`__ripples` + `emitRipple` + `queueRipple`）：每個湧浪峰（`swell` 上穿 0.60）從曼陀羅中心（gx,gy）送出一組同心漣漪，壓扁成平面（ry=rx*0.40）；每組畫浪頭（較亮較銳）＋兩道後浪（遞減），半徑越大越淡＝到岸（畫面邊緣）能量散去。4-7-8 的 `shoreWave()` 與拍石 `impact()` 會 `queueRipple(方位, tone)`，drawSea 從對應方位送出定向漣漪（gather/wash 青色、impact/wash 暖色），讓「不同方向的海潮」在視覺上也成立。color 隨 heartWarm、強度隨 tide/呼吸相位。
- 驗證：script 語法檢查通過；jsdom 跑 drawSea 多幀 + 定向事件 0 錯誤。**實際漣漪密度/柔和度/速度需 Pan 開 localhost 用眼睛校準**（可調：emitRipple 的 speed/strength、maxR 係數 0.30、後浪間距 H*0.05、flat 0.40）。
- 待 Pan 決策：漣漪要不要只在 session/4-7-8 出現，還是全程都有；idle（未連球）時是否也要有很淡的呼吸漣漪。目前全程都會依 swell 送出。

### 2026-07-14 — Claude｜回顧改綜合身心印象＋握力符合度、4-7-8 改感官引導、修畫面縮放
- 做了什麼（依 Pan 三段回饋）：
  1. **回顧不再逐項闡述參數**：`buildArrivalReport()` 不再輸出「呼吸狀態/身體張力/停留感/接下來」四列，改成**一句綜合身心印象**（例：「此刻，感覺你呼吸有點淺、有點急，身體裡的壓力和張力也比較大。」）。這是「我猜你大概是這樣」，把準確性交還使用者。文獻依據寫進 `READING.md` §四·五（呼吸淺快↔壓力喚起、握力↔情緒調節、force steadiness↔停留感；均族群相關、非診斷，守 guardrail 6）。
  2. **握力＝符合度**：回顧接一個握力環節——越用力＝越貼近，中間＝不確定，很小力/不握＝不像。放開後定案 `agreement`(0–1)，寫入 CSV（欄位 `arrival_confirmation`→`arrival_agreement`）。接著顯示**一個呼吸建議**（沿用推薦邏輯）。
  3. **握壓或甩動繼續**：移除 report 的「進入 session」按鈕。回顧的建議段用**再握一下或甩一下**開始練習（`reportAdvance()`；`handleSwing` 與鍵盤 Enter/方向鍵在 suggest 段都會觸發；有 700ms 緩衝避免同一次握壓誤觸）。
  4. **4-7-8 改成感官引導（Pan 的範例方向）**：**關掉此 preset 的震動**，改用「不同方向的海潮拍岸」計數——吸4＝四道從不同方位（-0.72/0.34/-0.34/0.72）湧上岸的海潮（新 `OceanEngine.shoreWave(az, tone)`：從遠處湧到近岸再退回散去，走 HRTF→dry/wet 空間鏈，有界隨機）；停7＝駐音層浮起、光澤轉亮、每拍很輕的明暗脈動（心跳代理計數，真 HR 未接）；吐8＝光澤轉暗冷、一道長長的退浪散去。相位光澤用 CSS 變數 `--phase-lum/--phase-tone/--count-glow/--count-tone` 驅動 core-orb 的 brightness/hue。其他 preset 的震動維持不變。
  5. **修畫面縮放**：根因是 `body{overflow:hidden}` 把超出視窗的內容裁掉又不能捲動，使用者只好 cmd+- 縮小。改為 `overflow-y:auto`＋容器 `100vh→100dvh`（in-app browser 網址列不再擠掉內容）＋`align-content:safe center`（內容過高時對齊上緣可捲，不切頂）。
- 驗證：script 語法檢查通過；jsdom 全頁載入 0 非 canvas 錯誤；OceanEngine + shoreWave mock 煙霧測試通過；jsdom 用可控時鐘完整跑「回顧→握力符合度→建議→握壓進 session」全流程通過、0 錯誤。**視覺與聲音的實際手感、4-7-8 光澤/海潮時序、空間定位，都需 Pan 開 localhost 用耳機/真球實測。**
- 未完成 / 待 Pan 決策：① 4-7-8 停7 的「心跳計數」目前是慢變代理，接真 HR/HRV 後才是真心跳；② 光澤變化幅度、shoreWave 音量與方位是設計起點，需實耳校準；③ 這套「海潮＋光澤代替震動」目前只做在 4-7-8，若 Pan 喜歡可延伸到其他 preset；④ 綜合印象的用詞（淺/急/滿/收著…）需真人資料與 Pan 語感校準，避免像貼標籤。
- 給下一位：回顧面向使用者只給「一句猜測＋請身體校正」，不要退回逐項參數或分數化；4-7-8 不要再加震動。

### 2026-07-14 — Claude｜聲景重設計：拍浪有界隨機 × 低頻湧動加強 × 空間分層 × 呼吸法聲音簽名
- 做了什麼：依 Pan 回饋「拍浪每次一樣不像海、低頻湧動太弱、空間感貧乏」做聲音引擎重設計。
  1. **拍浪有界隨機**：`impact()` 重構出 `impactBurst()` 共用層；每道浪的份量（0.7–1.3）、蓄積（0.30–0.58s）、破碎亮度（1400–2800Hz）、位置（揮動方位 ±0.3 漂移、距離 2.1–3.3）、尾巴（0.85–1.4s）都在有界範圍內不同；新增低頻「撞」body（58–88Hz 衰減正弦，破碎時刻進來）；約 1/3 的浪有第二次較小補拍。峰值仍限幅 ≤0.60、冷卻 1.5s 不變。
  2. **低頻湧動加強**：subGain 係數上調、subLP 截止隨湧浪 118–164Hz 微開合；新增 `subOsc` 極低頻正弦（46–60Hz）隨湧浪與呼吸相位鼓起（≤0.31）。海潮 preset `influence` 0.34→0.44，吸氣時低頻水體明顯靠近。
  3. **空間分層**（根因：原本 surge/foam/pebble 全走單一 HRTF panner＝點聲源）：新增 `wide` 立體聲去相關海床（不過 panner，給整片寬度）；新增 `sideL/sideR` 固定 ±60° 岸浪道（走既有 dry/wet），由引導相位（左右潮）與雙手握力（潮線，對應視覺 __leftWave/__rightWave）共同推。
  4. **呼吸法聲音簽名**：4-7-8 停屏新增駐音層（104/104.7Hz 微差拍雙正弦＋210Hz 窄帶噪音；停屏浮起、吐氣退掉、平時極低但不為零＝「懸止非停頓」，BREATHING.md §9）；左右潮改為浪真的在左/右湧起退去，不只 pan 中央床；風箱泡沫隨呼吸短促明滅、寬床更亮。endSession 會把引導層歸零回自走海。
  5. **觸覺**：節流 45→95ms（protocol 建議 ~100ms，避免藍牙塞車讓時序亂）；session 中停發揮動跟隨震動（拍石強脈衝保留），讓呼吸 pattern 獨占觸覺通道；4-7-8 吸氣雙短震逐拍增強（116→140）、吐氣長震逐拍減弱（96→68），可數拍之外多了方向感。Pan 確認長震被 255 上限切斷「還好，好歹知道幾拍」——不要改成連續拼接長震。
- 現在能跑到哪 / 怎麼驗證：script 語法檢查通過；OceanEngine 以 mock AudioContext 煙霧測試通過（新鏈路全部建構、51 次隨機 impact 無錯、冷卻正常）。需 Pan 開 localhost 實聽：拍浪是否每次不同、低頻湧動份量、左右潮是否真的在兩側、4-7-8 停屏駐音是否像「懸止」。
- 未完成 / 卡住：新增益係數是設計起點，需實耳校準（subOsc 在封閉耳機 vs 開放喇叭差很多）；駐音層音高（104Hz）與音色是否夠「懸止」需 Pan 判斷；風箱的聲音簽名還弱，只有泡沫與亮度差異。
- 給下一位的建議或待 Pan 決策的問題：海現在是「一片」不是「一點」——不要把新層塞回單一 panner。強握跨門檻觸發拍石維持現狀（Pan 2026-07-14 確認）。若某層太強，優先調該層 gain 係數，不要動結構。

### 2026-07-13 — Codex｜視覺配色重設：暮光珊瑚 × 海玻璃 × 珍珠月
- 做了什麼：依 Pan 明確回饋「不喜歡現在配色，希望不要再這個」，整體視覺不再沿用綠黑陰沉海／暗月。CSS 變數、按鈕、report、preset 狀態、中央 core orb 與 canvas 海面全部改成新方向：上方暮光深靛、水平線珊瑚暖光、海面海玻璃青、月亮珍珠白與泡沫金。中央符號降低宗教/儀表感，改像月亮/浮在海面上的珍珠光；canvas 背景也改為多色大氣層與青藍潮線，不再是單一深綠黑。
- 現在能跑到哪 / 怎麼驗證：`node` script 語法檢查通過，localhost `http://localhost:8001/web/index.html` 回 200。需 Pan 重新整理後以肉眼判斷新色系是否比上一版舒服。
- 未完成 / 卡住：未做截圖 QA；如果 Pan 還是不喜歡，下一步應直接定一張 moodboard 或 2-3 個色票方向，不再在舊系統上微調。
- 給下一位的建議或待 Pan 決策的問題：不要回到舊版綠黑、暗沉曼陀羅、水核配色。若要調，從「暮光珊瑚 / 海玻璃 / 珍珠月」這組重新演化。

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
