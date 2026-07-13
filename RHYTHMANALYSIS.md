# RHYTHMANALYSIS.md — 節奏分析作為 Tidal 的概念框架

> 目的：把 Henri Lefebvre 的 rhythmanalysis、Zone Sound Creative 的舊港島工作坊文章，以及 Tidal 現有的 Grip Ball / 海浪 / spatial / EEG 方向接起來。
> 本檔不是替代 `DESIGN.md`，而是提供「為什麼這樣改寫」與「接下來怎麼驗證」的交接脈絡。
> 寫作日期：2026-07-09。引用前請再確認連結。

---

## 0. 一句話改寫

Tidal 不只是「偵測身體狀態後生成放鬆音樂」，而是一個**節奏調和系統**：

> 觀察身體、握力、揮動、環境聲場與未來 EEG 指標之間的多重節奏，並用一片可被雙手塑形的海，幫助使用者從失序節奏回到可呼吸、可停留、可調整的複節奏。

這個改寫讓 Tidal 從「EEG state → music parameter」變成「body/environment/music rhythms → adaptive regulation」。對兩人小團隊來說，這也比較務實：先做好可感、可記錄、可訪談的節奏互動，再把 EEG 當成探索性量測層接進來。

## 1. 文章分析：Zone Sound Creative 的 rhythmanalysis

文章〈在舊港島練習節奏分析：從 Lefebvre 的 Rhythmanalysis 談起〉把舊港島工作坊設計成一個「以身體與聲音閱讀場域節奏」的方法。重點不在量測噪音大小，而是在辨認不同節奏如何疊合、壓迫或協調。

對 Tidal 特別有用的概念：

- **自然循環 vs 社會線性**：潮汐、水位、風、季節是循環節奏；通勤、行政通知、交通、工作排程是線性節奏。Tidal 的海浪不應只是背景音，而可以成為「循環節奏」的可聽化。
- **身體作為節拍器**：呼吸、心跳、步伐、肌肉緊繃是理解場域的工具。Grip Ball 很適合成為這個身體節拍器的延伸。
- **聲化不是狹義資料轉聲音**：文章把 sonification 擴成 sensorium 的轉譯，也就是讓聽覺、視覺、觸覺、溫度、記憶與壓力變成可討論的節奏關係。這比「腦波轉音符」更接近 Tidal 應該做的事。
- **presence vs the present**：不要只追即時事件；要看長時間累積出的深層節奏。Tidal 的 session log 應該記「過程」與「前後感受」，不是只記某一瞬間 EEG 值。

文章來源：
- Zone Sound Creative：<https://www.zonesoundcreative.com/lefebvre-rhythmanalysis/>

## 2. Lefebvre 四種節奏關係 → Tidal 狀態語彙

Lefebvre 的四個詞可以直接變成 Tidal 的設計語言，但不必一開始就做成複雜分類器。

| Lefebvre 概念 | Tidal 中的意思 | 可觀察線索 | 音樂回應 |
|---|---|---|---|
| **Polyrhythmia 複節奏** | 多種節奏並存：海浪、握力、呼吸、揮動、環境聲各自存在但互相牽連 | grip 有起伏但不僵硬；IMU 不是亂甩；聲音多層 LFO 自然疊合 | 保留多層慢週期，不急著同步；讓使用者探索 |
| **Eurhythmia 和諧節奏** | 身體與聲景形成健康流動，使用者感到可以停留 | grip 逐漸變平穩；強事件減少；自評「可停留/可呼吸」上升 | 降低 foam 密度，拉長 swell，增加聲場寬度與遠近呼吸 |
| **Arrhythmia 失序節奏** | 某個節奏壓過其他節奏，身體轉為防禦或緊繃 | 硬握、劇烈揮動、重複拍石、可能的高 arousal EEG | 承認能量但加邊界：限幅、減少強事件、把能量導入較慢的潮汐 |
| **Isorhythmia 等節奏** | 所有節奏被強制鎖成單一拍線；系統過度控制使用者 | 音樂過度節拍化、使用者只是在跟系統做任務 | 避免固定節拍與分數化；保留呼吸般的不完全同步 |

設計建議：`isorhythmia` 應該是 Tidal 避免的反模式。這也呼應既有 guardrail：不懲罰、不催促、不把 EEG 解讀成唯一真相。

## 3. 對 Tidal 的核心改寫建議

### 3.1 從「放鬆」改成「恢復節奏彈性」

「放鬆」容易變成單一低喚起目標，最後做出永遠慢、永遠暗、永遠少的 ambient。更好的主張是：

> Tidal 幫助使用者恢復節奏彈性：能緊、能鬆；能發力、也能回到可呼吸的海。

這會保留「浪拍礁石」這種強互動的價值，同時避免讓強事件變成刺激主體。

### 3.2 EEG 不做命令，先做慢變節奏層

初期不要讓 EEG 直接決定「你現在焦慮/快樂/悲傷」，也不要直接控制旋律。比較穩的是把 EEG 視為一個不確定、低權重、慢變的節奏層：

- alpha/theta ratio → `swell period`、聲音柔和度、視覺動態速率。
- beta activity → `foam gain` 或高頻密度上限。
- frontal asymmetry → 僅作色彩/和聲開放度的探索性微調，不宣稱 valence 判斷。
- signal confidence → EEG mapping 的強度；訊號差時自動退回 Grip Ball / 自走海。

### 3.3 Grip Ball 是身體節拍器，不只是控制器

目前 Ball 1 = direction、Ball 2 = tide 的設計可以保留，但語言上可改成：

- Ball 1：外在/空間節奏，讓海的方位跟身體揮動建立關係。
- Ball 2：內在/潮汐節奏，讓握壓轉成能量與回落。

這會讓硬體從「兩個 MIDI controller」變成「節奏分析的身體介面」。

### 3.4 Session log 要記節奏，而不只記分數

既有 `before/session/after/summary` 很適合擴充。建議 CSV 除了 grip/IMU/audio params，也加上少量主觀欄位：

| 欄位 | 類型 | 說明 |
|---|---|---|
| `felt_pushed` | 0-10 | 這段過程有多像「被節奏推著走」 |
| `felt_able_to_stay` | 0-10 | 有多能停留、呼吸、觀察 |
| `body_tension_before/after` | 0-10 | 沿用既有緊張度 |
| `agency` | 0-10 | 聲音是否像可被自己塑形，而非被系統控制 |
| `rhythm_note` | text | 一句話：哪一刻最緊？哪一刻最鬆？ |
| `dominant_mode` | enum | human/agent 標記：poly/eu/arry/iso/unknown |

## 4. 最小可行實驗

兩人小團隊不必一開始做完整 EEG study。建議先做 3 組極小實驗：

1. **固定海 vs 可塑形海**
   - A：固定海浪聲景。
   - B：Grip Ball 可控制潮汐/方向。
   - 比較 `felt_able_to_stay`、`agency`、`body_tension_after-before`。

2. **強事件是否破壞節奏彈性**
   - 測不同 `HARD_GRIP`、`STRONG_SWING`、impact cooldown。
   - 問使用者：拍石是釋放、驚嚇、還是打斷？

3. **EEG 作為低權重慢變層**
   - 先只記錄，不控制。
   - 第二階段只控制一個安全參數，例如 swell period 或 high-frequency cap。
   - 重點是看 EEG feature 是否與主觀節奏經驗有任何可解釋關聯，不是證明療效。

## 5. 建議優先順序

1. **先補 session/CSV**：這是 rhythmanalysis 轉成可累積知識的關鍵。沒有 log，就只剩好聽/不好聽的印象。
2. **加入 rhythm mode 標記**：先手動/半手動即可，不急著自動分類。
3. **保留目前聲音 guardrails**：聲音永遠成立、強事件稀疏、haptic 不催促，這些都與 rhythmanalysis 相容。
4. **把視覺/聲音讀同一個 `getState()`**：讓聲音、海面、觸覺是同一套節奏，而非三個不同效果。
5. **EEG 晚一點再接控制**：先做 record-only，再做低權重控制。避免把不穩的訊號變成產品核心。

## 6. 建議閱讀

### 必讀

- Henri Lefebvre, *Rhythmanalysis: Space, Time and Everyday Life*。Tidal 的 polyrhythmia / eurhythmia / arrhythmia / isorhythmia 來自這裡。出版社頁：<https://www.bloomsbury.com/us/rhythmanalysis-9780826472991/>
- R. Murray Schafer, *The Soundscape*。理解 keynote sound、sound signal、soundmark，以及 soundscape 作為人與環境的關係，而非單純聲音素材。簡介與書目：<https://bibliolore.org/2021/11/09/soundscape-schafers-heritage-and-an-annotated-bibliography/>
- Hildegard Westerkamp, “Soundwalking”。可作為 Tidal 使用者測試方法的參考：聆聽、行走、停留、記錄。<https://www.hildegardwesterkamp.ca/writings/writings-by/?post_id=13&title=soundwalking>

### 與 Tidal/EEG 特別相關

- Pitts, Jean & Clarke, “Rhythmanalysis, Concrete Abstraction and the Quantified Self”。把 wearable、sonification、synthesized music 與 rhythmanalysis 放在一起，與 Tidal 的問題非常近。<https://research-information.bris.ac.uk/en/publications/rhythmanalysis-concrete-abstraction-and-the-quantified-self-sonif/>
- Miranda & Castet, *Guide to Brain-Computer Music Interfacing*。BCMI、EEG 訊號、情緒與音樂 mapping 的入口。<https://link.springer.com/book/10.1007/978-1-4471-6584-2>
- Sourina, Liu & Nguyen, “Real-time EEG-based emotion recognition for music therapy”。早期 EEG-enabled music therapy 例子，可參考但不要直接照搬情緒分類宣稱。<https://link.springer.com/article/10.1007/s12193-011-0080-6>
- Hildt, “Affective Brain-Computer Music Interfaces—Drivers and Implications”。用於補倫理與 affective BCI guardrails。<https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2021.711407/full>
- “Music in the loop: a systematic review of current neurofeedback methodologies using music”。掌握 music-based neurofeedback 的方法與限制。<https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2025.1515377/full>

## 7. 對下一位 AI agent 的提醒

- 不要把本檔理解為「要做一個 Lefebvre 主題作品」。它是設計框架，不是表面文案。
- 實作優先仍是 `web/index.html`、session/CSV、穩定音訊、可驗證 log。
- 若要加 EEG，先加 record-only 欄位與 signal confidence，再考慮低權重控制。
- UI 不要把使用者標籤成「失序」或「不健康」。`arrhythmia` 等詞留在研究/分析層，面向使用者的語言應是「緊」、「被推著走」、「可以停留」、「可呼吸」。

## 8. 現況與給其他工具延伸探討的起點（2026-07-09）

本檔的 Lefebvre 節奏框架是**概念層**；Pan 想用別的工具進一步探討，故此節整理目前產品端的狀態與待議點，讓本檔可獨立帶走。

- **已實作**：session 前後主觀節奏欄位（`felt_pushed`、`felt_able_to_stay`、`agency`、`rhythm_note`）＋ `dominant_mode`（poly/eu/arry/iso 的簡單 heuristic）寫入本機匿名 CSV。
- **已移除（Pan 決策）**：頁面上的「即時節奏」顯示——Pan 實測覺得**聽覺上感受不到、無實質意義**。`dominant_mode` 改為**只在背景計算、僅供研究 CSV**，不面向使用者；這與「arrhythmia 等詞留分析層、不標籤使用者」一致。
- **待探討（適合帶到別的工具想）**：
  1. 節奏分析要不要、以及「如何」對使用者可感？目前結論是「不用文字標籤」；也許唯一該有的回饋就是**聲景本身的變化**，而非任何額外的量表或標記。
  2. `dominant_mode` 的 heuristic 太粗；要成為研究工具，需用真實 session 資料＋訪談校準，或改成**質性編碼**而非即時分類。
  3. 把 polyrhythmia / eurhythmia 當「目標狀態」是否過度目的論？是否更該只**描述、不評價**（回到 Lefebvre 觀察者的立場）。
  4. EEG 接入時，作為「低權重慢變節奏層」與其他身體節奏（握力、揮動、呼吸、環境聲）的關係如何談，且不淪為診斷。

> 給接手的工具／對話：本檔 §1–§7 可獨立閱讀，不需先讀程式；實作現況以 `AGENTS.md` 交接紀錄與 `web/index.html` 為準。
