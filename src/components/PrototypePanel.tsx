import { useState } from "react";
import { Copy, Download, Monitor, Smartphone } from "lucide-react";
import { toast } from "sonner";

interface PrototypePanelProps {
  htmlContent: string;
}

const PrototypePanel = ({ htmlContent }: PrototypePanelProps) => {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");

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
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">⚡</span>
          <h2 className="text-sm font-semibold text-panel-header-foreground">Prototype Preview</h2>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setViewport("desktop")}
            className={`p-1.5 rounded transition-colors ${
              viewport === "desktop"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            title="Desktop"
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => setViewport("mobile")}
            className={`p-1.5 rounded transition-colors ${
              viewport === "mobile"
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
            }`}
            title="Mobile"
          >
            <Smartphone className="w-3.5 h-3.5" />
          </button>
          {htmlContent && (
            <>
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
                title="다운로드 (.html)"
              >
                <Download className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 overflow-hidden flex items-center justify-center bg-card p-2">
        {htmlContent ? (
          <div
            className={`h-full bg-foreground/5 rounded border transition-all ${
              viewport === "mobile" ? "w-[375px]" : "w-full"
            }`}
          >
            <iframe
              srcDoc={htmlContent}
              className="w-full h-full rounded"
              sandbox="allow-scripts"
              title="Prototype Preview"
            />
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center">
            Prototype이 생성되면<br />여기에서 미리 확인할 수 있습니다
          </p>
        )}
      </div>
    </div>
  );
};

export default PrototypePanel;
