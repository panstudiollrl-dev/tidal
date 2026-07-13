# assets/ir — 空間化用的脈衝響應（IR）

放這裡的 `.wav` 給 Web 端 `ConvolverNode` 做 convolution（DESIGN.md §5 的 Level B）。

## 從哪來：MeshRIR（CC BY 4.0）

1. 下載：<https://zenodo.org/doi/10.5281/zenodo.5002817>（解壓到 repo 外的 `src/`，**勿放 Google Drive 同步熱路徑**）。
2. 用 <https://github.com/sh01k/MeshRIR> 的 `irutilities.py` 讀 `.npy`，挑幾個代表性接收點的 IR。
3. 匯出成 `.wav`（正規化、對齊取樣率 48k），放本資料夾。
   **web/index.html 啟動時會自動載入 `room.wav`**，所以先準備一個命名為 `room.wav` 的預設 IR；其餘可命名如 `mesh_room_left.wav` 供多接收點切換。

不同接收點的 IR 可對應 Ball 1 的「聽者位置」。詳見 `../../RESEARCH.md` §3。

## 現況（2026-07-08）

`room.wav` 已產出：來源 MeshRIR **S1-M3969（.mat 版）**，取陣列中心平面左右一對接收點（mic#1981 x=-0.15、mic#1987 x=+0.15，間距 0.3 m），48 kHz / 32-bit float / stereo、時長 0.55 s、RT60≈0.38 s。
重跑或改接收點/房間：`python3 export_room_ir.py --data <MeshRIR 資料夾> --out room.wav`（`export_room_ir.py` 支援 .npy 與 .mat，只讀需要的兩顆麥克風；讀 .mat 需 `pip install scipy`）。

**引用義務**：MeshRIR 為 CC BY 4.0，任何使用需標註 Shoichi Koyama et al. 與資料集出處。
