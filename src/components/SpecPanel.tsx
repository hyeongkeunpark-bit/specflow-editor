import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Copy, Download, ZoomIn, ZoomOut, FileText, Pencil, Eye, RefreshCw, PanelRightClose } from "lucide-react";
import { toast } from "sonner";
import { containsSpecSection } from "@/lib/parser";

interface SpecPanelProps {
  content: string;
  /** Spec 직접 편집 시 콜백 */
  onEdit?: (content: string) => void;
  /** Prototype 동기화 필요 표시 (플로팅 버튼) */
  needsSync?: boolean;
  /** 플로팅 "Prototype 업데이트" 버튼 클릭 */
  onSyncToPrototype?: () => void;
  /** 로딩 중 여부 */
  isLoading?: boolean;
  onClose?: () => void;
}

const SpecPanel = ({ content, onEdit, needsSync, onSyncToPrototype, isLoading, onClose }: SpecPanelProps) => {
  const [zoom, setZoom] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // content prop 변경 시 editContent 동기화 (AI가 Spec을 업데이트한 경우)
  useEffect(() => {
    if (!isEditing) {
      setEditContent(content);
    }
  }, [content, isEditing]);

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

  const handleToggleEdit = () => {
    if (isEditing) {
      // 편집 모드 → 읽기 모드: 변경사항 저장
      if (editContent !== content) {
        onEdit?.(editContent);
      }
      setIsEditing(false);
    } else {
      // 읽기 모드 → 편집 모드
      setEditContent(content);
      setIsEditing(true);
      // textarea에 포커스
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
  };

  return (
    <div className="flex flex-col h-full bg-background relative">
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
          <span className="text-xs font-mono text-muted-foreground">📄</span>
          <h2 className="text-sm font-semibold text-panel-header-foreground">Spec Document</h2>
        </div>
        <div className="flex items-center gap-1">
          {content && onEdit && (
            <>
              <button
                onClick={handleToggleEdit}
                className={`p-1.5 rounded transition-colors ${
                  isEditing
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                title={isEditing ? "편집 완료 (읽기 모드)" : "편집 모드"}
              >
                {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </button>
              <div className="w-px h-4 bg-border mx-1" />
            </>
          )}
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
        {isEditing ? (
          <textarea
            ref={textareaRef}
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="w-full h-full min-h-[500px] p-2 rounded border bg-muted/30 font-mono text-sm leading-relaxed resize-none focus:outline-none focus:ring-1 focus:ring-primary"
            style={{ fontSize: `${zoom}%` }}
            spellCheck={false}
          />
        ) : content && containsSpecSection(content) ? (
          <div
            className="markdown-body"
            style={{ fontSize: `${zoom}%` }}
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

      {/* 플로팅 "Prototype 업데이트" 버튼 */}
      {needsSync && onSyncToPrototype && !isEditing && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={onSyncToPrototype}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Prototype 업데이트
          </button>
        </div>
      )}
    </div>
  );
};

export default SpecPanel;
