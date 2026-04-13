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
  // 1차: 프로젝트 루트 (같은 디렉토리)
  const local = path.resolve(__dirname, filename);
  if (fs.existsSync(local)) return local;
  // 2차: 상위 디렉토리 (레거시 호환)
  const parent = path.resolve(__dirname, "..", filename);
  if (fs.existsSync(parent)) return parent;
  // 3차: cwd (Vercel 배포)
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
      messages: messages.map((m, i) => {
        const role = m.role === "assistant" ? "assistant" as const : "user" as const;
        if (i === messages.length - 2 && messages.length >= 2) {
          return {
            role,
            content: [{ type: "text" as const, text: m.content, cache_control: { type: "ephemeral" as const } }],
          };
        }
        return { role, content: m.content };
      }),
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    const u = response.usage as any;
    console.log(`[api/chat] Response: ${text.length} chars | input: ${u?.input_tokens} (cached: ${u?.cache_read_input_tokens ?? 0}) output: ${u?.output_tokens}`);
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
      // 마지막 메시지 직전까지 캐싱 — 이전 대화 이력을 캐시하여 input 비용 절감
      messages: messages.map((m, i) => {
        const role = m.role === "assistant" ? "assistant" as const : "user" as const;
        // 마지막에서 2번째 메시지에 cache breakpoint 설정
        // → 시스템 프롬프트 + 이전 대화 이력이 캐시됨, 새 메시지만 정가
        if (i === messages.length - 2 && messages.length >= 2) {
          return {
            role,
            content: [{ type: "text" as const, text: m.content, cache_control: { type: "ephemeral" as const } }],
          };
        }
        return { role, content: m.content };
      }),
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
      const u = stream.currentMessageSnapshot?.usage as any;
      console.log("[api/chat/stream] Stream completed");
      console.log(`[api/chat/stream] input: ${u?.input_tokens} (cached: ${u?.cache_read_input_tokens ?? 0}) output: ${u?.output_tokens}`);
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

// ── 에러 수정 전용 엔드포인트 ──

const FIX_ERRORS_SYSTEM_PROMPT = `당신은 HTML 프로토타입의 JavaScript 런타임 에러를 수정하는 전문가입니다.

## 규칙

1. 제공된 에러 분석을 읽고 **원인 코드만 최소한으로 수정**합니다.
2. 수정은 반드시 <prototype_delta> 형식으로 출력합니다:
   <prototype_delta>
   <search>기존 코드 (현재 HTML 원문 그대로)</search>
   <replace>수정된 코드</replace>
   </prototype_delta>
3. **절대 금지:**
   - 기존 기능, UI 요소, 입력 필드, 버튼을 제거하는 것
   - 에러와 무관한 코드를 변경하는 것
   - 전체 HTML을 다시 출력하는 것
   - CSS나 디자인을 변경하는 것
4. <search> 안의 텍스트는 [현재 Prototype HTML]에 **정확히 존재하는 원문**이어야 합니다.
5. 대화 텍스트는 최소한으로. 수정 내용만 간결하게 설명합니다.

## 흔한 에러 패턴

- "X is not defined" (인라인 onclick에서) → onclick="X()"를 onclick="인스턴스.X()"로 수정하거나, 전역 함수로 래핑
- "Cannot read properties of null" → DOM 로드 시점 문제. DOMContentLoaded 안으로 이동
- "X is not a function" → 함수 정의 스코프 확인 후 호출 방식 수정
- localStorage SecurityError (sandbox) → try-catch로 감싸기`;

app.post("/api/chat/fix-errors", async (req, res) => {
  const { html, errors } = req.body as { html: string; errors: string };

  if (!html || !errors) {
    return res.status(400).json({ error: "html and errors are required" });
  }

  // SSE 스트리밍
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  let fullResponse = "";

  try {
    const stream = anthropic.messages.stream({
      model: MODEL,
      max_tokens: 8192,
      system: [{ type: "text", text: FIX_ERRORS_SYSTEM_PROMPT }],
      messages: [
        {
          role: "user",
          content: `[현재 Prototype HTML]\n${html}\n\n${errors}\n\n위 에러를 수정해주세요.`,
        },
      ],
    });

    stream.on("text", (text) => {
      fullResponse += text;
      res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
    });

    stream.on("error", (error) => {
      console.error("[api/chat/fix-errors] Stream error:", error.message);
      res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    });

    stream.on("end", () => {
      console.log(`[api/chat/fix-errors] 완료: ${fullResponse.length}자`);
      res.write("data: [DONE]\n\n");
      res.end();
    });
  } catch (error: any) {
    console.error("[api/chat/fix-errors] Error:", error.message);
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

  const startMs = Date.now();
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
    const elapsedMs = Date.now() - startMs;

    if (!morphRes.ok) {
      const errText = await morphRes.text();
      console.error(`[api/morph] API error ${morphRes.status} (${elapsedMs}ms):`, errText.slice(0, 200));
      return res.status(502).json({ error: `Morph API error: ${morphRes.status}` });
    }

    const data = (await morphRes.json()) as {
      choices?: { message?: { content?: string } }[];
    };
    const rawHtml = data.choices?.[0]?.message?.content?.trim();

    if (!rawHtml) {
      console.error(`[api/morph] Empty response (${elapsedMs}ms)`);
      return res.status(502).json({ error: "Empty Morph response" });
    }

    const sizeRatio = rawHtml.length / original.length;
    console.log(`[api/morph] OK: ${original.length} → ${rawHtml.length} chars (${sizeRatio.toFixed(1)}x, ${elapsedMs}ms)`);

    return res.json({ html: rawHtml });
  } catch (error: any) {
    const elapsedMs = Date.now() - startMs;
    const isTimeout = error.name === "AbortError" || error.message?.includes("aborted");
    console.error(`[api/morph] ${isTimeout ? "TIMEOUT" : "ERROR"} (${elapsedMs}ms):`, error.message);
    return res.status(isTimeout ? 504 : 500).json({ error: error.message });
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
