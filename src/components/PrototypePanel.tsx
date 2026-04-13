import { useState, useEffect, useCallback, useRef } from "react";
import { Monitor, Smartphone, Link, FileText, Wrench, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { injectErrorCapture, isIframeErrorEvent, type IframeError } from "@/lib/iframeErrors";

interface PrototypePanelProps {
  htmlContent: string;
  /** Spec 문서가 존재하는지 (빈 상태 CTA 조건) */
  hasSpecContent?: boolean;
  /** Prototype 변경 이력이 있는지 (Spec 업데이트 버튼 활성 조건) */
  hasProtoChanges?: boolean;
  /** 로딩 중 여부 */
  isLoading?: boolean;
  /** [Spec 문서 업데이트] 버튼 클릭 */
  onSpecUpdate?: () => void;
  /** [Prototype 생성] 버튼 클릭 (빈 상태 CTA) */
  onRequestPrototype?: () => void;
  /** iframe 런타임 에러 발생 시 콜백 */
  onErrors?: (errors: IframeError[]) => void;
  /** "에러 자동 수정" 버튼 클릭 �� 콜백 */
  onAutoFix?: () => void;
}

const PrototypePanel = ({
  htmlContent,
  hasSpecContent = false,
  hasProtoChanges = false,
  isLoading = false,
  onSpecUpdate,
  onRequestPrototype,
  onErrors,
  onAutoFix,
}: PrototypePanelProps) => {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [runtimeErrors, setRuntimeErrors] = useState<IframeError[]>([]);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const prevBlobRef = useRef<string>("");

  // htmlContent 변경 시 → blob URL 생성 + 에러 초기화
  useEffect(() => {
    setRuntimeErrors([]);

    // 이전 blob URL 해제
    if (prevBlobRef.current) {
      URL.revokeObjectURL(prevBlobRef.current);
      prevBlobRef.current = "";
    }

    if (!htmlContent) {
      setBlobUrl("");
      return;
    }

    const injected = injectErrorCapture(htmlContent);
    const blob = new Blob([injected], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    prevBlobRef.current = url;

    // 컴포넌트 언마운트 시 정리
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [htmlContent]);

  // iframe 새로고침 — blob URL 재생성으로 iframe 리로드
  const handleRefresh = useCallback(() => {
    if (!htmlContent) return;
    if (prevBlobRef.current) {
      URL.revokeObjectURL(prevBlobRef.current);
    }
    setRuntimeErrors([]);
    const injected = injectErrorCapture(htmlContent);
    const blob = new Blob([injected], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    setBlobUrl(url);
    prevBlobRef.current = url;
  }, [htmlContent]);

  // postMessage 리스너
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (isIframeErrorEvent(e.data)) {
        setRuntimeErrors(e.data.errors);
        onErrors?.(e.data.errors);
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [onErrors]);

  const handleGenerateUrl = () => {
    const blob = new Blob([htmlContent], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    navigator.clipboard.writeText(url);
    toast.success("미리보기 URL이 생성되어 클립보드에 복사되었습니다");
    window.open(url, "_blank");
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">⚡</span>
          <h2 className="text-sm font-semibold text-panel-header-foreground">Prototype Preview</h2>
          {runtimeErrors.length > 0 && (
            <>
              <span
                className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive text-destructive-foreground cursor-help"
                title={runtimeErrors.map(e => e.message).join("\n")}
              >
                {runtimeErrors.length} error{runtimeErrors.length > 1 ? "s" : ""}
              </span>
              {onAutoFix && (
                <button
                  onClick={onAutoFix}
                  disabled={isLoading}
                  className="ml-1 flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                  title="런타임 에러를 AI에게 자동 수정 요청"
                >
                  <Wrench className="w-2.5 h-2.5" />
                  자동 수정
                </button>
              )}
            </>
          )}
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
                onClick={handleRefresh}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                title="새로고침"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={handleGenerateUrl}
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                title="URL 생성"
              >
                <Link className="w-3.5 h-3.5" />
              </button>
            </>
          )}
          {htmlContent && onSpecUpdate && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={onSpecUpdate}
                disabled={isLoading || !hasProtoChanges}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                title="Prototype 변경사항을 Spec 문서에 반영"
              >
                <FileText className="w-3 h-3" />
                Spec 문서 업데이트
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-hidden flex items-center justify-center bg-card p-2">
        {htmlContent && blobUrl ? (
          <div
            className={`h-full bg-foreground/5 rounded border transition-all ${
              viewport === "mobile" ? "w-[375px] max-w-full" : "w-full max-w-[1280px]"
            }`}
          >
            <iframe
              src={blobUrl}
              className="w-full h-full rounded"
              sandbox="allow-scripts allow-same-origin allow-forms allow-modals allow-popups allow-downloads allow-pointer-lock allow-orientation-lock allow-presentation"
              title="Prototype Preview"
            />
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-4">
            <p className="text-muted-foreground text-sm text-center">
              Prototype이 생성되면<br />여기에서 미리 확인할 수 있습니다
            </p>
            {hasSpecContent && onRequestPrototype && (
              <button
                onClick={onRequestPrototype}
                disabled={isLoading}
                className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
              >
                Prototype 생성
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default PrototypePanel;
