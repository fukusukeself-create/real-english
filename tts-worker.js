/* スマホの中でAI音声（Kokoro）を作るワーカー。モデルは初回だけ Hugging Face から読み込み、ブラウザに保存される */
import { KokoroTTS } from "./kokoro.web.js";
let tts = null, loading = null;
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
self.onmessage = async e => {
  const m = e.data || {};
  if (m.type === "load") { try { await load(); } catch (_) {} return; }
  if (m.type === "gen") {
    try {
      const t = await load();
      const audio = await t.generate(m.text, { voice: m.voice || "af_heart", speed: m.speed || 1 });
      const buf = await audio.toBlob().arrayBuffer();
      postMessage({ type: "audio", id: m.id, buf }, [buf]);
    } catch (err) {
      postMessage({ type: "genError", id: m.id, message: String((err && err.message) || err) });
    }
  }
};
