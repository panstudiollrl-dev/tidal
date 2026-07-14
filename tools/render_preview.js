// render_preview.js — 無頭渲染 web/index.html 的 canvas 海面成 PNG，讓 AI/人能「真的看到」視覺再改。
// 背景：純盲改視覺失敗多次（Pan 三次不滿意配色）。用 @napi-rs/canvas（免編譯）跑真正的 drawSea()，
// 存成 PNG 就能用眼睛校準顏色/漣漪/相位色/beat 明滅。注意：中央曼陀羅是 DOM 元素，不在這裡的 canvas 內。
//
// 用法：
//   npm i @napi-rs/canvas            # 在任意可寫資料夾，例如 /tmp
//   node tools/render_preview.js     # 從 Tidal/ 執行；輸出到 ./preview/*.png
//
// 若 require 路徑不對，改成你安裝 @napi-rs/canvas 的位置。

const path = require("path");
const fs = require("fs");
let createCanvas;
try { ({ createCanvas } = require("@napi-rs/canvas")); }
catch { ({ createCanvas } = require("/tmp/node_modules/@napi-rs/canvas")); }

const html = fs.readFileSync(path.join(__dirname, "..", "web", "index.html"), "utf8");
const src = html.match(/<script[^>]*>([\s\S]*?)<\/script>/)[1];
const code = src.slice(src.indexOf("let __seaScroll"), src.indexOf("\ndrawSea();"));

const clamp = (v, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, v));
let CANVAS = createCanvas(1000, 640);
global.innerWidth = 1000; global.innerHeight = 640;
global.window = { devicePixelRatio: 1 };
global.requestAnimationFrame = () => {};
global.$ = () => CANVAS;
let CLOCK = 0;
global.performance = { now: () => CLOCK };
const state = { grip: { 1: 0, 2: 0 }, handMap: { left: 1, right: 2 }, azimuth: 0, phase: "idle", lastImpactAt: -1e9,
  guided: { heartWeather: 0.45, phase: 0.5, pan: 0, preset: "", phaseName: "" } };
let engine = { tide: 0.4, azimuth: 0, metrics: { swell: 0.5, foam: 0, rw: 0 } };
global.state = state; global.engine = engine;
eval(code + "\n; global.__drawSea = drawSea;");

const outDir = path.join(__dirname, "..", "preview");
fs.mkdirSync(outDir, { recursive: true });
function render(name, setup, beatRGB) {
  setup();
  for (let f = 0; f < 40; f++) { CLOCK += 0.05; global.__drawSea(); }
  if (beatRGB && typeof beatPulse === "function") { beatPulse(beatRGB); CLOCK += 0.05; global.__drawSea(); }
  fs.writeFileSync(path.join(outDir, name + ".png"), CANVAS.toBuffer("image/png"));
  console.log("rendered", name);
}

render("idle", () => { state.phase = "idle"; engine.tide = 0.15; engine.metrics.swell = 0.5; });
render("session_resonance", () => { state.phase = "session"; state.guided.preset = "resonance"; state.guided.phase = 0.8; engine.tide = 0.5; engine.metrics.swell = 0.7; state.grip[1] = 0.5; });
render("h478_inhale", () => { state.phase = "session"; state.guided.preset = "hold478"; state.guided.phaseName = "inhale"; state.guided.phase = 0.7; engine.tide = 0.4; engine.metrics.swell = 0.65; }, [78, 206, 178]);
render("h478_hold", () => { state.phase = "session"; state.guided.preset = "hold478"; state.guided.phaseName = "hold"; state.guided.phase = 0.76; engine.metrics.swell = 0.6; });
render("h478_exhale", () => { state.phase = "session"; state.guided.preset = "hold478"; state.guided.phaseName = "exhale"; state.guided.phase = 0.3; engine.metrics.swell = 0.55; });
console.log("done → preview/");
