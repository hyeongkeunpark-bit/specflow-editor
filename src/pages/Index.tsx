import { useCallback, useEffect, useRef, useState, useMemo } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import ChatPanel from "@/components/ChatPanel";
import SpecPanel from "@/components/SpecPanel";
import PrototypePanel from "@/components/PrototypePanel";
import HistoryPanel from "@/components/HistoryPanel";
import { useSessionManager } from "@/hooks/useSessionManager";
import { sendMessage, sharePrototype } from "@/lib/api";
import type { SendOptions } from "@/lib/api";
import { mergeSpec } from "@/lib/parser";
import type { ChatMessage } from "@/lib/types";
import { formatErrorsForAI, tryClientPatch, type IframeError } from "@/lib/iframeErrors";
import type { ChatAttachments } from "@/components/ChatPanel";
import { FileText, Code2, History, Copy, Download, Settings, PanelRightClose } from "lucide-react";
import SettingsDialog from "@/components/SettingsDialog";
import { toast } from "sonner";

type SidePanel = "spec" | "code" | "history" | null;

const Index = () => {
  const {
    sessions,
    activeSession,
    activeSessionId,
    storageLevel,
    setMessages,
    setSpecContent,
    setHtmlContent,
    setSnapshots,
    setShareUrl,
    createNewSession,
    switchSession,
    deleteSession,
  } = useSessionManager();

  const [activePanel, setActivePanel] = useState<SidePanel>("spec");
  const [isDark, setIsDark] = useState(() => {
    const saved = localStorage.getItem("specbot_theme");
    return saved === "dark";
  });
  const [isLoading, setIsLoading] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);

  // ── 양방향 동기화 플래그 ──
  const [specNeedsSync, setSpecNeedsSync] = useState(false);   // Prototype 변경 → Spec 동기화 필요
  const [protoNeedsSync, setProtoNeedsSync] = useState(false); // Spec 직접 수정 → Prototype 동기화 필요

  // ── 공유 URL 자동 업데이트 — shareUrl이 있는 세션에서 Prototype 변경 시 자동 업로드 ──
  useEffect(() => {
    if (!activeSession.shareUrl || !activeSession.htmlContent) return;
    sharePrototype(activeSession.htmlContent, activeSessionId).catch(() => {});
  }, [activeSession.htmlContent, activeSession.shareUrl, activeSessionId]);

  // ── 스트리밍 취소용 AbortController ──
  const abortRef = useRef<AbortController | null>(null);
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  // ── Prototype 변경 이력 (Spec 업데이트 시 전달용) ──
  const protoChangeLogRef = useRef<string[]>([]);

  // ── iframe 런타임 에러 ──
  const iframeErrorsRef = useRef<IframeError[]>([]);
  // 히스토리 복원 직후 해당 세션의 에러 자동 수정을 억제 — 유저가 실제로 수정할 때까지 유지
  const suppressAutoFixInSessionsRef = useRef<Set<string>>(new Set());
  // 세션별로 AI에게 한번이라도 노출된 에러 signature — 동일 에러 재주입 방지
  // 키 포맷: `${sessionId}:${errorMessage}`
  const processedErrorsRef = useRef<Set<string>>(new Set());
  const handleIframeErrors = useCallback((errors: IframeError[]) => {
    iframeErrorsRef.current = errors;
    if (errors.length > 0) {
      console.log("[iframeErrors]", errors.map(e => e.message));
      // 클라이언트 패치 자동 시도 (AI 호출 없이, 백그라운드)
      if (activeSession.htmlContent) {
        const patch = tryClientPatch(activeSession.htmlContent, errors);
        if (patch) {
          console.log("[autoFix] 클라이언트 패치 성공:", patch.applied.join(", "));
          setHtmlContent(patch.html);
          iframeErrorsRef.current = [];
        }
      }
    }
  }, [activeSession.htmlContent, setHtmlContent]);

  // ── 스트리밍 raw 텍스트 (노이즈 제거용) ──
  const rawStreamRef = useRef("");

  // ── 다크모드 초기화 (localStorage 복원) ──
  useEffect(() => {
    document.documentElement.classList.toggle("dark", isDark);
  }, []);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("specbot_theme", next ? "dark" : "light");
  };

  /** 유저 메시지 첫 줄을 변경 요약으로 사용 */
  const summarizeChange = (userMessage: string): string => {
    const firstLine = userMessage.split("\n")[0].trim();
    return firstLine || "수정";
  };

  // ── 일반 채팅 전송 ──
  const handleSend = useCallback(async (text: string, attachments?: ChatAttachments, extraOptions?: Partial<SendOptions>) => {
    // 채팅에 표시할 텍스트: 파일명 + 사용자 입력만 (파일 내용 X)
    const displayParts: string[] = [];
    if (attachments?.images?.length) displayParts.push(`[이미지 ${attachments.images.length}장 첨부]`);
    if (attachments?.textFiles?.length) {
      attachments.textFiles.forEach((f) => displayParts.push(`[${f.name}]`));
    }
    if (text) displayParts.push(text);
    const displayText = displayParts.join(" ") || "(첨부파일)";

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: displayText,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // 취소용 AbortController 생성 + 330초 타임아웃 자동 취소 (Vercel 300s + 버퍼 30s)
    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => {
      if (!controller.signal.aborted) controller.abort();
    }, 330_000);

    // 스트리밍용 AI 메시지 placeholder
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: aiMsgId, role: "ai" as const, content: "" }]);
    rawStreamRef.current = "";

    // 매 턴 current Spec/HTML을 전송 (buildMessages가 cache_control로 캐싱)
    const sendSpec = activeSession.specContent || undefined;
    const sendHtml = activeSession.htmlContent || undefined;

    // AI에 전송할 사용자 메시지: 파일 내용 + 에러 컨텍스트 + 사용자 텍스트
    let apiUserMessage = text;
    if (attachments?.textFiles?.length) {
      const fileContents = attachments.textFiles
        .map((f) => `[첨부 파일: ${f.name}]\n${f.content}`)
        .join("\n\n");
      const instruction = text || "위 문서를 첨부합니다. 이 문서를 어떻게 활용할지 알려주세요.";
      apiUserMessage = `${fileContents}\n\n[요청]\n${instruction}`;
    }

    // 에러가 있으면 자동으로 에러 컨텍스트 첨부 (Bolt 방식)
    // 억제 조건:
    // 1. 히스토리 복원 직후 세션 (유저 실제 수정까지)
    // 2. 이미 AI에게 노출된 에러 signature (매 턴 재주입 방지)
    const autoFixAllowed = !suppressAutoFixInSessionsRef.current.has(activeSessionId);
    const newErrors = iframeErrorsRef.current.filter(
      (e) => !processedErrorsRef.current.has(`${activeSessionId}:${e.message}`),
    );
    // 현재 모든 에러를 "처리됨"으로 마킹 (suppress 여부 무관 — 재주입 원천 차단)
    iframeErrorsRef.current.forEach((e) =>
      processedErrorsRef.current.add(`${activeSessionId}:${e.message}`),
    );
    if (autoFixAllowed && newErrors.length > 0 && activeSession.htmlContent) {
      const errorContext = formatErrorsForAI(newErrors, activeSession.htmlContent);
      if (errorContext) {
        apiUserMessage = `${apiUserMessage}\n\n${errorContext}`;
      }
    }

    const options: SendOptions = {
      specContent: sendSpec,
      htmlContent: sendHtml,
      existingHtml: activeSession.htmlContent || undefined,
      images: attachments?.images?.map((img) => ({ base64: img.base64, mediaType: img.mediaType })),
      signal: controller.signal,
      model: localStorage.getItem("specbot_model") || undefined,

      ...extraOptions,
      onToken: (token) => {
        rawStreamRef.current += token;
        const display = stripStreamingNoise(rawStreamRef.current);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: display } : m,
          ),
        );
      },
    };

    try {
      const response = await sendMessage(apiUserMessage, activeSession.messages, options);

      // 스트리밍 완료 후: chatText로 AI 메시지 정리
      // AI가 설명 없이 delta/html/spec만 출력한 경우 → 빈 AI 메시지 제거
      // ("🖥️ Prototype 업데이트됨" / "📝 Spec 업데이트됨" 시스템 메시지가 대신 알림)
      const chatContent = response.chatText.trim();
      setMessages((prev) => {
        if (!chatContent && (response.html || response.spec)) {
          return prev.filter((m) => m.id !== aiMsgId);
        }
        return prev.map((m) => (m.id === aiMsgId ? { ...m, content: chatContent || m.content } : m));
      });

      // ── Spec 추출 결과 처리 ──
      if (response.spec) {
        if (!activeSession.specContent) {
          // 초기 생성
          setSpecContent(response.spec);
          setSnapshots((prev) => [
            ...prev,
            {
              spec: response.spec!,
              html: activeSession.htmlContent,
              timestamp: Date.now(),
              summary: "Spec 초기 생성",
              userMessage: text,
            },
          ]);
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 2).toString(), role: "system" as const, content: "📝 Spec 업데이트됨" },
          ]);
        } else {
          // 수정 모드: merge
          const prevSpec = activeSession.specContent;
          const merged = mergeSpec(prevSpec, response.spec);
          const specChanged = merged !== prevSpec;

          if (specChanged) {
            setSpecContent(merged);
            setSnapshots((prev) => [
              ...prev,
              {
                spec: merged,
                html: activeSession.htmlContent,
                timestamp: Date.now(),
                summary: summarizeChange(text),
                userMessage: text,
              },
            ]);
            setMessages((prev) => [
              ...prev,
              { id: (Date.now() + 2).toString(), role: "system" as const, content: "📝 Spec 업데이트됨" },
            ]);
          }
        }
      }

      // ── HTML 추출 결과 처리 ──
      if (response.html) {
        setHtmlContent(response.html);
        // 유저가 실제 수정을 했으므로 복원 직후 억제 해제
        suppressAutoFixInSessionsRef.current.delete(activeSessionId);
        // Prototype 변경 이력에 추가
        protoChangeLogRef.current.push(text);
        setSnapshots((prev) => [
          ...prev,
          {
            spec: activeSession.specContent,
            html: response.html!,
            timestamp: Date.now(),
            summary: activeSession.htmlContent ? summarizeChange(text) : "Prototype 초기 생성",
            userMessage: text,
          },
        ]);
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 3).toString(), role: "system" as const, content: "🖥️ Prototype 업데이트됨" },
        ]);
        // Prototype 변경 → Spec 동기화 필요 (Spec 유무와 무관 — 없으면 생성, 있으면 업데이트)
        setSpecNeedsSync(true);
      }
    } catch (err) {
      // 취소된 경우 조용히 처리
      if (err instanceof DOMException && err.name === "AbortError") {
        const partial = rawStreamRef.current.trim();
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: partial || "응답 시간이 초과되었습니다. 다시 시도해주세요." } : m)),
        );
      } else {
        const errContent = err instanceof Error
          ? `오류가 발생했습니다: ${err.message}`
          : "요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.";
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: errContent } : m)),
        );
      }
    } finally {
      clearTimeout(timeoutId);
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [setMessages, setSpecContent, setHtmlContent, setSnapshots, activeSession.messages, activeSession.specContent, activeSession.htmlContent]);

  // ── [Spec 문서 업데이트] 버튼 핸들러 ──
  const handleSpecUpdate = useCallback(async () => {
    if (!activeSession.htmlContent) return;
    setIsLoading(true);

    const now = Date.now();
    const sysMsgId = `spec-update-sys-${now}`;
    const aiMsgId = `spec-update-ai-${now}`;
    setMessages((prev) => [
      ...prev,
      { id: sysMsgId, role: "system" as const, content: "📝 Spec 문서 업데이트 요청 중..." },
      { id: aiMsgId, role: "ai" as const, content: "" },
    ]);
    rawStreamRef.current = "";

    const options: SendOptions = {
      specUpdateMode: {
        specContent: activeSession.specContent,
        htmlContent: activeSession.htmlContent,
        changeLog: [...protoChangeLogRef.current],
      },
      model: localStorage.getItem("specbot_model") || undefined,

      onToken: (token) => {
        rawStreamRef.current += token;
        const display = stripStreamingNoise(rawStreamRef.current);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === aiMsgId ? { ...m, content: display } : m,
          ),
        );
      },
    };

    try {
      const response = await sendMessage("", activeSession.messages, options);

      const chatContent = response.chatText.trim();
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: chatContent || m.content } : m)),
      );

      if (response.spec) {
        if (!activeSession.specContent) {
          setSpecContent(response.spec);
        } else {
          const merged = mergeSpec(activeSession.specContent, response.spec);
          setSpecContent(merged);
        }

        setSnapshots((prev) => [
          ...prev,
          {
            spec: activeSession.specContent ? mergeSpec(activeSession.specContent, response.spec!) : response.spec!,
            html: activeSession.htmlContent,
            timestamp: Date.now(),
            summary: "Spec 문서 업데이트",
            userMessage: "Prototype 기반 Spec 업데이트",
          },
        ]);

        // 변경 이력 리셋
        protoChangeLogRef.current = [];

        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 2).toString(), role: "system" as const, content: "📝 Spec 문서 업데이트 완료" },
        ]);

        toast.success("Spec 문서가 업데이트되었습니다");
        setSpecNeedsSync(false);
      }
    } catch (err) {
      const errContent = err instanceof Error
        ? `Spec 업데이트 오류: ${err.message}`
        : "Spec 업데이트 중 오류가 발생했습니다.";
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: errContent } : m)),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setMessages, setSpecContent, setSnapshots, activeSession.messages, activeSession.specContent, activeSession.htmlContent]);

  // ── [Use Case 분석] 버튼 → 일반 채팅으로 분석 요청 ──
  const handleEdgeCaseAnalysis = useCallback(() => {
    handleSend(`현재 Prototype·Spec을 분석해서 **기획자 관점**에서 정책·분기 누락을 찾아 **3티어**로 분류해서 알려줘.

**찾을 것:**
- 같은 기능이 유저 상태·조건에 따라 다르게 동작할 수 있는데 Spec에 분기가 없는 지점
- 리스트·카운트·섹션의 노출 기준이 불명확한 지점
- 특정 유저 상태(휴면·미완성·비공개 등)에서의 동작이 정의되지 않은 지점

**3티어 분류:**

## 🎯 결정 필요 (최대 5개)
기획자가 선택지 중 고르지 않으면 **개발·디자인 착수 불가**한 항목만.
표준 관행으로 처리되는 건 제외. 다른 항목에 흡수 가능한 건 통합.

## 🧩 설계 선택 (최대 5개)
UX·운영 방향 논의 필요. 결정 없어도 진행은 가능하나 품질 좌우.

## ℹ️ 참고 확인 (압축 나열)
엣지케이스·operational 사항. 각 1줄로 "~의 경우 일반적으로 X로 처리 권장" 형식.

**🎯/🧩 항목 형식 (반드시 이 구조, 모든 본문은 마크다운 불릿 "-" 사용):**

### N. 한 줄 타이틀

**핵심 질문**:
- 기획자가 결정해야 할 단일 질문 한 줄 (정확히 1개 불릿, 하위 질문·맥락 부연 금지)

**선택지**:
- A. ...
- B. ...
- C. ... (필요 시)

**영향**:
- 영향 키워드 1 (25자 이내, 완결 문장 금지)
- 영향 키워드 2
- (최대 3개, 적을수록 좋음)

**쓰는 방식:**
- **기획자 언어만.** DB 컬럼명·SQL·영문 필드명 직접 노출 금지.
  ❌ "wanted_des.status=active" → ✅ "현재 모집 중인 공고"
  ❌ "resume.is_complete=true" → ✅ "이력서 작성을 완료한 유저"
- DB 지식은 내부 참고용. 답변에 DB 근거 블록 넣지 말 것.
- 구현 디테일(debounce·페이지네이션·로딩 UI) 제외.
- 이미 Spec·Prototype에서 처리된 항목 제외.

**예시 (🎯 항목):**

### 1. 이력서 등록 완료 기준

**핵심 질문**:
- 무엇을 "이력서 등록 완료"로 볼지?

**선택지**:
- A. 원티드 이력서 작성 완료만 (파일 업로드는 미등록으로)
- B. 파일 업로드도 등록으로 인정
- C. 두 케이스 각각 다른 분기 (가장 정밀)

**영향**:
- 강조 축소 대상 유저 범위
- 이력서 등록 유도 UI 노출 조건

**예시 (ℹ️ 항목):**
- 휴면·탈퇴 유저: 세션 무효화 후 비로그인 분기로 처리 권장
- A/B 쿠키 재할당: 쿠키 삭제 시 신규 방문자로 간주해 재할당이 표준 관행

마지막에 '위 항목을 확인해주세요. 🎯 항목은 선택지를 고른 뒤, 🧩 항목은 의견을 주시고, ℹ️는 반영 여부만 확인해주세요. 반영 원하시면 번호로 알려주세요.'라고 안내해줘.`, undefined, { systemPromptMode: "none", includeDbContext: true });
  }, [handleSend]);

  // ── Spec 직접 편집 콜백 ──
  const handleSpecEdit = useCallback((newContent: string) => {
    setSpecContent(newContent);
    if (activeSession.htmlContent) setProtoNeedsSync(true);
  }, [setSpecContent, activeSession.htmlContent]);

  // ── Spec 일관성 검토 — Spec 전문만 전송 (대화 이력/HTML 제외로 토큰 절감) ──
  const handleConsistencyCheck = useCallback(async () => {
    if (!activeSession.specContent) return;
    setIsLoading(true);

    const now = Date.now();
    const sysMsgId = `consistency-sys-${now}`;
    const aiMsgId = `consistency-ai-${now}`;
    setMessages((prev) => [
      ...prev,
      { id: sysMsgId, role: "system" as const, content: "🔍 Spec 일관성 검토 중..." },
      { id: aiMsgId, role: "ai" as const, content: "" },
    ]);
    rawStreamRef.current = "";

    const instruction = `[Spec 일관성 검토 요청]

[현재 Spec 전문]
${activeSession.specContent}

Spec 내부에서 같은 정책·수치·규칙이 여러 섹션에 다르게 언급되는 불일치를 찾아.

**중요: 이 턴에서는 Spec을 수정하지 마. <spec> 태그 출력 금지.**

각 불일치에 대해:
1. 어느 섹션 vs 어느 섹션이 어떻게 다른지 구체적으로 인용.
2. 유저에게 "어느 방향으로 통일할까요?"라고 질문. 가능하면 선택지 제시:
   (A) outlier 쪽으로 통일 (= 유저가 최근 직접 편집했을 가능성이 높은 쪽)
   (B) 다수 쪽으로 통일
   (C) 수정하지 않고 그대로 유지
   (D) 다른 방향 (유저가 구체적으로 지시)

여러 불일치가 있으면 번호를 매겨서 각각 선택할 수 있도록 해.

유저가 다음 메시지에서 방향을 지시하면, 그때 일반 채팅 흐름에서 실제 수정이 진행됩니다.

불일치가 없으면 "Spec 내부에 불일치가 없습니다."라고만 안내하고 끝내.`;

    const options: SendOptions = {
      systemPromptMode: "none",
      onToken: (token) => {
        rawStreamRef.current += token;
        const display = stripStreamingNoise(rawStreamRef.current);
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: display } : m)),
        );
      },
    };

    try {
      const response = await sendMessage(instruction, [], options);

      const fullText = rawStreamRef.current.trim();
      const cleaned = fullText
        .replace(/<spec>[\s\S]*?<\/spec>/g, "")
        .trim();
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: cleaned || fullText } : m)),
      );

      // Spec 수정 결과 반영
      if (response.spec) {
        const merged = mergeSpec(activeSession.specContent, response.spec);
        setSpecContent(merged);
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 2).toString(), role: "system" as const, content: "📝 Spec 일관성 수정 완료" },
        ]);
      }
    } catch (err) {
      const errContent = err instanceof Error
        ? `검토 오류: ${err.message}`
        : "검토 중 오류가 발생했습니다.";
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: errContent } : m)),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setMessages, setSpecContent, activeSession.specContent]);

  // ── [Prototype 업데이트] 플로팅 버튼 핸들러 (Spec → Prototype 동기화) ──
  const handleProtoFromSpec = useCallback(async () => {
    if (!activeSession.specContent || !activeSession.htmlContent) return;
    setIsLoading(true);

    const now = Date.now();
    const sysMsgId = `proto-sync-sys-${now}`;
    const aiMsgId = `proto-sync-ai-${now}`;
    setMessages((prev) => [
      ...prev,
      { id: sysMsgId, role: "system" as const, content: "🔄 Spec 기반 Prototype 업데이트 요청 중..." },
      { id: aiMsgId, role: "ai" as const, content: "" },
    ]);
    rawStreamRef.current = "";

    const options: SendOptions = {
      protoUpdateMode: {
        specContent: activeSession.specContent,
        htmlContent: activeSession.htmlContent,
      },
      existingHtml: activeSession.htmlContent,
      model: localStorage.getItem("specbot_model") || undefined,

      onToken: (token) => {
        rawStreamRef.current += token;
        const display = stripStreamingNoise(rawStreamRef.current);
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: display } : m)),
        );
      },
    };

    try {
      const response = await sendMessage("", activeSession.messages, options);

      const chatContent = response.chatText.trim();
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: chatContent || m.content } : m)),
      );

      if (response.html) {
        setHtmlContent(response.html);
        protoChangeLogRef.current.push("Spec 기반 Prototype 업데이트");
        setSnapshots((prev) => [
          ...prev,
          {
            spec: activeSession.specContent,
            html: response.html!,
            timestamp: Date.now(),
            summary: "Spec 기반 Prototype 업데이트",
            userMessage: "Spec → Prototype 동기화",
          },
        ]);
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 2).toString(), role: "system" as const, content: "🖥️ Prototype 업데이트됨" },
        ]);
      }

      setProtoNeedsSync(false);
    } catch (err) {
      const errContent = err instanceof Error
        ? `Prototype 업데이트 오류: ${err.message}`
        : "Prototype 업데이트 중 오류가 발생했습니다.";
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: errContent } : m)),
      );
    } finally {
      setIsLoading(false);
    }
  }, [setMessages, setHtmlContent, setSnapshots, activeSession.messages, activeSession.specContent, activeSession.htmlContent]);

  const handleRestore = (index: number) => {
    const snap = activeSession.snapshots[index];
    setSpecContent(snap.spec);
    setHtmlContent(snap.html);
    // 복원 직후 iframe이 에러를 보고해도 AI 자동 수정을 억제 (유저 실제 수정 전까지)
    suppressAutoFixInSessionsRef.current.add(activeSessionId);
    // 복원 시 동기화 플래그 리셋 — 복원된 상태는 일치한 시점의 스냅샷
    setSpecNeedsSync(false);
    setProtoNeedsSync(false);
    // 비파괴적 되돌리기: 이전 스냅샷 유지 + "되돌림" 스냅샷 추가
    setSnapshots((prev) => [
      ...prev,
      {
        spec: snap.spec,
        html: snap.html,
        timestamp: Date.now(),
        summary: `v${index + 1}로 되돌림`,
        userMessage: `v${index + 1} 복원`,
      },
    ]);
    toast.success(`v${index + 1}로 되돌렸습니다`);
  };

  const togglePanel = (panel: SidePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  // 히스토리 → 채팅 스크롤: 스냅샷 timestamp와 가장 가까운 메시지로 스크롤
  const handleScrollToMessage = useCallback((timestamp: number) => {
    // 스냅샷 timestamp 직전의 가장 가까운 user 메시지를 찾아 스크롤
    const msgs = activeSession.messages;
    let target: ChatMessage | null = null;
    for (const m of msgs) {
      const msgTime = Number(m.id);
      if (msgTime <= timestamp && m.role === "user") {
        target = m; // 스냅샷 이전의 마지막 user 메시지
      }
    }
    // user 메시지를 못 찾으면 스냅샷에 가장 가까운 아무 메시지
    if (!target) {
      let minDiff = Infinity;
      for (const m of msgs) {
        const diff = Math.abs(Number(m.id) - timestamp);
        if (diff < minDiff) { minDiff = diff; target = m; }
      }
    }
    if (target) {
      const el = document.getElementById(`msg-${target.id}`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [activeSession.messages]);

  const sidePanelContent = activePanel && (
    activePanel === "spec" ? <SpecPanel content={activeSession.specContent} onEdit={handleSpecEdit} onConsistencyCheck={handleConsistencyCheck} needsSync={specNeedsSync} onSyncToSpec={handleSpecUpdate} isLoading={isLoading} onLoadSpec={(text) => { setSpecContent(text); }} onClose={() => setActivePanel(null)} /> :
    activePanel === "code" ? <CodeViewPanel htmlContent={activeSession.htmlContent} onClose={() => setActivePanel(null)} /> :
    activePanel === "history" ? <HistoryPanel snapshots={activeSession.snapshots} onRestore={handleRestore} onScrollToMessage={handleScrollToMessage} isLoading={isLoading} onClose={() => setActivePanel(null)} /> :
    null
  );

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex relative">
      {/* Main Area: Chat + Preview + Side Panel */}
      <div className="flex-1 min-w-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={activePanel ? 33 : 43} minSize={15}>
            <ChatPanel
              messages={activeSession.messages}
              onSend={handleSend}
              onCancel={handleCancel}
              isLoading={isLoading}
              storageLevel={storageLevel}
              sessions={sessions}
              activeSessionId={activeSessionId}
              onNewSession={createNewSession}
              onSwitchSession={switchSession}
              onDeleteSession={deleteSession}
            />
          </ResizablePanel>

          <PanelDivider />

          <ResizablePanel defaultSize={activePanel ? 33 : 57} minSize={15}>
            <PrototypePanel
              htmlContent={activeSession.htmlContent}
              hasSpecContent={!!activeSession.specContent}
              isLoading={isLoading}
              sessionId={activeSessionId}
              shareUrl={activeSession.shareUrl}
              onShareUrlChange={setShareUrl}
              onEdgeCaseAnalysis={handleEdgeCaseAnalysis}
              needsSync={protoNeedsSync}
              onSyncToPrototype={handleProtoFromSpec}
              onRequestPrototype={() => handleSend("Prototype 생성해줘")}
              onLoadHtml={(html) => { setHtmlContent(html); }}
              onErrors={handleIframeErrors}
            />
          </ResizablePanel>

          {activePanel && sidePanelContent && (
            <>
              <PanelDivider />

              <ResizablePanel defaultSize={34} minSize={15}>
                {sidePanelContent}
              </ResizablePanel>
            </>
          )}
        </ResizablePanelGroup>
      </div>

      {/* Icon Sidebar - Right */}
      <aside className="relative z-40 w-12 shrink-0 border-l bg-card flex flex-col items-center py-3 gap-1">
        <SidebarButton
          icon={<FileText className="w-[18px] h-[18px]" />}
          label="Spec"
          active={activePanel === "spec"}
          badge={specNeedsSync}
          onClick={() => togglePanel("spec")}
        />
        <SidebarButton
          icon={<Code2 className="w-[18px] h-[18px]" />}
          label="Html"
          active={activePanel === "code"}
          onClick={() => togglePanel("code")}
        />
        <SidebarButton
          icon={<History className="w-[18px] h-[18px]" />}
          label="History"
          active={activePanel === "history"}
          onClick={() => togglePanel("history")}
        />
        <SidebarButton
          icon={<Settings className="w-[18px] h-[18px]" />}
          label="설정"
          active={false}
          onClick={() => setSettingsOpen(true)}
        />
        <SettingsDialog
          open={settingsOpen}
          onOpenChange={setSettingsOpen}
          isDark={isDark}
          onToggleTheme={toggleTheme}
        />
      </aside>
    </div>
  );
};

/** 스트리밍 중 채팅에 노출되면 안 되는 콘텐츠 제거 */
/** raw 스트리밍 텍스트에서 노이즈를 제거하여 채팅에 표시할 텍스트 반환 */
function stripStreamingNoise(rawText: string): string {
  let text = rawText.trimStart().replace(/<\/?spec>/g, "");

  // ```html, <!DOCTYPE html, <partial-update>, <prototype_delta> 이후 전체를 잘라냄
  const htmlFenceIdx = text.indexOf("```html");
  const doctypeIdx = text.search(/<!DOCTYPE html/i);
  const partialIdx = text.indexOf("<partial-update>");
  const deltaIdx = text.indexOf("<prototype_delta>");
  const candidates = [htmlFenceIdx, doctypeIdx, partialIdx, deltaIdx].filter(i => i >= 0);
  const cutIdx = candidates.length > 0 ? Math.min(...candidates) : -1;

  if (cutIdx >= 0) {
    const before = text.slice(0, cutIdx).trim();
    const isModify = (partialIdx >= 0 && partialIdx === cutIdx) || (deltaIdx >= 0 && deltaIdx === cutIdx);
    const label = isModify ? "(Prototype 수정 중...)" : "(Prototype 생성 중...)";
    return before ? before + "\n\n" + label : label;
  }

  return text;
}

function PanelDivider() {
  return (
    <ResizableHandle
      className="relative w-2.5 cursor-col-resize bg-white dark:bg-zinc-900 hover:bg-zinc-50 dark:hover:bg-primary/10 transition-colors border-x border-border after:!absolute after:!top-1/2 after:!left-[calc(50%-0.5px)] after:!-translate-y-1/2 after:!translate-x-0 after:!w-px after:!h-10 after:!inset-y-auto after:!rounded-full after:!bg-border"
    />
  );
}

function SidebarButton({
  icon,
  label,
  active,
  badge,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  badge?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`relative w-9 h-9 flex items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
      }`}
    >
      {icon}
      {badge && (
        <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-amber-500" />
      )}
    </button>
  );
}

function CodeViewPanel({ htmlContent, onClose }: { htmlContent: string; onClose?: () => void }) {
  const handleCopy = () => {
    navigator.clipboard.writeText(htmlContent);
    toast.success("HTML이 클립보드에 복사되었습니다");
  };

  const handleDownload = () => {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "prototype.html";
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-panel-header">
        <div className="flex items-center gap-2">
          {onClose && (
            <button
              onClick={onClose}
              className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
              title="패널 접기"
            >
              <PanelRightClose className="w-4 h-4" />
            </button>
          )}
          <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
          <h2 className="text-sm font-semibold text-panel-header-foreground">Html</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={handleCopy}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
            title="복사"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={handleDownload}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
            title="다운로드 (.html)"
          >
            <Download className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto p-4">
        {htmlContent ? (
          <pre className="text-xs leading-relaxed text-foreground whitespace-pre-wrap break-all font-mono">
            {htmlContent}
          </pre>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <Code2 className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm text-center">
              생성된 코드가 여기에 표시됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Index;
