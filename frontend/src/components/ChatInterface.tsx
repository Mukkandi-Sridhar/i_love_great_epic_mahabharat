import { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { chatService, ChatMessage } from "@/services/chat";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { useFirebase } from "@/contexts/FirebaseContext";
import { db } from "@/lib/firebase";
import { collection, getDocs, limit, orderBy, query } from "firebase/firestore";

interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    onstart: (event: Event) => void;
    onend: (event: Event) => void;
    onerror: (event: any) => void;
    onresult: (event: any) => void;
    onsoundstart: (event: Event) => void;
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

const toolDisplayName = (tool?: string) => {
    const names: Record<string, string> = {
        get_user_summary: "Checking Your Account",
        get_order_status: "Checking Orders",
        get_user_purchases: "Loading Purchases",
        verify_payment: "Verifying Payment",
        create_refund_request: "Refund Request",
        create_support_ticket: "Creating Ticket",
        check_coupon: "Validating Coupon",
        search_policies: "Reading Policies",
        search_products: "Finding Products",
    };
    return names[tool || ""] || "Working";
};

const createMessageId = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export const ChatInterface = () => {
    const { user } = useFirebase();
    const userName = user?.displayName || user?.email?.split("@")[0] || "Guest";
    const userEmail = user?.email || "guest@example.com";
    const userPhoto = user?.photoURL || null;
    const userInitial = userName.charAt(0).toUpperCase();

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            id: "greeting-0",
            role: "assistant",
            content: user ? `Namaste ${userName.split(" ")[0]}! How can I assist you today?` : "Namaste! How can I help you today?",
            timestamp: Date.now(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(() => window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`);
    const [showQuickQuestions, setShowQuickQuestions] = useState(true);
    const [agentStatus, setAgentStatus] = useState<string | null>(null);
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [isListening, setIsListening] = useState(false);
    const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);

    const containerRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const tokenBufferRef = useRef<string>("");
    const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const greetingSet = useRef(false);

    const scrollToBottom = () => {
        const container = containerRef.current;
        if (!container) return;
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
        if (distanceFromBottom < 100) {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    };

    const forceScrollToBottom = () => {
        requestAnimationFrame(() => {
            messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
        });
    };

    const appendAssistantChunk = (chunk: string) => {
        if (!chunk) return;
        setMessages((prev) => {
            const last = prev[prev.length - 1];
            if (last?.role === "assistant") {
                return [...prev.slice(0, -1), { ...last, content: last.content + chunk, timestamp: Date.now() }];
            }
            return [...prev, { id: createMessageId("assistant"), role: "assistant", content: chunk, timestamp: Date.now() }];
        });
    };

    const startFlushTimer = () => {
        if (flushTimerRef.current) return;
        flushTimerRef.current = setInterval(() => {
            const chunk = tokenBufferRef.current;
            if (!chunk) return;
            tokenBufferRef.current = "";
            appendAssistantChunk(chunk);
        }, 40);
    };

    const stopFlushTimer = (flushRemaining = true) => {
        if (flushTimerRef.current) {
            clearInterval(flushTimerRef.current);
            flushTimerRef.current = null;
        }
        if (flushRemaining && tokenBufferRef.current) {
            const chunk = tokenBufferRef.current;
            tokenBufferRef.current = "";
            appendAssistantChunk(chunk);
        } else if (!flushRemaining) {
            tokenBufferRef.current = "";
        }
    };

    const stopListening = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages, agentStatus, activeTools]);

    useEffect(() => {
        const onResize = () => setIsMobile(window.innerWidth < 768);
        window.addEventListener("resize", onResize);
        return () => window.removeEventListener("resize", onResize);
    }, []);

    useEffect(() => {
        return () => {
            stopListening();
            stopFlushTimer(false);
        };
    }, []);

    useEffect(() => {
        if (!user) {
            const keys = Object.keys(localStorage).filter((key) => key.startsWith("dharma_chat_session_"));
            keys.forEach((key) => localStorage.removeItem(key));
            setMessages([
                {
                    id: "greeting-0",
                    role: "assistant",
                    content: "Namaste! How can I help you today?",
                    timestamp: Date.now(),
                },
            ]);
            setShowQuickQuestions(true);
            greetingSet.current = false;
            return;
        }

        const storageKey = `dharma_chat_session_${user.uid}`;
        const existingSession = localStorage.getItem(storageKey);
        const nextSession = existingSession || `${user.uid}_${Date.now()}`;
        if (!existingSession) localStorage.setItem(storageKey, nextSession);
        setSessionId(nextSession);

        if (greetingSet.current) return;

        let cancelled = false;
        const loadPersistedMessages = async () => {
            try {
                const messagesQuery = query(
                    collection(db, "users", user.uid, "chat_sessions", nextSession, "messages"),
                    orderBy("timestamp", "desc"),
                    limit(20)
                );
                const snap = await getDocs(messagesQuery);
                if (cancelled) return;

                const persisted = snap.docs
                    .reverse()
                    .map((doc) => {
                        const data = doc.data();
                        return {
                            id: doc.id,
                            role: data.role as ChatMessage["role"],
                            content: data.content as string,
                            timestamp: data.timestamp?.toMillis?.() || Date.now(),
                        };
                    })
                    .filter((item) => (item.role === "user" || item.role === "assistant") && item.content);

                if (persisted.length > 0) {
                    setMessages(persisted);
                    setShowQuickQuestions(false);
                } else {
                    const firstName = (user.displayName || user.email?.split("@")[0] || "").split(" ")[0];
                    setMessages([
                        {
                            id: "greeting-0",
                            role: "assistant",
                            content: firstName ? `Namaste ${firstName}! How can I assist you today?` : "Namaste! How can I help you today?",
                            timestamp: Date.now(),
                        },
                    ]);
                    setShowQuickQuestions(true);
                }
                greetingSet.current = true;
            } catch {
                if (!cancelled) {
                    setShowQuickQuestions(true);
                }
            }
        };

        loadPersistedMessages();
        return () => {
            cancelled = true;
        };
    }, [user]);

    const resetSilenceTimer = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        silenceTimerRef.current = setTimeout(() => {
            stopListening();
        }, 5000);
    };

    const startListening = () => {
        if (isListening) {
            stopListening();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) return;

        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-IN";

        recognition.onstart = () => {
            setIsListening(true);
            resetSilenceTimer();
        };

        recognition.onsoundstart = resetSilenceTimer;

        recognition.onend = () => {
            setIsListening(false);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        };

        recognition.onerror = () => {
            setIsListening(false);
        };

        recognition.onresult = (event: any) => {
            resetSilenceTimer();
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript) {
                setInput((prev) => {
                    const cleanFinal = finalTranscript.trim();
                    if (!cleanFinal) return prev;
                    return prev ? `${prev.trim()} ${cleanFinal}` : cleanFinal.charAt(0).toUpperCase() + cleanFinal.slice(1);
                });
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const sendMessage = async (content: string) => {
        const trimmed = content.trim();
        if (!trimmed || isLoading) return;

        stopListening();
        setShowQuickQuestions(false);

        const userMessage: ChatMessage = {
            id: `${Date.now()}-user`,
            role: "user",
            content: trimmed,
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMessage]);
        forceScrollToBottom();
        setInput("");

        if (!user) {
            setMessages((prev) => [
                ...prev,
                {
                    id: createMessageId("auth"),
                    role: "assistant",
                    content: "Please sign in to continue chatting with Dharma.",
                    timestamp: Date.now(),
                },
            ]);
            return;
        }

        setAgentStatus("Thinking...");
        setActiveTools([]);
        setIsLoading(true);

        let handledError = false;
        let streamingAssistantStarted = false;
        let streamedContent = "";

        try {
            await chatService.sendMessageStreaming(
                {
                    message: userMessage.content,
                    email: userEmail,
                    name: userName,
                    uid: user?.uid || "",
                    session_id: sessionId,
                },
                (event) => {
                    switch (event.type) {
                        case "status":
                            setAgentStatus(event.message || null);
                            break;
                        case "tool_start":
                            setAgentStatus(event.message || null);
                            if (event.tool) {
                                setActiveTools((prev) => (prev.includes(event.tool!) ? prev : [...prev, event.tool!]));
                            }
                            break;
                        case "tool_end":
                            setActiveTools((prev) => prev.filter((tool) => tool !== event.tool));
                            break;
                        case "generating":
                            setAgentStatus("Generating response...");
                            setActiveTools([]);
                            startFlushTimer();
                            break;
                        case "token":
                            if (event.delta) {
                                startFlushTimer();
                                streamedContent += event.delta;
                                tokenBufferRef.current += event.delta;
                                streamingAssistantStarted = true;
                            }
                            break;
                        case "done":
                            stopFlushTimer();
                            if (event.session_id && event.session_id !== sessionId) {
                                setSessionId(event.session_id);
                                if (user?.uid) {
                                    localStorage.setItem(`dharma_chat_session_${user.uid}`, event.session_id);
                                }
                            }
                            if (!handledError) {
                                if (streamingAssistantStarted) {
                                    const finalContent = event.response || streamedContent || "I can help with that.";
                                    setMessages((prev) => {
                                        const last = prev[prev.length - 1];
                                        if (last?.role === "assistant") {
                                            return [...prev.slice(0, -1), { ...last, content: finalContent, timestamp: Date.now() }];
                                        }
                                        return [...prev, { id: createMessageId("assistant"), role: "assistant", content: finalContent, timestamp: Date.now() }];
                                    });
                                } else {
                                    setMessages((prev) => [
                                        ...prev,
                                        {
                                            id: createMessageId("assistant"),
                                            role: "assistant",
                                            content: event.response || "I can help with that.",
                                            timestamp: Date.now(),
                                        },
                                    ]);
                                }
                            }
                            setAgentStatus(null);
                            setActiveTools([]);
                            break;
                        case "error":
                            stopFlushTimer();
                            handledError = true;
                            const errMsg = event.code === 429
                                ? "You're sending messages too quickly. Please wait a moment. 🙏"
                                : event.code === 401 || event.code === 403
                                    ? "Please sign in to continue chatting with Dharma."
                                    : "Sorry, I'm having trouble connecting. Please try again.";
                            setMessages((prev) => [
                                ...prev,
                                {
                                    id: `err-${Date.now()}`,
                                    role: "assistant",
                                    content: errMsg,
                                    timestamp: Date.now(),
                                },
                            ]);
                            break;
                    }
                }
            );
        } catch {
            setMessages((prev) => [
                ...prev,
                {
                    id: `err-${Date.now()}`,
                    role: "assistant",
                    content: "Sorry, I'm having trouble connecting. Please try again.",
                    timestamp: Date.now(),
                },
            ]);
        } finally {
            setIsLoading(false);
            setAgentStatus(null);
            setActiveTools([]);
            stopFlushTimer();
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        await sendMessage(input);
    };

    const quickQuestions = [
        { label: "📦 Track my order", query: "Where is my order?" },
        { label: "📖 Which product for me?", query: "Which product suits me best?" },
        { label: "🔁 Refund & return policy", query: "What is your refund policy?" },
        { label: "🎧 What's in the pendrive?", query: "What audio content is on the pendrive?" },
    ];
    const visibleQuestions = isMobile ? quickQuestions.slice(0, 2) : quickQuestions;

    return (
        <div className="flex flex-col w-full h-full md:max-h-[700px] max-w-3xl mx-auto bg-black/60 backdrop-blur-2xl md:rounded-2xl border-y md:border border-white/10 overflow-hidden shadow-2xl relative">
            <div className="px-4 py-3 flex items-center justify-between border-b border-white/5 bg-gradient-to-r from-black/60 via-black/40 to-black/60 backdrop-blur-xl relative z-20">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/20 ring-2 ring-primary/10 bg-black/40">
                            <img src={logo} alt="Dharma" className="w-full h-full object-cover" />
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-400 border-2 border-black rounded-full shadow-[0_0_8px_rgba(52,211,153,0.6)]" />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-white tracking-wide">Dharma</p>
                        <p className="text-[10px] text-emerald-400/80 font-mono tracking-widest uppercase">
                            Online · AI Support
                        </p>
                    </div>
                </div>
                {user && (
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                        {userPhoto ? (
                            <img src={userPhoto} alt="" className="w-7 h-7 rounded-full object-cover opacity-70" />
                        ) : (
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary text-xs font-bold">
                                {userInitial}
                            </div>
                        )}
                    </div>
                )}
            </div>

            <div ref={containerRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 no-scrollbar relative z-10">
                <AnimatePresence initial={false}>
                    {messages.map((msg, index) => {
                        const isUser = msg.role === "user";
                        const isStreaming = isLoading && index === messages.length - 1 && msg.role === "assistant";
                        return (
                            <motion.div
                                key={msg.id}
                                layout
                                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={cn("flex gap-4 max-w-[92%] group", isUser ? "ml-auto flex-row-reverse" : "flex-row")}
                            >
                                <div
                                    className={cn(
                                        "w-7 h-7 md:w-10 md:h-10 rounded-full flex-shrink-0 mt-1 border border-white/10 p-0.5 bg-black/40 overflow-hidden",
                                        isUser ? "shadow-lg" : "shadow-[0_0_20px_rgba(0,0,0,0.3)]"
                                    )}
                                >
                                    {isUser && userPhoto ? (
                                        <img src={userPhoto} alt="" className="w-full h-full object-cover rounded-full" />
                                    ) : isUser ? (
                                        <div className="w-full h-full rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-sm">
                                            {userInitial}
                                        </div>
                                    ) : (
                                        <img src={logo} alt="" className="w-full h-full object-cover rounded-full grayscale group-hover:grayscale-0 transition-all duration-700" />
                                    )}
                                </div>

                                <div className={cn("flex flex-col gap-1.5", isUser ? "items-end text-right" : "items-start text-left")}>
                                    <span className="text-[10px] text-gray-500 font-bold tracking-[0.1em] uppercase px-1 opacity-70">
                                        {isUser ? userName : "Assistant"}
                                    </span>

                                    <div
                                        className={cn(
                                            "px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed backdrop-blur-3xl border transition-all duration-500",
                                            isUser
                                                ? "bg-primary/20 text-white border-primary/20 rounded-tr-none shadow-xl shadow-primary/5"
                                                : "bg-white/5 text-gray-300 border-white/10 rounded-tl-none hover:bg-white/10 shadow-xl shadow-black/20"
                                        )}
                                    >
                                        {msg.role === "assistant" ? (
                                            <>
                                                <div className="prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0.5 prose-strong:text-primary/90 prose-strong:font-semibold prose-p:leading-relaxed">
                                                    <ReactMarkdown
                                                        components={{
                                                            a: ({ href, children }) => (
                                                                <a
                                                                    href={href}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="text-primary underline underline-offset-2 hover:opacity-80"
                                                                >
                                                                    {children}
                                                                </a>
                                                            ),
                                                        }}
                                                    >
                                                        {msg.content}
                                                    </ReactMarkdown>
                                                </div>
                                                {isStreaming && (
                                                    <motion.span
                                                        animate={{ opacity: [1, 0] }}
                                                        transition={{ duration: 0.6, repeat: Infinity }}
                                                        className="inline-block w-0.5 h-4 bg-primary ml-0.5 align-middle rounded-full"
                                                    />
                                                )}
                                            </>
                                        ) : (
                                            <span className="text-[15px] leading-relaxed">{msg.content}</span>
                                        )}
                                    </div>
                                    <span className="text-[9px] text-gray-500 px-1 tracking-widest uppercase font-mono opacity-0 group-hover:opacity-60 transition-opacity duration-300">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {showQuickQuestions && messages.length === 1 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-12 flex flex-col gap-2">
                        {visibleQuestions.map((q) => (
                            <motion.button
                                key={q.label}
                                whileHover={{ scale: 1.01 }}
                                whileTap={{ scale: 0.98 }}
                                type="button"
                                onClick={() => sendMessage(q.query)}
                                disabled={isLoading}
                                className="flex items-center gap-3 px-4 py-3 rounded-2xl text-left border border-white/[0.08] bg-white/[0.03] hover:bg-white/[0.07] hover:border-primary/25 transition-all disabled:opacity-40 group"
                            >
                                <span className="text-[13px] text-gray-300 group-hover:text-white transition-colors">
                                    {q.label}
                                </span>
                            </motion.button>
                        ))}
                    </motion.div>
                )}

                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="flex gap-3 items-start px-2"
                    >
                        <div className="w-9 h-9 rounded-full border border-white/10 bg-black/40 overflow-hidden shrink-0 mt-0.5">
                            <img src={logo} alt="" className="w-full h-full object-cover grayscale" />
                        </div>

                        <div className="flex flex-col gap-2 max-w-[85%]">
                            <AnimatePresence mode="wait">
                                {agentStatus && (
                                    <motion.div
                                        key={agentStatus}
                                        initial={{ opacity: 0, x: -6 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0, x: 6 }}
                                        transition={{ duration: 0.2 }}
                                        className="flex items-center gap-2 px-4 py-2.5 rounded-2xl rounded-tl-none bg-white/[0.04] border border-white/[0.08] text-xs text-gray-300"
                                    >
                                        {activeTools.length > 0 ? (
                                            <>
                                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                                                <span className="font-semibold text-primary text-[11px]">
                                                    {toolDisplayName(activeTools[activeTools.length - 1])}
                                                </span>
                                                <span className="text-gray-500">·</span>
                                            </>
                                        ) : (
                                            <span className="w-1.5 h-1.5 rounded-full bg-white/30 animate-pulse" />
                                        )}
                                        <span>{agentStatus}</span>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {!agentStatus && (
                                <div className="px-4 py-3 rounded-2xl rounded-tl-none bg-white/[0.04] border border-white/[0.08] flex items-center gap-1.5 w-fit">
                                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:0ms]" />
                                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:150ms]" />
                                    <span className="w-1.5 h-1.5 bg-primary/50 rounded-full animate-bounce [animation-delay:300ms]" />
                                </div>
                            )}
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <form onSubmit={handleSend} className="px-5 py-6 border-t border-white/5 bg-black/20 relative z-20">
                <div className="flex items-center gap-3 max-w-xl mx-auto bg-black/40 rounded-xl border border-white/5 p-1 px-3 focus-within:border-primary/30 transition-all shadow-inner">
                    <button
                        type="button"
                        onClick={startListening}
                        disabled={isLoading}
                        aria-label={isListening ? "Stop listening" : "Start voice input"}
                        className={cn(
                            "p-2 rounded-lg transition-all text-gray-500 hover:text-primary hover:bg-white/5 disabled:opacity-30 disabled:hover:text-gray-500 disabled:hover:bg-transparent",
                            isListening && "text-primary bg-primary/10 shadow-[0_0_15px_rgba(255,215,0,0.2)]"
                        )}
                        title="Voice Input"
                    >
                        <Mic className="w-5 h-5" />
                    </button>

                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={isListening ? "Listening..." : "Message assistant..."}
                        className="flex-1 bg-transparent py-3 text-sm text-white placeholder:text-gray-600 focus:outline-none"
                        disabled={isLoading}
                    />

                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        aria-label="Send message"
                        className="p-2 rounded-lg transition-all text-gray-500 hover:text-white disabled:opacity-20 flex items-center justify-center hover:bg-white/5"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
};
