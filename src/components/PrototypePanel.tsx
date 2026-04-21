import { useState, useEffect, useCallback, useRef } from "react";
import { Monitor, Smartphone, Share2, Check, Loader2, FileText, ListChecks, RefreshCw, Upload } from "lucide-react";
import { toast } from "sonner";
import { injectErrorCapture, isIframeErrorEvent, type IframeError } from "@/lib/iframeErrors";
import { sharePrototype } from "@/lib/api";

interface PrototypePanelProps {
  htmlContent: string;
  /** Spec 문서가 존재하는지 (빈 상태 CTA 조건) */
  hasSpecContent?: boolean;
  /** 로딩 중 여부 */
  isLoading?: boolean;
  /** 현재 세션 ID (공유 URL 키로 사용) */
  sessionId?: string;
  /** 기존 공유 URL (이미 공유된 경우) */
  shareUrl?: string;
  /** 공유 URL 변경 시 콜백 */
  onShareUrlChange?: (url: string) => void;
  /** [Use Case 분석] 버튼 클릭 */
  onEdgeCaseAnalysis?: () => void;
  /** Prototype 동기화 필요 표시 (Spec이 변경됨 → Prototype 업데이트 필요) */
  needsSync?: boolean;
  /** 플로팅 "Prototype 업데이트" 버튼 클릭 */
  onSyncToPrototype?: () => void;
  /** [Prototype 생성] 버튼 클릭 (빈 상태 CTA) */
  onRequestPrototype?: () => void;
  /** HTML 파일 직접 로드 (html, filename) */
  onLoadHtml?: (html: string, filename: string) => void;
  /** iframe 런타임 에러 발생 시 콜백 */
  onErrors?: (errors: IframeError[]) => void;
}

const PrototypePanel = ({
  htmlContent,
  hasSpecContent = false,
  isLoading = false,
  sessionId,
  shareUrl,
  onShareUrlChange,
  onEdgeCaseAnalysis,
  needsSync,
  onSyncToPrototype,
  onRequestPrototype,
  onLoadHtml,
  onErrors,
}: PrototypePanelProps) => {
  const [viewport, setViewport] = useState<"desktop" | "mobile">("desktop");
  const [runtimeErrors, setRuntimeErrors] = useState<IframeError[]>([]);
  const [blobUrl, setBlobUrl] = useState<string>("");
  const prevBlobRef = useRef<string>("");
  const [isSharing, setIsSharing] = useState(false);
  const [justCopied, setJustCopied] = useState(false);

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

  const handleShare = useCallback(async () => {
    if (!htmlContent || !sessionId || isSharing) return;
    setIsSharing(true);
    try {
      const { url } = await sharePrototype(htmlContent, sessionId);
      onShareUrlChange?.(url);
      await navigator.clipboard.writeText(url);
      setJustCopied(true);
      setTimeout(() => setJustCopied(false), 2000);
      toast.success(
        shareUrl ? "공유 URL이 업데이트되어 클립보드에 복사되었습니다" : "공유 URL이 생성되어 클립보드에 복사되었습니다",
      );
    } catch (err: any) {
      toast.error(`공유 실패: ${err.message}`);
    } finally {
      setIsSharing(false);
    }
  }, [htmlContent, sessionId, isSharing, shareUrl, onShareUrlChange]);

  const handleCopyShareUrl = useCallback(async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setJustCopied(true);
    setTimeout(() => setJustCopied(false), 2000);
    toast.success("공유 URL이 클립보드에 복사되었습니다");
  }, [shareUrl]);

  return (
    <div className="flex flex-col h-full bg-background relative">
      <div className="flex items-center justify-between px-4 py-2.5 border-b bg-panel-header">
        <div className="flex items-center gap-2">
          <span className="text-xs font-mono text-muted-foreground">⚡</span>
          <h2 className="text-sm font-semibold text-panel-header-foreground">Prototype Preview</h2>
          {runtimeErrors.length > 0 && (
            <span
              className="ml-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-destructive text-destructive-foreground cursor-help"
              title={runtimeErrors.map(e => e.message).join("\n")}
            >
              {runtimeErrors.length} error{runtimeErrors.length > 1 ? "s" : ""}
            </span>
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
              {shareUrl && (
                <button
                  onClick={handleCopyShareUrl}
                  className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
                  title={`공유 URL 복사\n${shareUrl}`}
                >
                  {justCopied ? <Check className="w-3.5 h-3.5 text-green-500" /> : <Share2 className="w-3.5 h-3.5" />}
                </button>
              )}
              <button
                onClick={handleShare}
                disabled={isSharing || isLoading}
                className="flex items-center gap-1 px-2 py-1 rounded text-xs font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                title={shareUrl ? "공유 URL 업데이트 (같은 URL에 최신 내용 반영)" : "공유 URL 생성"}
              >
                {isSharing ? (
                  <Loader2 className="w-3 h-3 animate-spin" />
                ) : (
                  <Share2 className="w-3 h-3" />
                )}
                {shareUrl ? "업데이트" : "공유"}
              </button>
            </>
          )}
          {htmlContent && onEdgeCaseAnalysis && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <button
                onClick={onEdgeCaseAnalysis}
                disabled={isLoading}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                title="Prototype의 누락된 Use Case와 Edge Case를 분석합니다"
              >
                <ListChecks className="w-3 h-3" />
                Use Case 분석
              </button>
            </>
          )}
          {htmlContent && onLoadHtml && (
            <>
              <div className="w-px h-4 bg-border mx-1" />
              <label
                className="p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors cursor-pointer"
                title="HTML 파일 업로드 (기존 내용 덮어씀, 히스토리에서 복원 가능)"
              >
                <Upload className="w-3.5 h-3.5" />
                <input
                  type="file"
                  accept=".html,.htm"
                  className="hidden"
                  onClick={(e) => {
                    const ok = window.confirm(
                      "현재 Prototype을 업로드한 파일로 덮어씁니다.\n\n덮어쓴 후에도 히스토리에서 이전 내용으로 돌아갈 수 있습니다.\n\n계속하시겠습니까?"
                    );
                    if (!ok) e.preventDefault();
                  }}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) { toast.error("2MB 이하 파일만 가능합니다."); return; }
                    file.text().then((text) => { onLoadHtml(text, file.name); });
                    e.target.value = "";
                  }}
                />
              </label>
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
            <div className="flex items-center gap-2">
              {hasSpecContent && onRequestPrototype && (
                <button
                  onClick={onRequestPrototype}
                  disabled={isLoading}
                  className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed"
                >
                  Prototype 생성
                </button>
              )}
              {onLoadHtml && (
                <label className="flex items-center gap-1.5 px-4 py-2 rounded-md text-sm font-medium border border-border text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors cursor-pointer">
                  <Upload className="w-3.5 h-3.5" />
                  HTML 불러오기
                  <input
                    type="file"
                    accept=".html,.htm"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      if (file.size > 2 * 1024 * 1024) { toast.error("2MB 이하 파일만 가능합니다."); return; }
                      file.text().then((text) => { onLoadHtml(text, file.name); });
                      e.target.value = "";
                    }}
                  />
                </label>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 플로팅 "Prototype 업데이트" 버튼 — Spec이 변경되어 Prototype 동기화 필요 */}
      {needsSync && onSyncToPrototype && (
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-10">
          <button
            onClick={onSyncToPrototype}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2.5 rounded-full shadow-lg bg-amber-600 text-white hover:bg-amber-700 transition-colors disabled:opacity-40 disabled:cursor-not-allowed text-sm font-medium"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
            Prototype에 반영하기
          </button>
        </div>
      )}
    </div>
  );
};

export default PrototypePanel;
