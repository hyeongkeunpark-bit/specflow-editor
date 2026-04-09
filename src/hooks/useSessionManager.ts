import { useState, useEffect, useCallback, useRef } from "react";
import type { Session, ChatMessage, Snapshot } from "@/lib/types";
import { toast } from "sonner";

const STORAGE_KEY = "specbot_sessions";
const ACTIVE_KEY = "specbot_active_session";

function loadSessions(): Session[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

/** localStorage 사용률 계산 (0~1) */
function getStorageUsage(): number {
  let total = 0;
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key) {
      total += key.length + (localStorage.getItem(key)?.length ?? 0);
    }
  }
  // localStorage는 UTF-16이므로 char당 2바이트, 보수적으로 5MB 기준
  const limitBytes = 5 * 1024 * 1024;
  return (total * 2) / limitBytes;
}

type StorageLevel = "normal" | "warning" | "full";

function getStorageLevel(usage: number): StorageLevel {
  if (usage >= 1) return "full";
  if (usage >= 0.8) return "warning";
  return "normal";
}

function saveSessions(sessions: Session[]): boolean {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
    return true;
  } catch {
    return false;
  }
}

function saveActiveId(id: string) {
  localStorage.setItem(ACTIVE_KEY, id);
}

function loadActiveId(): string | null {
  return localStorage.getItem(ACTIVE_KEY);
}

function createEmptySession(): Session {
  return {
    id: Date.now().toString(),
    title: "새 세션",
    createdAt: Date.now(),
    messages: [],
    specContent: "",
    htmlContent: "",
    snapshots: [],
  };
}

export function useSessionManager() {
  const [sessions, setSessions] = useState<Session[]>(() => {
    const loaded = loadSessions();
    if (loaded.length === 0) {
      const empty = createEmptySession();
      return [empty];
    }
    return loaded;
  });

  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    const loaded = loadSessions();
    const savedId = loadActiveId();
    if (savedId && loaded.some((s) => s.id === savedId)) return savedId;
    return loaded.length > 0 ? loaded[0].id : createEmptySession().id;
  });

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0] || {
    id: "",
    title: "새 세션",
    createdAt: Date.now(),
    messages: [] as ChatMessage[],
    specContent: "",
    htmlContent: "",
    snapshots: [] as Snapshot[],
  };

  // 이전 저장소 레벨 추적 (동일 레벨 반복 알림 방지)
  const prevLevelRef = useRef<StorageLevel>("normal");

  // Persist on change + 용량 체크
  useEffect(() => {
    const saved = saveSessions(sessions);

    if (!saved) {
      toast.error(
        "브라우저 용량을 전부 사용했습니다. 이후 내용은 저장되지 않습니다.\n기존 대화를 삭제해 용량을 확보해 주세요.",
        { duration: Infinity, id: "storage-full" },
      );
      prevLevelRef.current = "full";
      return;
    }

    const usage = getStorageUsage();
    const level = getStorageLevel(usage);

    if (level !== prevLevelRef.current) {
      prevLevelRef.current = level;

      if (level === "full") {
        toast.error(
          "브라우저 용량을 전부 사용했습니다. 이후 내용은 저장되지 않습니다.\n기존 대화를 삭제해 용량을 확보해 주세요.",
          { duration: Infinity, id: "storage-full" },
        );
      } else if (level === "warning") {
        toast.warning(
          "브라우저 용량을 80% 이상 사용하였습니다.\n용량을 100% 사용한 이후 내용은 저장되지 않습니다.\n기존 대화를 삭제해 용량을 확보해 주세요.",
          { duration: 10000, id: "storage-warning" },
        );
      }
      // normal로 돌아오면 기존 toast 자동 해제 (id 기반)
    }
  }, [sessions]);

  useEffect(() => {
    saveActiveId(activeSessionId);
  }, [activeSessionId]);

  const updateActiveSession = useCallback(
    (updater: (s: Session) => Session) => {
      setSessions((prev) =>
        prev.map((s) => (s.id === activeSessionId ? updater(s) : s))
      );
    },
    [activeSessionId]
  );

  const setMessages = useCallback(
    (updater: (prev: ChatMessage[]) => ChatMessage[]) => {
      updateActiveSession((s) => {
        const newMessages = updater(s.messages);
        const title =
          s.title === "새 세션" && newMessages.length > 0
            ? newMessages.find((m) => m.role === "user")?.content.slice(0, 30) || s.title
            : s.title;
        return { ...s, messages: newMessages, title };
      });
    },
    [updateActiveSession]
  );

  const setSpecContent = useCallback(
    (spec: string) => updateActiveSession((s) => ({ ...s, specContent: spec })),
    [updateActiveSession]
  );

  const setHtmlContent = useCallback(
    (html: string) => updateActiveSession((s) => ({ ...s, htmlContent: html })),
    [updateActiveSession]
  );

  const setSnapshots = useCallback(
    (updater: (prev: Snapshot[]) => Snapshot[]) => {
      updateActiveSession((s) => ({ ...s, snapshots: updater(s.snapshots) }));
    },
    [updateActiveSession]
  );

  const createNewSession = useCallback(() => {
    const newSession = createEmptySession();
    setSessions((prev) => [newSession, ...prev]);
    setActiveSessionId(newSession.id);
  }, []);

  const switchSession = useCallback((id: string) => {
    setActiveSessionId(id);
  }, []);

  const deleteSession = useCallback(
    (id: string) => {
      setSessions((prev) => {
        const filtered = prev.filter((s) => s.id !== id);
        if (id === activeSessionId) {
          // 현재 세션 삭제 → 새 세션 생성
          const newSession = createEmptySession();
          setActiveSessionId(newSession.id);
          return [newSession, ...filtered];
        }
        if (filtered.length === 0) {
          const empty = createEmptySession();
          setActiveSessionId(empty.id);
          return [empty];
        }
        return filtered;
      });
    },
    [activeSessionId]
  );

  return {
    sessions,
    activeSession,
    activeSessionId,
    setMessages,
    setSpecContent,
    setHtmlContent,
    setSnapshots,
    createNewSession,
    switchSession,
    deleteSession,
  };
}
