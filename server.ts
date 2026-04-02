import express from "express";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;

app.use(express.json({ limit: "1mb" }));

app.post("/api/chat", async (req, res) => {
  const { message } = req.body as { message: string };

  if (!message) {
    return res.status(400).json({ error: "message is required" });
  }

  const apiUrl = process.env.ENNOIA_API_URL;
  const project = process.env.ENNOIA_PROJECT;
  const apiKey = process.env.ENNOIA_API_KEY;
  const hash = process.env.ENNOIA_HASH;

  if (!apiUrl || !project || !apiKey || !hash) {
    return res.status(500).json({ error: "Missing Ennoia API configuration" });
  }

  const payload = JSON.stringify({
    hash,
    params: { user_message: message },
  });

  console.log(`[api/chat] Sending ${payload.length} bytes to Ennoia`);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        project,
        apiKey,
      },
      body: payload,
    });

    console.log(`[api/chat] Ennoia responded: ${response.status}`);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[api/chat] Ennoia error ${response.status}:`, errorText.slice(0, 500));
      return res
        .status(response.status)
        .json({ error: `Ennoia API error (${response.status})`, detail: errorText.slice(0, 500) });
    }

    const raw = await response.text();
    console.log(`[api/chat] Response body: ${raw.length} chars`);

    if (!raw.trim()) {
      console.error("[api/chat] Empty response body from Ennoia");
      return res.status(502).json({ error: "Ennoia API returned empty response" });
    }

    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      console.error("[api/chat] Invalid JSON from Ennoia:", raw.slice(0, 300));
      return res.status(502).json({ error: "Ennoia API returned invalid JSON" });
    }

    const text = data.choices?.[0]?.message?.content?.[0]?.text ?? "";

    if (!text) {
      console.warn("[api/chat] No text in response. Keys:", Object.keys(data));
    }

    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("[api/chat] Unexpected error:", error.message);
    return res
      .status(500)
      .json({ error: "Internal server error", detail: error.message });
  }
});

app.listen(PORT, () => {
  console.log(`[server] API proxy running on http://localhost:${PORT}`);
});
