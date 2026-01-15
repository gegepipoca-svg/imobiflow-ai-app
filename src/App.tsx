import { useState } from "react";
import { askGemini } from "./lib/gemini";

export default function App() {
  const [prompt, setPrompt] = useState("Responda: Gemini online 🚀");
  const [answer, setAnswer] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState("");

  async function onAsk() {
    setLoading(true);
    setErr("");
    setAnswer("");
    try {
      const out = await askGemini(prompt);
      setAnswer(out);
    } catch (e: any) {
      setErr(e?.message || "Erro");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ padding: 24, fontFamily: "Arial" }}>
      <h1>ImobiFlow AI 🚀</h1>

      <textarea
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        rows={4}
        style={{ width: "100%", padding: 12, borderRadius: 8 }}
      />

      <div style={{ marginTop: 12 }}>
        <button onClick={onAsk} disabled={loading}>
          {loading ? "Consultando..." : "Testar Gemini"}
        </button>
      </div>

      {err && <p style={{ color: "red" }}>{err}</p>}

      {answer && (
        <pre style={{ marginTop: 12, background: "#f4f4f4", padding: 12 }}>
          {answer}
        </pre>
      )}
    </div>
  );
}
