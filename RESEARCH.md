# RESEARCH.md — 海浪合成、MeshRIR 空間音訊、技術選型

> 為什麼這樣做，以及原始來源。所有連結在寫作當下（2026-07）已核實可達；接手者引用前請再確認。
> 態度：可驗證、不誇大。不確定處已標記。

---

## 1. 技術路線總覽與選型

| 面向 | 決策 | 理由 |
|---|---|---|
| 合成語言（主線） | **Web Audio（`web/index.html`）** | 延續 `Gripball/nature_loop_web.html` 已驗證的 WebHID 骨架；零安裝、桌面 Chrome/Edge 可跑；兩人團隊維護成本低。 |
| 合成語言（副線） | **Max/MSP + gen~** | 聲音設計時快速試 DSP（`gen~` 可寫 sample-level 演算法）；定案參數再搬回 Web。非必須。 |
| 海浪聲學模型 | **Andy Farnell《Designing Sound》水體/海浪法** | 程序式、參數化、即時可控，正好符合「有界 recipe、即時互動」需求；比純播放錄音更能把「潮汐/方向」變成連續維度。 |
| 空間音訊 | **先 PannerNode(HRTF)，再選配 MeshRIR convolution / ambisonics** | 由簡到繁；先驗證方向感對放鬆的價值，再決定是否承擔 IR 資料與 convolution 複雜度。 |

> 為何是程序式而非只播海浪錄音：錄音是固定資料，無法讓「握力→潮汐」平滑連續地改變浪的物理。Farnell 的核心主張正是「把聲音當成一段可即時改變的程序（procedural audio），而非資料」。這與 Tidal 要的即時互動天然契合。

## 2. Andy Farnell《Designing Sound》— 海浪 / 水體合成

《Designing Sound》(MIT Press, 2010) 用 **Pure Data** 從第一原理合成音效；書的方法是「先談該聲音的物理、再建模型、再實作 Pd patch」。水與海浪屬其中的自然聲章節。核心可搬到 Web Audio / gen~ 的技法：

**(a) 海 / 湧浪（surge）— 濾波噪音 + 慢包絡**
- 一整片海 ≈ 寬頻噪音經**帶通/低通濾波**，用**慢速 LFO** 同時調變濾波截止與音量，做出「湧上—退去」的呼吸感。
- 「一陣陣的浪組（wave sets）」用**數個週期不可公約的慢 LFO 相加**得到，避免機械式重複——這是讓海聽起來自然、不循環的關鍵。
- 泡沫/嘶聲（foam）＝**高通噪音**，由湧浪包絡的上升段開閤（gate）。

**(b) 水滴 / 氣泡（bubble）模型 — 用於水花點綴**
- 單一氣泡 ≈ 一個**正弦波，頻率做正向上滑（chirp）**、振幅指數衰減 → 典型「啵」聲。基頻與氣泡半徑相關（Minnaert 共振）。
- 大量隨機觸發、不同大小與速率的氣泡 → 流水/水花質感。Tidal 用少量、稀疏的版本做浪拍時的水花細節。

**(c) 拍岸 / 浪拍礁石（impact）**
- 短促的 **bandpass 噪音爆破 + 快起慢落包絡 + 短殘響**，空間定位在當前方位。作為離散、稀疏、限幅的強拍事件。

> 註記（待接手者以原書核對）：以上為《Designing Sound》水/海章節的通用技法摘要，方向正確；實作時建議回書核對具體 patch 參數（濾波階數、LFO 範圍、包絡時值）。SuperCollider 對照可參 Wikibooks「Designing Sound in SuperCollider」。書中亦有關於用 delay/filter 近似共振的段落（約 p.378–379）可用於殘響尾巴。

參考：
- 出版頁：<https://mitpress.mit.edu/9780262014410/designing-sound/>
- 程序式音訊訪談（Farnell 本人談 procedural audio 理念）：<https://designingsound.org/2012/01/18/procedural-audio-interview-with-andy-farnell/>
- SuperCollider 對照（社群整理的 Pd→SC 物件對照，含多個範例章節）：<https://en.wikibooks.org/wiki/Designing_Sound_in_SuperCollider/Equivalents_for_Pure_Data_Objects>

## 3. MeshRIR — 空間化用的實測室內脈衝響應

**MeshRIR** 是一組在「細密網格點」上量測的室內脈衝響應（RIR）資料集，專為評估**聲場分析與合成**方法而做（一般 RIR 資料集空間解析度太低，不適合驗證這類方法）。

- 內容：兩個子資料集——(1) 單一聲源、3D 立方區域內的 IR；(2) 32 顆聲源陣列、2D 方形區域內的 IR。
- 授權：**CC BY 4.0**（可商用，需標註出處）。作者 Shoichi Koyama 等（National Institute of Informatics, Tokyo）。
- 官方頁：<https://www.sh01.org/MeshRIR/>
- GitHub（含 `irutilities.py` 讀取工具、`example/` 範例）：<https://github.com/sh01k/MeshRIR>
- 資料下載（Zenodo，DOI）：<https://zenodo.org/doi/10.5281/zenodo.5002817>
- 論文：MeshRIR: A Dataset of Room Impulse Responses on Meshed Grid Points…（arXiv 2106.10801）：<https://arxiv.org/abs/2106.10801>

**在 Tidal 怎麼用（Level B 沉浸升級）**
1. 從 Zenodo 下載資料，解壓到 `src/`（**不要放進 Google Drive 同步熱路徑**）。
2. 用 repo 的 `irutilities.py`（Python）讀取 `.npy` IR，挑選幾個代表性接收點的 IR。
3. 匯出成 `.wav`（正規化、對齊取樣率）放到 `Tidal/assets/ir/`。
4. Web 端用 `ConvolverNode` 載入該 IR，把海的各層（或 ambisonic 訊號）過 convolution，得到真實房間的空間著色；不同接收點 IR 可對應 Ball 1 的「聽者位置」。

> 這正是你在 **SolarMix** 用 MeshRIR 的同一套路（那個專案不在本 EEG 資料夾內，但方法可直接沿用）：以實測 IR 的 convolution 取得可信的空間感，而非純合成 reverb。

## 4. Web 的空間音訊工具箱

- **PannerNode（HRTF 模式）**：Web Audio 原生，戴耳機即有方位/距離的 3D 感，零額外資料。**Tidal 的 Level A 首選。**
- **ConvolverNode**：載入 IR 做 convolution，用來套 MeshRIR 的房間響應或 HRTF/BRIR。
- **Omnitone**（Google）：Web Audio 的 ambisonic 解碼 + binaural 渲染。<https://github.com/GoogleChrome/omnitone>
- **JSAmbisonics**：瀏覽器用的 FOA/HOA ambisonics 處理。<https://github.com/polarch/JSAmbisonics>

選型建議：先 PannerNode 驗證概念；要更強包覆感或多點聲場再上 Convolver(MeshRIR) 或 ambisonics。避免一開始就扛函式庫與資料複雜度。

## 5. 與既有原型的銜接

- WebHID + Web Audio 骨架、自動校正、慢漂移歸零、握壓節律、session/CSV 流程 → 全部沿用 `Gripball/nature_loop_web.html`（已過 17 項對拍測試）。
- 觸覺回饋（`cmd_id 11`）→ 可做放鬆時輕震的 biofeedback，屬 nice-to-have。
- HID 協定細節 → `GRIPBALL_PROTOCOL.md`。

## 6. 已定決策（Pan 2026-07-08）

1. **空間化**：第一版就上 **MeshRIR convolution**（不只做 PannerNode）。訊號鏈 sources → panner → MeshRIR convolver → soft-clip。
2. **強互動觸發**：浪拍礁石只在**握得很用力 + 揮動**同時成立時出現；單一條件不觸發，也不自發。
3. **觸覺回饋**：拍石時給一次強震動；揮動中給跟隨的輕度震動（海浪也跟著揮動方向跑）；**放下、無明顯揮動時不震動**。
4. **方向**：由揮動（IMU）帶動，海浪跟著球揮動的方向跑；停止揮動後緩回中。
5. **播放情境＝耳機 或 智能眼鏡**（Pan 2026-07-08）：兩者皆為頭戴式個人音訊，故走 **binaural / HRTF** 路線。訊號鏈維持 `sources → PannerNode(HRTF) → MeshRIR ConvolverNode(房間著色) → soft-clip`，不需喇叭的串音消除（crosstalk cancellation）。MeshRIR IR 作為房間空間著色，方位/距離感由前級 HRTF panner 提供。
   - 註記：智能眼鏡多為**開放式（open-ear）**喇叭、不完全遮蔽，會與真實環境音混合，外化（externalization）感受與封閉耳機不同；設計上先都當頭戴 binaural 處理，實機再依眼鏡型號微調 wet/dry 與距離。

### 仍待確認（下次可問 Pan）
- 揮動「強度」的量測用加速度模長還是陀螺儀角速度？（校準時決定，見 web `onReport`）

## 7. Rhythmanalysis / soundscape / BCMI 延伸（Codex 2026-07-09）

Pan 指定閱讀 Zone Sound Creative 的〈在舊港島練習節奏分析：從 Lefebvre 的 Rhythmanalysis 談起〉後，Tidal 的概念框架新增為「節奏調和系統」。完整整理見 [`RHYTHMANALYSIS.md`](./RHYTHMANALYSIS.md)。

核心轉向：
- 從「偵測狀態 → 播放放鬆音樂」改成「觀察身體/握力/聲場/EEG 的多重節奏 → 幫助恢復節奏彈性」。
- EEG 先作為探索性慢變節奏層與量測通道，不作診斷、不作單一命令。
- session/CSV 應記錄「被節奏推著走」「能停留」「agency」等主觀節奏經驗。

新增建議閱讀：
- Zone Sound Creative，舊港島 rhythmanalysis 文章：<https://www.zonesoundcreative.com/lefebvre-rhythmanalysis/>
- Henri Lefebvre, *Rhythmanalysis: Space, Time and Everyday Life*：<https://www.bloomsbury.com/us/rhythmanalysis-9780826472991/>
- R. Murray Schafer, *The Soundscape* 背景與書目：<https://bibliolore.org/2021/11/09/soundscape-schafers-heritage-and-an-annotated-bibliography/>
- Hildegard Westerkamp, “Soundwalking”：<https://www.hildegardwesterkamp.ca/writings/writings-by/?post_id=13&title=soundwalking>
- Pitts, Jean & Clarke, “Rhythmanalysis, Concrete Abstraction and the Quantified Self”：<https://research-information.bris.ac.uk/en/publications/rhythmanalysis-concrete-abstraction-and-the-quantified-self-sonif/>
- Miranda & Castet, *Guide to Brain-Computer Music Interfacing*：<https://link.springer.com/book/10.1007/978-1-4471-6584-2>
- Sourina, Liu & Nguyen, “Real-time EEG-based emotion recognition for music therapy”：<https://link.springer.com/article/10.1007/s12193-011-0080-6>
- Hildt, “Affective Brain-Computer Music Interfaces—Drivers and Implications”：<https://www.frontiersin.org/journals/human-neuroscience/articles/10.3389/fnhum.2021.711407/full>
- “Music in the loop: a systematic review of current neurofeedback methodologies using music”：<https://www.frontiersin.org/journals/neuroscience/articles/10.3389/fnins.2025.1515377/full>

## 參考連結彙整

- Designing Sound（MIT Press）：<https://mitpress.mit.edu/9780262014410/designing-sound/>
- Farnell procedural audio 訪談：<https://designingsound.org/2012/01/18/procedural-audio-interview-with-andy-farnell/>
- Designing Sound in SuperCollider（Pd→SC 對照）：<https://en.wikibooks.org/wiki/Designing_Sound_in_SuperCollider/Equivalents_for_Pure_Data_Objects>
- MeshRIR 官方：<https://www.sh01.org/MeshRIR/>
- MeshRIR GitHub：<https://github.com/sh01k/MeshRIR>
- MeshRIR 下載（Zenodo DOI）：<https://zenodo.org/doi/10.5281/zenodo.5002817>
- MeshRIR 論文（arXiv 2106.10801）：<https://arxiv.org/abs/2106.10801>
- Omnitone：<https://github.com/GoogleChrome/omnitone>
- JSAmbisonics：<https://github.com/polarch/JSAmbisonics>
- Zone Sound Creative rhythmanalysis：<https://www.zonesoundcreative.com/lefebvre-rhythmanalysis/>
- Lefebvre Rhythmanalysis（Bloomsbury）：<https://www.bloomsbury.com/us/rhythmanalysis-9780826472991/>
- Westerkamp Soundwalking：<https://www.hildegardwesterkamp.ca/writings/writings-by/?post_id=13&title=soundwalking>
