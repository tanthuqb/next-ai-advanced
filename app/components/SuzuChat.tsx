"use client";

import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { DefaultChatTransport } from 'ai';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { SendIcon, User, Bot } from "lucide-react";
import { useEffect, useRef, useState } from "react";

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('');
}

export default function SuzuChat() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  });
  const [input, setInput] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const isLoading = status === 'submitted' || status === 'streaming';

  const handleSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const value = input.trim();

    if (!value) {
      return;
    }

    setInput('');
    void sendMessage({ text: value });
  };

  // Tự động cuộn xuống khi có tin nhắn mới
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo(0, scrollRef.current.scrollHeight);
    }
  }, [messages]);

  return (
    <div className="flex justify-center items-center min-h-screen bg-slate-50 p-4">
      <Card className="w-full max-w-2xl h-[80vh] flex flex-col shadow-xl border-none">
        <CardHeader className="border-b bg-white rounded-t-xl">
          <CardTitle className="flex items-center gap-3 text-primary">
            <div className="bg-primary/10 p-2 rounded-full">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <p className="text-lg font-bold">Suzu AI</p>
              <p className="text-xs text-muted-foreground font-normal">Cố vấn nghề nghiệp thực chiến</p>
            </div>
          </CardTitle>
        </CardHeader>

        <CardContent className="flex-1 overflow-hidden p-0 bg-slate-50/50">
          <ScrollArea ref={scrollRef} className="h-full p-4">
            <div className="space-y-4">
              {messages.length === 0 && (
                <div className="text-center py-10 text-muted-foreground">
                  <p className="text-sm italic">"Chào bạn, mình là Suzu. Hôm nay bạn muốn chinh phục mục tiêu nào?"</p>
                </div>
              )}
              
              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                  <div className={`flex gap-3 max-w-[80%] ${m.role === "user" ? "flex-row-reverse" : ""}`}>
                    <Avatar className="w-8 h-8 border">
                      {m.role === "user" ? (
                        <>
                          <AvatarImage src="/user-avatar.png" />
                          <AvatarFallback><User size={16} /></AvatarFallback>
                        </>
                      ) : (
                        <>
                          <AvatarImage src="/suzu-avatar.png" />
                          <AvatarFallback className="bg-primary text-white text-[10px]">SZ</AvatarFallback>
                        </>
                      )}
                    </Avatar>
                    
                    <div className={`rounded-2xl px-4 py-2 text-sm shadow-sm ${
                      m.role === "user" 
                        ? "bg-primary text-primary-foreground rounded-tr-none" 
                        : "bg-white text-slate-800 rounded-tl-none border"
                    }`}>
                      <div className="whitespace-pre-wrap leading-relaxed">
                        {getMessageText(m)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white border rounded-2xl rounded-tl-none px-4 py-2 shadow-sm">
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                      <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                    </span>
                  </div>
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>

        <CardFooter className="p-4 border-t bg-white rounded-b-xl">
          <form onSubmit={handleSubmit} className="flex w-full gap-2">
            <Input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Hỏi Suzu về kỹ năng, lương thưởng..."
              className="flex-1 focus-visible:ring-primary border-slate-200"
            />
            <Button type="submit" disabled={isLoading || !input} size="icon" className="shrink-0 transition-all active:scale-95">
              <SendIcon className="w-4 h-4" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  );
}