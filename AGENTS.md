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
- **保留既有結構**：`web/index.html` 是從已驗證的 `Gripball/nature_loop_web.html` 演化來的。互動核心（慢漂移歸零、握壓節律、session 流程）已被對拍測試驗證過，**沿用、不要重寫**。
  - **例外（Pan 指示，2026-08-04）**：「自動校正」這一項**已經作廢**。30.7 秒的左右手 cue 校正整段移除，改成「量一次零點 + 固定滿刻度 + 方向不猜」。理由是有真實紀錄證明那套校正學錯（見 `GRIPBALL_PROTOCOL.md` 的「不校正」段落與下面 2026-08-04 的交接紀錄）。慢漂移歸零、握壓節律、session 流程都**沒有**跟著改。
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

### 2026-08-05 (b) — Claude (Opus)｜Pan 試聽回饋四件事：pebble 音質、水位滿刻度、478 倒數、每段第一音改頌缽

Pan 的原話：「pebble 的聲音品質非常差 然後從自我覺察呼吸這邊水位顯示就很糟糕了」／
「478的時間點抓得滿好的 但是有些數字有震動 有些沒有 而且我看不到所有數字倒數 例如 7 這段
竟然是從6開始」／「現在倒數這邊的聲音每段第一個音可以用頌缽的聲音嗎 其他聲音維持目前設定
沒關係」。四件全部處理完（zh + en 兩頁同步）。

- **(a) pebble 音質**：`pebbleBuffer` 整段重寫、新增 `PEBBLE_RATE = 11`。實測三個缺陷：
  ① 舊版 `while(i < len)` 一路往前撒，最後一顆石頭的尾巴被 `len` 硬切，而 pebble 是
  `loop = true` ⇒ **每 4.5 秒一次喀聲**（接縫跳變 vs 鄰域最壞 3.28×、27% 的接縫 >1.0）。
  改成 `(start + j) % len` 繞回開頭 ⇒ 最壞 0.64×、0% 超過 1.0。
  ② 密度 ~34 顆/秒糊成嗡嗡（crest 只有 14.9dB）⇒ 11 顆/秒、每顆 26–84ms ⇒ crest 21.3dB。
  ③ 每顆缺互撞的接觸瞬態 ⇒ 加一個 8ms 快衰減的 650–1800Hz 分量。
  ⚠️ **量測點很重要**：下游 `pebbleBP` 是 LP 380–800Hz，所以「500–2000Hz 幾乎沒有能量」是
  **設計**（「被水吃掉高頻」）不是缺陷；我第一次在濾波器**之前**量，得到的結論完全相反，
  差點把修法定成「補中頻」。詳見 `DESIGN.md` §4。
- **(b) 水位滿刻度**：`GRIP_FULL_SCALE` **900 → 1400**。900 是**照 `GRIPBALL_PROTOCOL.md` 的
  「firm grip ≈ +1250 raw」推的**，不是量真球量出來的——Pan 那兩顆真球大約是它的兩倍。
  重跑他 291 秒的紀錄（**只用 `raw` 與 `tMs`**）：刻意握一下的 dev 峰值 1009–2831 raw，
  而舊 effScale 只有 1098 ⇒ 正常握就貼頂，水位只剩「0 或滿」。改成 1400 後同一份紀錄的
  breath 峰值 0.40–0.84、貼頂 2.6% → 0%。
  ⚠️ **這件事污染了已記錄的資料**：`record/tidal_record_2026-08-05T05-19-01.json` 的
  `arrival.pre_tension = 9` 是貼頂造成的，**那個資料點不可信**，要跟 Pan 講。
  ⚠️ **不要改成「每顆球自己學天花板」**：試過，它會收斂到偶發最大尖峰（ball1 1494／
  ball2 2807），於是正常的握只剩 0.1–0.4，「用握力表達緊張」那題會被記成 0 分。
  學錯比不學更糟——與 08-04 移除 cue 校正同一個理由。兩顆球的動態範圍差 ~1.9×，
  1400 是刻意挑在**較不敏感**那顆附近，讓兩顆都到得了滿。
- **(c) 478 倒數**：兩個獨立的 bug。
  ① 「有些數字有震動 有些沒有」＝眼的震動時長寫死 34ms，比
  `GRIPBALL_PROTOCOL.md:73` 的範例（50ms）還短，短到一部分點在真球上感覺不到 ⇒
  新增 `BANGZI_TICK_MS = 54`（仍明顯短於板的 78ms，重音關係不變）。
  **沒有動 `HAPTICS_ENABLED = false`**，只改 `duration`。
  ② 「7 這段竟然是從 6 開始」＝從時間表反推剩餘數時沒扣掉正在響的那一記。
  正確語意是 `remaining = count − max(0, done − 1)`；少了 −1，板的 `at = 0` 在
  `elapsed = 0` 就成立、被算成打完了。
- **(d) 每段第一個音改頌缽**：分岔看 `p.accent`（時間表上的板），**不看第幾次呼叫、
  更不看使用者輸入**。一段裡只有一記板、段長 6.0–10.6s，而 `singingBowl` 自己有 0.35s
  冷卻 ⇒ 不會糊。其餘的點維持 `underwaterStone`。

**怎麼驗證**（九支全綠，都在 `tmp/`）：

| 指令 | 結果 |
|---|---|
| `node tmp/sim_bangzi_478.js` | 332 項（新增 `[4c]`、`[9]`、`[8]` 的震動時長） |
| `node tmp/mutate_bangzi_478.js` | 82/82 |
| `node tmp/sim_grip_rezero.js` | 198 項（新增 `[8]` 滿刻度＝真球量級） |
| `node tmp/mutate_grip_rezero.js` | 33/33 |
| `node tmp/check_pebble_quality.js` | 46 項（**新檔**） |
| `node tmp/mutate_pebble_quality.js` | 32/32（**新檔**，16 變異 × 2 頁） |
| `node tmp/check_alangyi_match.js` | 114 項（pebble 層權重要對新的 `pebbleBuffer` 重驗過） |
| `node tmp/test_hrir_spatial.js` | 181 項 |
| `node tmp/mutate_hrir_spatial.js` | 93/93 |

每一條新斷言都拿**真正壞掉的碼**驗過，不是只確認它會通過：把倒數的修正 revert 掉，
讀得到的就是 Pan 說的 `6,5,4,3,2,1,0`；換回 `git show HEAD` 的 `pebbleBuffer` 會倒 14 項；
`GRIP_FULL_SCALE` 改回 900 會倒 6 項。

**這次做錯又修正的事（留給下一位，免得重踩）：**
- **接縫的量法我第一次訂錯**：拿「接縫跳變 vs 整個 buffer 的最大跳變」當判準，結果**修好的**
  碼也量到 65.6%。因為紋理裡有寬頻顆粒，石頭橫跨接縫時那裡本來就有一個跟別處一樣大的
  單樣本步階＝正常訊號。正確的定義是「接縫跳變 ÷ 接縫兩側各 5ms 內的最大跳變」，
  跨 60 顆 buffer 校準後門檻取 0.9。錯的第一版寫在測試註解裡。
- **兩個變異逃掉，都是斷言真的有洞，是補斷言而不是弱化變異**：
  ①「倒數改成算剩下的時間比例」逃掉 ⇒ 補上「數字換的時刻要落在某一記的時間點上」
  （畫面要跟耳朵對齊）。②「滿刻度只調一點（1150）」逃掉 ⇒ 用 Pan 實測的刻意握上緣
  補 `levelFor(1486) < 0.98`。
- **「起音拿掉」這個變異實測量不出差別**（最大跳變/峰值兩者都是 0.396，中位數 0.312 vs
  0.344＝seed 雜訊量級）。沒有硬掰一個指標——改成兩條**結構**斷言，並在測試與變異腳本
  兩邊都寫明「這一項不是量出來的」。
- **舊斷言 `maxRemaining.hold === 7` 對 (c)② 完全免疫**：`startBangziPhase` 確實把
  `remaining` 設成 7，只是下一幀就被 `tickManual478` 蓋掉 ⇒ 7 只活一幀、畫面上讀不到。
  實驗證實 revert 修正後 234 項仍全過。現在量的是**每個數字顯示了多久**（≥400ms 才算
  讀得到）。**寫斷言時要問「使用者看得到嗎」，不是「這個值出現過嗎」。**
- **變異的 `from` 字串必須唯一**：`const d = buf.getChannelData(ch);` 在 `index.html` 裡有
  四處，而 `String.replace` 只換第一處（別的函式）⇒ 變異注入到無關的地方、當然抓不到。

**文件同步**：`DESIGN.md` §4（pebble 重寫）、§6（`GRIP_FULL_SCALE` 表列 + 900→1400 的證據與
「不要學天花板」的禁令）、§7.2（頌缽的板、`BANGZI_TICK_MS`、**倒數的語意**）；
`GRIPBALL_PROTOCOL.md`（滿刻度 900→1400、對照表重算、三條 ⚠️）。

**未完成 / 待 Pan 決策：**
- `gripTrust` 初始化成 `0`，這**掩蓋**了小小回顧那段的水位問題（所以 Pan 說「只有小小回顧
  的段落是對的」）。要不要一起改？
- `playBowlForHands`（`web/index.html` 3854）仍然沒有呼叫者。現在 `singingBowl` 又有真的
  呼叫者了，這個函式要留還是刪？
- 一次性音效（impact / cue / glint）目前還是內建 `PannerNode`，要不要一起走 HRIR？
- `assets/hrir/` 的來源資料集**尚未確認授權**（不可宣稱 SADIE II / CC BY 4.0），
  公開發布前要先確認；`web/vendor/omnitone.min.js`（B 路未選用）要留還是刪？
- 「球放到桌上」vs「手放開」還是分不出來（`sim_grip_rezero.js [7d]` 記錄了這個界限），
  要真球的 IMU 靜止資料才能做。

---

### 2026-08-05 — Claude (Opus)｜Pan 試聽回饋三件事：水位卡在半滿、shimmer 太遠、478 速度曲線改照 MIDI

Pan 跑了 08-04 那版之後的回饋，三件事全部處理完（zh + en 兩頁同步）。

- **(a) 「從一開始沒有握起來水位就是全滿的，握了再放掉也會一直停留在半滿」**（已 commit `1bb61ff`）
  ⚠️ 這是 08-04 (a) 那個修法**沒修乾淨**的部分，不是新 bug。根因是三方死結：
  ① 握著連上 → 零點寫成握著的值，放開後偏差還有 ~700 raw；② 700 raw → shaped 0.65 →
  判定成「正在握」→ baseline 凍結在 0.00005/frame（那是刻意的，讓 4-7-8 的長屏息不會下沉）
  → **錯的零點也一起被凍住**；③ 唯一會修 `restRef` 的那一行被 `< GRIP_REST_MARGIN`(45) 擋住，
  而 700 ≫ 45。**在真實的 30Hz 下**這個凍結速率要 ~30 分鐘才走得完（既有的 sim 全跑 80Hz，
  這個取樣率差距正是它一直沒被抓到的原因）。
  修法的**依據是實測極性**，不是調參數：從 Pan 的 20 653 筆真實 report 量出兩顆球都是
  **up-polarity**（靜止落在分布底端；slot1 眾數 ~34320、p99 +683、最大 +1521、往下只有 −454；
  slot2 眾數 ~34224、p99 +2168、最大 +2911、往下只有 −225），對照
  `GRIPBALL_PROTOCOL.md` 的「紮實一握 ≈ +1250 raw」。既然**出力只會讓 raw 上升**，
  那麼一個持續停在**零點下方**的平台就只可能是零點取樣錯了。方向性就是整個安全論證——
  所以這條不需要信任門檻、不需要一次性額度、不需要 8 秒窗，也**永遠不會吃掉刻意的長握**
  （長握是往**上**走）。常數 `GRIP_SETTLE_MS = 600` / `GRIP_SETTLE_MIN_SHIFT = 60`。
  兩條重取零點的路徑按證據品質分工：眾數／佔用時間那條保守（要贏過現任、關在 8 秒窗裡、
  一次性），零點下方平台這條激進（無視被污染的歷史、永遠開著）——零點錯的時候，
  佔用時間的歷史**本身就是被污染的證據**。
  驗證：30Hz 下握 3/6/9/15/25 秒都在 3 秒內回到 0（改之前 ≥6 秒就永遠卡在 0.65）；
  16 秒刻意長握不受影響（水位 ≥0.5、`settleCount === 0`）；用 Pan 的真實 log 重播結果
  **與改動前完全相同**（slot1 水位中位數 0.000、0% 觸頂；slot2 17.5% 飽和）＝健康的
  session 沒被動到。`tmp/sim_grip_rezero.js` 88 → 168 項斷言、`tmp/mutate_grip_rezero.js`
  17 → 29 個變異（29/29 抓到）。
  ⚠️ **誠實記錄一個沒解決的界限**：「把球放到桌上」也是「零點下方的平台」，跟「手放開」
  在訊號上**分不開**（實測舊註解記的 Ball2 放下差 1860 raw）。取捨往「握著連上」倒，
  因為那是 Pan 兩次回饋都遇到、每個 session 都會碰的；「中途放到桌上再拿起來」少見，
  而且**修好前就已經是壞的**（實測：修好前再拿起後 30s 水位 0.75、修好後 0.85，都靠
  phantom 修復在 ~60s 內收斂，量級沒變）。**想真的分開需要「球是否在手上」的獨立證據**
  ——例如 IMU 的靜止判定。這需要實機實驗，列為待辦。

- **(b) 「海的空間感還不錯，只是 shimmer 的聲音太遠了，幾乎感覺不到」**
  遠近感是 **direct-to-reverberant ratio**，不是音量。`loadIR` 設的全域是 dry 0.4 / wet 0.8
  （殘響大於直達聲，−6.0dB），所以每一層都被推遠——**光調大 `SHIMMER_LEVEL` 只會得到
  「一個比較大聲的遠處的東西」**。改成給 shimmer 自己一對 gain（per-layer 乾濕比是本專案
  既有的寫法，見 `playGlint`）：`SHIMMER_DRY = 2.2`、`SHIMMER_WET = 0.40`
  → D/R 從 −6.0dB 轉成 **+8.8dB**，而送到 clip 的**總量維持 1.20（0.0dB）**。
  ⚠️ 這兩個數字是**一起**挑的。我第一版用 1.35 / 0.30，D/R +7.0dB 但總量掉 3.7dB——
  那是**拿音量換距離感**，而 Pan 的抱怨正是「幾乎感覺不到」，等於沒解決。所以把
  「總能量不減」寫成斷言釘住，不讓它退化。`tmp/check_alangyi_match.js` 92 → 114 項
  （並且教它把 shimmer 的匯流權重算進頻帶分析，否則那支測試對這個改動視而不見）、
  `tmp/mutate_hrir_spatial.js` 83 → 93 個突變（93/93 擋下，含一個專打「用調小 wet 換距離感」）。

- **(c) 「478 應該是第一拍拍下去有個較長間隔，然後漸快再漸慢」＋ 給了 MIDI 當範本**
  Pan：「你看一下 tidal 資料夾裡面有個 midi_Accel_Rit_Rhythm 的 midi clip, 你可以從中學習
  他的速度變化的方式」。手工解析 `midi_Accel_Rit_Rhythm.mid`（format 0、96 tpq、11 個音、
  note 76、無 tempo meta）：IOI `116 76 73 57 57 62 76 78 96 108` tick、
  力度 `127 70 63 52 57 63 65 61 57 50 39`。除以最短的 57 得到
  `BANGZI_CURVE = [2.04, 1.33, 1.28, 1.00, 1.00, 1.09, 1.33, 1.37, 1.68, 1.89]`。
  這**修正了原本的模型**：原本是單向的幾何級數 `BANGZI_SLOWDOWN = 1.24`（只會愈來愈慢），
  而且起頭空隙 `BANGZI_LEAD_MS = 300` 是**最短**的——正好與 Pan 要的相反。兩個常數都移除。
  段落點數不同（3/6/7）時用 `bangziGaps(n)` **線性內插重新取樣**，不是截斷：截斷的話短段落
  只拿到「長間隔＋漸快」那一半，聽不到漸慢。強度插值改成 `0.65·slow + 0.35·k`
  （`slow` 看**當下的速度**、`k` 看段內位置），因為 MIDI 的力度在最快處附近會回升
  （52→57→63→65），尾端才收掉（50→39）。`BANGZI_UNIT_MS` 900 → 880，讓一輪維持 26.1s。
  **附帶發現**（不是刻意設計）：段長比例從 1 : 2.85 : 3.76 變成 **1 : 1.56 : 1.75**，
  明顯更接近 4-7-8 本身的 1 : 1.75 : 2.00——單向級數會把點數多的段落過度拉長，
  而先快後慢的曲線讓中段的密集把長段拉回來。
  `tmp/sim_bangzi_478.js` 174 → 234 項斷言（其中一項直接斷言曲線**等於那份 MIDI 的 IOI 比例**，
  否則任何人都可以換成自己編的數列而測試照樣通過）、`tmp/mutate_bangzi_478.js`
  24（只跑 zh）→ 64 個變異（**兩頁各注入一次**；en 已同步，原本那個「只生成 zh 變體」的
  分支是在放水，已移除）。
  ⚠️ 修測試時我自己寫錯過一次：斷言「最密的那一點要用比較小的石頭（慢＝大＝低沉）」——
  方向反了。既有設計是 `size` 與 `intensity` **同向**（密＝大＝強，收尾一起淡出），
  慢的那幾點刻意用小石頭小音量是為了**淡出**，不是為了更低沉。已改成釘住這個同向性。

**七支測試現況（全綠）**：`sim_grip_rezero` 168、`test_hrir_spatial` 181、
`check_alangyi_match` 114、`sim_bangzi_478` 234；`mutate_grip_rezero` 29/29、
`mutate_hrir_spatial` 93/93、`mutate_bangzi_478` 64/64。
`DESIGN.md` §5（shimmer 乾濕比）與 §7.2（新的速度曲線與時間表）已同步更新。

**新增待決策／待實機（延續 08-04 那批）**：
- 分辨「球放桌上」與「手放開」需要獨立證據（IMU 靜止判定）——見 (a)。
- `gripTrust` 的初始化：初始為 `0` 時 `trustedHeld()` 25 秒後永遠回 0（除非有球到過
  `AFTER_OFF`）。它目前**遮住**了小小回顧那段的水位 bug（也就是為什麼 Pan 說「只有小小
  回顧的段落是對的」）。要不要修，請 Pan 決定。
- `GRIP_FULL_SCALE` 是否改成 **per-slot**（兩顆球差 ~2×，slot 2 有 17.5% 的幀飽和）。
- `playBowlForHands` / `engine.singingBowl` 目前沒有呼叫者：移除還是再利用。

### 2026-08-04 (d) — Claude (Opus)｜Pan 實跑回饋四件事：零點 bug、頻帶不對、4-7-8 改成水中石頭梆子（中英文版同步）

Pan 跑了 (c) 那版之後的回饋，逐項處理。**（c) 的 commit `c7b3d93` 仍是 local-only，本則的
改動也全部未 commit**——Drive 掛載當時不通，工作區在 `/tmp/tidal-work`。接手的第一件事是把
它同步回 Drive 再 push。

- **(a) 握力：「一剛開始鬆開手水位還是會跑到全滿」＋「478 一剛開始按壓會不太有反應，然後突然
  bang＋震動好幾次」**（正面回饋：「但真的很輕鬆很好握」）
  這兩個症狀是**同一個 bug**：零點在「手已經握著」時取樣 → baseline 寫成握著的值 → 放開後
  `Math.abs(rawDev)` 變大 ＝ 水位全滿；按壓時 raw 反而往 baseline 靠 ＝ 量不到上升邊；
  幾秒後零點被慢慢修回來、極性翻正 ＝ 積著的邊一起認列 ＝ bang 好幾次。
  修法：**零點自我修正**（直方圖眾數估計，`GRIP_HIST_BIN` / `GRIP_HIST_MIN_MS` /
  `GRIP_REZERO_MS` / `GRIP_REZERO_MIN_SHIFT`）＋ `GRIP_BEAT_REFRACTORY_MS = 400` 不反應期。

  ⚠️ **三個給接手者的坑，都是實際踩到的：**
  1. **挑戰者必須「贏過」現任者，不是只過門檻**。原本只要求某一格待滿 1.5s 就換零點。
     但 4-7-8 數拍是每秒握 0.35s，連握 5 拍之後**握著那一格**的累計佔用就超過 1.5s
     → 零點被握壓偷走 → 放開後水位卡在 0.8。眾數的定義本來就是「佔用最多」，所以加了
     `ms > baseMs`（現任者 ＝ 零點所在那一格含鄰格）。**這個 bug 是 527 項斷言全都漏掉的**，
     靠重寫 `tmp/_dbg.js` 手動觀察 `beats` 情境才發現——觀察工具有它自己的價值，別讓它爛掉。
  2. **`GRIP_REZERO_MIN_SHIFT` 是另一道獨立的守門，別以為 1. 涵蓋了它**。它擋的是
     「挑戰者佔用真的比較多、但只挪了幾十個 raw」——重取零點是**一次性**的
     （`rezeroCount === 0`），被微小漂移用掉額度，之後真的錯零點就再也修不回來。
     測這件事的漂移必須**漂到就停住**；寫成一路慢慢爬的斜坡會被 1. 先擋掉，斷言變成空的。
  3. **不反應期只能擋「算成拍」，絕不能擋「解除武裝」**。擋掉的話這一握永遠不會結束，
     每過一次不反應期就再補一拍 ＝ 另一種形式的 bang 好幾次。
  還有一個**無法消除的取捨**已寫進碼裡的註解：「一開始握著→放開」與「先靜止→刻意長握」的
  raw 結構完全相同，能區分的只有「在新位置待多久」。選了 1.5s 門檻／8s 窗／最多一次。
  代價是**窗內**（前 8 秒）的刻意長握會塌一次；4-7-8 憋氣發生在窗外，不受影響。

- **(b) 聲音：「這些聲音跟我當時阿朗壹海岸錄音的頻帶差很多，這個版本的模仿海浪的白噪音很假，
  然後 shimmer 和 pebble 的聲音幾乎都是沒有的」**
  三個獨立成因，見 `DESIGN.md` §4 與 `assets/hrir/README.md`（兩份都已改）：
  1. **HRIR 低頻往下斜**（220Hz −23.8dB）。(c) 那版用「每層一個寬頻倍數」補，只能拉回該層的
     中位能量，層內斜度還在。改成**在卷積之後接固定等化鏈** `HRIR_TILT_FIX` ＋
     `HRIR_TILT_TRIM = 1.288`，最大殘差 2.7dB。頻帶絕對誤差合計 **121% → 57%**、
     centroid 4526Hz → 2356Hz（阿朗壹 428Hz，仍偏亮但方向對了）。
     `SPATIAL_MAKEUP` 隨之全部塌回 ~1.0。
  2. **白噪音 → 粉紅噪音**（`pinkNoiseSource()`）。白噪音每倍頻程能量相同 ＝「嘶」；
     自然是 −3dB/oct。實測 250Hz→4kHz 落 −10.4dB／4 oct。
  3. `SHIMMER_LEVEL = 2.4`、`PEBBLE_FLOOR = 0.14`（pebble 的 floor 守「聲音永遠不消失」）。

  ⚠️ **`foam` 的 makeup 是 0.98，不是 0.90。** 0.90 是 `tmp/fit_hrir_tilt_fix.js` 把 foam
  當成「沒有上限的 HP1500」算出來的——它漏了後來加的 `foamLP` 頂端蓋子，少了 0.8dB。
  那支腳本現在**從頁面讀** `foamLP.frequency`。上線常數來自擬合腳本時，腳本的模型就是
  上線碼的一部分，別在裡面寫死頁面已經改掉的東西。

- **(c) 「我把 log 存到 log 資料夾裡去了 再請你確認」——✅ 找到了、已經用它驗過（2026-08-05）**
  Drive 掛載恢復後找到了。**沒有 `log/` 資料夾**，log 直接在 EEG 根目錄：
  `tidal_grip_log_live.ndjson`（17MB、20769 行、2026-07-22、28 分鐘、兩顆 MB01、30Hz）、
  `tidal_grip_operation_log.json`（7.5MB）、`tidal_grip_log_live 2.ndjson`（0 byte，空的）。
  **log 不進 repo**（`AGENTS.md` 的隱私規範：session 紀錄只存本機、不上傳）。

  新增 `tmp/replay_grip_log.js`：拿真 log 重播**現在的** `GripCalibrator`。
  ⚠️ 那份 log 錄於 **07-22，早於 08-04 改版**，裡面的 `baseline`/`level`/`sign` 是舊校正算的，
  腳本一律不採用，只吃 `raw` 與 `tMs`（硬體事實）。真實時間戳有斷線造成的 1370 秒跳躍，
  所以按 >5s 的間隔切成 session 再各自重播（硬接下去會拖著一段不存在的歷史）。

  **結果（這是本次最有價值的驗證——人造訊號驗不到刻度）：**
  | | slot 1 | slot 2 |
  |---|---|---|
  | 在握時的偏差 p99 | 643 | 2212 |
  | 持續 0.5s 以上的最大偏差 | 1227 | 2670 |
  | 達到滿刻度的比例 | 2.7% | 17.5% |
  | 水位觸頂 / 誤重取零點 | **0 / 0** | **0 / 0** |

  ① **28 分鐘真實資料裡，零點修正 0 次誤觸發、水位 0 次假觸頂** ——(a) 的修法在真硬體上成立。
  ② **`GRIP_FULL_SCALE = 900` 可以留著，不要照 p99.9 調大。** 我一開始寫成「用 p99.9 當滿刻度
  → 建議 1300/2750」，那是**錯的框架**，已在腳本裡改掉並寫下理由：滿刻度的意思是
  「**紮實地握**就該讀成全滿」，所以最用力的那幾下**本來就該**超出刻度被 clamp。
  真正要看的是飽和比例——2.7% / 17.5%，全滿碰得到又沒把動態範圍壓平。
  ③ **兩顆球的靈敏度差約 2 倍**（slot 2 的偏差是 slot 1 的 2–3 倍，17.5% 偏高一點）。
  單一常數是折衷。要不要改成 **per-slot 滿刻度**是新的設計決策，**留給 Pan**。

- **(e) 修掉 `EEG/tmp/test_foa_encode.js` [10] 範圍過寬的斷言（2026-08-05）**
  原本是 `!/spatial_bench/.test(main)`。主頁採用 bench 選出的 C 路之後，碼裡有一句
  **出處註解**提到 `web/spatial_bench.html`——那正是 `AGENTS.md` 要求的決策脈絡，
  卻讓斷言失敗：**測試在罰它自己要求的好習慣**。改成只擋真正造成相依的形式
  （`src=`/`href=`/`fetch(`/`import(`/`location=` 指向 bench），註解放行。
  反向驗過：塞一個 `<script src="spatial_bench.html">` 進去仍會被抓到。53/53 通過。

- **(d) 4-7-8 全新設計：水中石頭 × 中國戲曲梆子節律（Pan 指定參考 2016 年那篇 wearable 研究）**
  設計全文寫在 `DESIGN.md` §7.2（舊的握拍版留在該節末當歷史）。要點：
  一記板＋一串由快到慢的眼，敲擊總數 ＝ 段落數字；4→3.4s、7→9.7s、8→12.8s，
  一輪 25.9s ＝ 2.3 呼吸/分；聲音是 `underwaterStone()`（低沉、短衰減，**不是頌缽**——
  頌缽的長尾會讓連擊糊掉）；**時間驅動、不抓捏握**。
  Pan 明確指定**抵達流程的問問題**與**前面的自由／共振呼吸保持原狀**。

  ⚠️ **guardrail 的處理（重要）**：`HAPTICS_ENABLED = false` 那條規則要求「不要在未經 Pan
  確認下重新啟用自動 haptic pattern」。Pan 這次的要求就是那個確認，但我**沒有**把總開關打開
  ——全域旗標仍是 `false`，梆子只用**顯式 `force`** 呼叫、且只綁在**時間表**上，絕不看使用者
  輸入。這樣「震動絕不用作懲罰或催促」仍然完整成立。`tmp/sim_bangzi_478.js [8]` 與一個
  「梆子的震動改看使用者握壓」的變異在守這件事。**不要圖方便把全域旗標改成 `true`。**

- **中英文版**：`web/en/index.html` 之前落後 689 行，本次**全部補上**。
  兩頁共用**同一份中文註解的引擎碼**，只有 UI 文案／log 字串是英文，所以整段 class 置換是安全的
  ——**但置換前要先確認那段裡沒有英文文案字串**（我用 `"[A-Za-z][A-Za-z '\.,!?]{6,}"` 掃過被移除
  的行）。兩個例外：`HrirBank` 的 log 文案不同，**不要整段置換**；en 沒有 `gripLog()`，移植過去
  的碼要把那行拿掉。

- **驗證**（全綠）：`tmp/sim_grip_rezero.js` 88、`tmp/sim_bangzi_478.js` 182、
  `tmp/test_hrir_spatial.js` 179、`tmp/check_alangyi_match.js` 92 ＝ **541 項斷言**；
  變異測試 `mutate_grip_rezero` 17/17、`mutate_bangzi_478` 24/24、`mutate_hrir_spatial` 83/83
  ＝ **124/124**。
  **這次學到最重要的一課：regex 斷言不夠。** 「係數留著、註解全對、但輸出那一行改成
  `d[i] = w`」的粉紅噪音變異逃掉過兩次，因為根本沒有測試量過產生器的輸出。補了實測頻譜
  （Goertzel DFT ＋ 1/3 倍頻程平均）才抓到。同理，(a) 的零點 bug 也是行為觀察抓到的。
  兩支變異腳本現在都**每次重新生成** zh-only 的變體，不再留手動維護的副本（那份會過期，
  於是變異測試量的是舊測試——本專案已經踩過）。

- **⚠️ Drive 掛載上不要跑 git**（2026-08-05 學到）：在 Drive 目錄裡 `git fetch` 一個**本地**
  路徑跑超過 5 分鐘還沒完，背景跑也被環境砍掉兩次。可行的做法是
  **在 `/tmp` 工作並 commit → `git push` 到 GitHub（幾秒）→ 在 Drive 目錄 `git pull --ff-only`，
  而且要用 `nohup … &` 完全脫離**（前景與一般背景都會被超時砍掉）。已這樣同步完成，
  Drive 現在也在 `231d3ef`，`meditation/` 與 3 個 `record/*.json`（gitignore 的本機專屬內容）沒動。

- **給下一位／待 Pan 決策**
  1. **`playBowlForHands` / `engine.singingBowl` 現在沒有任何呼叫者**（4-7-8 改用石頭了）。
     刻意留著並加了註解。要刪還是另作他用，請 Pan 決定。
  2. **`GRIP_FULL_SCALE` 已用真 log 驗過，900 留著**（見 (c)）。**新的待決事項：要不要改成
     per-slot 滿刻度**——兩顆球靈敏度差 2 倍，slot 2 的飽和比例 17.5% 偏高。
  3. 仍要等實機才能定的兩件（真 log 也驗不到，因為它們要看**當下**的硬體行為）：
     phantom self-healing 可能吃掉刻意的長握；單一筆壞報告仍可能被算成一拍。
  4. 待決：一次性音效（impact / cue / glint）要不要也改走 HRIR；對外發佈前要不要先確認
     HRIR 原始資料集（`assets/hrir/README.md` 已標「未確認」，**不要照抄 SADIE II / CC BY 4.0**）；
     `web/vendor/omnitone.min.js` 要留還是刪。

### 2026-08-04 (c) — Claude (Opus)｜Pan 選了 C：實測 HRIR 卷積上主頁（中英文版同步）＋ shimmer 調大

- **Pan 的決定**：「c 的表現最好，請用它來套用到我的 tidal 專案裡面，然後 shimmer 的相對音量可以再大點嗎」。
  所以 (b) 那則裡「主頁未動」的狀態**到這裡結束**——`web/index.html` 與 `web/en/index.html` 都改了。
  Omnitone（B 路）**沒有選用**，`web/vendor/omnitone.min.js` 目前留著沒刪（見下面待決事項）。

- **做了什麼**
  1. `assets/hrir/`：從 duck-hunt 複製水平面 90 個 IR（48kHz / float32 / stereo / 256 taps，共 368KB）
     ＋ `manifest.json` ＋ `README.md`（來源、量測、補償表都在那裡）。只取 `ele=0`，那邊另有 ±15°/+30°。
  2. 兩頁都新增 `HrirBank`（多候選路徑載入、繞圈找最近角度、per-IR L2 norm、粗暖一圈）與
     `HrirSource`（單聲道化＋makeup＋雙 convolver 交叉淡化＋退回 panner）。
  3. 走實測 HRIR 的層：主浪匯流排（surge/foam/pebble）、bubble、左右岸浪。
  4. `SHIMMER_LEVEL = 1.6`（+4.1dB），乘在整個 `causticAmt` 上。

- **⚠️ 一個一定要先知道的量測結果：不補償就等於偷改 Pan 調好的平衡。**
  這批 IR 在低頻是往下斜的。以 `foam`（HP1500）為 0dB 基準，在各層**真實濾波器頻帶**內取
  對數等距 13 點 DFT、90 個方向取中位數：

  | 層 | 頻帶 | 卷積後帶內增益 | 補償 |
  |---|---|---|---|
  | drone | BP260 | −17.1dB | 7.19× |
  | bubble | BP320 | −13.7dB | 4.82× |
  | shore | LP640 | −12.3dB | 4.10× |
  | pebble | LP700 | −11.2dB | 3.61× |
  | surge | LP800 | −9.9dB | 3.11× |
  | shimmer | LP1450 | −4.7dB | 1.72× |
  | foam | HP1500 | +1.4dB | 0.85× |

  低頻層會整體掉 10–14dB ＝ 悄悄把 Pan 依阿朗壹錄音調好的比例改掉。卷積是線性的，所以在
  **進 convolver 之前**乘上係數就能還原，而且左右耳乘同一個數，ILD（方向線索）不受影響。
  方向之間還有 −2.4 .. +7.5dB 的起伏，那是 HRTF 本來就有的，**不補、也不該補**。

  **因此主頁會比 Pan 在 bench 聽到的 C 路低頻更足**——bench 的 C 路沒有這層補償。這是刻意的，
  但也是「Pan 認可的聲音」與「上線的聲音」之間唯一的差別，所以頁面上留了 **H 鍵**可以即時
  切回瀏覽器內建 HRTF 做 A/B。**如果 Pan 覺得太厚，先動 `SPATIAL_MAKEUP` 而不是動各層的
  `gain.value`**（後者是 Pan 自己調的聲音設計，補償是後來加的修正項）。

- **兩個刻意的邊界（是決定，不是漏掉）**
  - **shimmer 不過 HRIR**：它是「一片」水光而不是點聲源，過點聲源定位會把它收成一個方向
    ——跟 `sub` / `wide` 同樣的理由。沒經過 HRIR 就沒有要補的損失，所以也沒有 makeup。
  - **一次性音效（impact / cue / glint）留在內建 panner**：① bench 只比較了 5 個持續層，
    Pan 的耳朵認可的是那些；② 那三個是寬頻瞬態，內建 panner 的弱點（低頻持續帶）在那裡
    影響最小；③ glint 約 1.6 次/秒，每次多開一顆 convolver 是真實的效能代價。要不要一起換
    **請 Pan 決定**。

- **⚠️ 資料集來源：duck-hunt 的標示是錯的，而正確答案還沒確認。**
  duck-hunt 的 `.gitignore` 把來源池標成「1551 個 MeshRIR HRIR wav」。**這個標示錯了**：
  MeshRIR 是**房間**麥克風陣列（3969 顆全向麥克風），裡面沒有 HRTF。實測：

  | 方位角 | 峰值 ITD | ILD |
  |---|---|---|
  | 0° | 0µs | −2.2dB |
  | 45° | +167µs | +16.5dB |
  | 90° | +583µs | +20.4dB |
  | 270° | −583µs | −17.2dB |

  ±583µs 與 20dB 是**人頭**量級（真人 ITD 上限約 ±700µs），90°/270° 對稱翻號。相距 0.3m 的
  兩顆**全向**麥克風不會有 20dB 的耳間差（沒有頭部遮蔽），ILD 會接近 0。所以這批是真 HRIR。
  `gripball_webhid.js:1514` 的「SADIE-style」比較接近。**但確切的原始資料集仍未確認**
  （來源池 `hrir_wavs/` 不在 repo、也不在這台機器上），所以**沒有**替它寫任何引用。
  **要對外發佈前請先確認原始資料集與授權**——不要照抄 SADIE II / CC BY 4.0 的說法。
  （`assets/ir/room.wav` 是另一件事：那個確實是 MeshRIR、CC BY 4.0、要標註 Shoichi Koyama et al.，
  標註仍在 `assets/ir/README.md`。兩者同時在用：HRIR 給方向、room.wav 給房間。）

- **怎麼驗證**（都從 `Tidal/` 這層跑）
  ```
  node tmp/test_hrir_spatial.js       # 169 項斷言（中英文版各跑一次結構斷言）
  node tmp/mutate_hrir_spatial.js     # 59/59 個突變被擋下（兩頁各注入一次）
  python3 -m http.server 8000         # 然後開 http://localhost:8000/web/index.html
  ```
  **注意這次測試放在 `Tidal/tmp/`（進 repo），不是以前的 `EEG/tmp/`（在 repo 外、沒版控）。**
  理由：測試跟著它驗的碼一起版控，換機器 clone 就能跑；`EEG/` 不是 git repo，放那裡等於
  只存在這台機器上。舊的 `EEG/tmp/*.js` 沒有搬（Drive 讀不到），所以兩處暫時並存——
  **建議下一位把舊的也搬進 `Tidal/tmp/`**，並把路徑從 `EEG/` 相對改成 `Tidal/` 相對。
  測試**讀真的 IR 檔**量 ITD/ILD 當真值（不用假資料），並且 regex 抽 `index.html` 裡**真正的**
  `nearest()` / `SPATIAL_MAKEUP` 出來跑，不在測試裡重寫一份。最關鍵的兩項是
  「pan=+1 挑到的 IR 右耳要更大聲」（左右搞反不會報錯、只會聽起來相反）與「makeup 要等於
  從真 IR 重算的值」。診斷面板（**D**）多了一行 `spatial:`，可以看到目前用哪條路、暖了幾顆 IR。

- **⚠️ 未完成 / 卡住**
  - **這次的改動還沒進 Google Drive 也還沒 commit。** 工作期間整個 Drive 掛載變成
    `Operation not permitted`（連帳號根目錄都 `ls` 不了，Drive 行程還活著），所以我從已推上去的
    `b3f59a0` clone 到 **`/tmp/tidal-work`** 繼續做。**掛載恢復後要把 `web/index.html`、
    `web/en/index.html`、`assets/hrir/`、`tmp/test_hrir_spatial.js`、`tmp/mutate_hrir_spatial.js`、
    `tmp/port_hrir_to_en.py`、`AGENTS.md` 複製回 Drive 再 commit / push。** 沒有東西遺失
    （`b3f59a0` 是剛推上去的），但**在複製回去之前 Drive 上的 repo 沒有這些改動**。
  - 上次 push 也遇過 Drive 的 `mmap failed`：解法是 clone 到 `/tmp`、`git fetch <drive路徑> main:drivemain`
    → `merge --ff-only` → 從 `/tmp` push。
  - `tmp/test_foa_encode.js` [10] 那條 `!/spatial_bench/` 是整檔字串比對，現在會對**註解裡**
    提到出處的那行誤報。原意是「主頁不能**依賴** bench」，所以 `tmp/test_hrir_spatial.js` 改成只驗
    `script src` / `import` / `fetch`。**那條舊斷言要改成同樣的寫法**（該檔在 Drive 的 `EEG/tmp/`，
    目前讀不到，所以還沒改）。`!/omnitone/` 那條仍然成立、也已在新測試裡覆蓋。
  - 這次**只用測試與量測驗過，還沒有人用耳朵聽過**。H 鍵 A/B 就是為此留的。

- **給下一位的建議**：Pan 若說「低頻太多」→ 調 `SPATIAL_MAKEUP`（整體乘一個 <1 的數），
  不要動各層的 `gain.value`。若說「方向感沒差多少」→ 先按 H 確認 A/B 真的有切換
  （看 `spatial:` 那行），再看是不是 `cached` 數字太小（IR 沒暖到）。

---

### 2026-08-04 (b) — Claude (Opus)｜空間音訊 A/B/C 試聽台（`web/spatial_bench.html`）—— ⚠️ 「主頁未動」已由 (c) 取代

> ⚠️ **後續**：Pan 之後聽了 bench，選了 **C 路（實測 HRIR）**，主頁已於 **(c)** 那則改掉。
> 下面「主頁刻意一行都沒改」只描述 (b) 當時的狀態。這則其餘的內容（三件事的釐清、
> 量測證據、Solarmix 的 SHA-1 發現、Omnitone 的 2019 停更）仍然有效。

- **Pan 的要求**：「我覺得可以用看看 Omnitone 的 spatial audio，但我之前不是有 MeshRIR 嗎，我的 duck-hunt 也是用這個」→「我其實就是覺得，跟 duck-hunt 或 Solarmix 既有的就好了」→**「先讓我試用看看再決定好嗎」**。所以這次的交付物是**一個獨立的試聽台**，`web/index.html` **刻意一行都沒改**（有測試釘住：`test_foa_encode.js` [10] 斷言主頁不含 `omnitone`）。

- **先釐清一個一直被「空間感」這個詞混在一起的三件事**（這是整個討論的關鍵）：
  | | 是什麼 | Tidal 現況 |
  |---|---|---|
  | `assets/ir/room.wav`（MeshRIR） | **房間**的殘響與染色 | 已在用，跟方向無關 |
  | duck-hunt `assets/hrir/` | **方向**（ITD/ILD） | 沒在用 |
  | Omnitone | 設計過的**環繞聲解碼**濾波器 | 這次評估的對象 |
  「我之前不是有 MeshRIR 嗎」→ 有，但那是房間，不是方向。兩者可以同時存在（bench 裡三條路都共用同一顆 room convolver）。

- **「用既有的就好」為什麼在 Tidal 行不通——實測，不是讀碼猜的**：
  - duck-hunt 的 HRIR 是 **256 taps = 5.33ms**。用 interaural phase 反推 ITD：同樣 45°，**320Hz 讀到 +391µs（偏左）、520Hz 讀到 −615µs（偏右）**——相鄰頻帶指向相反的耳朵；315° 同樣翻號；130Hz 讀到 +3595µs（真人 ITD 上限約 ±700µs ＝ 這是 phase-wrap 假影）。
  - 對 duck-hunt 完全沒差（鴨叫是寬頻，能量在 1.5kHz 以上，那裡的 ILD 是實測正確的）；對 Tidal 是結構性的問題，因為 **Tidal 每一層都被濾在 1.5kHz 以下**。
  - 逐層帶內能量（在每層**真實濾波器頻帶**內取 9 點對數 DFT、前方弧中位數、以 foam 為 0dB）：duck-hunt HRIR → bubble(BP320) **−13.4dB**、shore(LP640) −12.8、pebble(LP700) −11.5、surge(LP800) −9.9、shimmer(LP1450) −5.8、foam(HP1500) 0.0。Omnitone FOA 在**同樣頻帶**：−0.3 / −0.2 / −0.3 / −0.4 / −2.0 / 0.0 dB。
  - 同樣 256 taps 為什麼差這麼多：Omnitone 那批是**設計過、做過 diffuse-field 等化**的解碼濾波器，而且 FOA 的低頻方向是編在**振幅比**上、不是靠時間差。
  - **Solarmix 沒有可搬的東西**：Unity + Steam Audio。`Assets/test_hrtf.sofa` 與 `Assets/Plugins/SteamAudio/Resources/dtf_nh2.sofa` **SHA-1 完全相同**（`ea957d15525028a80c073eab970c36583c8dac4c`）＝那是 Steam Audio 內建的 ARI `nh2` DTF，**不是 Pan 自己量的**；SOFA 是 HDF5，Web Audio 讀不了，這台也沒 h5py。
  - 所以「用既有的」被我改成：**沿用 duck-hunt 的工程做法**（per-IR 增益補償、載入永不阻塞出聲、Node 對真檔測試、對齊音量的 A/B），方向渲染另尋。

- **§「不要引入重依賴」的理由（規範要求寫在交接筆記）**：`AGENTS.md:43` 說 spatial 若需函式庫「先評估 Omnitone / JSAmbisonics」——這就是那個評估。**Omnitone 46589 bytes、HRIR 以 base64 內嵌（15 個 RIFF：FOA 2 + SOA 5 + TOA 8）、沒有任何 rawgit/CDN 抓取、沒有已廢棄的 ScriptProcessor、只用 Gain/Splitter/Merger/Convolver**，離線可用、無 build step、Apache-2.0（NOTICE 已附 `web/vendor/omnitone-NOTICE.txt`）。⚠️ **誠實說明：最後一個實質 commit 是 2019-01-16、最後 release 1.3.0（2019-01-18）**，沒 archive、912 star，但實際上等於自己維護。Resonance Audio Web SDK **已 archived**；JSAmbisonics 2022-05 停更。所以**如果 Pan 聽了覺得 B 路值得**，下一步建議不是就這樣留著 46KB，而是**內聯約 30 行 FOA 解碼 + 一個 2KB 的 `sh_hrir_order_1.wav`**（見下面待決策）。

- **怎麼試（Pan 這一步）**：
  ```
  cd Tidal && python3 -m http.server 8000
  ```
  桌機 Chrome/Edge 開 `http://localhost:8000/web/spatial_bench.html`（**不能 `file://`**），**戴耳機**。頁面自己會印建議順序：
  **① 先按「自動對齊三條路的音量」② solo bubble（差異最該聽得出來的那層）③ 自動繞圈 ④ 再切 A/B/C。**
  - 三條路：**A** = 瀏覽器內建 HRTF panner（＝主頁現況）、**B** = 一階球諧編碼 → Omnitone FOA 解碼、**C** = duck-hunt 那批實測 HRIR（直接 cross-origin 抓 raw.githubusercontent.com，**沒有把任何檔案複製進 Tidal**，順便完全避開 Solarmix `docs/DATASETS.md` 的 Redistribution Rule）。
  - 三條路**共用同一組聲源、同一顆房間 convolver**，analyser 放在 mute **之前**（所以沒在聽的那兩條也量得到）——這樣才能一次把音量對齊。**沒對齊的 A/B 只會選出比較大聲的那個，這是 duck-hunt 文件裡最貴的教訓。**
  - 有**盲測 + 揭曉**：先別看是哪一條再判斷。
  - sub(LP130) / wide(LP520) 照主頁一樣繞過空間化直接進 clip。

- **怎麼驗證（不用真球）**：
  - `node tmp/test_foa_encode.js` → **53 項斷言全過**。測的是唯一我自己寫、而且**寫錯不會報錯只會左右相反**的東西：`foaEncodeGains()`。bench UI 與主頁 panner 都用「正方位角＝右」，而 ambiX 的 **Y 是左為正**，所以 `Y = -sin(a)*cos(e)`。斷言除了直接檢查符號，還用**從 Omnitone `foa-convolver.js` 讀出來的真實接線**（`L = W + Y`、`R = W − Y`）解回左右耳交叉驗證。另外把「FOA 一階前後混淆」當**現況記錄**釘住，免得下一位把它當缺陷去「修」。
  - `node tmp/smoke_spatial_bench.js` → **51 項斷言全過**（需 `cd /tmp && npm install jsdom --no-save`，**不要裝進 Drive 同步資料夾**）。jsdom + 假 Web Audio 真的跑一遍建圖：5 個 HRTF panner、**11 個 convolver（房間 1 + C 路 5 層 ×2）**、其中 10 個 `normalize === false`、Omnitone 真的被 `initialize()`、三條路都到得了 destination、房間 convolver `__in === 3`。`fetch` 一律 404 ＝ 測離線路徑（「聲音永遠成立」的最低標）。
  - **突變測試 16/16 全殺**。過程中 **M11 存活**：把 `merge.channelCountMode` 從 `"explicit"` 改成 `"max"`（＝拿掉卷積前的 mono 化，會讓 pebble 的立體聲影像汙染 HRIR 的左右耳資訊，duck-hunt `SPATIAL_AUDIO.md` 第 1 點）兩支測試都照樣過。**根因是我自己的斷言太鬆**——只找 `channelCountMode = "explicit"`，而 B 路的四通道匯流排也是 explicit，所以 regex 照樣命中。改成要求 `channelCount = 1;` 與 `explicit` 同時出現在 120 字內，M11 才被殺掉（另一個變體「刪掉 `merge.channelCount = 1;`」也一併殺掉）。

- **未完成**：docs 還沒提到這個 bench（`RESEARCH.md` §空間音訊 的選型表、`DESIGN.md:112`、`web/README.md`）——等 Pan 聽完有結論再寫，免得寫了又改。

- ⚠️ **待 Pan 決策（聽完再說，我沒有替你決定）**：
  1. **A / B / C 哪一條？** 或者「差異小到不值得動主頁」也是完全合理的答案——那就把 bench 留著當記錄，主頁維持現況。
  2. 若選 B：**FOA 還是 TOA**（TOA 前後定位好得多，但 HRIR 大 4 倍、8 個 convolver）。
  3. 若選 B：**要不要留這顆 46KB vendor**，還是內聯約 30 行 FOA 解碼 + 一個 2KB `sh_hrir_order_1.wav`（考慮到上面「2019 年就停更」）。我傾向後者，但先聽了再說。
  4. **要不要真的在 `web/index.html` 開一條並行的 FOA 匯流排**——§2 說互動核心「沿用、不要重寫」，這件事要 Pan 明確點頭我才動主頁。

- **引用義務（都已寫在 bench 頁面上）**：MeshRIR **CC BY 4.0**，需標註 Shoichi Koyama et al. 與資料集出處；Omnitone **Apache-2.0**，其 HRIR 來自 Google / **SADIE, University of York**。

### 2026-08-04 — Claude (Opus)｜移除 30.7 秒的握力校正：量一次零點＋固定滿刻度＋方向不猜（中英文版同步）
- **Pan 的要求**：把 duck-hunt 的「不校正、直接開始」做法搬到 Tidal——「他的校正也很糟糕」。接著指定「同步」（＝英文版 `web/en/index.html` 一起改）並要直接上線測試。
- **舊校正錯在哪（有真實紀錄可證，不是靠讀碼猜）**：
  - `record/tidal_record_2026-07-29T06-31-52.json`：ball1 `calibSpan 171`、ball2 `calibSpan 185`，`lockedSpan 143 / 141`。加上 05-52-23 那份的 ball2 `lockedSpan 140`——**四個球次裡三個正好坐在舊地板 `GRIP_MIN_SPAN_LOCKED = 140` 上**。也就是 30.7 秒之後校正沒有提供任何資訊，是那個常數在做事。
  - 算術對得上：`span = 峰值中位數 × GRIP_PEAK_TO_SPAN(0.68)` → 252×0.68=171、273×0.68=185，代表校正期間只量到 250–273 raw，而 `GRIPBALL_PROTOCOL.md` 實測「用力握」是 **+1250 raw**。差了 5 倍。
  - **根因是一句 UI 文案**：cue 的提示字「輕輕握就好」（2026-07-22 為了讓人不要用力而改）——使用者最輕的一握被當成了滿刻度。
  - 這正好解釋 Pan 的兩個回饋：span 掉到地板 → `effScale = 140×1.22 = 171 raw` → 殘壓 62raw 讀成 **0.36**（高於答題門檻 `AFTER_ON` 0.24 ＝**殘壓會被記錄成答案**）、輕握讀成 1.00 ＝「有時超級敏感」；30.7 秒沒換到東西 ＝「校正效果不大」。
  - `sign` 也不穩：**同一顆 ball2** 在兩份紀錄裡一次學成 +1、一次 −1（`pressMinusRest` +98 / −114）＝「水位有時倒過來」。
- **改成什麼**：只量一次零點（`GRIP_BASELINE_MS = 700` ms 內 raw 的**中位數**，中位數不是平均——取樣中手抖一下的尖峰拉不走它；定案前水位一律 0）＋滿刻度寫死 `GRIP_FULL_SCALE = 900`＋**方向不猜**（`Math.abs(rawDev)`，升型/降型球在定義上不可能倒反）＋`handMap` 固定 `{left:1, right:2}`（兩顆球長得一樣、WebHID 拿不到序號，本來就分辨不出來；唯一差別是左右聲道可能互換）。cue 校正的常數、函式、state、DOM 全部移除。連線文案「準備進入校正」→「馬上開始」。
- **中英文版都改了**：`web/en/index.html` 原本是**更舊的分岔複本**（自己一份較簡單的 `GripCalibrator`，有 `lock()`/`upMax`/`downMax`，`GRIP_HEADROOM 1.35`、`GRIP_DEADZONE 0.10`，沒有 edge detector / restRef / phantom 修復）。這次把中文版的 calibrator 與常數整段移植過去，兩份的握力邏輯**現在一致**。
- **怎麼驗證**：`node tmp/sim_grip_nocalib.js`（中文版）／`node tmp/sim_grip_nocalib.js en`（英文版），**各 83 項斷言全過**。沿用 `tmp/sim_agreement.js` 的模式：regex 從 index.html 抽**真正的**常數與 `GripCalibrator` 來跑，不重寫邏輯。
- **突變測試 23/24**（這個專案的既有慣例——過去有幾條斷言就是靠突變才發現太鬆）：把 24 個「應該要壞」的改動一個個塞回程式，看測試抓不抓得到。存活的 1 個是良性微調（放手回歸率 0.3→0.15，兩者都收斂）。**過程中發現 4 條斷言太鬆並補強**：長握下沉的容忍度 0.85 太寬（把凍結率放大 10 倍也照樣過，已改 0.95 並在註解寫出算式）、`EDGE_ON_FRAC` 被 `EDGE_ON_MIN_RAW` 地板遮住等於沒測、`smRaw` 平滑拿掉抓不到、快起慢落只看終值所以 attack/release 對調抓不到。
- **測試抓到我自己寫壞的兩個 bug**（同一類錯誤，值得記著）：**任何寫在 `shaped`（正規化）單位上的門檻，raw 意義都會隨滿刻度變**。滿刻度從 ~140 變成 900 之後：① `shaped<0.14` 的緩吸收帶從只蓋 34 raw 變成蓋 220 raw，把真的輕握（188 raw）當漂移吸掉；② 放手分支的 `slack = span*0.1` 從 14 raw 變成 90 raw，造成**死鎖**——輕握起手時 `shaped` 還是 0（死區 143 raw）就走進「放手」分支，baseline 被以 0.3 的速率追到 restRef+90，dev 永遠停在 97 raw ＝水位恆為 0，握壓得超過 233 raw 才逃得出來。兩處都已修掉並在碼裡註明來歷。
- **給 Pan 的實測對照表**（FULL = +1250 的球）：輕拿殘壓 62raw→**0.00**、輕握 188raw→0.02、舒適握 438raw→**0.40**、明確握 750raw→0.70、全力→**1.00**。按 **D** 開診斷面板會顯示 `full900` 與 `d<偏離量>`。
- ⚠️ **待 Pan 真球確認 / 需要決策的三件事**：
  1. **`GRIP_FULL_SCALE = 900` 是為協定實測 +1250 的球挑的**。若某顆球全力握只有 +300 raw（2026-07-17 Pan 曾遇到「一手很用力連一半都不到」），全力握只到 0.23。**這是唯一要調的數字**，其餘都不用動；測試 [7] 會把各種球的表現印出來並直接給該調成多少。真球跑一輪、看診斷面板的 `d` 值最大到多少就知道。
  2. **phantom 自我修復會吃掉持續的長握**：60 秒穩定握 0.5 之後水位只剩 ~0.09（修復在 24.3 秒啟動）。而且「平坦度」判別**分不出**呼吸微起伏與死平訊號（兩者都在 24.3 秒啟動）。4-7-8 情境碰不到（每次握拍會把 `holdRun` 歸零），但 Tidal 的水位是連續的，使用者若「一直握著維持高水位」就會遇到。這是既有邏輯（§2 說沿用不要重寫），**不在這次「換掉校正」的範圍**，所以我只用測試釘住現況、沒有動它。要不要修請 Pan 決定。
  3. **單筆壞掉的 report 仍會被 edge detector 算成拍**（模擬：3 秒內 4 個孤立滿格尖峰＝數到 4 拍）。這重現了 Pan 2026-07-22 的真球紀錄「58 拍裡混進 9 拍不是使用者握的」。水位那條路徑沒問題（尖峰只到 0.087，遠低於門檻），問題在 `updateEdge` 沒有最小持續時間要求。同樣是既有設計、同樣不在這次範圍。
- **未完成**：**只有模擬，還沒在真球上跑過**。上面三件事都要真球才能定案。

### 2026-07-29 (b) — Claude (Opus)｜修「多貼近那題被自動填答並跳走」＋不再把沒回答記成 0
- **Pan 的症狀**（478 之前那題「這段描述有多貼近你」）：① 鬆開握力球很難被正確感知；② 還沒來得及用握力回答，就被指定一個數值往下一步了。
- **根因是同一個機制**：回應窗 `AGREEMENT_RESPONSE_MS = 5200` 從 `finishArrival()` 就開始計時——那時 720ms 換幕動畫還在跑，而且還沒 armed；超時後舊碼直接 `arrival.agreePeak = 0; fixAgreementChoice(now)`，**把 0 當成使用者的答案寫進紀錄**。arming 又只認「握力掉到 `AFTER_OFF` 以下」，遇到殘壓或弱訊號球（span 被鎖在下限）就永遠 arm 不了，於是必定走超時分支。
- **實證**：Pan 的第一份 session 紀錄 `record/tidal_record_2026-07-29T05-52-23.json` 裡 `"agreement": 0`，而 ball2 `lockedSpan: 140` 正好等於 `GRIP_MIN_SPAN_LOCKED`（＝訊號弱到只能吃下限）。那個 0 是超時編出來的，不是 Pan 答的。
- **改了什麼**（`web/index.html`）：`AGREEMENT_RESPONSE_MS` 5200→**12000**，且改成**從 armed 之後才起算**（`agreeArmedAt`）；`finishArrival()` 把 `agreeStartedAt` 設 0，改由 agree 分支在第一次進來時蓋章，時間不再被換幕動畫吃掉。新增 `armAgreement()`：等不到完全鬆開時，`AGREEMENT_ARM_GRACE_MS = 4000` 後照樣 arm，並把當下握力記成 `agreeFloor`（殘壓地板），`agreementHeld()` 之後只算地板以上的部分，並在 log 明說「偵測不到完全鬆開（可能是殘壓）」。超時改成 `finalizeAgreement(now, true)` → `arrival.agreement = null`，UI 不亮數值、不顯示標籤，log 寫「這一題沒有回答（不記成 0）」。
- **怎麼驗證**：`EEG/tmp/sim_agreement.js`（用 regex 把真的常數／`updateArrival`／`handleArrivalConfirmation` 從 index.html 抽出來跑，不是重寫一份）8 情境 **19 項斷言全過**：正常作答、思考 8 秒（Pan 的症狀）、完全沒握→`null` 不是 0、殘壓 0.18 卡在 `AFTER_OFF` 以上仍能 arm 並帶地板、殘壓且沒答→null、前一幕殘留 0.9 不被當答案、輕握仍是有效的低分答案、閾值合理性。
- **未完成 / 誠實說明**：**沒有做「舊碼重現 bug」的對照組**——`git show HEAD:web/index.html` 在 Google Drive 這條路徑上寫出 0 byte、重試直接超時 2 分鐘。所以根因是靠讀碼＋Pan 的紀錄佐證，不是靠跑舊版重現。另外只做過模擬，**還沒在真球上實測**。
- **給下一位／待 Pan 決策**：(1) `null` 這個新的「沒回答」狀態要不要進 CSV／後續統計，Pan 要決定怎麼處理缺值；(2) 12 秒是不是太長（會不會讓人覺得卡住），要真球體驗才知道；(3) 殘壓地板的做法是把使用者當下的握力當成新的零點，若 Pan 覺得語意不對可以改成「請先完全放開」的明確提示再等。

### 2026-07-29 — Claude (Opus)｜策略備忘 → 對主管的方向報告投影片（未改任何程式）
- **做了什麼**：把 `EEG/策略備忘_20260729_聲音閉環與紓壓球價值主張的整合.md` 做成 8 頁中英雙語投影片 `EEG/outputs/策略備忘_20260729_聲音閉環整合_中英雙語.pptx`。Pan 指定的定位是「方向報告：保留落差但收斂語氣」——三個落差保留但改寫成「接下來要驗證的三件事」，移除對 7/28 報告的評價性描述，D1–D6 收斂成 4 題（見下）。沿用 `outputs/` 既有 deck 的視覺系統（orange F97316 / navy 0B2F55 / PingFang TC）。
- **怎麼驗證**：這台機器沒有 LibreOffice 也沒有 PowerPoint，所以另寫 `EEG/tmp/preview_pptx.py`（讀 pptx 真實 shape 座標 + 真 CJK 字型度量，用 PIL 渲染成 PNG，並偵測文字溢出/超出頁面）。八頁全部目視看過。**注意：自動偵測器說「no layout problems」時仍有兩個真實版面錯誤**（第 8 頁結語壓到頁footer、第 3 頁 bullet 間距不均），是靠看圖才發現的——以後產 deck 不要只信偵測器。
- **未完成**：deck 內容是照 7/29 備忘的狀態寫的，D1–D4 的答案還沒回填；備忘裡的 D6（Merry 對「軟體才是經常性營收」的立場）刻意沒放進這份對主管的版本，需要 Pan 自己判斷什麼場合問。
- **給下一位**：`EEG/tmp/build_strategy_deck.py` 是產生器（改內容改這支再跑，不要手改 pptx）。`preview_pptx.py` 可重用於之後任何 deck 的版面檢查。

### 2026-07-22 (g) — Claude｜答題門檻調高＋session 紀錄自動存檔（W 鍵/下載雙出口）
- **答題太敏感（Pan）**：`AFTER_ON` 0.14→0.24、`AFTER_HOLD_MS` 900→1100——要更明確的握才開始作答；影響所有問答（回顧 agree、結尾問卷）。
- **Session 紀錄**：整段做完（結尾問卷答完）自動產生 JSON：`saved_at`/`session_started_at`/preset/arrival（impression·agreement·建議·pre_tension）/478（輪數·拍距）/after_answers（post·pushed·stay·agency 0-10）/校正摘要（handMap＋兩球 snapshot）。出口兩種：**W 鍵**選一次資料夾（建議 `EEG/Tidal/record/`，已建）→ 之後自動寫入；沒設定/別台電腦 → 自動下載 `tidal_record_<時間>.json`。權限在首次手勢預熱（resumeRecordDir）。**不做 GitHub 直傳**：公開頁面藏寫入權杖＝任何人可改 repo。
- **驗證**：46 項模擬、jsdom init 0、478 五情境全過。record/ 資料夾與 README 已建立。

### 2026-07-22 (f) — Claude｜修「水位不太會歸零」（答題不便）；onebang 保留（Pan 好評）
- **根因**：(c)(d) 兩輪降力道把 span 縮小，`GRIP_DEADZONE` 的 **raw 範圍**跟著縮——放開後手虛搭在球上的殘壓（~50-100 raw）以前被死區吃掉，現在顯示成一截水位＝不歸零，答題（要 ≤AFTER_OFF 才武裝）不方便。
- **修法**：①`GRIP_DEADZONE` 0.10→0.13；②baseline 吸收鏈加「低水位緩吸收」帶：`shaped<0.14` 以 0.015 吸（33Hz τ≈2s）——殘壓幾秒內自動歸零；`shaped<0.06` 仍 0.05 快吸、`≥0.14` 仍凍結（刻意的握都在 0.3+ 完全不受影響）。
- **驗證**：46 項模擬全過，新增回歸 K：殘壓 +80 → 4s 內歸零、之後真握 0.845、刻意輕握（0.37）10s 不被吸；jsdom、478 五情境全過。
- **旋鈕地圖（目前的手感三角）**：省力＝PEAK_TO_SPAN/HEADROOM ↓；歸零快＝DEADZONE/低水位吸收 ↑；兩者拉扯時中間值是 span 的 raw 大小——看 log 的 lockedSpan 與殘壓分布再動。

### 2026-07-22 (e) — Claude｜478 onebang（Pan 指定，如 Max/MSP）
- **Pan 回報**：478 開始處按一下出現 4，再按一下「4、3 緊貼著跳」＝一次握被算成兩拍。
- **根因**：用力握的攻擊段常有 過衝→微回落→坐穩 的彈跳；回落 0.25 就重新武裝（(c) 的規則），坐穩段的第二個 edge 又算一拍，380ms refractory 擋不住 ~0.4-0.6s 的彈跳間隔。
- **修法（onebang）**：①`MANUAL_478_REFRACTORY_MS` 380→650（數到一拍就關閘 650ms；正常數拍 ~1 拍/秒不受影響）；②重新武裝的回落量改 `max(0.25, 峰值×0.35)`——攻擊彈跳（1.0→0.72）過不了、緊繃數拍（0.8→0.45）仍成立。
- **驗證**：jsdom 五情境（tap 5/5、緊繃 7/7、慢放開 1、phantom ≤1、**攻擊彈跳 1**）＋43 項模擬全過。
- **478 數拍完整規則（六輪演化後的現狀）**：edge pulse（相對 rest floor 的真上升、門檻含雜訊自適應）為主、level 上升穿越 ON 為輔；兩路共用 per-ball「相對放開」arm-gate（掉到峰值一半以下或回落 ≥max(0.25, 峰值×0.35)）＋650ms onebang refractory；478 進行中不做 span 適應。改動前必跑 /tmp/test478all.js 五情境。

### 2026-07-22 (d) — Claude｜修「長握水位有時降太快」＝phantom 修復吃到活握＋再降力道
- **Pan 回饋**：整體體驗好；剩「還是滿用力」＋「持續用力時水位有時降太快」。
- **降太快的根因**：(2026-07-21) 的 phantom 自我修復在 ~25s 長握後啟動，把「活的握壓」也當漂移吸掉（先前 (j) 就掛過此取捨警告）。
- **修法**：修復啟動加「**平坦度**」判別——rawDev 的 ~2s 窗標準差：沒人碰的球死平（σ≈2-3）、人握著一定有起伏（呼吸/張力，σ≈20+）。只有「高水位 + 無握拍 + 死平」三條件齊才啟動；啟動採**遲滯**（`this.healing`，修到底才停——修復自身移動 baseline 會推高變異，不能拿變異當關門條件），任何真握拍（edge pulse）立即中止修復。活握 40s 模擬水位 min 0.657（原本被吸到 0）。
- **力道再降**：`GRIP_HEADROOM` 1.35→1.22（舒適握更貼近滿水位）。
- **驗證**：43 項模擬全過（新增回歸 J：活的長握 40s 不被吸、死平 phantom 照樣 30s 自癒）；jsdom、478 四情境全過。
- **註**：Pan 這輪的 log 又是 NUL 損毀（測試時 (c) 的 offset 修正還沒部署/沒重新整理）——下一輪起 log 應完整。

### 2026-07-22 (c) — Claude｜換新球後「要很用力」＝校正力道校得太硬＋log 寫檔 NUL race
- **Log 判讀**：新球品質很好（雜訊 σ≈2、幅度 1237、SNR 788），但 lockedSpan 被鎖到 **928**——Pan 校正時用力捏，滿刻度＝那個力道 → 之後 478 一拍要 +241 raw、水位要滿更費力。「要很用力」不是球也不是偵測，是校正學到的尺度太硬。
- **修正**：①校正提示「請握起」→**「輕輕握就好」**（人看到「請握起」就用力捏）；②`GRIP_PEAK_TO_SPAN` 0.75→0.68（session 舒適握 < 校正峰值，係數再讓一點，舒適握 ≈0.85 水位）；③`GRIP_SPAN_ADAPT_LO` 0.4→0.3（實際使用的輕握能把校得太硬的尺度拉回來）。
- **log 寫檔 bug**：檔案開頭一大段 NUL——Drive 資料夾上 `getFile().size` 會回舊值，append offset 錯位。改為自己追蹤 `__logFilePos`，不再信 getFile().size；analyzer 改為容忍壞行/NUL（跳過）。
- **驗證**：41 項模擬（含 0.68 係數後全部重驗）、jsdom、478 四情境全過。
- 給下一位：判讀「要很用力」問題的順序＝先看 lockedSpan vs 使用中實際 delta 分布，再想門檻。校正提示語與 PEAK_TO_SPAN 是同一組平衡：提示越溫和、校正峰值越低、係數就不用讓太多。

### 2026-07-22 (b) — Claude｜壞球確認＋trustedHeld（問答不被卡高位球綁架）＋刪過場＋雜訊自適應門檻
- **Log 判讀（Pan 這輪，校正 left=Ball1 right=Ball2）**：壞球＝**右手**那顆（幅度 227 vs 727、session 中 level 第 10 百分位 0.256 恆高、58 拍 478 裡有 9 拍來自它＝Pan 懷疑的「亂跳跟球不穩相關」成立）。Pan 已去更換。
- **三個修正**：
  1. **trustedHeld()**：某顆球 25s 內沒回到 AFTER_OFF 以下＝訊號卡高位，不能代表使用者作答、也不能卡住「放開」判定。套用在：結尾問卷（卡在「現在身體還緊繃嗎」的直接原因）、回顧 agree 的武裝/定案/自動前進。恢復低位即恢復信任。
  2. **刪「再握一下開始」過場**（Pan 決定）：本來就常被卡高位球自動觸發跳過＝形同虛設。現在顯示建議 ~2.5s 後自動進練習，由 4-7-8 自己的「握一下開始」接手。
  3. **edge 門檻雜訊自適應**：`noiseEma`（deadzone 內的 |rawDev| EMA）×5 併入 onThresh——雜訊大的球要更明確的握才算一拍（襯 478 亂跳）。
- **驗證**：sim 41 項、jsdom init 0、478 四情境全過。log 檔另發現：按 S 重選檔會 truncate＋只回寫 ring buffer 現存範圍（校正段被沖掉）——測試中不要重複按 S，一輪一次即可（或之後把 truncate 改成只在頁面重載時）。
- **待觀察**：換新球後重新校正的品質數字（analyzer「球體品質」段落）；478 亂跳應隨壞球移除大幅消失。

### 2026-07-22 — Claude｜校正期間水位改用 |dev|（方向未定就不假裝知道方向）＋自動 log 首戰立功
- **Pan 回報（自動 log 已進 EEG ✓）**：右手校正時握↔水位倒過來（用力降、放鬆升）。
- **Log 判讀**：右手球（Ball1）訊號特殊——握的瞬間 +150、**持續握 −250**（三次握都這模式）。lock 依「自己手峰值中位 −153」定 sign=−1，以持續握力而言是**對的**；Pan 看到的倒反發生在**校正過程中**：方向未鎖定時暫定 sign=+1 → 持續用力水位反而降。另外 analyzer 的「反向」警報把校正期樣本混進統計＝誤報。
- **修法**：①`GripCalibrator.update` 未鎖定時 `dev = |rawDev|`——校正期間任何方向的握壓都讓水位升（校正 UI 只需要「有反應」的回饋；方向 lock 才定案）。②analyzer 極性判讀只取 `handCue:locked` 之後的樣本。
- **驗證**：41 項 calibrator 模擬、jsdom init 0 錯誤、478 四情境（tap/緊繃/慢放開/phantom）全過；重跑 Pan 的 log：Ball1 判讀=下降型與 sign=−1 一致，警報消失。
- **註**：Ball1 span 只有 175（貼地板），rest 遊走 ±60、握壓幅度又小——這顆球訊號品質先天差，手感會比另一顆抖。若 Pan 反映右手還是難用，優先懷疑球體本身（或握的位置），不是程式。

### 2026-07-21 (d) — Claude｜修「478 壓一下連跳三拍（4→3→2）」
- **Pan 回報**：按「開始」後壓一下，自己倒數了三次。
- **根因（(c) 相對放開的副作用）**：放開的**下坡**每回落 0.25 就重新武裝一次，而 level 後援路徑只看「level ≥ ON」這個**狀態**不看方向——武裝完殘餘水位仍高於 ON(0.20) → 立刻又數一拍 → 一次握放沿下坡連數三拍。
- **修法**：level 路徑加「由下往上穿越」條件（`level ≥ ON && previous < ON`）——下坡永遠不會數拍。真球主路徑（edge）本來就只在真上升觸發，不受影響；緊繃數拍（(c) 的修）仍然成立。
- **驗證**：jsdom 新情境「一次握放、慢慢放開經過多次 0.25 回落」→ 只數 1 拍；(c) 的屏息緊繃 7/7、phantom ≤1、tap 5/5 全保持；calibrator 38 項、jsdom init 全過。
- **給下一位（重要教訓）**：478 數拍已經歷五輪修正（全域門檻→per-ball edge→arm-gate→相對放開→上升穿越）。現在的完整規則：**edge pulse（相對 rest floor 的真上升）為主、level 上升穿越 ON 為輔，兩路共用「相對放開」arm-gate＋380ms refractory**。動任何一條前先跑 /tmp/test478*.js 三套情境（tap／緊繃殘壓／phantom 平台／慢放開）。

### 2026-07-21 (c) — Claude｜修「4-7-8 屏住呼吸段卡死（怎麼握都不動）」
- **Pan 回報**：卡在屏住呼吸（7 拍）那段，怎麼握都數不下去。
- **根因（(l) 的相對放開留的洞）**：`beat478Peak[slot]` 記的是 trigger 當下的 level——但 edge 觸發在水位爬升**之前**（edge 看 posDelta、level 有 attack 延遲），記到的「峰值」只有 ~0.1-0.3 → re-arm 門檻退化回絕對 OFF(0.09)。屏息時整手緊繃，拍間水位掉不到 0.09 → 第一拍後全部被 arm-gate 擋掉。
- **修法**：峰值改成「這拍之後實際看到的最高 level」持續更新（在 setGrip 內、未武裝時 max 累積）；re-arm 條件＝掉到峰值一半以下 **或 從峰值回落 ≥0.25**（緊繃著數拍：0.8→0.45 回落 0.35 ✓）。phantom 平台＝恆定高水位無明顯回落，兩條件都進不來，仍不會自己倒數。
- **驗證**：jsdom 新情境：屏息緊繃 7 拍（拍間只鬆到 0.45、edge 在 level 0.25 就觸發）全數到；phantom 平台（0.93-0.97 微波動）40 次觸發只數 1 拍；完全放開 tap 5/5；先前全部測試（478×2、calibrator 38 項）與 jsdom init 全過。
- 註：Pan 的自動 log 檔（S 鍵）尚未出現在 EEG 資料夾——下次請 Pan 按 S 時把檔案存到 EEG 資料夾，之後即可直接讀 `tidal_grip_log_live.ndjson` 分析。

### 2026-07-21 (b) — Claude｜校正資料選手改用流程指派（Pan 澄清自然使用場景）
- **Pan 澄清**：左手校正時，右手可能也握著另一顆球（甚至跟著出力），也可能放桌上——不一定。先前 `bestHandPeak()` 用「反應大的那隻 cue」猜這顆球的手，共同出力時可能猜錯桶。
- **修法**：`lock(preferHand)`——`finishHandCue` 在確定 `handMap` 後，把每顆球被指派的手傳進去；lock 首選該手 cue 的峰值/rest 資料（物理上握這顆球的手從頭到尾沒變，「自己 cue」的資料＝被指示的握，最可靠）。preferHand 資料不足（|峰值|<45）才退回 bestHandPeak 猜。另一手 cue 期間這顆球被握著/跟著出力/放桌上都不再影響校正。
- **驗證**：模擬 38 項全過，新增回歸 I：另一手 cue 三輪分別「跟著大力握 1.2×／放桌上／微出力 0.2」混合——span 仍來自自己的手（582）、restRef 不被污染（34701）、拿著不握 level 0、握 0.795。jsdom、478 測試全過。
- 已知殘餘風險（未修）：`handMap` 本身由 cue.scores 決定，極端的共同出力理論上可讓左右指派錯（機率低，指派錯時球仍可用、只是左右音像相反）。若真的發生，改用「各球在兩個 cue 的峰值比」決定指派會更穩。

### 2026-07-21 — Claude｜水位不穩總體檢（per-hand rest／phantom 自我修復／斷流不歸零）＋log 自動寫檔
- **Pan 回饋**：水位跳動仍不穩、一顆疑似反向、穩定握著跳來跳去、不握水位有時還是高；並要求 log 全自動寫檔（不要手動按 L）。
- **修了四個根因**：
  1. **rest 樣本 per-hand 化**：`restSamples{left,right}`。另一手 cue 時球常被放下（open 值低 ~1800 raw），混合中位數把 rest 錨點拉低＝「拿著就像握著」（不握水位高、也可能судь反向）的總根源。`lock()` 用「自己那隻手」的 rest；峰值判手已 per-hand，現在整條鏈一致。
  2. **錨點漂移修正**：own-hand rest 可能是十幾秒前的（該手先校完），漂移下鎖完即假握壓。lock 用「最近 60 筆 rest」修正：往握壓方向全額跟（漂移）、往放開方向最多 45 raw（防跟到 open）。〔發現舊版通過漂移測試純屬僥倖：flat 桶 240 上限恰好只留最近樣本〕
  3. **phantom 自我修復**：鎖定後「高水位且無任何握拍」連續 ~800 筆 report（33Hz≈25s）→ baseline 以 0.008、restRef 以 0.004 緩慢收斂到目前姿勢。錨點就算錯也會自癒；刻意長握有起伏/握拍不會誤觸（pulse 會 reset）。
  4. **HID 斷流不再硬歸零**：`watchHidLiveness` stale(2.5s) 時水位「保持」，只停 ready 標記＋重送 mode；FORGET(6.5s) 才清——藍牙塞車時硬歸零又恢復＝「穩定握著水位跳來跳去」的主要來源之一。
- **log 自動寫檔（Pan 要求）**：按 **S** 選一次檔案（File System Access API，建議選雲端資料夾內的 `tidal_grip_log_live.ndjson`）→ 之後每 ~3s 自動「附加」新紀錄（NDJSON）；重新整理後第一次點按自動恢復（handle 存 IndexedDB）。每筆 entry 加 `seq`。`tools/analyze_grip_log.py` 已同時支援 .json 與 .ndjson。L 手動下載仍在。
- **驗證**：模擬 34 項全過（新增：G 另一手 cue 時球放下→錨點不被拉低；G2 反向順序同樣安全；H 人為錯錨 +800 → 30s 內自癒且真握仍有反應；漂移測試在錨點修正後恢復通過）；478 jsdom 測試（phantom/tap/殘壓）全過；node --check、jsdom init 0 錯誤。
- 給下一位：若 Pan 還是回報不穩，現在請他按一次 S 之後 log 就會持續寫進 Drive，直接讀 `tidal_grip_log_live.ndjson` 分析，不用等手動下載。

### 2026-07-20 (l) — Claude｜修「4-7-8 數幾拍後卡在中間（按壓有聲但不繼續）」
- **Pan 回饋**：倒數突然卡在中間，按壓仍有互動聲，但倒數不繼續。
- **根因（(j) arm-gate 的兩個副作用）**：① re-arm 條件是「level ≤ 絕對 OFF(0.09)」——敏感球/殘壓球放開後殘餘水位停在 0.09 以上就永遠不 re-arm→數幾拍後卡死；② (h) 的換手 span 適應**會被 478 每一拍餵進去**（拍間隔 >refractory），刻意節拍被當成力量校準→越點 span 越小→越敏感→殘餘水位升→加速卡死。
- **修法**：① re-arm 改**相對放開**：`level ≤ max(OFF, 這拍握力峰值×0.5)`（每次數拍記 `beat478Peak[slot]`）。敏感球/殘壓球也 re-arm 得了；卡在高位的 phantom 球（峰值≈1、門檻≈0.5）仍掉不下去→不 runaway。② `updateEdge` 在 `state.guided.preset==='hold478'` 時**不呼叫 adaptSpanFromPulse**（478 節拍不改 span；自由 session 的換手適應不受影響）。
- **驗證**：jsdom 實地驅動：殘壓球（放開停在 0.15）6 拍全數到（原本卡在 1）、phantom 球（0.95）仍最多 1 拍；原 478 測試（tap 5→5、連握→1、phantom→≤1）全過；30 項 calibrator 模擬、jsdom 0 錯誤全過。

### 2026-07-20 (k) — Claude｜海面加「環境湧浪」動態（照 wave5 影片；不動海的設計/音色）
- **Pan 決策**：喜歡 wave5（黃金時刻、一層層低平湧浪連續滾向岸邊）與**目前海的設計**；千萬不要暗沉厚重、不要動海的外觀。只要浪的**動態**像 wave5。
- **做法**：`drawSea()` 在水域加一組**恆常環境湧浪**——5 道柔光橫線（湧浪稜線），phase 隨時間由遠(小/淡/慢/密)推近(大/亮/快/疏，透視間距 phase²），約 2.1s 一道（wave5 實測浪律 ~2s），screen 疊加、有界、進出淡入淡出。**不碰**水色漸層/天空/caustics/沙灘（純加法）。握力驅動的近岸浪花仍疊在最前景不變。音色引擎完全沒動。
- **驗證**：@napi-rs/canvas 無頭渲染 idle（沒握）連續三幀確認湧浪由遠推近、配色與原設計一致（sea_swell_a/b/c.png）；node --check、jsdom 0 錯誤、30 項 calibrator 模擬全過。
- 可調：湧浪道數 `bandN=5`、浪律 `period=2.1`、透視 `phase*phase`、亮度係數。若 Pan 覺得太多/太亮，降 bandN 或 alpha 係數即可；要更像影片的「近岸翻白」可再把最近的 1-2 道接上既有 shoreWave 白沫。

### 2026-07-20 (j) — Claude｜修「4-7-8 沒握卻自己倒數」＋記錄浪聲/視覺參考影片
- **Pan 回饋（含影片 IMG_9338.MOV）**：進 4-7-8 後沒握，程式自己一直倒數。
- **root cause（第三份 log 判讀）**：Ball2 的 `restRef` 鎖在 33979（校正 rest 中位被「放桌上/完全放開」值拉低），但「拿在手裡不握」是 ~34700 → 光拿著 delta≈+720、level 釘在 ~1.0；edge detector 在這個高位平台上因手抖/雜訊反覆越過門檻＝每 ~0.5s 自己觸發一拍（log 中 15 個 478:press 全 source=edge、間隔 ~0.5s、期間 grip 未真正握）。
- **修法（targeted，不動 calibrator，避免破壞前面已 OK 的步驟）**：4-7-8 數拍改 **per-ball「必須先放開才數下一拍」**——`state.guided.beat478Armed{1,2}`，該球 level ≤ `MANUAL_478_OFF` 才武裝，數一拍後撤武裝。卡在高位的球（level 回不到 OFF）數一次後就不再 rearm → 不再 runaway；另一隻真正握放的手照數（4-7-8 本來就任一手可數）。edge 與 level 兩路都經此閘＋380ms refractory。進場依當下 level 初始化武裝（進場那一握不算拍）。
- **驗證**：jsdom 實地驅動頁面：phantom 球連打 40 次 → 最多 1 拍（不 runaway）、真實 tap 5 次 → 5 拍、不放開連握 → 1 拍；30 項 calibrator 模擬全過；jsdom init 0 錯誤。
- **未解 / 待 Pan 決策**：① Ball2 phantom 的**根因**（restRef 鎖到 open 值）還在——自由 session 的海面會把 Ball2 當成握著（海位偏高）。徹底解需要「持續握 >N 秒＝其實是新的靜止姿勢→慢慢吸收 baseline」，但這會和「刻意長握維持海面」相衝（就是先前修好的『握持不下沉』），需 Pan 定調要不要犧牲長握穩定度。目前 arm-gate 已讓 478 可用（用另一手數），故列為 follow-up。② **浪聲/視覺參考**：Pan 給了 IMG_9338.MOV（湧浪打到岸邊的感覺）當海面美學目標，待做一輪 frame + 音訊頻譜分析後 retune 海浪合成（見 RESEARCH §海岸 field recording 分析表 TODO）。

### 2026-07-20 (i) — Claude｜修「表達緊張」放手歸零＋下一幕文字提早出現
- **Pan 回饋**：表達緊張程度那段，「可以放開」出現後一放手水位就歸零（看不見自己選了什麼），而且下一段「符合程度」的字在**還沒換幕**時就跳出來。
- **根因**：`finishArrival()` 在放手當下同步執行：把球上文字設成下一幕的「握出有多貼近」＋ `--cue-fill=0`＋`orbFill=0`，但 `showArrivalStep("report")` 的換幕動畫要 720ms 才真正切 step——所以舊畫面上出現新幕的字、水位被硬歸零。
- **修法**：①hold 完成時記 `arrival.holdExpressed`（表達的高度）；hold 步驟的水位在 `holdDoneAt` 之後凍結在這個高度（放手不歸零），直到換幕。②`finishArrival` 不再直接動球上文字/水位；改由 `updateArrival` 的 report/agree 分支在 step 真正切到 report 後逐幀接手（原本就會每幀設字與水位——水位從表達高度以 ×0.8/幀平滑退掉，銜接自然）。③移除 `orbFill=0` 的瞬間歸零。
- **驗證**：node --check、jsdom 0 錯誤、30 項校正模擬全過（calibrator 未動）。**尚待 Pan 實測換幕觀感。**
- 未解：Pan 說「校正的時候畫面看起來很怪」——具體是什麼樣待問（cue 球？文字？時序？）。「一隻手要特別用力」＝硬球 span 地板 140，看下一份 log 的 pulseRises/lockedSpan 再決定要不要降 `GRIP_MIN_SPAN_LOCKED`。

### 2026-07-20 (h) — Claude｜換手支援：edge-pulse 驅動的雙向 span 適應
- **需求（Pan）**：常常左右手互換球。sign/restRef/baseline 是球的物理特性、換手不受影響；但 span 是「球×校正那隻手」的，原本只會慢擴張、不會縮＝弱手拿到強校正的球會一直遲鈍。
- **設計**：把 4-7-8 的「握一拍」偵測拿來當力量探針。每個 pulse 結束記峰值 rise（相對**起握當下**的 rest floor，避免長握時 floor 爬上來低估）；最近 3-5 筆的中位數 ×`GRIP_PEAK_TO_SPAN` 當新滿刻度 target，`lockedSpan` 以 `GRIP_SPAN_ADAPT_RATE(0.45)`/pulse 收斂（~5-6 握到位），span 在 pulse 結束（手已放開）時直接重標定。範圍鎖 `calibSpan × [0.4, 2.5]`。
- **安全閥**：①輕拿/放鬆緩握不產生 pulse → 不誤調；②`GRIP_ADAPT_REFRACTORY=25` 筆 report（33Hz≈0.76s）內的連續 pulse 不餵適應 → 2-4Hz 手抖不會拉低 span；③中位數擋單次亂握；④有界。
- **驗證**：30 項模擬全過，新增：換弱手 6 握 span 563→256、弱手 +200 → 0.64；換回強手 6 握 → 531；輕拿 20s span 不動；手抖 ±15% level 波動 0.05。node --check、jsdom 0 錯誤。
- 給下一位：snapshot 新欄位 `calibSpan`（校正錨點）；`lockedSpan` 現在是「目前這隻手」的活值，兩者差距大＝最近換過手，log 可直接看出。

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
