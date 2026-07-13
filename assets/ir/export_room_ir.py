#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
export_room_ir.py — 把 MeshRIR 的 IR 匯出成 Web 端 ConvolverNode 用的 room.wav
（見 Tidal/RESEARCH.md §3、DESIGN.md §5、assets/ir/README.md）

支援 MeshRIR 兩種下載格式：
  - .npy 版（pos_mic.npy / pos_src.npy / ir_<idx>.npy，每檔 shape=(numSrc, irLen)）
  - .mat 版（pos_mic.mat / pos_src.mat / ir_<idx>.mat，變數 'ir' shape=(numSrc, irLen)，MAT 5.0）
只讀取需要的「左右兩顆麥克風」，不整包載入（S1 有 3969 顆，全載很慢）。

依賴：numpy（一定要）；讀 .mat 版時需要 scipy（pip install scipy）。WAV 用標準庫手寫，不需 soundfile。

用法：
  python3 export_room_ir.py --data <MeshRIR 資料所在資料夾> [--out room.wav] [--work <解壓工作區>]

行為：
  1. 在 --data 下找 MeshRIR 資料集（已解壓的資料夾，或含它的 .zip；.zip 會解壓到 --work，
     預設 <data>/_meshrir_work，留在原碟、不進 Google Drive）。優先單一聲源（S1）。
  2. 讀 pos_mic，取陣列中心平面上左右一對接收點，組成 stereo IR（給空間寬度）。
  3. 只載那兩顆麥克風的 IR → 正規化 + 依 -60 dB 尾巴裁切（上限 1.5 s）→ 寫 48 kHz 32-bit float WAV。

MeshRIR 為 CC BY 4.0，使用需標註 Shoichi Koyama et al.（見 README.md）。
"""
import argparse, struct, sys, zipfile
from pathlib import Path
import numpy as np

SR = 48000  # MeshRIR 原始取樣率


def _load_arr(path: Path):
    """讀單一 .npy 或 .mat（MAT 5.0）陣列。.mat 取第一個非底線變數。"""
    if path.suffix == ".npy":
        return np.asarray(np.load(path))
    from scipy.io import loadmat  # 只有 .mat 才需要 scipy
    m = loadmat(str(path))
    keys = [k for k in m if not k.startswith("__")]
    return np.asarray(m[keys[0]])


def find_sessions(root: Path):
    """含 pos_mic.(npy|mat) 且有 ir_*.(npy|mat) 的資料夾。"""
    out = []
    for name in ("pos_mic.npy", "pos_mic.mat"):
        for p in root.rglob(name):
            d = p.parent
            if any(d.glob("ir_*.npy")) or any(d.glob("ir_*.mat")):
                out.append(d)
    return out


def extract_zips(data: Path, work: Path):
    work.mkdir(parents=True, exist_ok=True)
    for z in sorted(data.glob("*.zip")):
        try:
            with zipfile.ZipFile(z) as zf:
                names = zf.namelist()
        except zipfile.BadZipFile:
            print(f"  跳過（未完成/壞檔）：{z.name}")
            continue
        if any(n.endswith(("pos_mic.npy", "pos_mic.mat")) for n in names):
            print(f"  解壓 {z.name} → {work}")
            with zipfile.ZipFile(z) as zf:
                zf.extractall(work)


def session_ir_path(session: Path, idx: int):
    for ext in (".npy", ".mat"):
        p = session / f"ir_{idx}{ext}"
        if p.exists():
            return p
    raise FileNotFoundError(f"找不到 ir_{idx}.npy/.mat @ {session}")


def pick_lr(pos_mic: np.ndarray):
    """在中心 z 平面上取左右一對接收點（x 為左右軸），需有實際橫向間距。"""
    c = pos_mic.mean(axis=0)
    x = pos_mic[:, 0]
    span = float(x.max() - x.min())
    margin = max(span * 0.15, 0.05)
    zc = pos_mic[:, 2][np.argmin(np.abs(pos_mic[:, 2] - c[2]))]
    plane = np.isclose(pos_mic[:, 2], zc)
    dist = np.linalg.norm(pos_mic - c, axis=1)
    lm = plane & (x <= c[0] - margin)
    rm = plane & (x >= c[0] + margin)
    if lm.any() and rm.any():
        li = int(np.where(lm)[0][np.argmin(dist[lm])])
        ri = int(np.where(rm)[0][np.argmin(dist[rm])])
        print(f"  L mic#{li} @ {pos_mic[li].round(3)}   R mic#{ri} @ {pos_mic[ri].round(3)}"
              f"   橫向間距 {pos_mic[ri,0]-pos_mic[li,0]:.3f} m")
        return li, ri
    ci = int(np.argmin(dist))
    print(f"  單點退化：mic#{ci} @ {pos_mic[ci].round(3)}（左右複製，無足夠橫向間距）")
    return ci, ci


def write_wav_float32(path: Path, stereo: np.ndarray):
    """WAVE_FORMAT_IEEE_FLOAT（3）32-bit stereo。stereo shape=(2,N)。"""
    n_ch, _ = stereo.shape
    data = stereo.T.astype("<f4").tobytes()
    with open(path, "wb") as f:
        f.write(b"RIFF"); f.write(struct.pack("<I", 36 + len(data))); f.write(b"WAVE")
        f.write(b"fmt "); f.write(struct.pack("<IHHIIHH", 16, 3, n_ch, SR, SR * n_ch * 4, n_ch * 4, 32))
        f.write(b"data"); f.write(struct.pack("<I", len(data))); f.write(data)


def trim_and_norm(stereo: np.ndarray, tail_db=-60.0, max_s=1.5):
    peak = float(np.max(np.abs(stereo))) or 1.0
    stereo = stereo / peak * 0.9
    env = np.max(np.abs(stereo), axis=0)
    thr = 10 ** (tail_db / 20.0) * 0.9
    above = np.where(env > thr)[0]
    end = (above[-1] + 1) if len(above) else stereo.shape[1]
    end = min(end, int(max_s * SR), stereo.shape[1])
    return stereo[:, :end]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--data", required=True, help="MeshRIR 資料所在資料夾（含 .zip 或已解壓資料夾）")
    ap.add_argument("--out", default=str(Path(__file__).with_name("room.wav")))
    ap.add_argument("--work", default=None, help="解壓工作區（預設 <data>/_meshrir_work）")
    args = ap.parse_args()

    data = Path(args.data).expanduser().resolve()
    out = Path(args.out).expanduser().resolve()
    work = Path(args.work).expanduser().resolve() if args.work else (data / "_meshrir_work")
    if not data.exists():
        sys.exit(f"找不到資料夾：{data}")

    print(f"[1/4] 掃描 {data} 內的 MeshRIR 資料集…")
    sessions = find_sessions(data)
    if not sessions:
        print("  沒有現成資料夾，改從 .zip 解壓…")
        extract_zips(data, work)
        sessions = find_sessions(work)
    if not sessions:
        sys.exit("找不到含 pos_mic + ir_* 的 MeshRIR 資料夾。"
                 "\n若下載尚未完成（仍有 .crdownload），請等下載結束後再跑。")

    chosen = None
    for s in sessions:
        try:
            n_src = _load_arr(next(p for p in (s/'pos_src.npy', s/'pos_src.mat') if p.exists())).shape[0]
        except Exception:
            continue
        if n_src == 1:
            chosen = s; break
    chosen = chosen or sessions[0]
    print(f"[2/4] 使用資料夾：{chosen}")

    pos_mic = _load_arr(next(p for p in (chosen/'pos_mic.npy', chosen/'pos_mic.mat') if p.exists()))
    li, ri = pick_lr(pos_mic)

    print("[3/4] 只載左右兩顆麥克風的 IR、正規化、裁尾…")
    src_idx = 0
    L = _load_arr(session_ir_path(chosen, li))[src_idx].astype(np.float64)
    R = _load_arr(session_ir_path(chosen, ri))[src_idx].astype(np.float64)
    stereo = trim_and_norm(np.stack([L, R]))
    print(f"  irLen={L.shape[0]} → 輸出 {stereo.shape[1]} samples（{stereo.shape[1]/SR:.3f}s）")

    out.parent.mkdir(parents=True, exist_ok=True)
    write_wav_float32(out, stereo)
    print(f"[4/4] 已寫入 {out}（48 kHz, 32-bit float, stereo）")
    print("完成。web/index.html 啟動時會自動載入這個 room.wav。")


if __name__ == "__main__":
    main()
