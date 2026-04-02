import { useCallback, useState } from "react";
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
import { sendMessage, isSpecGenerationTrigger, sendSpecChunked, buildFailureSummary } from "@/lib/api";
import { mergeSpec, stripConversational } from "@/lib/parser";
import type { ChatMessage } from "@/lib/types";
import { FileText, Code2, History, Copy, Download, ZoomIn, ZoomOut, Link, Sun, Moon, PanelRightClose } from "lucide-react";
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

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
  };

  /** Spec이 존재하는 상태에서 AI 응답에 Spec 변경이 있는지 판단 */
  const isSpecUpdate = (responseSpec: string | null): boolean => {
    return !!activeSession.specContent && !!responseSpec;
  };

  /** 유저 요청 텍스트에서 변경 요약을 생성 */
  const summarizeChange = (userText: string): string => {
    if (userText.length <= 40) return userText;
    return userText.slice(0, 40) + "...";
  };

  const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Spec이 있으면 수정 모드 → Spec 요약 포함, 없으면 일반 모드
      const response = await sendMessage(
        text,
        activeSession.messages,
        activeSession.specContent || undefined,
      );

      // ── 분할 생성 모드 ──
      if (isSpecGenerationTrigger(response.text)) {
        // 트리거 응답은 채팅에만 표시 (response.text 사용, Spec 아님)
        const triggerMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: response.text.trim(),
        };
        setMessages((prev) => [...prev, triggerMsg]);

        const historyForChunked = [...activeSession.messages, userMsg, triggerMsg];
        let runningSpec = activeSession.specContent;
        const specBefore = activeSession.specContent;

        const { failedSteps } = await sendSpecChunked(
          historyForChunked,
          (step, label) => {
            setMessages((prev) => [
              ...prev,
              { id: `spec-step-${step}-${Date.now()}`, role: "system", content: label },
            ]);
          },
          (_step, chunk) => {
            runningSpec = mergeSpec(runningSpec, chunk);
            setSpecContent(runningSpec);
          },
          (step, label) => {
            setMessages((prev) => [
              ...prev,
              {
                id: `spec-skip-${step}-${Date.now()}`,
                role: "system",
                content: `\u26A0\uFE0F ${label} \uC0DD\uC131 \uC911 \uC751\uB2F5 \uC2DC\uAC04\uC774 \uCD08\uACFC\uB418\uC5C8\uC2B5\uB2C8\uB2E4. \uAC74\uB108\uB6F0\uACE0 \uB2E4\uC74C\uC73C\uB85C \uC9C4\uD589\uD569\uB2C8\uB2E4.`,
              },
            ]);
          },
        );

        const summary = buildFailureSummary(failedSteps);
        setMessages((prev) => [
          ...prev,
          { id: `spec-done-${Date.now()}`, role: "system", content: summary },
        ]);

        // Spec이 실제로 변경된 경우에만 버전 생성
        if (runningSpec && runningSpec !== specBefore) {
          setSnapshots((prev) => [
            ...prev,
            {
              spec: runningSpec,
              html: activeSession.htmlContent,
              timestamp: Date.now(),
              summary: "\uCD08\uAE30 \uC0DD\uC131",
            },
          ]);
        }

      // ── 수정 모드: Spec이 존재 + 응답에 Spec 변경 있음 ──
      } else if (isSpecUpdate(response.spec)) {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: response.text.trim(),
        };

        const cleaned = stripConversational(response.spec!);
        const merged = mergeSpec(activeSession.specContent, cleaned);
        const specChanged = merged !== activeSession.specContent;

        if (specChanged) {
          setMessages((prev) => [
            ...prev,
            aiMsg,
            { id: (Date.now() + 2).toString(), role: "system", content: "\uD83D\uDCDD Spec \uC5C5\uB370\uC774\uD2B8\uB428" },
          ]);
          setSpecContent(merged);
          if (response.html) setHtmlContent(response.html);

          setSnapshots((prev) => [
            ...prev,
            {
              spec: merged,
              html: response.html || activeSession.htmlContent,
              timestamp: Date.now(),
              summary: summarizeChange(text),
            },
          ]);
        } else {
          // merge 결과가 동일 → 변경 없음, 채팅만 표시
          setMessages((prev) => [...prev, aiMsg]);
        }

      // ── 일반 대화 (검증 모드): Spec/히스토리 건드리지 않음 ──
      } else {
        const aiMsg: ChatMessage = {
          id: (Date.now() + 1).toString(),
          role: "ai",
          content: response.text.trim(),
        };
        setMessages((prev) => [...prev, aiMsg]);

        // HTML만 왔을 때는 반영 (Prototype 업데이트)
        if (response.html) {
          setHtmlContent(response.html);
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 3).toString(), role: "system", content: "\uD83D\uDDA5\uFE0F Prototype \uC5C5\uB370\uC774\uD2B8\uB428" },
          ]);
        }
        // 검증 모드에서는 Spec 패널 & 히스토리 변경 없음
      }
    } catch (err) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: err instanceof Error
          ? `\uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4: ${err.message}`
          : "\uC694\uCCAD \uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4. \uB2E4\uC2DC \uC2DC\uB3C4\uD574\uC8FC\uC138\uC694.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [setMessages, setSpecContent, setHtmlContent, setSnapshots, activeSession.messages, activeSession.specContent, activeSession.htmlContent]);

  const handleRestore = (index: number) => {
    const snap = activeSession.snapshots[index];
    setSpecContent(snap.spec);
    setHtmlContent(snap.html);
    setSnapshots((prev) => prev.slice(0, index + 1));
    toast.success(`v${index + 1}로 되돌렸습니다`);
  };

  const togglePanel = (panel: SidePanel) => {
    setActivePanel((prev) => (prev === panel ? null : panel));
  };

  const sidePanelContent = activePanel && (
    activePanel === "spec" ? <SpecPanel content={activeSession.specContent} onClose={() => setActivePanel(null)} /> :
    activePanel === "code" ? <CodeViewPanel htmlContent={activeSession.htmlContent} onClose={() => setActivePanel(null)} /> :
    activePanel === "history" ? <HistoryPanel snapshots={activeSession.snapshots} onRestore={handleRestore} onClose={() => setActivePanel(null)} /> :
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
            <PrototypePanel htmlContent={activeSession.htmlContent} />
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
