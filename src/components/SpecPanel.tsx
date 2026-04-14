import { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import MDEditor from "@uiw/react-md-editor";
import { Copy, Download, ZoomIn, ZoomOut, FileText, Pencil, Eye, Save, RefreshCw, PanelRightClose } from "lucide-react";
import { toast } from "sonner";
import { containsSpecSection } from "@/lib/parser";

interface SpecPanelProps {
  content: string;
  /** Spec 직접 편집 시 콜백 */
  onEdit?: (content: string) => void;
  /** Spec 동기화 필요 표시 (Prototype이 변경됨 → Spec 업데이트 필요) */
  needsSync?: boolean;
  /** 플로팅 "Spec 업데이트" 버튼 클릭 */
  onSyncToSpec?: () => void;
  /** 로딩 중 여부 */
  isLoading?: boolean;
  onClose?: () => void;
}

const SpecPanel = ({ content, onEdit, needsSync, onSyncToSpec, isLoading, onClose }: SpecPanelProps) => {
  const [zoom, setZoom] = useState(100);
  const [isEditing, setIsEditing] = useState(false);
  const [editContent, setEditContent] = useState(content);

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

  const isDirty = isEditing && editContent !== content;

  const handleToggleEdit = () => {
    if (isEditing) {
      // 편집 모드 → 읽기 모드 (변경 폐기)
      setEditContent(content);
      setIsEditing(false);
    } else {
      // 읽기 모드 → 편집 모드
      setEditContent(content);
      setIsEditing(true);
    }
  };

  const handleSave = () => {
    if (!isDirty) return;
    onEdit?.(editContent);
    setIsEditing(false);
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
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent hover:text-accent-foreground"
                }`}
                title={isEditing ? "편집 취소 (읽기 모드)" : "편집 모드"}
              >
                {isEditing ? <Eye className="w-3.5 h-3.5" /> : <Pencil className="w-3.5 h-3.5" />}
              </button>
              {isDirty && (
                <button
                  onClick={handleSave}
                  className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity"
                  title="변경사항 저장"
                >
                  <Save className="w-3 h-3" />
                  저장
                </button>
              )}
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

      <div className="flex-1 overflow-y-auto p-4" data-color-mode="light">
        {isEditing ? (
          <div style={{ fontSize: `${zoom}%` }}>
            <MDEditor
              value={editContent}
              onChange={(val) => setEditContent(val || "")}
              height="100%"
              minHeight={500}
              preview="live"
              visibleDragbar={false}
            />
          </div>
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

      {/* 플로팅 "Spec 업데이트" 버튼 — Prototype이 변경되어 Spec 동기화 필요 */}
      {needsSync && onSyncToSpec && !isEditing && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={onSyncToSpec}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Spec 문서 업데이트
          </button>
        </div>
      )}
    </div>
  );
};

export default SpecPanel;
