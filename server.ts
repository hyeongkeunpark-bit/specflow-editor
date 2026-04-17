import express from "express";
import Anthropic from "@anthropic-ai/sdk";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config();

const app = express();
const PORT = process.env.SERVER_PORT || 3001;
const DEFAULT_MODEL = process.env.CLAUDE_MODEL || "claude-sonnet-4-6";
const ALLOWED_MODELS = new Set(["claude-sonnet-4-6", "claude-opus-4-6"]);

app.use(express.json({ limit: "5mb" }));

// ── Claude API 클라이언트 ──
const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ── 시스템 프롬프트 + 지식 파일 로드 ──
// 리터럴 경로로 읽어야 @vercel/nft가 파일을 번들에 포함함
function readFileWithLiteralPath(filename: string): string {
  // nft가 추적 가능한 리터럴 매핑
  const fileMap: Record<string, string> = {
    "prompt-v4-prototype-first.md": path.join(__dirname, "prompt-v4-prototype-first.md"),
    "product-spec-v2-template.txt": path.join(__dirname, "product-spec-v2-template.txt"),
    "wds-design-guide.md": path.join(__dirname, "wds-design-guide.md"),
    "wanted-db-knowledge.md": path.join(__dirname, "wanted-db-knowledge.md"),
  };
  const filePath = fileMap[filename];
  if (!filePath) throw new Error(`알 수 없는 파일: ${filename}`);
  return fs.readFileSync(filePath, "utf-8");
}

// nft 정적 분석 힌트 — 이 줄이 있어야 Vercel이 파일을 번들에 포함
path.join(__dirname, "prompt-v4-prototype-first.md");
path.join(__dirname, "product-spec-v2-template.txt");
path.join(__dirname, "wds-design-guide.md");
path.join(__dirname, "wanted-db-knowledge.md");

function loadSystemPrompt(wdsEnabled: boolean = false): string {
  let prompt = "";
  try {
    prompt = readFileWithLiteralPath("prompt-v4-prototype-first.md");
  } catch (err) {
    console.error("[server] ❌ 시스템 프롬프트 로드 실패:", (err as Error).message);
    prompt = "당신은 Product Spec 작성과 Prototype 생성을 돕는 AI 에이전트입니다.";
    console.error("[server] ⚠️ 폴백 프롬프트 사용 중 (정상 동작 불가)");
  }

  try {
    const knowledge = readFileWithLiteralPath("product-spec-v2-template.txt");
    prompt += "\n\n---\n\n# Knowledge: Product Spec 템플릿\n\n" + knowledge;
  } catch (err) {
    console.error("[server] ❌ 지식 파일 로드 실패:", (err as Error).message);
  }

  if (wdsEnabled) {
    try {
      const wdsGuide = readFileWithLiteralPath("wds-design-guide.md");
      prompt += "\n\n---\n\n" + wdsGuide;
      console.log(`[server] WDS 가이드 추가: ${wdsGuide.length}자`);
    } catch (err) {
      console.warn("[server] WDS 가이드 로드 실패:", (err as Error).message);
    }
  }

  console.log(`[server] 시스템 프롬프트 로드 완료: ${prompt.length}자 (WDS: ${wdsEnabled ? "ON" : "OFF"})`);
  return prompt;
}

// ── 헬스체크 ──
app.get("/api/health", (_req, res) => {
  const prompt = loadSystemPrompt(false);
  res.json({
    status: prompt.length > 100 ? "ok" : "error",
    promptLength: prompt.length,
    env: process.env.VERCEL ? "vercel" : "local",
  });
});

// ── DB 지식 조회 도구 ──

function queryDbKnowledge(): string {
  try {
    return readFileWithLiteralPath("wanted-db-knowledge.md");
  } catch (err) {
    console.warn("[db-knowledge] 파일 로드 실패:", (err as Error).message);
    return "DB 지식 파일을 찾을 수 없습니다.";
  }
}

const DB_TOOL: Anthropic.Tool = {
  name: "query_db",
  description: "원티드 서비스의 DB 구조를 조회합니다. 테이블 스키마, 컬럼 구조, 상태값/Enum 정의, 테이블 간 관계, 기능별 관련 테이블을 확인할 수 있습니다. Spec 작성 시 기존 DB 구조 파악이 필요하면 호출하세요.",
  input_schema: {
    type: "object" as const,
    properties: {
      question: { type: "string", description: "확인하고 싶은 DB 구조 (예: apply 테이블 구조, 지원 관련 테이블, 채용공고 상태값)" }
    },
    required: ["question"]
  }
};

// ── Ennoia API (레거시, 유지) ──

app.post("/api/chat", async (req, res) => {
  const { messages, wdsEnabled, model: reqModel, thinking: reqThinking } = req.body as {
    messages: { role: string; content: any }[];
    wdsEnabled?: boolean;
    model?: string;
    thinking?: string;
  };

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: "messages is required" });
  }

  const systemPrompt = loadSystemPrompt(wdsEnabled ?? false);
  const useModel = (reqModel && ALLOWED_MODELS.has(reqModel)) ? reqModel : DEFAULT_MODEL;
  const thinkingConfig = reqThinking === "disabled"
    ? undefined
    : { type: "adaptive" as const, display: "omitted" as const };

  try {
    const response = await anthropic.messages.create({
      model: useModel,
      max_tokens: 16384,
      ...(thinkingConfig ? { thinking: thinkingConfig } : {}),
      cache_control: { type: "ephemeral" },
      system: [{ type: "text", text: systemPrompt, cache_control: { type: "ephemeral" } }],
      messages: messages.map((m) => {
        const role = m.role === "assistant" ? "assistant" as const : "user" as const;
        return { role, content: m.content };
      }),
    });

    // thinking 블록을 건너뛰고 text 블록만 추출
    const textBlock = response.content.find((b) => b.type === "text");
    const text = textBlock && "text" in textBlock ? textBlock.text : "";

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
  const { messages, systemPromptMode, wdsEnabled, model: reqModel, thinking: reqThinking } = req.body as {
    messages: { role: string; content: any }[];
    systemPromptMode?: "full" | "none";
    wdsEnabled?: boolean;
    model?: string;
    thinking?: string;
  };

  if (!messages || messages.length === 0) {
    return res.status(400).json({ error: "messages is required" });
  }

  // SSE 응답 헤더
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  const system = systemPromptMode === "none"
    ? []
    : [{ type: "text" as const, text: loadSystemPrompt(wdsEnabled ?? false), cache_control: { type: "ephemeral" as const } }];
  const useModel = (reqModel && ALLOWED_MODELS.has(reqModel)) ? reqModel : DEFAULT_MODEL;
  const thinkingConfig = reqThinking === "disabled"
    ? undefined
    : { type: "adaptive" as const, display: "omitted" as const };
  let fullResponse = "";

  const apiMessages: any[] = messages.map((m) => {
    const role = m.role === "assistant" ? "assistant" as const : "user" as const;
    return { role, content: m.content };
  });

  const MAX_TOOL_ROUNDS = 3;

  try {
    for (let round = 0; round <= MAX_TOOL_ROUNDS; round++) {
      const stream = anthropic.messages.stream({
        model: useModel,
        max_tokens: 16384,
        ...(thinkingConfig ? { thinking: thinkingConfig } : {}),
        cache_control: { type: "ephemeral" },
        system,
        messages: apiMessages,
        tools: [DB_TOOL],
      });

      // 텍스트 토큰은 기존과 동일하게 SSE 전송
      stream.on("text", (text) => {
        fullResponse += text;
        res.write(`data: ${JSON.stringify({ content: text })}\n\n`);
      });

      let finalMessage: Anthropic.Message;
      try {
        finalMessage = await stream.finalMessage();
      } catch (error: any) {
        console.error("[api/chat/stream] Stream error:", error.message);
        res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      // tool_use가 없으면 종료 (기존과 동일한 흐름)
      const toolUseBlocks = finalMessage.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (toolUseBlocks.length === 0 || finalMessage.stop_reason !== "tool_use") {
        const u = finalMessage.usage as any;
        const thinkingTokens = u?.thinking_tokens ?? u?.anthropic_thinking_tokens ?? 0;
        console.log(`[api/chat/stream] Stream completed (model: ${useModel}, thinking: ${thinkingConfig ? "adaptive" : "off"}, tool_rounds: ${round})`);
        console.log(`[api/chat/stream] input: ${u?.input_tokens ?? "?"} (cached: ${u?.cache_read_input_tokens ?? 0}) output: ${u?.output_tokens ?? "?"} thinking: ${thinkingTokens}`);
        console.log("[api/chat/stream] === 응답 원문 (처음 500자) ===");
        console.log(fullResponse.slice(0, 500));
        console.log("전체 길이:", fullResponse.length, "자");
        break;
      }

      // tool_use 처리: DB 지식 파일 조회
      console.log(`[api/chat/stream] Tool use round ${round + 1}: ${toolUseBlocks.map(b => b.name).join(", ")}`);
      res.write(`data: ${JSON.stringify({ content: "\n\n_(DB 구조 확인 중...)_\n\n" })}\n\n`);

      apiMessages.push({ role: "assistant" as const, content: finalMessage.content });

      const toolResults: any[] = [];
      for (const block of toolUseBlocks) {
        const question = (block.input as any).question || "";
        console.log(`[db-knowledge] 질문: ${question}`);
        const result = queryDbKnowledge();
        console.log(`[db-knowledge] 결과: ${result.length}자`);
        toolResults.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: result,
        });
      }
      apiMessages.push({ role: "user" as const, content: toolResults });
    }

    res.write("data: [DONE]\n\n");
    res.end();
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

// ── Prototype 공유 (Cloudflare R2) ──

function getR2Client(): S3Client | null {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY) return null;
  return new S3Client({
    region: "auto",
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
  });
}

app.post("/api/share", async (req, res) => {
  const { html, sessionId } = req.body as { html: string; sessionId: string };

  if (!html || !sessionId) {
    return res.status(400).json({ error: "html and sessionId are required" });
  }

  const bucket = process.env.R2_BUCKET_NAME;
  const publicUrl = process.env.R2_PUBLIC_URL; // e.g. https://{bucket}.r2.dev
  const r2 = getR2Client();

  if (!r2 || !bucket || !publicUrl) {
    console.warn("[api/share] R2 not configured");
    return res.status(501).json({ error: "R2 not configured. Set R2_* env vars." });
  }

  const key = `prototypes/${sessionId}.html`;

  try {
    await r2.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: key,
        Body: html,
        ContentType: "text/html; charset=utf-8",
        CacheControl: "public, max-age=0, must-revalidate",
      }),
    );

    const url = `${publicUrl.replace(/\/$/, "")}/${key}`;
    console.log(`[api/share] Uploaded: ${key} (${html.length} chars) → ${url}`);
    return res.json({ url });
  } catch (error: any) {
    console.error("[api/share] R2 upload error:", error.message);
    return res.status(500).json({ error: error.message });
  }
});

// Vercel 환경에서는 listen하지 않음 (serverless function으로 동작)
if (!process.env.VERCEL) {
  app.listen(PORT, () => {
    console.log(`[server] API proxy running on http://localhost:${PORT}`);
    console.log(`[server] Model: ${DEFAULT_MODEL}`);
  });
}

export default app;
