import { useState, useCallback } from "react";
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
import type { ChatMessage } from "@/lib/types";
import { FileText, Code2, History, Copy, Download, Sun, Moon } from "lucide-react";
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
  const [isDark, setIsDark] = useState(true);
  const [isLoading, setIsLoading] = useState(false);

  const toggleTheme = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
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
      const response = await sendMessage(text);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.spec || response.text,
      };
      setMessages((prev) => [...prev, aiMsg]);

      // HTML만 있으면 Spec 유지, Spec만 있으면 Prototype 유지
      if (response.spec) setSpecContent(response.spec);
      if (response.html) setHtmlContent(response.html);

      setSnapshots((prev) => [
        ...prev,
        {
          spec: response.spec || activeSession.specContent,
          html: response.html || activeSession.htmlContent,
          timestamp: Date.now(),
          summary: text,
        },
      ]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: err instanceof Error
          ? `오류가 발생했습니다: ${err.message}`
          : "요청 처리 중 오류가 발생했습니다. 다시 시도해주세요.",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
    }
  }, [setMessages, setSpecContent, setHtmlContent, setSnapshots, activeSession.specContent, activeSession.htmlContent]);

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

  return (
    <div className="h-screen w-screen overflow-hidden bg-background flex relative">
      {/* Icon Sidebar */}
      <aside className="relative z-40 w-12 shrink-0 border-r bg-card flex flex-col items-center py-3 gap-1">
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

      {/* Push Side Panel */}
      {activePanel && (
        <div className="h-full w-[40%] shrink-0 border-r bg-background">
          {activePanel === "spec" && (
            <SpecPanel
              content={activeSession.specContent}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === "code" && (
            <CodeViewPanel
              htmlContent={activeSession.htmlContent}
              onClose={() => setActivePanel(null)}
            />
          )}
          {activePanel === "history" && (
            <HistoryPanel
              snapshots={activeSession.snapshots}
              onRestore={handleRestore}
              onClose={() => setActivePanel(null)}
            />
          )}
        </div>
      )}

      {/* Main Area: Chat + Preview */}
      <div className="flex-1 min-w-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={40} minSize={20} maxSize={60}>
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

          <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary" />

          <ResizablePanel defaultSize={60} minSize={30}>
            <PrototypePanel htmlContent={activeSession.htmlContent} />
          </ResizablePanel>
        </ResizablePanelGroup>
      </div>
    </div>
  );
};

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
