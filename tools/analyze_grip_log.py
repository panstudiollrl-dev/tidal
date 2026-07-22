#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
分析 Tidal 握力球操作 log（頁面按 L 下載的 tidal_grip_operation_log.json）。

用法：
    python3 tools/analyze_grip_log.py path/to/tidal_grip_operation_log.json [輸出資料夾]

輸出：
    grip_log_report.png  每顆球 smRaw/baseline、delta(握=正)、span、level 時序圖（含 phase 底色與 478 拍記號）
    stdout               自動判讀：極性、sign 是否正確、span 是否崩/太小/太大、殘壓是否高於 4-7-8 門檻、
                         report 頻率、478 拍間距——對應「該調哪個常數」的建議。

判讀原則來自 GRIPBALL_PROTOCOL.md / FIX_BRIEF：不要憑感覺調常數，先看數據。
"""
import json, sys, os

MANUAL_478_ON, MANUAL_478_OFF = 0.20, 0.09   # 與 web/index.html 對齊；改了那邊記得同步
ARRIVAL_PRESS_OFF = 0.16

def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(1)
    path = sys.argv[1]
    outdir = sys.argv[2] if len(sys.argv) > 2 else os.path.dirname(os.path.abspath(path)) or "."
    with open(path, "r", encoding="utf-8") as f:
        text = f.read().strip()
    if text.startswith("["):
        entries = json.loads(text)
    else:  # NDJSON（自動寫檔格式，一行一筆）；容忍壞行/NUL（雲端資料夾寫入 race 可能留垃圾）
        entries = []
        for ln in text.splitlines():
            ln = ln.strip("\x00 \t\r")
            if not ln:
                continue
            try:
                entries.append(json.loads(ln))
            except json.JSONDecodeError:
                pass
    if not isinstance(entries, list) or not entries:
        print("log 是空的或格式不對"); sys.exit(1)

    reports = [e for e in entries if e.get("event") == "report"]
    print(f"共 {len(entries)} 筆，其中 report {len(reports)} 筆；"
          f"時間跨度 {(entries[-1]['tMs']-entries[0]['tMs'])/1000:.1f}s")

    balls = {}
    for slot in (1, 2):
        rows = []
        for e in reports:
            if e.get("slot") != slot:
                continue
            b = e.get(f"ball{slot}") or {}
            rows.append({
                "t": e["tMs"] / 1000.0,
                "raw": e.get("raw"),
                "smRaw": b.get("smRaw"), "baseline": b.get("baseline"),
                "delta": b.get("delta"), "sign": b.get("sign"),
                "signLocked": b.get("signLocked"), "span": b.get("span"),
                "lockedSpan": b.get("lockedSpan"), "level": b.get("level"),
                "phase": e.get("phase"), "step": e.get("step"),
                "cueOn": e.get("handCueOn"),
            })
        if rows:
            balls[slot] = rows

    presses = [e for e in entries if e.get("event") == "478:press"]
    locked_ev = [e for e in entries if e.get("event") == "handCue:locked"]

    print()
    for slot, rows in balls.items():
        n = len(rows)
        dur = rows[-1]["t"] - rows[0]["t"] if n > 1 else 0
        hz = n / dur if dur > 0 else 0
        print(f"── Ball {slot}：{n} 筆 report，約 {hz:.0f} Hz ──")

        raws = [r["raw"] for r in rows if r["raw"] is not None]
        if raws:
            print(f"  raw 範圍 {min(raws)}–{max(raws)}（幅寬 {max(raws)-min(raws)}）")

        # 極性：高 level 段的 smRaw-baseline 原始方向（只看「鎖定後」的樣本——校正期間水位是 |dev|、方向未定，混入會誤報反向）
        lock_t = 0
        for e in entries:
            if e.get("event") == "handCue:locked":
                lock_t = e["tMs"]
        rows_locked = [r for r in rows if r["t"] * 1000 >= lock_t] if lock_t else rows
        press_rows = [r for r in rows_locked if (r["level"] or 0) > 0.35 and r["smRaw"] and r["baseline"]]
        rest_rows = [r for r in rows_locked if (r["level"] or 0) < 0.03 and r["smRaw"] and r["baseline"]]
        if press_rows and rest_rows:
            raw_dir = sum((r["smRaw"] - r["baseline"]) for r in press_rows) / len(press_rows)
            signs = {r["sign"] for r in rows if r.get("signLocked")}
            inferred = 1 if raw_dir >= 0 else -1
            print(f"  極性：高水位時 smRaw-baseline 平均 {raw_dir:+.0f} → 這顆球是 {'上升型(+1)' if inferred==1 else '下降型(-1)'}")
            if signs and inferred not in signs:
                print(f"  ⚠ 鎖定的 sign={signs} 與實際方向不符 → 這就是水位倒反的原因；檢查校正時是否有完整三握")
        else:
            print("  （沒有足夠的高/低水位樣本可判極性——可能這顆球從未有明顯反應）")

        spans = [r["span"] for r in rows if r["span"]]
        lspans = [r["lockedSpan"] for r in rows if r.get("lockedSpan")]
        if spans:
            print(f"  span：min {min(spans)} / max {max(spans)}" + (f"，lockedSpan {lspans[-1]}" if lspans else "（無 lockedSpan＝舊版程式）"))
            if lspans and min(spans[len(spans)//2:]) < 0.8 * lspans[-1]:
                print("  ⚠ 後半段 span 掉到 lockedSpan 八成以下 → span 衰減又在崩（不應發生於新版）")
            if not lspans and min(spans) < 300:
                print("  ⚠ span 崩到 300 以下 → 這版程式沒有 lockedSpan 下限＝「越玩越敏感」的主因")

        # 殘壓：非握壓期間 level 是否降得回 478 OFF 門檻以下
        sess = [r for r in rows if r["phase"] == "session"]
        if sess:
            import statistics
            lows = sorted((r["level"] or 0) for r in sess)
            floor = lows[int(len(lows) * 0.1)] if lows else 0
            print(f"  session 中 level 第 10 百分位 {floor:.3f}（4-7-8 OFF 門檻 {MANUAL_478_OFF}）")
            if floor > MANUAL_478_OFF:
                print("  ⚠ 放鬆時 level 降不回 OFF 門檻 → 舊 level 路徑會卡拍；新版 edge 路徑應可繞過——若仍卡，看 edgeFloor 是否有跟上")

    # ── 球體品質判定（哪顆球該換）────────────────────────
    print()
    print("── 球體品質 ──")
    hand_of = {}
    if locked_ev:
        e = locked_ev[-1]
        hand_of = {e.get("leftSlot"): "左手", e.get("rightSlot"): "右手"}
    import statistics
    for slot, rows in balls.items():
        lock_t = locked_ev[-1]["tMs"] if locked_ev else 0
        post = [r for r in rows if r["t"] * 1000 >= lock_t]
        rest_deltas = [abs(r["delta"] or 0) for r in post if (r["level"] or 0) < 0.03 and r["delta"] is not None]
        noise = statistics.pstdev(rest_deltas) if len(rest_deltas) > 30 else None
        amp = None
        for r in reversed(rows):
            if r.get("lockedSpan"):
                amp = r["lockedSpan"] / 0.75   # 還原成峰值中位數
                break
        hand = hand_of.get(slot, "?")
        if noise is not None and amp:
            snr = amp / max(noise, 1)
            verdict = "OK" if snr > 8 else ("勉強" if snr > 4 else "差——建議換掉這顆")
            print(f"  Ball{slot}（{hand}）：握壓幅度 ~{amp:.0f} raw，靜止雜訊 σ≈{noise:.0f} → 訊噪比 {snr:.1f} ⇒ {verdict}")
        else:
            print(f"  Ball{slot}（{hand}）：樣本不足，無法判定")

    print()
    if locked_ev:
        e = locked_ev[-1]
        print(f"校正鎖定：left=Ball{e.get('leftSlot')} right=Ball{e.get('rightSlot')}")
    else:
        print("⚠ log 裡沒有 handCue:locked → 校正從未完成，sign/span 都沒鎖定（一切判讀失準的首要原因）")
    if presses:
        gaps = [(b["tMs"] - a["tMs"]) / 1000 for a, b in zip(presses, presses[1:])]
        print(f"4-7-8 記到 {len(presses)} 拍" + (f"，拍距中位數 {sorted(gaps)[len(gaps)//2]:.2f}s（來源 {set(p.get('source') for p in presses)}）" if gaps else ""))
    else:
        print("log 裡沒有 478:press 事件（可能還沒進 4-7-8，或是舊版程式）")

    # 畫圖
    try:
        import matplotlib
        matplotlib.use("Agg")
        import matplotlib.pyplot as plt
        from matplotlib import font_manager
        for cand in ["Noto Sans CJK TC", "Noto Sans CJK SC", "PingFang TC", "Heiti TC", "WenQuanYi Zen Hei"]:
            if any(cand in f.name for f in font_manager.fontManager.ttflist):
                plt.rcParams["font.family"] = cand; break
    except ImportError:
        print("\n（沒裝 matplotlib，略過畫圖：pip install matplotlib --break-system-packages）"); return

    nb = len(balls)
    fig, axes = plt.subplots(3 * nb, 1, figsize=(14, 4.2 * 3 * nb // 2), sharex=True, squeeze=False)
    axes = axes[:, 0]
    t0 = entries[0]["tMs"] / 1000.0
    press_ts = [(p["tMs"] / 1000.0 - t0) for p in presses]
    for i, (slot, rows) in enumerate(balls.items()):
        ts = [r["t"] - t0 for r in rows]
        ax = axes[3 * i]
        ax.plot(ts, [r["smRaw"] for r in rows], lw=0.7, label="smRaw")
        ax.plot(ts, [r["baseline"] for r in rows], lw=0.7, label="baseline")
        ax.set_ylabel(f"Ball{slot} raw"); ax.legend(loc="upper right", fontsize=8)
        ax = axes[3 * i + 1]
        ax.plot(ts, [r["delta"] for r in rows], lw=0.7, color="tab:purple", label="delta(握=正)")
        ax.plot(ts, [r["span"] for r in rows], lw=0.7, color="tab:orange", label="span")
        ax.axhline(0, color="gray", lw=0.5); ax.set_ylabel("delta/span"); ax.legend(loc="upper right", fontsize=8)
        ax = axes[3 * i + 2]
        ax.plot(ts, [r["level"] for r in rows], lw=0.8, color="tab:blue", label="level")
        ax.axhline(MANUAL_478_ON, color="green", lw=0.5, ls="--", label="478 ON")
        ax.axhline(MANUAL_478_OFF, color="red", lw=0.5, ls="--", label="478 OFF")
        for pt in press_ts:
            ax.axvline(pt, color="green", lw=0.4, alpha=0.4)
        ax.set_ylim(-0.02, 1.02); ax.set_ylabel("level"); ax.legend(loc="upper right", fontsize=8)
    axes[-1].set_xlabel("秒")
    out = os.path.join(outdir, "grip_log_report.png")
    fig.tight_layout(); fig.savefig(out, dpi=110)
    print(f"\n圖已存：{out}")

if __name__ == "__main__":
    main()
