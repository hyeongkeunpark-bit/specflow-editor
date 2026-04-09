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

app.use(express.json({ limit: "1mb" }));

// ── Claude API 클라이언트 ──
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── 시스템 프롬프트 + 지식 파일 로드 ──
function loadSystemPrompt(): string {
  const promptPath = path.resolve(__dirname, "../prompt-v4-prototype-first.md");
  const knowledgePath = path.resolve(__dirname, "../product-spec-v2-template.txt");

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
      system: systemPrompt,
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
      system: systemPrompt,
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
      res.write(
        `data: ${JSON.stringify({ error: error.message })}\n\n`,
      );
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

app.listen(PORT, () => {
  console.log(`[server] API proxy running on http://localhost:${PORT}`);
  console.log(`[server] Model: ${MODEL}`);
});
