import { useState, useCallback } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import ChatPanel, { ChatMessage } from "@/components/ChatPanel";
import SpecPanel from "@/components/SpecPanel";
import PrototypePanel from "@/components/PrototypePanel";
import { generateDummyResponse } from "@/lib/dummyResponse";

const Index = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [specContent, setSpecContent] = useState("");
  const [htmlContent, setHtmlContent] = useState("");

  const handleSend = useCallback((text: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: "user",
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);

    // Simulate AI response after a short delay
    setTimeout(() => {
      const response = generateDummyResponse(text);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: "ai",
        content: response.text,
      };
      setMessages((prev) => [...prev, aiMsg]);
      setSpecContent(response.spec);
      setHtmlContent(response.html);
    }, 600);
  }, []);

  return (
    <div className="h-screen w-screen overflow-hidden bg-background">
      <ResizablePanelGroup direction="horizontal">
        {/* Chat Panel - 40% */}
        <ResizablePanel defaultSize={40} minSize={25} maxSize={60}>
          <ChatPanel messages={messages} onSend={handleSend} />
        </ResizablePanel>

        <ResizableHandle className="w-px bg-border hover:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary" />

        {/* Right Side - 60% */}
        <ResizablePanel defaultSize={60} minSize={30}>
          <ResizablePanelGroup direction="vertical">
            {/* Spec Panel */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <SpecPanel content={specContent} />
            </ResizablePanel>

            <ResizableHandle className="h-px bg-border hover:bg-primary/50 transition-colors data-[resize-handle-active]:bg-primary" />

            {/* Prototype Panel */}
            <ResizablePanel defaultSize={50} minSize={20}>
              <PrototypePanel htmlContent={htmlContent} />
            </ResizablePanel>
          </ResizablePanelGroup>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
};

export default Index;
