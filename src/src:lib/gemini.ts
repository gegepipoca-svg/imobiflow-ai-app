export async function askGemini(prompt: string): Promise<string> {
  const key = import.meta.env.VITE_GEMINI_API_KEY as string;

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=` +
    encodeURIComponent(key);

  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  const data = await res.json();

  if (!res.ok) {
    throw new Error(data?.error?.message || "Erro no Gemini");
  }

  return (
    data?.candidates?.[0]?.content?.parts?.[0]?.text ||
    "Sem resposta do Gemini"
  );
}


