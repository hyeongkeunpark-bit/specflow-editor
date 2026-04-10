import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-20250514";

app.use(express.json({ limit: "2mb" }));

// ── Claude API 클라이언트 ──
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── 시스템 프롬프트 + 지식 파일 로드 ──
function resolveFile(filename: string): string {
  // 1차: 로컬 개발 (specflow-editor/ 상위에 파일 존재)
  const local = path.resolve(__dirname, "..", filename);
  if (fs.existsSync(local)) return local;
  // 2차: Vercel 배포 (프로젝트 루트에 복사됨)
  const cwd = path.resolve(process.cwd(), filename);
  if (fs.existsSync(cwd)) return cwd;
  return local; // 기본값
}

function loadSystemPrompt(): string {
  const promptPath = resolveFile("prompt-v4-prototype-first.md");
  const knowledgePath = resolveFile("product-spec-v2-template.txt");

  let prompt = "";
  try {
    prompt = fs.readFileSync(promptPath, "utf-8");
  } catch (err) {
    console.warn("[server] 시스템 프롬프트 로드 실패:", (err as Error).message);
    prompt = "당신은 Product Spec 작성과 Prototype 생성을 돕는 AI 에이전트입니다.";
  }

  try {
    const knowledge = fs.readFileSync(knowledgePath, "utf-8");
    prompt += "\n\n---\n\n# Knowledge: Product Spec 템플릿\n\n" + knowledge;
  } catch (err) {
    console.warn("[server] 지식 파일 로드 실패:", (err as Error).message);
  }

  console.log(`[server] 시스템 프롬프트 로드 완료: ${prompt.length}자`);
  return prompt;
}

// ── Ennoia API (레거시, 유지) ──

app.post("/api/chat", async (req, res) => {
  const { messages } = req.body as { messages: { role: string; content: string }[] };

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: "messages is required" });
  }

  const systemPrompt = loadSystemPrompt();

  try {
    const response = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 16384,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    console.log(`[api/chat] Response: ${text.length} chars`);
    return res.status(200).json({ text });
  } catch (error: any) {
    console.error("[api/chat] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// ── SSE 스트리밍 엔드포인트 ──

app.post("/api/chat/stream", async (req, res) => {
  const { messages } = req.body as {
    messages: { role: string; content: string }[];
  };

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: "messages is required" });
  }

  // SSE 응답 헤더
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const systemPrompt = loadSystemPrompt();
  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 16384,
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: messages.map((m) => ({
        role: m.role === "assistant" ? "assistant" : "user",
        content: m.content,
      })),
    });

    stream.on("text", (text) => {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    });

    stream.on("error", (error) => {
      console.error("[api/chat/stream] Stream error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("end", () => {
      console.log("[api/chat/stream] Stream completed");
      console.log("[api/chat/stream] === 응답 원문 (처음 500자) ===");
      console.log(fullResponse.slice(0, 500));
      console.log("전체 길이:", fullResponse.length, "자");
      res.write("data: [DONE]\n\n");
      res.end();
    });
  } catch (error: any) {
    console.error("[api/chat/stream] Error:", error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ── Morph Fast Apply 엔드포인트 ──

app.post("/api/morph/apply", async (req, res) => {
  const { original, edit } = req.body as { original: string; edit: string };

  if (!original || !edit) {
    return res.status(400).json({ error: "original and edit are required" });
  }

  const morphApiKey = process.env.MORPH_API_KEY;
  if (!morphApiKey) {
    console.warn("[api/morph] MORPH_API_KEY not configured");
    return res.status(501).json({ error: "MORPH_API_KEY not configured" });
  }

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000); // 12초 타임아웃

    const morphRes = await fetch("https://api.morphllm.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${morphApiKey}`,
      },
      body: JSON.stringify({
        model: "morph-v3-fast",
        messages: [
          {
            role: "user",
            content: `<code>\n${original}\n</code>\n<update>\n${edit}\n</update>`,
          },
        ],
      }),
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (!morphRes.ok) {
      const errText = await morphRes.text();
      console.error("[api/morph] Morph API error:", morphRes.status, errText.slice(0, 200));
      return res.status(502).json({ error: `Morph API error: ${morphRes.status}` });
    }

    const data = (await morphRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const rawHtml = data.choices?.[0]?.message?.content?.trim();

    if (!rawHtml) {
      console.error("[api/morph] Empty Morph response");
      return res.status(502).json({ error: "Empty Morph response" });
    }

    const sizeRatio = rawHtml.length / original.length;
    console.log(`[api/morph] Morph applied: ${original.length} → ${rawHtml.length} chars (${sizeRatio.toFixed(1)}x)`);

    return res.json({ html: rawHtml });
  } catch (error: any) {
    console.error("[api/morph] Error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Vercel 환경에서는 listen하지 않음 (serverless function으로 동작)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[server] API proxy running on http://localhost:${PORT}`);
    console.log(`[server] Model: ${MODEL}`);
  });
}

export default app;
