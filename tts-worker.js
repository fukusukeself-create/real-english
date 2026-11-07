/* スマホの中でAI音声（Kokoro）を作るワーカー。モデルは初回だけ Hugging Face から読み込み、ブラウザに保存される */
import { KokoroTTS } from "./kokoro.web.js";
let tts = null, loading = null, chain = Promise.resolve();
function load(){
  if (tts) return Promise.resolve(tts);
  if (!loading) loading = (async () => {
    const files = {};
    tts = await KokoroTTS.from_pretrained("onnx-community/Kokoro-82M-v1.0-ONNX", {
      dtype: "q8", device: "wasm",
      progress_callback: p => {
        if (p && p.status === "progress" && p.file) {
          files[p.file] = { loaded: p.loaded || 0, total: p.total || 0 };
          let l = 0, t = 0; for (const k in files) { l += files[k].loaded; t += files[k].total; }
          postMessage({ type: "progress", loaded: l, total: t });
        }
      }
    });
    postMessage({ type: "ready" });
    return tts;
  })().catch(e => { loading = null; postMessage({ type: "error", message: String((e && e.message) || e) }); throw e; });
  return loading;
}
async function gen(m){
  const t0 = Date.now();
  try {
    const t = await load();
    const audio = await t.generate(m.text, { voice: m.voice || "af_heart", speed: m.speed || 1 });
    const buf = await audio.toBlob().arrayBuffer();
    postMessage({ type: "audio", id: m.id, buf, ms: Date.now() - t0 }, [buf]);
  } catch (err) {
    postMessage({ type: "genError", id: m.id, message: String((err && err.message) || err) });
  }
}
self.onmessage = e => {
  const m = e.data || {};
  if (m.type === "load") { load().catch(() => {}); return; }
  /* 1文ずつ順番に作る（同時に作ると失敗することがあるため） */
  if (m.type === "gen") { chain = chain.then(() => gen(m)); }
};
