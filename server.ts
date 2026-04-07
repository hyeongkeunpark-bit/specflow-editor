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

// ── SSE 스트리밍 엔드포인트 ──

app.post("/api/chat/stream", async (req, res) => {
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

  // SSE 응답 헤더
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const payload = JSON.stringify({
    hash,
    stream: true,
    params: { user_message: message },
  });

  console.log(`[api/chat/stream] Sending ${payload.length} bytes to Ennoia (streaming)`);

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json; charset=utf-8",
        "Accept": "text/event-stream",
        project,
        apiKey,
      },
      body: payload,
    });

    if (!response.ok) {
      console.error(`[api/chat/stream] Ennoia error: ${response.status}`);
      res.write(`data: ${JSON.stringify({ error: `Ennoia API error (${response.status})` })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
      return;
    }

    const reader = (response.body as any).getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullResponse = ""; // 디버그: 전체 응답 누적

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE 이벤트 분리 (double newline)
      const events = buffer.split("\n\n");
      buffer = events.pop() || "";

      for (const event of events) {
        if (!event.trim()) continue;
        const lines = event.trim().split("\n");
        let eventType = "";
        let data = "";
        for (const line of lines) {
          if (line.startsWith("event:")) eventType = line.slice(6).trim();
          else if (line.startsWith("data:")) data = line.slice(5).trim();
        }

        if (eventType === "delta" && data) {
          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              res.write(`data: ${JSON.stringify({ content })}\n\n`);
            }
          } catch {}
        }
      }
    }

    // 버퍼에 남은 이벤트 처리
    if (buffer.trim()) {
      const lines = buffer.trim().split("\n");
      let eventType = "";
      let data = "";
      for (const line of lines) {
        if (line.startsWith("event:")) eventType = line.slice(6).trim();
        else if (line.startsWith("data:")) data = line.slice(5).trim();
      }
      if (eventType === "delta" && data) {
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) {
            res.write(`data: ${JSON.stringify({ content })}\n\n`);
          }
        } catch {}
      }
    }

    console.log("[api/chat/stream] Stream completed");
    console.log("[api/chat/stream] === 응답 원문 (처음 500자) ===");
    console.log(fullResponse.slice(0, 500));
    console.log("전체 길이:", fullResponse.length, "자");
    res.write("data: [DONE]\n\n");
    res.end();
  } catch (error: any) {
    console.error("[api/chat/stream] Error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`[server] API proxy running on http://localhost:${PORT}`);
});
