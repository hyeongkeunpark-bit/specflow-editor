import { useState, useRef, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Send, Paperclip, Menu, Plus, Trash2, Square, X } from "lucide-react";
import type { ChatMessage, Session } from "@/lib/types";
import { isImageFile, validateFileSize, resizeImage, type ResizedImage } from "@/lib/imageResize";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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

interface ChatPanelProps {
  messages: ChatMessage[];
  onSend: (message: string, images?: ResizedImage[]) => void;
  onCancel?: () => void;
  isLoading?: boolean;
  sessions: Session[];
  activeSessionId: string;
  onNewSession: () => void;
  onSwitchSession: (id: string) => void;
  onDeleteSession: (id: string) => void;
}

const WELCOME_MESSAGE = `Product Spec을 함께 만들어 보겠습니다.
편한 방식으로 시작해 주세요:

- 이미 정리된 문서가 있다면 — 전체 내용을 붙여넣거나 파일을 첨부해 주세요.
- 아직 생각 정리가 되지 않았다면 — 머릿속의 생각을 편하게 나열해 주세요.

💡 모르는 항목은 '모르겠어요'라고 하거나 '추천해줘'라고 해주세요.`;

const ChatPanel = ({
  messages,
  onSend,
  onCancel,
  isLoading = false,
  sessions,
  activeSessionId,
  onNewSession,
  onSwitchSession,
  onDeleteSession,
}: ChatPanelProps) => {
  const [input, setInput] = useState("");
  const [isComposing, setIsComposing] = useState(false);
  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);
  const [pendingImages, setPendingImages] = useState<ResizedImage[]>([]);
  const [pendingTextFile, setPendingTextFile] = useState<{ name: string; content: string } | null>(null);
  const MAX_IMAGES = 5;
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messagesContainerRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isAtBottomRef = useRef(true);
  const [showScrollBtn, setShowScrollBtn] = useState(false);

  const checkIsAtBottom = () => {
    const el = messagesContainerRef.current;
    if (!el) return true;
    return el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  };

  const handleScroll = () => {
    const atBottom = checkIsAtBottom();
    isAtBottomRef.current = atBottom;
    setShowScrollBtn(!atBottom);
  };

  const scrollToBottom = () => {
    isAtBottomRef.current = true;
    setShowScrollBtn(false);
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    if (isAtBottomRef.current) {
      scrollToBottom();
    }
  }, [messages]);

  const handleSend = () => {
    if (isLoading) return;
    const trimmed = input.trim();
    const hasAttachments = pendingImages.length > 0 || pendingTextFile;
    if (!trimmed && !hasAttachments) return;

    // 텍스트 파일 내용을 메시지에 포함
    let messageText = trimmed;
    if (pendingTextFile) {
      messageText = `[첨부 파일: ${pendingTextFile.name}]\n${pendingTextFile.content}${trimmed ? `\n\n${trimmed}` : ""}`;
    }

    onSend(messageText || "(이미지 첨부)", pendingImages.length > 0 ? pendingImages : undefined);
    setInput("");
    setPendingImages([]);
    setPendingTextFile(null);
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.nativeEvent.isComposing || isComposing) return;
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInput(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 160) + "px";
  };

  const handleFileAttach = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    e.target.value = "";

    for (const file of Array.from(files)) {
      if (isImageFile(file)) {
        const sizeError = validateFileSize(file);
        if (sizeError) {
          alert(`${file.name}: ${sizeError}`);
          continue;
        }
        if (pendingImages.length >= MAX_IMAGES) {
          alert(`이미지는 최대 ${MAX_IMAGES}장까지 첨부할 수 있습니다.`);
          break;
        }
        try {
          const resized = await resizeImage(file);
          setPendingImages((prev) => [...prev, resized].slice(0, MAX_IMAGES));
        } catch (err) {
          alert(`${file.name}: 이미지 처리 실패`);
        }
      } else {
        // 텍스트/HTML 파일 → 전송 대기
        const reader = new FileReader();
        reader.onload = (ev) => {
          const text = ev.target?.result as string;
          if (text) setPendingTextFile({ name: file.name, content: text });
        };
        reader.readAsText(file);
      }
    }
  };

  const formatDate = (ts: number) => {
    const d = new Date(ts);
    return `${d.getMonth() + 1}/${d.getDate()} ${d.getHours()}:${String(d.getMinutes()).padStart(2, "0")}`;
  };

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b bg-panel-header">
        <div className="flex items-center gap-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="p-1 rounded hover:bg-accent text-muted-foreground hover:text-accent-foreground transition-colors">
                <Menu className="w-4 h-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64">
              {sessions.map((s) => (
                <DropdownMenuItem
                  key={s.id}
                  className={`flex items-center justify-between gap-2 ${s.id === activeSessionId ? "bg-accent" : ""}`}
                  onSelect={() => onSwitchSession(s.id)}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm truncate">{s.title}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(s.createdAt)}</p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTargetId(s.id);
                    }}
                    className="p-1 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive shrink-0"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={onNewSession}>
                <Plus className="w-4 h-4 mr-2" />
                새 세션
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <div className="w-2 h-2 rounded-full bg-primary" />
          <h2 className="text-sm font-semibold text-panel-header-foreground">Chat</h2>
        </div>
      </div>

      {/* Messages */}
      <div ref={messagesContainerRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="flex items-center justify-center h-full">
            <p className="text-chat-placeholder text-sm text-center max-w-sm leading-relaxed whitespace-pre-wrap">
              {WELCOME_MESSAGE}
            </p>
          </div>
        )}
        {messages.map((msg) =>
          msg.role === "system" ? (
            <div key={msg.id} id={`msg-${msg.id}`} className="flex justify-center">
              <span className="text-sm text-muted-foreground">{msg.content}</span>
            </div>
          ) : (
            <div
              key={msg.id}
              id={`msg-${msg.id}`}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-chat-user text-chat-user-foreground whitespace-pre-wrap"
                    : "bg-chat-ai text-chat-ai-foreground chat-markdown"
                }`}
              >
                {msg.role === "ai" ? (
                  <ReactMarkdown remarkPlugins={[remarkGfm]}>{msg.content}</ReactMarkdown>
                ) : (
                  msg.content
                )}
              </div>
            </div>
          )
        )}
        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-chat-ai text-chat-ai-foreground max-w-[85%] rounded-lg px-3.5 py-2.5 text-sm">
              <span className="inline-flex items-center gap-1">
                응답을 생성하고 있습니다
                <span className="inline-flex">
                  <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                  <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
                </span>
              </span>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* ↓ 최신 메시지 플로팅 버튼 */}
      {showScrollBtn && (
        <div className="relative">
          <button
            onClick={scrollToBottom}
            className="absolute bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-medium shadow-lg hover:opacity-90 transition-opacity z-10"
          >
            ↓ 최신 메시지
          </button>
        </div>
      )}

      {/* Footer notice */}
      <div className="px-3 pb-1">
        <p className="text-[10px] text-muted-foreground text-center">
          대화 내용은 이 브라우저에 저장됩니다.<br />브라우저 데이터를 삭제하면 채팅 내역이 사라집니다.
        </p>
      </div>

      {/* Input */}
      <div className="border-t p-3">
        {/* 첨부 파일 미리보기 */}
        {(pendingImages.length > 0 || pendingTextFile) && (
          <div className="mb-2 px-2 flex flex-wrap items-center gap-2">
            {pendingImages.map((img, idx) => (
              <div key={idx} className="relative group">
                <img
                  src={img.base64}
                  alt={`첨부 이미지 ${idx + 1}`}
                  className="w-14 h-14 object-cover rounded border"
                />
                <button
                  onClick={() => setPendingImages((prev) => prev.filter((_, i) => i !== idx))}
                  className="absolute -top-1.5 -right-1.5 w-4 h-4 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </div>
            ))}
            {pendingTextFile && (
              <div className="flex items-center gap-1.5 px-2 py-1 bg-muted rounded text-xs">
                <span className="text-muted-foreground">{pendingTextFile.name}</span>
                <button
                  onClick={() => setPendingTextFile(null)}
                  className="p-0.5 rounded hover:bg-accent text-muted-foreground hover:text-foreground"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            )}
          </div>
        )}
        <div className="flex items-end gap-2 bg-secondary rounded-lg p-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".txt,.md,.html,.png,.jpg,.jpeg,.gif,.webp"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleFileAttach}
            disabled={isLoading}
            className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors disabled:opacity-30 shrink-0"
            title="파일 첨부 (이미지, .txt, .md, .html)"
          >
            <Paperclip className="w-4 h-4" />
          </button>
          <textarea
            ref={textareaRef}
            value={input}
            onChange={handleTextareaChange}
            onCompositionStart={() => setIsComposing(true)}
            onCompositionEnd={(e) => {
              setIsComposing(false);
              setInput(e.currentTarget.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={isLoading ? "다음 메시지를 미리 작성하세요..." : "메시지를 입력하세요..."}
            rows={1}
            className="flex-1 bg-transparent text-foreground text-sm resize-none outline-none placeholder:text-muted-foreground min-h-[24px] max-h-[160px] disabled:opacity-50"
          />
          {isLoading ? (
            <button
              onClick={onCancel}
              className="p-2 rounded-md bg-destructive text-destructive-foreground hover:opacity-90 transition-opacity shrink-0"
              title="답변 중단"
            >
              <Square className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleSend}
              disabled={!input.trim()}
              className="p-2 rounded-md bg-primary text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-30 disabled:cursor-not-allowed shrink-0"
            >
              <Send className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <AlertDialog open={!!deleteTargetId} onOpenChange={(open) => !open && setDeleteTargetId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>세션을 삭제하시겠습니까?</AlertDialogTitle>
            <AlertDialogDescription>
              이 세션의 대화 내용, 문서, 프로토타입이 모두 삭제됩니다. 이 작업은 되돌릴 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteTargetId) onDeleteSession(deleteTargetId);
                setDeleteTargetId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              삭제
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ChatPanel;
