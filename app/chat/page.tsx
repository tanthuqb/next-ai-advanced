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
import { SendIcon, Bot, User, Sparkles, FileText } from "lucide-react"
import { Streamdown } from 'streamdown'
import { CHAT_MODEL_LABEL } from '@/lib/models'

type Source = {
  id: number
  title: string
  similarity: number
  snippet: string
}

function getMessageSources(message: UIMessage): Source[] {
  const sources = (message.metadata as { sources?: Source[] } | undefined)?.sources
  return Array.isArray(sources) ? sources : []
}

const SUGGESTED_QUESTIONS = [
  'What roles is SuZu Group hiring for?',
  'How should I prepare my portfolio?',
  'Help me plan a career switch into media',
]

function getMessageText(message: UIMessage) {
  return message.parts
    .filter((part): part is Extract<UIMessage['parts'][number], { type: 'text' }> => part.type === 'text')
    .map((part) => part.text)
    .join('')
}

export default function ChatPage() {
  const { messages, sendMessage, status, error } = useChat({
    transport: new DefaultChatTransport({ api: '/api/chat' }),
  })
  const [input, setInput] = useState('')
  const scrollRef = useRef<HTMLDivElement>(null)
  const endRef = useRef<HTMLDivElement>(null)
  const loading = status === 'submitted' || status === 'streaming'

  // Auto-scroll to the bottom when a new message arrives
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
        {/* Fancy header */}
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
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">AI Career Advisor · RAG-powered</p>
              </div>
            </div>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px] px-2 py-0">{CHAT_MODEL_LABEL}</Badge>
        </CardHeader>

        {/* Message area */}
        <CardContent className="min-h-0 flex-1 bg-slate-50/40 p-0">
          <ScrollArea ref={scrollRef} className="h-full">
            <div className="space-y-6 px-4 py-5 sm:px-6 sm:py-6">
              {messages.length === 0 && (
                <div className="flex flex-col items-center justify-center h-52 text-center space-y-4">
                  <div className="bg-white p-4 rounded-full shadow-sm border">
                    <Sparkles className="w-6 h-6 text-blue-500 animate-pulse" />
                  </div>
                  <p className="text-sm text-slate-500 max-w-[250px]">
                    Suzu is ready. Ask anything, or start with one of these:
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 px-4">
                    {SUGGESTED_QUESTIONS.map((q) => (
                      <button
                        key={q}
                        type="button"
                        onClick={() => sendMessage({ text: q })}
                        className="rounded-full border border-slate-200 bg-white px-3.5 py-1.5 text-xs text-slate-600 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((m) => (
                <div key={m.id} data-testid="chat-message" data-role={m.role} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
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
                      {m.role === 'user' ? (
                        <div className="whitespace-pre-wrap break-words">{getMessageText(m)}</div>
                      ) : (
                        <>
                          <Streamdown className="[&>*:first-child]:mt-0 [&>*:last-child]:mb-0">
                            {getMessageText(m)}
                          </Streamdown>
                          {getMessageSources(m).length > 0 && (
                            <details className="mt-3 border-t border-slate-100 pt-2 text-xs text-slate-500">
                              <summary className="flex cursor-pointer select-none items-center gap-1.5 font-medium hover:text-slate-700">
                                <FileText className="h-3.5 w-3.5" />
                                View sources ({getMessageSources(m).length})
                              </summary>
                              <ul className="mt-2 space-y-2">
                                {getMessageSources(m).map((s) => (
                                  <li key={s.id} className="rounded-lg bg-slate-50 p-2">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-semibold text-slate-600">📄 {s.title}</span>
                                      <span className="shrink-0 font-mono text-[10px] text-slate-400">
                                        {(s.similarity * 100).toFixed(0)}% match
                                      </span>
                                    </div>
                                    {s.snippet && (
                                      <p className="mt-1 line-clamp-2 text-slate-400">{s.snippet}</p>
                                    )}
                                  </li>
                                ))}
                              </ul>
                            </details>
                          )}
                        </>
                      )}
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

              {error && (
                <p role="alert" data-testid="chat-error" className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  Suzu could not answer right now. Please try again.
                  {error.message && <span className="mt-1 block text-red-600/80">{error.message}</span>}
                </p>
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
                placeholder="Send Suzu a message..."
                aria-label="Message"
                disabled={loading}
              />
            </div>
            <Button
              type="submit"
              aria-label="Send message"
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