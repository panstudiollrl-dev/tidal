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

## 為什麼卷積前要乘一個補償增益

這批 IR 在低頻是往下斜的。以 `foam`（HP1500）為 0dB 基準，在各層**真實濾波器頻帶**內
取對數等距 13 點 DFT、90 個方向取中位數，量到：

| 層 | 頻帶 | 卷積後的帶內增益 | 補償 |
|---|---|---|---|
| bubble | BP320 | −13.7dB | 4.82× |
| shore（岸浪道） | LP640 | −12.3dB | 4.10× |
| pebble | LP700 | −11.2dB | 3.61× |
| surge | LP800 | −9.9dB | 3.11× |
| shimmer | LP1450 | −4.7dB | 1.72× |
| foam | HP1500 | +1.4dB | 0.85× |

不補的話低頻層會整體掉 10–14dB ＝ 悄悄把 Pan 依阿朗壹錄音調好的聲音平衡改掉。
卷積是線性的，所以在**進 convolver 之前**乘上這個係數就能還原設計比例，而且左右耳
乘同一個數，ILD（方向線索）不受影響。`web/spatial_bench.html` 的 C 路**沒有**這層補償，
所以主頁會比 bench 低頻更足——這是刻意的。頁面上 **H** 鍵可以切回內建 HRTF 對照。

方向之間還有 −2.4 .. +7.5dB 的起伏，那是 HRTF 本來就有的（頭部遮蔽隨角度變），
不補、也不該補。

## 驗證

```
node tmp/test_hrir_spatial.js     # 讀真 IR 量 ITD/ILD 當真值，驗角度對應與補償增益
```
