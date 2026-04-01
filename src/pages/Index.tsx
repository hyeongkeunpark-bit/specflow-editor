import { useState, useCallback } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import ChatPanel, { ChatMessage } from "@/components/ChatPanel";
import SpecPanel from "@/components/SpecPanel";
import PrototypePanel from "@/components/PrototypePanel";
import HistoryPanel, { Snapshot } from "@/components/HistoryPanel";
import { generateDummyResponse } from "@/lib/dummyResponse";
import { FileText, Code2, History, Copy, Download, ZoomIn, ZoomOut, Link } from "lucide-react";
import { toast } from "sonner";

type SidePanel = "spec" | "code" | "history" | null;

const Index = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [specContent, setSpecContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");
  const [snapshots, setSnapshots] = useState<Snapshot[]>([]);
  const [activePanel, setActivePanel] = useState<SidePanel>(null);

  const handleSend = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    setTimeout(() => {
      const response = generateDummyResponse(text);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.text,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setSpecContent(response.spec);
      setHtmlContent(response.html);
    }, 600);
  }, []);

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
          label="Code"
          active={activePanel === "code"}
          onClick={() => togglePanel("code")}
        />
      </aside>

      {/* Overlay Side Panel */}
      <div
        className={`absolute left-12 top-0 h-full w-[720px] z-30 border-r bg-background shadow-2xl shadow-black/40 transition-transform duration-250 ease-in-out ${
          activePanel ? "translate-x-0" : "-translate-x-full pointer-events-none"
        }`}
      >
        {activePanel === "spec" && <SpecPanel content={specContent} />}
        {activePanel === "code" && <CodeViewPanel htmlContent={htmlContent} />}
      </div>

      {/* Backdrop */}
      {activePanel && (
        <div
          className="absolute inset-0 left-12 z-20 bg-black/20"
          onClick={() => setActivePanel(null)}
        />
      )}

      {/* Main Area: Chat + Preview */}
      <div className="flex-1 min-w-0">
        <ResizablePanelGroup direction="horizontal">
          <ResizablePanel defaultSize={50} minSize={25} maxSize={70}>
            <ChatPanel messages={messages} onSend={handleSend} />
          </ResizablePanel>

          <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary" />

          <ResizablePanel defaultSize={50} minSize={25}>
            <PrototypePanel htmlContent={htmlContent} />
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

function CodeViewPanel({ htmlContent }: { htmlContent: string }) {
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
          <div className="flex items-center justify-center h-full">
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
