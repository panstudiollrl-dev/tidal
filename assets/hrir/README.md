# assets/hrir — 實測 HRIR（水平面 90 個方位角）

`web/index.html` 的空間定位用這批 IR 做卷積，取代瀏覽器內建的 `PannerNode`
（`panningModel = "HRTF"`）。Pan 在 `web/spatial_bench.html` 用 A/B/C 盲測聽過，
選了這條路（2026-08-04）。

## 檔案

- 90 個 `ir_azi{方位角}_ele000.wav`，48kHz / **float32** / stereo / **256 taps**（5.33ms）。
- `manifest.json`：`[{name, azi, ele}]`，供頁面查表。
- 全部是**仰角 0（水平面）**，涵蓋完整 360°。正面較密（2~3° 一格）、側面較疏（5° 一格）。
  Tidal 的層都在水平面上，所以不需要仰角層。

## 來源與一個要修正的標示

從 `panstudiollrl-dev/duck-hunt-gripball-web` 的 `assets/hrir/`（同一位作者的另一個
專案）取水平面那 90 個。**只複製了 ele=0 這層**，那邊另有 ±15°/+30° 共 344 檔。

⚠️ **duck-hunt 那邊的 `.gitignore` 把來源池標成「1551 個 MeshRIR HRIR wav」，這個標示是錯的。**
MeshRIR 是**房間**的麥克風陣列資料集（3969 顆全向麥克風），裡面沒有 HRTF。
`gripball_webhid.js:1514` 的註解寫「SADIE-style」比較接近。實際量測支持後者：

| 方位角 | 峰值 ITD | ILD |
|---|---|---|
| 0° | 0µs | −2.2dB |
| 45° | +167µs | +16.5dB |
| 90° | +583µs（xcorr +708µs）| +20.4dB |
| 270° | −583µs（xcorr −792µs）| −17.2dB |

±583µs 的 ITD 與 20dB 的 ILD 是**人頭**的量級（真人上限約 ±700µs），而且 90°/270°
對稱翻號。MeshRIR 那種相距 0.3m 的兩顆**全向**麥克風不會有 20dB 的耳間音量差
（全向麥克風之間沒有頭部遮蔽），ILD 會接近 0dB。所以這批是真的 HRIR，不是 MeshRIR。

**但確切的原始資料集仍未確認**（來源池 `hrir_wavs/` 不在 repo 裡、也不在這台機器上）。
`web/index.html` 的引用區塊目前寫「來源待確認」。**要對外發佈前，請先確認原始資料集
與其授權**——SADIE II（University of York）是 CC BY 4.0，但在確認之前不要照抄這個說法。
這件事記在 `AGENTS.md` 的交接紀錄裡。

（本目錄與 `assets/ir/room.wav` 無關。那個是 **MeshRIR**，是**房間殘響**，CC BY 4.0、
需標註 Shoichi Koyama et al.，見 `assets/ir/README.md`。兩者同時在用：HRIR 給方向、
room.wav 給房間。）

## 為什麼要在卷積後補一段等化（HRIR_TILT_FIX）

這批 IR 在低頻是往下斜的，而且斜得很兇：以 5kHz 為 0dB 基準，220Hz 掉 −23.8dB、
60Hz 掉 −19.7dB。不修的話低頻層會整體掉十幾 dB ＝ 悄悄把 Pan 依阿朗壹錄音調好的
聲音平衡改掉，而那正是 Pan 2026-08-04 聽到的「白噪音很假、shimmer 和 pebble 幾乎沒有」。

**修法（2026-08-04 改版）：在卷積之後接一段固定的等化鏈**，而不是每層在卷積前乘一個
寬頻倍數。原因是傾斜是**頻率的函數**：一個寬頻倍數只能把該層頻帶的「中位」能量拉回來，
層內的斜度還在（例如 `surge` LP800 的 100Hz 與 700Hz 之間仍差 15dB），聽起來還是薄。
等化鏈直接把傾斜本身拉平，所以每層的補償倍數隨之全部塌回 ~1.0。

鏈的內容見 `web/index.html` 的 `HRIR_TILT_FIX`（一組 lowshelf/peaking），整體再乘
`HRIR_TILT_TRIM = 1.288`（鏈本身有 +2.2dB 淨增益，用阿朗壹的頻帶權重把總音量對回 0dB）。
修正後 15 個對數等距頻點的最大殘差 **2.7dB**（在 7kHz，那裡本來就幾乎沒有能量）。

各層在**自己的濾波器頻帶**內加權之後只剩零點幾 dB 殘差，這才是現在 `SPATIAL_MAKEUP`
的來源：

| 層 | 頻帶 | 等化後的帶內殘差 | makeup |
|---|---|---|---|
| surge | LP800 | −0.19dB | 1.02× |
| foam | HP1500 + LP（頂端蓋子） | +0.16dB | 0.98× |
| pebble | LP700 | −0.12dB | 1.01× |
| bubble | BP320 | −0.26dB | 1.03× |
| shore（岸浪道） | LP640 | −0.15dB | 1.02× |

⚠️ `foam` 的 0.98 一定要把 **`foamLP`（頂端蓋子）算進去**才算得對；把 foam 當成沒有
上限的 HP1500 會得到 0.90，少了 0.8dB。`tmp/fit_hrir_tilt_fix.js` 現在從頁面讀
`foamLP.frequency`，不要在腳本裡寫死。

makeup 仍然乘在**進 convolver 之前**（卷積是線性的，前後等價），左右耳乘同一個數，
ILD（方向線索）不受影響。方向之間還有 −2.4 .. +7.5dB 的起伏，那是 HRTF 本來就有的
（頭部遮蔽隨角度變），不補、也不該補。

`web/spatial_bench.html` 的 C 路**沒有**這層等化，所以主頁會比 bench 低頻足很多
——這是刻意的。頁面上 **H** 鍵可以切回內建 HRTF 對照。

## 驗證

```
node tmp/test_hrir_spatial.js     # 讀真 IR 量 ITD/ILD 當真值，驗角度對應與等化鏈接線
node tmp/check_alangyi_match.js   # makeup vs 殘差的權威測試；另含粉紅噪音頻譜的實測
node tmp/mutate_hrir_spatial.js   # 變異測試：把等化鏈/粉紅噪音/PEBBLE_FLOOR 改壞要被抓到
node tmp/fit_hrir_tilt_fix.js     # 觀察用：重新擬合等化鏈並印出頻帶分布 vs 阿朗壹
```

`fit` 那支印的頻帶分布是這次改版的驗收依據（阿朗壹 → 改版前 → 改版後）：
頻帶絕對誤差合計從 **121.0% 降到 57.0%**，spectral centroid 從 4526Hz 降到 2356Hz
（阿朗壹是 428Hz——仍然偏亮，但方向對了）。
