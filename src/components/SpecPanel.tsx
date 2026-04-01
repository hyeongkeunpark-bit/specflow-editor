import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Download, ZoomIn, ZoomOut, FileText, PanelRightClose } from "lucide-react";
import { toast } from "sonner";

interface SpecPanelProps {
  content: string;
  onClose?: () => void;
}

const SpecPanel = ({ content, onClose }: SpecPanelProps) => {
  const [zoom, setZoom] = useState(100);

  const handleCopy = () => {
    navigator.clipboard.writeText(content);
    toast.success("Spec이 클립보드에 복사되었습니다");
  };

  const handleDownload = () => {
    const blob = new Blob([content], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "spec.md";
    a.click();
    URL.revokeObjectURL(url);
  };

  const zoomIn = () => setZoom((z) => Math.min(z + 10, 200));
  const zoomOut = () => setZoom((z) => Math.max(z - 10, 50));

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">📄</span>
          <h2 className="text-sm font-semibold text-panel-header-foreground">Spec Document</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={zoomOut}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
            title="축소"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-xs text-muted-foreground w-8 text-center tabular-nums">{zoom}%</span>
          <button
            onClick={zoomIn}
            className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
            title="확대"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <div className="w-px h-4 bg-border mx-1" />
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
                title="다운로드 (.md)"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {content ? (
          <div
            className="markdown-body origin-top-left"
            style={{ transform: `scale(${zoom / 100})`, transformOrigin: "top left" }}
          >
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{content}</ReactMarkdown>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <FileText className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm text-center">
              채팅에서 Spec이 생성되면<br />여기에 표시됩니다
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SpecPanel;
