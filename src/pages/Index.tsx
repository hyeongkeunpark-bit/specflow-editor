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
import { sendMessage } from "@/lib/api";
import { mergeSpec, generateChangeSummary } from "@/lib/parser";
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

  /** 이전/이후 Spec을 비교하여 변경 요약 생성 */
  const summarizeChange = (prevSpec: string, newSpec: string): string => {
    return generateChangeSummary(prevSpec, newSpec);
  };

  const handleSend = useCallback(async (text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
    setIsLoading(true);

    // 스트리밍용 AI 메시지 placeholder
    const aiMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [...prev, { id: aiMsgId, role: "ai" as const, content: "" }]);

    try {
      // 스트리밍: 토큰 단위로 AI 메시지 업데이트
      const response = await sendMessage(
        text,
        activeSession.messages,
        activeSession.specContent || undefined,
        (token) => {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === aiMsgId ? { ...m, content: (m.content + token).trimStart().replace(/<\/?spec>/g, "") } : m,
            ),
          );
        },
      );

      // 스트리밍 완료 후: chatText로 AI 메시지 정리 (<spec> 태그, HTML 블록 제거된 전체 텍스트)
      const chatContent = response.chatText.trim();
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: chatContent || m.content } : m)),
      );

      // Spec 추출 결과가 있으면 문서 패널에 반영
      if (response.spec) {
        if (!activeSession.specContent) {
          // ── 초기 생성 ──
          setSpecContent(response.spec);
          if (response.html) setHtmlContent(response.html);
          setSnapshots((prev) => [
            ...prev,
            {
              spec: response.spec!,
              html: response.html || activeSession.htmlContent,
              timestamp: Date.now(),
              summary: "초기 생성",
            },
          ]);
          setMessages((prev) => [
            ...prev,
            { id: (Date.now() + 2).toString(), role: "system" as const, content: "📝 Spec 생성 완료. Prototype을 생성하려면 채팅으로 요청해 주세요." },
          ]);
        } else {
          // ── 수정 모드: merge ──
          const prevSpec = activeSession.specContent;
          const merged = mergeSpec(prevSpec, response.spec);
          const specChanged = merged !== prevSpec;

          if (specChanged) {
            setSpecContent(merged);
            if (response.html) setHtmlContent(response.html);
            setSnapshots((prev) => [
              ...prev,
              {
                spec: merged,
                html: response.html || activeSession.htmlContent,
                timestamp: Date.now(),
                summary: summarizeChange(prevSpec, merged),
              },
            ]);
            setMessages((prev) => [
              ...prev,
              { id: (Date.now() + 2).toString(), role: "system" as const, content: "📝 Spec 업데이트됨" },
            ]);
          }
        }
      }

      // HTML만 있는 경우 (Spec 없이 Prototype만 업데이트)
      if (!response.spec && response.html) {
        setHtmlContent(response.html);
        setMessages((prev) => [
          ...prev,
          { id: (Date.now() + 3).toString(), role: "system" as const, content: "🖥️ Prototype 업데이트됨" },
        ]);
      }
    } catch (err) {
      const errContent = err instanceof Error
        ? `오류가 발생했습니다: ${err.message}`
        : "요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.";
      setMessages((prev) =>
        prev.map((m) => (m.id === aiMsgId ? { ...m, content: errContent } : m)),
      );
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
