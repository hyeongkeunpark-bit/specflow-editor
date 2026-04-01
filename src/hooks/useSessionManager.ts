import { useState, useEffect, useCallback } from "react";
import type { Session, ChatMessage, Snapshot } from "@/lib/types";

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

function saveSessions(sessions: Session[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
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

  const activeSession = sessions.find((s) => s.id === activeSessionId) || sessions[0];

  // Persist on change
  useEffect(() => {
    saveSessions(sessions);
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
        if (filtered.length === 0) {
          const empty = createEmptySession();
          setActiveSessionId(empty.id);
          return [empty];
        }
        if (id === activeSessionId) {
          setActiveSessionId(filtered[0].id);
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
