import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Settings, Moon, Palette, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";

type SettingsTab = "wds" | "appearance" | "storage";

const WDS_MCP_KEY = "specbot_wds_mcp_enabled";

function getStorageInfo() {
  let totalBytes = 0;
  const keys: { key: string; size: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) ?? "";
      const size = (key.length + value.length) * 2; // UTF-16
      totalBytes += size;
      keys.push({ key, size });
    }
  }
  keys.sort((a, b) => b.size - a.size);
  return { totalBytes, keys };
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function SettingsDialog({
  open,
  onOpenChange,
  isDark,
  onToggleTheme,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isDark: boolean;
  onToggleTheme: () => void;
}) {
  const [activeTab, setActiveTab] = useState<SettingsTab>("wds");
  const [wdsMcpEnabled, setWdsMcpEnabled] = useState(() => {
    const saved = localStorage.getItem(WDS_MCP_KEY);
    return saved === null ? true : saved === "true";
  });
  const [storageInfo, setStorageInfo] = useState<ReturnType<typeof getStorageInfo> | null>(null);

  useEffect(() => {
    if (open && activeTab === "storage") {
      setStorageInfo(getStorageInfo());
    }
  }, [open, activeTab]);

  const handleWdsMcpToggle = (checked: boolean) => {
    setWdsMcpEnabled(checked);
    localStorage.setItem(WDS_MCP_KEY, String(checked));
    toast.success(checked ? "WDS 디자인 시스템 활성화" : "WDS 디자인 시스템 비활성화");
  };

  const handleClearStorage = () => {
    const sessionCount = JSON.parse(localStorage.getItem("specbot_sessions") || "[]").length;
    if (!window.confirm(`모든 데이터를 삭제합니다.\n(세션 ${sessionCount}개 포함)\n\n계속하시겠습니까?`)) return;

    localStorage.clear();
    toast.success("브라우저 저장소를 초기화했습니다. 새로고침합니다.");
    setTimeout(() => window.location.reload(), 1000);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "wds", label: "디자인 시스템", icon: <Palette className="w-4 h-4" /> },
    { id: "appearance", label: "화면 설정", icon: <Moon className="w-4 h-4" /> },
    { id: "storage", label: "저장소 관리", icon: <Database className="w-4 h-4" /> },
  ];

  const limitBytes = 5 * 1024 * 1024;
  const usagePercent = storageInfo ? Math.min((storageInfo.totalBytes / limitBytes) * 100, 100) : 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[540px] p-0 gap-0">
        <DialogHeader className="px-6 pt-5 pb-4 border-b border-border">
          <DialogTitle className="flex items-center gap-2 text-base">
            <Settings className="w-4 h-4" />
            설정
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-[300px]">
          {/* 좌측 메뉴 */}
          <nav className="w-[160px] border-r border-border p-2 flex flex-col gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-2 rounded-md text-sm transition-colors text-left ${
                  activeTab === tab.id
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
                }`}
              >
                {tab.icon}
                {tab.label}
              </button>
            ))}
          </nav>

          {/* 우측 콘텐츠 */}
          <div className="flex-1 p-5">
            {activeTab === "wds" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">WDS (Wanted Design System)</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    활성화하면 Prototype 생성 시 WDS 컴포넌트를 활용합니다.
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <div className="text-sm font-medium">WDS MCP 사용</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      Prototype에 WDS 스타일 적용
                    </div>
                  </div>
                  <Switch checked={wdsMcpEnabled} onCheckedChange={handleWdsMcpToggle} />
                </div>
              </div>
            )}

            {activeTab === "appearance" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">화면 설정</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    에디터의 테마를 변경합니다.
                  </p>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                  <div>
                    <div className="text-sm font-medium">다크 모드</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {isDark ? "현재 다크 모드" : "현재 라이트 모드"}
                    </div>
                  </div>
                  <Switch checked={isDark} onCheckedChange={onToggleTheme} />
                </div>
              </div>
            )}

            {activeTab === "storage" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">브라우저 저장소</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    세션, 설정 등 로컬 데이터를 관리합니다.
                  </p>
                </div>

                {storageInfo && (
                  <>
                    {/* 사용량 바 */}
                    <div className="p-3 rounded-lg border border-border space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>사용량</span>
                        <span className="font-mono text-xs">
                          {formatBytes(storageInfo.totalBytes)} / {formatBytes(limitBytes)}
                        </span>
                      </div>
                      <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            usagePercent > 80 ? "bg-red-500" : usagePercent > 50 ? "bg-amber-500" : "bg-primary"
                          }`}
                          style={{ width: `${usagePercent}%` }}
                        />
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {usagePercent.toFixed(1)}% 사용 중
                      </div>
                    </div>

                    {/* 항목별 사용량 */}
                    <div className="p-3 rounded-lg border border-border space-y-1.5">
                      <div className="text-sm font-medium mb-2">항목별 사용량</div>
                      {storageInfo.keys.slice(0, 5).map(({ key, size }) => (
                        <div key={key} className="flex justify-between text-xs">
                          <span className="text-muted-foreground truncate max-w-[180px]">{key}</span>
                          <span className="font-mono">{formatBytes(size)}</span>
                        </div>
                      ))}
                    </div>
                  </>
                )}

                {/* 전체 삭제 */}
                <button
                  onClick={handleClearStorage}
                  className="flex items-center gap-2 w-full px-3 py-2.5 rounded-lg border border-red-200 dark:border-red-900 text-red-600 dark:text-red-400 text-sm hover:bg-red-50 dark:hover:bg-red-950 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  전체 데이터 삭제
                </button>
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
