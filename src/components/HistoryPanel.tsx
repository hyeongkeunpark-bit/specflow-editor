import { useState } from "react";
import { History, RotateCcw, PanelRightClose, ArrowLeft } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

import type { Snapshot } from "@/lib/types";

interface HistoryPanelProps {
  snapshots: Snapshot[];
  onRestore: (index: number) => void;
  onClose?: () => void;
}

const HistoryPanel = ({ snapshots, onRestore, onClose }: HistoryPanelProps) => {
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);
  const [viewingIndex, setViewingIndex] = useState<number | null>(null);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  // ── 상세 뷰: 선택한 버전의 Spec 전체 보기 ──
  if (viewingIndex !== null) {
    const snap = snapshots[viewingIndex];
    const version = viewingIndex + 1;
    const isCurrent = viewingIndex === snapshots.length - 1;

    return (
      <div className="flex flex-col h-full bg-background">
        {/* Header */}
        <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-panel-header">
          <button
            onClick={() => setViewingIndex(null)}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
            title="목록으로 돌아가기"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-xs font-mono font-semibold text-primary">v{version}</span>
            <span className="text-xs text-muted-foreground">{formatTime(snap.timestamp)}</span>
            {isCurrent && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                현재
              </span>
            )}
          </div>
          {!isCurrent && (
            <button
              onClick={() => setConfirmIndex(viewingIndex)}
              className="shrink-0 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
              title="이 버전으로 되돌리기"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* 변경 요청 내용 */}
        <div className="px-4 py-2 border-b border-border/50 bg-muted/20">
          <p className="text-[11px] font-medium text-muted-foreground mb-1">변경 요청</p>
          <p className="text-xs text-foreground/70 whitespace-pre-wrap leading-relaxed">
            {snap.userMessage || snap.summary}
          </p>
        </div>

        {/* Spec content */}
        <div className="flex-1 overflow-y-auto p-4">
          {snap.spec ? (
            <div className="markdown-body text-sm">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{snap.spec}</ReactMarkdown>
            </div>
          ) : (
            <p className="text-muted-foreground text-sm text-center mt-8">
              이 버전에 Spec 내용이 없습니다.
            </p>
          )}
        </div>

        <RestoreDialog
          confirmIndex={confirmIndex}
          onClose={() => setConfirmIndex(null)}
          onRestore={(idx) => {
            onRestore(idx);
            setConfirmIndex(null);
            setViewingIndex(null);
          }}
        />
      </div>
    );
  }

  // ── 리스트 뷰 ──
  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-panel-header">
        {onClose && (
          <button
            onClick={onClose}
            className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors"
            title="패널 접기"
          >
            <PanelRightClose className="w-4 h-4" />
          </button>
        )}
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-panel-header-foreground">History</h2>
        <span className="ml-auto text-xs text-muted-foreground">{snapshots.length}개 버전</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {snapshots.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <History className="w-10 h-10 text-muted-foreground/30" />
            <p className="text-muted-foreground text-sm text-center">
              아직 히스토리가 없습니다.<br />채팅에서 응답이 생성되면 기록됩니다.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {[...snapshots].reverse().map((snap, reverseIdx) => {
              const idx = snapshots.length - 1 - reverseIdx;
              const version = idx + 1;
              const isCurrent = idx === snapshots.length - 1;
              return (
                <div
                  key={snap.timestamp}
                  className={`group rounded-md border px-3 py-2.5 cursor-pointer transition-colors ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-accent/30"
                  }`}
                  onClick={() => setViewingIndex(idx)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-mono font-semibold text-primary">v{version}</span>
                        <span className="text-xs text-muted-foreground">{formatTime(snap.timestamp)}</span>
                        {isCurrent && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/20 text-primary font-medium">
                            현재
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-foreground/80 leading-relaxed truncate">{snap.summary}</p>
                    </div>
                    {!isCurrent && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setConfirmIndex(idx);
                        }}
                        className="shrink-0 p-1.5 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors opacity-0 group-hover:opacity-100"
                        title="이 버전으로 되돌리기"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <RestoreDialog
        confirmIndex={confirmIndex}
        onClose={() => setConfirmIndex(null)}
        onRestore={(idx) => {
          onRestore(idx);
          setConfirmIndex(null);
        }}
      />
    </div>
  );
};

function RestoreDialog({
  confirmIndex,
  onClose,
  onRestore,
}: {
  confirmIndex: number | null;
  onClose: () => void;
  onRestore: (index: number) => void;
}) {
  return (
    <AlertDialog open={confirmIndex !== null} onOpenChange={(open) => !open && onClose()}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>이 버전으로 되돌리시겠습니까?</AlertDialogTitle>
          <AlertDialogDescription>
            v{confirmIndex !== null ? confirmIndex + 1 : ""}로 되돌립니다.
            되돌린 시점 이후의 모든 작업은 영구적으로 삭제됩니다.
            이 작업은 취소할 수 없습니다.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>취소</AlertDialogCancel>
          <AlertDialogAction
            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            onClick={() => {
              if (confirmIndex !== null) onRestore(confirmIndex);
            }}
          >
            되돌리기
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export default HistoryPanel;
