'use client'

import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { useState, useRef, useEffect } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { SendIcon, Bot, User, Sparkles } from "lucide-react"

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

export default function ChatPage() {
  const { messages, sendMessage, status } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const loading = status === 'submitted' || status === 'streaming'

  // Tự động cuộn xuống khi có tin nhắn mới
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
  }, [messages, loading])

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!input || loading) return

    const userMsg = input.trim()

    if (!userMsg) return

    setInput('')

    await sendMessage({ text: userMsg })
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eff6ff,_#e2e8f0_55%,_#dbe4f0)] p-4 font-sans sm:p-6">
      <Card className="flex h-[88vh] w-full max-w-3xl flex-col overflow-hidden border-none shadow-2xl shadow-slate-300/60">
        {/* Header xịn xò */}
        <CardHeader className="flex flex-row items-center justify-between border-b bg-white/95 py-4 px-5 backdrop-blur sm:px-6">
          <div className="flex items-center gap-3">
            <div className="bg-blue-600 p-2 rounded-lg shadow-blue-200 shadow-lg">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div>
              <CardTitle className="text-lg font-bold text-slate-800">Suzu AI</CardTitle>
              <div className="flex items-center gap-1">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
                </span>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Cố vấn thực chiến</p>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0">v2.0 Flash</Badge>
        </CardHeader>

        {/* Khu vực tin nhắn */}
        <CardContent className="min-h-0 flex-1 bg-slate-50/40 p-0">
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-40 text-center space-y-3">
                  <div className="bg-white p-4 rounded-full shadow-sm border">
                    <Sparkles className="w-6 h-6 text-blue-500 animate-pulse" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-[250px]">
                    Suzu đã sẵn sàng. Hãy thử hỏi về lộ trình phát triển kỹ năng của bạn!
                  </p>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex max-w-[90%] gap-3 sm:max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <Avatar className={`w-8 h-8 border-2 ${m.role === 'user' ? 'border-blue-100' : 'border-white'}`}>
                      {m.role === 'user' ? (
                        <AvatarFallback className="bg-slate-200 text-slate-600 text-xs"><User size={14}/></AvatarFallback>
                      ) : (
                        <AvatarFallback className="bg-blue-600 text-white text-[10px]">SZ</AvatarFallback>
                      )}
                    </Avatar>
                    
                    <div className={`rounded-2xl p-3.5 text-sm leading-relaxed shadow-sm ${
                      m.role === 'user' 
                        ? 'bg-blue-600 text-white rounded-tr-none' 
                        : 'bg-white border border-slate-200 text-slate-800 rounded-tl-none'
                    }`}>
                      <div className="whitespace-pre-wrap break-words">{getMessageText(m)}</div>
                    </div>
                  </div>
                </div>
              ))}

              {loading && messages[messages.length - 1]?.role !== 'assistant' && (
                <div className="flex justify-start items-center gap-3">
                  <Avatar className="w-8 h-8 border-2 border-white">
                    <AvatarFallback className="bg-blue-600 text-white text-[10px]">SZ</AvatarFallback>
                  </Avatar>
                  <div className="bg-white border p-3 rounded-2xl rounded-tl-none shadow-sm flex gap-1">
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.2s]"></span>
                    <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}

              <div ref={endRef} />
            </div>
          </ScrollArea>
        </CardContent>

        {/* Input Footer */}
        <CardFooter className="border-t bg-white/95 p-3 backdrop-blur sm:p-4">
          <form onSubmit={handleManualSubmit} className="flex w-full gap-2 items-end">
            <div className="relative flex-1">
              <Input
                className="rounded-xl border-slate-200 bg-slate-50/70 py-6 pr-10 focus-visible:ring-blue-500"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Nhắn gì đó cho Suzu..."
                disabled={loading}
              />
            </div>
            <Button 
              type="submit" 
              disabled={loading || !input}
              className="h-[52px] w-[52px] rounded-xl bg-blue-600 hover:bg-blue-700 transition-all shadow-lg shadow-blue-200 active:scale-95"
            >
              <SendIcon className="w-5 h-5" />
            </Button>
          </form>
        </CardFooter>
      </Card>
    </div>
  )
}