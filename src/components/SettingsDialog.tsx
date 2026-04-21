import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { Settings, Moon, Cpu, Database, Trash2 } from "lucide-react";
import { toast } from "sonner";

type SettingsTab = "model" | "appearance" | "storage";

const MODEL_KEY = "specbot_model";

type ModelOption = "claude-sonnet-4-6" | "claude-opus-4-6" | "claude-opus-4-7";

const MODEL_OPTIONS: { value: ModelOption; label: string; desc: string; disabled?: boolean }[] = [
  { value: "claude-sonnet-4-6", label: "Sonnet 4.6", desc: "균형 잡힌 성능과 속도" },
  { value: "claude-opus-4-7", label: "Opus 4.7", desc: "최고 품질, 느림, 비용 5배\n사용을 원하실 경우 담당자에게 문의해 주세요.", disabled: true },
];

function getStorageInfo() {
  let totalBytes = 0;
  const keys: { key: string; size: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      const value = localStorage.getItem(key) ?? "";
      const size = (key.length + value.length) * 2;
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
  const [activeTab, setActiveTab] = useState<SettingsTab>("model");
  const [model, setModel] = useState<ModelOption>(() => {
    const stored = localStorage.getItem(MODEL_KEY) as ModelOption | null;
    // UI에서 미노출된 모델(예: 과거 선택된 Opus 4.6)이 저장되어 있으면 Sonnet 4.6으로 리셋
    const visibleValues = MODEL_OPTIONS.filter((o) => !o.disabled).map((o) => o.value);
    if (stored && visibleValues.includes(stored)) return stored;
    if (stored !== "claude-sonnet-4-6") localStorage.setItem(MODEL_KEY, "claude-sonnet-4-6");
    return "claude-sonnet-4-6";
  });
  const [storageInfo, setStorageInfo] = useState<ReturnType<typeof getStorageInfo> | null>(null);

  useEffect(() => {
    if (open && activeTab === "storage") {
      setStorageInfo(getStorageInfo());
    }
  }, [open, activeTab]);

  const handleModelChange = (value: ModelOption) => {
    setModel(value);
    localStorage.setItem(MODEL_KEY, value);
    const label = MODEL_OPTIONS.find(o => o.value === value)?.label ?? value;
    toast.success(`모델 변경: ${label}`);
  };

  const handleClearStorage = () => {
    const sessionCount = JSON.parse(localStorage.getItem("specbot_sessions") || "[]").length;
    if (!window.confirm(`모든 데이터를 삭제합니다.\n(세션 ${sessionCount}개 포함)\n\n계속하시겠습니까?`)) return;

    localStorage.clear();
    toast.success("브라우저 저장소를 초기화했습니다. 새로고침합니다.");
    setTimeout(() => window.location.reload(), 1000);
  };

  const tabs: { id: SettingsTab; label: string; icon: React.ReactNode }[] = [
    { id: "model", label: "AI 모델", icon: <Cpu className="w-4 h-4" /> },
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

          <div className="flex-1 p-5">
            {activeTab === "model" && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-sm font-medium mb-1">AI 모델</h3>
                  <p className="text-xs text-muted-foreground mb-4">
                    Prototype/Spec 생성에 사용할 모델을 선택합니다.
                  </p>
                </div>
                <div className="space-y-2">
                  {MODEL_OPTIONS.map((opt) => (
                    <label
                      key={opt.value}
                      className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                        opt.disabled
                          ? "border-border bg-muted/30 cursor-not-allowed opacity-60"
                          : model === opt.value
                          ? "border-primary bg-primary/5 cursor-pointer"
                          : "border-border hover:bg-accent/30 cursor-pointer"
                      }`}
                    >
                      <input
                        type="radio"
                        name="model"
                        value={opt.value}
                        checked={model === opt.value}
                        onChange={() => !opt.disabled && handleModelChange(opt.value)}
                        disabled={opt.disabled}
                        className="accent-primary disabled:cursor-not-allowed"
                      />
                      <div>
                        <div className="text-sm font-medium">{opt.label}</div>
                        <div className="text-xs text-muted-foreground whitespace-pre-line">{opt.desc}</div>
                      </div>
                    </label>
                  ))}
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
