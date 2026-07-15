# AESTHETIC.md — Tidal 音畫美學語言（研究背書 + 設計原則）

> 規範「Tidal 的畫面與聲音為什麼長這樣」。根基：Marc Berman **環境神經科學實驗室（Environmental Neuroscience Lab, UChicago）** 的「低階自然特徵 → 注意力恢復」證據，加上 Richard Taylor 的**碎形流暢（fractal fluency）**理論；對照 Endel——取其原則、不抄其外觀。
> 與 `DESIGN.md`（要做什麼）、`AGENTS.md`（怎麼做事）、`RESEARCH.md`（技術來源）並列；聲音物理見 DESIGN，本檔談美學語言與其科學依據。連結於寫作當下（2026-07）已核實，引用前請再確認。

---

## 0. 一句話

Tidal 不是一個抽象的放鬆 app，而是一片**認得出來的海**：用自然場景的低階統計特徵（曲線邊緣、碎形自相似、克制但有變異的色相、1/f 慢動態）**同時**驅動聲音與畫面，並讓身體的握壓／揮動即時塑形。質感來自科學原則，不來自模仿 Endel 的外觀。

## 1. 科學根基

### 1.1 聽覺恢復（已彙整於 `../Berman_sound_research_table.md`）
- 自然聲景相對都市聲景能改善 directed attention（Van Hedger, Nusbaum, Berman 2019）——把注意力恢復理論（ART）從視覺延伸到純聽覺。
- 對自然聲音的偏好**取決於「辨識得出聲音來源」**（sound object recognition；Van Hedger 2019）。**設計含義：Tidal 的海必須聽得出是海，不能退化成抽象 pad。** 這正是我們與 Endel（抽象、pentatonic 生成）分道的科學理由。
- Schertz & Berman（2019）主張：restoration 理論過去只認真處理低階「視覺」特徵，現在要用同樣方式納入低階「聽覺」特徵。

### 1.2 視覺低階特徵 → 自然感／偏好／恢復（Berman 實驗室）
- **非直線／曲線邊緣**越多 → 場景越被判為自然、越受偏好（Kardan, Kotabe, Berman 2015；跨都市與自然場景成立）。
- 低階「色相與飽和度的變異度」（SD of hue、SD of saturation）是「偏好自然勝於人造」的關鍵成分——重點不是單色，而是**克制中有變化**。
- **碎形自相似**（跨尺度重複的結構）帶來連貫感與偏好；「水」這個高階特徵讓人更**沉思、反省**（Schertz & Berman 2019）。選海本身即有證據支撐放鬆／反省。

### 1.3 碎形流暢（Richard Taylor）
- 人眼對自然界常見的**中等碎形維度 D≈1.3–1.5** 特別流暢、處理省力，落在「視覺舒適區」，與自律神經放鬆（減慢心跳／呼吸、降肌肉張力）相關。相關研究報告可觀的壓力下降幅度（該數字為原研究宣稱，**我們保守引用、不誇大、不宣稱療效**）。
- **設計目標**：畫面複雜度落在**中碎形帶**——不要像極簡風那樣空到沒有結構，也不要繁雜到有負擔。

## 2. Endel：取原則，不取外觀

**學它的原則**（其實多半我們 guardrail 已在守）：恢復而非娛樂、連續無硬切、稀疏低認知負荷、隨情境自適應、on-device 生成（隱私本機）。
**不抄的**：它的抽象漸層／光斑外觀、pentatonic 生成手法、以及「no artistic statement」的立場。我們反其道——**有一個明確的自然對象（海）**；而 sound object recognition 的證據顯示，這種「認得出來」反而更有效。Endel 的高級感來自克制與連續慢動，這些是**原則**，可以各自實作，不需要長得像它。

## 3. Tidal 的差異化（我們的，不是它的）

1. **認得出的海**（representational-but-procedural），而非抽象光斑。
2. **一套碎形文法貫穿聲與畫**：聲音已用多個不可公約週期的 LFO（1/f 般的時間結構，DESIGN §3）；視覺用**同一原則**——浪形跨 3+ 尺度自相似、目標中碎形 D。聲與畫讀同一組 `getState()`，同源、同步。
3. **只有曲線**：畫面零直線，全是浪、漣漪、水面弧線。
4. **克制但有變異的色相**：不單色；深藍綠為主，隨深度與 foam 有細微色相位移，中飽和。
5. **具身即時塑形**（Endel 沒有）：畫面要讓「你的放鬆／發力如何塑形這片海」**可被看見**——一個 biofeedback 迴路，而非被動背景。
6. **水 = 沉思**：選海本身有證據支撐。
7. **量測不宣稱**：wellness 語氣（guardrail 6）；EEG 僅探索性。
8. **千層 + 有界隨機，繞著焦點中心**（Pan 2026-07-09）：真實的海是多層、充滿隨機的；純週期正弦一抽掉隨機就顯機械。因此聲/畫都在**握力球控制的焦點中心**（方位、潮汐）周圍加入**有界隨機**——聲音用均值回歸的隨機漫步微擾亮度/泡沫/浪組週期＋多個不可公約 LFO；視覺用每道浪各自的 seed（振幅/波長/相位不同）＋多 octave 碎形細波。關鍵是**有界**（guardrail 3：不自由生成）：隨機只在明確上下限內漂移，焦點與可控性不被淹沒。這和碎形自相似（§1.3）、soft fascination（§1.1）一致——有機、溫和、可安住。
9. **站在岸邊看海，而不是假俯視岸線**（Pan 2026-07-14）：Pan 喜歡海潮參考圖的青綠、白泡沫、濕沙色感，但不想被鎖成空拍俯視。最新視覺方向應是「站在海岸往海邊看」：遠方青綠海面、近處白浪與水膜、沒有一條硬切的沙灘/海水分界。若覺得海岸太假，下一步應往更抽象的水膜、光影、泡沫肌理收斂，而不是再畫更明確的岸線。
10. **中央圓球是被擠壓的內核**（Pan 2026-07-14）：握力越大，球應越小，因為球被手擠壓；但光、水位與聲音能量可同步增強。不要做成握力越大球越膨脹的能量球。
11. **不要畫浪，畫光穿過水**（Pan 2026-07-15 參考圖：`/Users/panstudiollrl/Downloads/IMG_9778.PNG`）：新的海面參考是一張近水面視角的清澈淺海，重點不是海浪線條，而是透明青綠水體、沙底、粉紫天空與水下 caustics 光紋。下一版視覺應抓這些特徵：
    - 水色來自透明深度與沙底反光，不是一片藍綠色塊。
    - 主視覺是水下白色折射光紋，細碎、漂移、互相交疊，避免規則正弦波。
    - 遠方天空可有粉紫/淡藍霧化，讓狀態更像清晨或黃昏的心理空間。
    - 海平線與遠岸要柔，不要硬切分層。
    - 視角像人站在水邊或水裡看出去，身體已進入水，而不是俯視地圖。
    - 握力互動應優先改變光紋亮度、密度、流向與中央內核壓縮，而不是畫人工海浪。

## 4. 低階特徵 → 具體映射（可調、可實驗）

| 低階特徵 | 聲音 | 畫面 | 由誰控 | 研究依據 |
|---|---|---|---|---|
| 曲線邊緣 | 浪為正弦疊加、無方波感 | 水面／漣漪全曲線、零直線 | 固定原則 | Kardan/Kotabe/Berman |
| 碎形自相似 | 多個不可公約 LFO 疊加 | 3+ 尺度浪層、目標 D≈1.3–1.5 | set／swell | Taylor；Schertz/Berman |
| 1/f 慢動態 | swell 8–16s、set 30–90s 慢包絡 | 慢位移、無硬切、緩起緩落 | 自走 | fractal fluency |
| 色相變異 | foam 亮度／頻譜 | 隨深度的色相位移、foam 微暖 | tide／energy | Kardan/Berman |
| 稀疏強事件 | 拍石稀疏、限幅、快起慢落 | 一次濺起 + 擴散漣漪、定位在方位 | 用力握＋揮動 | soft fascination（強互動需刻意） |
| 具身塑形 | 握壓→潮汐／聲場 | 可見的塑形與方向 | 握力球 READ | 我們的差異軸 |

> 這些是「起點」，須在真實體驗中校準；改動請更新本表並在 `AGENTS.md` 交接紀錄註明（同 DESIGN.md 規矩）。

## 5. 一個原創的研究角度（bonus）

因為我們把上述低階特徵做成**可調參數**，又有 MEASURE 流程與探索性 EEG 通道，Tidal 可以做我們自己的小實驗：**哪一組（碎形 D、色相變異度、動態速率）最能推動 restoration？** 這是把 Berman 實驗室的科學變成產品命題，也是 Endel 不公開追的方向。仍守 guardrail：探索性量測，不解讀為「已放鬆」的證明。

## 參考連結（2026-07 核實）

- Kardan/Kotabe/Berman — 自然 vs 人造場景偏好的低階視覺特徵：<https://pubmed.ncbi.nlm.nih.gov/25954228/>
- Schertz & Berman — Understanding Nature and Its Cognitive Benefits（免費 PDF 見 Berman 表）：<https://journals.sagepub.com/doi/10.1177/0963721419854100>
- 低階視覺特徵與知覺恢復性：<https://www.sciencedirect.com/science/article/abs/pii/S0272494422000457>
- Van Hedger/Berman — Cricket chirps and car horns（自然聲景與認知）：<https://pubmed.ncbi.nlm.nih.gov/30367351/>
- Richard Taylor — Fractal Fluency：<https://blogs.uoregon.edu/richardtaylor/2016/02/03/human-physiological-responses-to-fractals-in-nature-and-art/>
- Berman 實驗室刺激素材與軟體：<https://voices.uchicago.edu/bermanlab/stimuli-software/>
- Endel — science（供對照，取原則不抄）：<https://endel.io/science>
