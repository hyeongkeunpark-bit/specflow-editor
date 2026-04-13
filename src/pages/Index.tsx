import { useCallback, useRef, useState, useMemo } from "react";
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
import { sendMessage, fixErrors } from "@/lib/api";
import type { SendOptions } from "@/lib/api";
import { mergeSpec } from "@/lib/parser";
import type { ChatMessage } from "@/lib/types";
import { formatErrorsForAI, tryClientPatch, type IframeError } from "@/lib/iframeErrors";
import type { ResizedImage } from "@/lib/imageResize";
import { FileText, Code2, History, Copy, Download, Sun, Moon, PanelRightClose } from "lucide-react";
import { toast } from "sonner";

type SidePanel = "spec" | "code" | "history" | null;

const Index = () => {
  const {
    sessions,
    activeSession,
    activeSessionId,
    setMessages,
    setSpecContent,
    setHtmlContent,
    setSnapshots,
    createNewSession,
    switchSession,
    deleteSession,
  } = useSessionManager();

  const [activePanel, setActivePanel] = useState<SidePanel>("spec");
  const [isDark, setIsDark] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // ── 스트리밍 취소용 AbortController ──
  const abortRef = useRef<AbortController | null>(null);
  const handleCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setIsLoading(false);
  }, []);

  // ── dirty 플래그: 변경 후 다음 전송 시 1회 포함 ──
  const specDirtyRef = useRef(false);
  const htmlDirtyRef = useRef(false);

  // ── Prototype 변경 이력 (Spec 업데이트 시 전달용) ──
  const protoChangeLogRef = useRef<string[]>([]);

  // ── iframe 런타임 에러 ──
  const iframeErrorsRef = useRef<IframeError[]>([]);
  // Morph 적용 후 자동 에러 수정 플래그 (1회만 실행)
  const autoFixPendingRef = useRef(false);
  const handleIframeErrors = useCallback((errors: IframeError[]) => {
    iframeErrorsRef.current = errors;
    if (errors.length > 0) {
      console.log("[iframeErrors]", errors.map(e => e.message));
      // Morph 적용 직후 에러 → 자동 수정 트리거
      if (autoFixPendingRef.current && !isLoading) {
        autoFixPendingRef.current = false;
        console.log("[autoFix] Morph 후 에러 감지 → 자동 수정 실행");
        // setTimeout으로 현재 렌더 사이클 이후 실행
        setTimeout(() => handleAutoFixRef.current(), 100);
      }
    } else {
      autoFixPendingRef.current = false;
    }
  }, [isLoading]);

  // handleAutoFix를 ref로 참조 (handleIframeErrors에서 순환 의존 방지)
  const handleAutoFixRef = useRef<() => void>(() => {});

  // ── 스트리밍 raw 텍스트 (노이즈 제거용) ──
  const rawStreamRef = useRef("");

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  /** 유저 메시지 첫 줄을 변경 요약으로 사용 */
  const summarizeChange = (userMessage: string): string => {
    const firstLine = userMessage.split("\n")[0].trim();
    return firstLine || "수정";
  };

  // ── 일반 채팅 전송 ──
  const handleSend = useCallback(async (text: string, images?: ResizedImage[]) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: images?.length ? `[이미지 ${images.length}장 첨부] ${text}` : text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // 취소용 AbortController 생성
    const controller = new AbortController();
    abortRef.current = controller;

    // 스트리밍용 AI 메시지 placeholder
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: aiMsgId, role: "ai" as const, content: "" }]);
    rawStreamRef.current = "";

    // Spec은 dirty일 때만, HTML은 존재하면 항상 전송
    // (HTML을 안 보내면 AI가 현재 프로토타입을 모르고 새로 만들거나 라벨을 search에 씀)
    const sendSpec = specDirtyRef.current ? activeSession.specContent || undefined : undefined;
    const sendHtml = activeSession.htmlContent || undefined;
    if (sendSpec) specDirtyRef.current = false;

    // 런타임 에러는 일반 채팅에 포함하지 않음 — 자동 수정 버튼으로만 처리
    // (에러 컨텍스트가 AI를 혼란시켜 delta search 부정확 → 매칭 실패 원인)

    const options: SendOptions = {
      specContent: sendSpec,
      htmlContent: sendHtml,
      existingHtml: activeSession.htmlContent || undefined,
      images: images?.map((img) => ({ base64: img.base64, mediaType: img.mediaType })),
      signal: controller.signal,
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
      const response = await sendMessage(text, activeSession.messages, options);

      // 스트리밍 완료 후: chatText로 AI 메시지 정리
      const chatContent = response.chatText.trim();
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: chatContent || m.content } : m)),
      );

      // ── Spec 추출 결과 처리 ──
      if (response.spec) {
        if (!activeSession.specContent) {
          // 초기 생성
          setSpecContent(response.spec);
          specDirtyRef.current = true;
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
            specDirtyRef.current = true;
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
        htmlDirtyRef.current = true;
        // Morph/Claude 폴백으로 적용된 경우 → iframe 에러 발생 시 자동 수정 예약
        if (response.morphApplied) {
          autoFixPendingRef.current = true;
        }
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
      }
    } catch (err) {
      // 취소된 경우 조용히 처리
      if (err instanceof DOMException && err.name === "AbortError") {
        const partial = rawStreamRef.current.trim();
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: partial || "(취소됨)" } : m)),
        );
      } else {
        const errContent = err instanceof Error
          ? `오류가 발생했습니다: ${err.message}`
          : "요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.";
        setMessages((prev) =>
          prev.map((m) => (m.id === aiMsgId ? { ...m, content: errContent } : m)),
        );
      }
      // 전송 실패 시 dirty 복원
      if (sendSpec) specDirtyRef.current = true;
    } finally {
      abortRef.current = null;
      setIsLoading(false);
    }
  }, [setMessages, setSpecContent, setHtmlContent, setSnapshots, activeSession.messages, activeSession.specContent, activeSession.htmlContent]);

  /** "에러 자동 수정" 버튼 핸들러 — 클라이언트 패치 우선, 실패 시 AI 폴백 */
  const handleAutoFix = useCallback(async () => {
    if (iframeErrorsRef.current.length === 0 || !activeSession.htmlContent) return;
    const errors = [...iframeErrorsRef.current];
    iframeErrorsRef.current = [];

    // ── Step 1: 클라이언트 직접 패치 시도 (AI 호출 없음) ──
    const clientPatch = tryClientPatch(activeSession.htmlContent, errors);
    if (clientPatch) {
      const patchSummary = clientPatch.applied.join(", ");
      console.log("[autoFix] 클라이언트 패치 성공:", patchSummary);
      setHtmlContent(clientPatch.html);
      htmlDirtyRef.current = true;
      setSnapshots((prev) => [
        ...prev,
        {
          spec: activeSession.specContent,
          html: clientPatch.html,
          timestamp: Date.now(),
          summary: "에러 자동 수정 (클라이언트)",
          userMessage: patchSummary,
        },
      ]);
      setMessages((prev) => [
        ...prev,
        { id: Date.now().toString(), role: "system" as const, content: `🔧 에러 자동 수정됨: ${patchSummary}` },
      ]);
      return;
    }

    // ── Step 2: 클라이언트 패치 불가 → AI 전용 엔드포인트 폴백 ──
    const errorText = formatErrorsForAI(errors, activeSession.htmlContent);
    if (!errorText) return;

    setIsLoading(true);

    const sysMsgId = `autofix-${Date.now()}`;
    const aiMsgId = `autofix-ai-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      { id: sysMsgId, role: "system" as const, content: "🔧 에러 자동 수정 중 (AI)..." },
      { id: aiMsgId, role: "ai" as const, content: "" },
    ]);
    rawStreamRef.current = "";

    try {
      const response = await fixErrors(
        activeSession.htmlContent,
        errorText,
        (token) => {
          rawStreamRef.current += token;
          const display = stripStreamingNoise(rawStreamRef.current);
          setMessages((prev) =>
            prev.map((m) => (m.id === aiMsgId ? { ...m, content: display } : m)),
          );
        },
      );

      const chatContent = response.chatText.trim();
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: chatContent || m.content } : m)),
      );

      if (response.html) {
        setHtmlContent(response.html);
        htmlDirtyRef.current = true;
        setSnapshots((prev) => [
          ...prev,
          {
            spec: activeSession.specContent,
            html: response.html!,
            timestamp: Date.now(),
            summary: "에러 자동 수정 (AI)",
            userMessage: "런타임 에러 자동 수정",
          },
        ]);
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 3).toString(), role: "system" as const, content: "🖥️ Prototype 에러 수정됨" },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 3).toString(), role: "system" as const, content: "⚠️ 자동 수정 실패 — delta 매칭 불가" },
        ]);
      }
    } catch (err) {
      const errContent = err instanceof Error
        ? `에러 수정 실패: ${err.message}`
        : "에러 수정 중 오류가 발생했습니다.";
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: errContent } : m)),
      );
    } finally {
      setIsLoading(false);
    }
  }, [activeSession.htmlContent, activeSession.specContent, setMessages, setHtmlContent, setSnapshots]);

  // handleAutoFix ref 업데이트 (handleIframeErrors에서 참조)
  handleAutoFixRef.current = handleAutoFix;

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
        specDirtyRef.current = true;

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

  const handleRestore = (index: number) => {
    const snap = activeSession.snapshots[index];
    setSpecContent(snap.spec);
    setHtmlContent(snap.html);
    if (snap.spec !== activeSession.specContent) specDirtyRef.current = true;
    if (snap.html !== activeSession.htmlContent) htmlDirtyRef.current = true;
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

  // Prototype 변경 이력이 있으면 Spec 업데이트 버튼 활성화
  const hasProtoChanges = protoChangeLogRef.current.length > 0;

  const sidePanelContent = activePanel && (
    activePanel === "spec" ? <SpecPanel content={activeSession.specContent} onClose={() => setActivePanel(null)} /> :
    activePanel === "code" ? <CodeViewPanel htmlContent={activeSession.htmlContent} onClose={() => setActivePanel(null)} /> :
    activePanel === "history" ? <HistoryPanel snapshots={activeSession.snapshots} onRestore={handleRestore} onScrollToMessage={handleScrollToMessage} onClose={() => setActivePanel(null)} /> :
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
              hasProtoChanges={hasProtoChanges}
              isLoading={isLoading}
              onSpecUpdate={handleSpecUpdate}
              onRequestPrototype={() => handleSend("Prototype 생성해줘")}
              onErrors={handleIframeErrors}
              onAutoFix={handleAutoFix}
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
        <div className="flex-1" />
        <SidebarButton
          icon={isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
          label={isDark ? "Light mode" : "Dark mode"}
          active={false}
          onClick={toggleTheme}
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
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      title={label}
      className={`w-9 h-9 flex items-center justify-center rounded-md transition-colors ${
        active
          ? "bg-accent text-accent-foreground"
          : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
      }`}
    >
      {icon}
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
