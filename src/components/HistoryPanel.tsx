import { useState } from "react";
import { History, RotateCcw } from "lucide-react";
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

export interface Snapshot {
  spec: string;
  html: string;
  timestamp: number;
  summary: string;
}

interface HistoryPanelProps {
  snapshots: Snapshot[];
  onRestore: (index: number) => void;
}

const HistoryPanel = ({ snapshots, onRestore }: HistoryPanelProps) => {
  const [confirmIndex, setConfirmIndex] = useState<number | null>(null);

  const formatTime = (ts: number) => {
    const d = new Date(ts);
    return d.toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  };

  return (
    <div className="flex flex-col h-full bg-background">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b bg-panel-header">
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <h2 className="text-sm font-semibold text-panel-header-foreground">History</h2>
        <span className="ml-auto text-xs text-muted-foreground">{snapshots.length}개 버전</span>
      </div>

      <div className="flex-1 overflow-y-auto">
        {snapshots.length === 0 ? (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground text-sm text-center">
              아직 히스토리가 없습니다.<br />채팅에서 응답이 생성되면 기록됩니다.
            </p>
          </div>
        ) : (
          <div className="p-2 space-y-1">
            {[...snapshots].reverse().map((snap, reverseIdx) => {
              const idx = snapshots.length - 1 - reverseIdx;
              const version = idx + 1;
              const version = idx + 1;
              const isCurrent = idx === snapshots.length - 1;
              return (
                <div
                  key={snap.timestamp}
                  className={`group relative rounded-md border px-3 py-2.5 transition-colors ${
                    isCurrent
                      ? "border-primary/40 bg-primary/5"
                      : "border-border hover:border-primary/30 hover:bg-accent/30"
                  }`}
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
                        onClick={() => setConfirmIndex(idx)}
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

      <AlertDialog open={confirmIndex !== null} onOpenChange={(open) => !open && setConfirmIndex(null)}>
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
                if (confirmIndex !== null) {
                  onRestore(confirmIndex);
                  setConfirmIndex(null);
                }
              }}
            >
              되돌리기
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default HistoryPanel;
