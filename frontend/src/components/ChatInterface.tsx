import { useState, useRef, useEffect } from "react";
import { Send, Mic } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { chatService, ChatMessage } from "@/services/chat";
import { cn } from "@/lib/utils";
import logo from "@/assets/logo.png";
import { useFirebase } from "@/contexts/FirebaseContext";

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

export const ChatInterface = () => {
    const { user } = useFirebase();
    const userName = user?.displayName || user?.email?.split("@")[0] || "Guest";
    const userEmail = user?.email || "guest@example.com";
    const userPhoto = user?.photoURL || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop";

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: "assistant",
            content: `Namaste${userName !== "Guest" ? ` ${userName.split(" ")[0]}` : ""}! How can I assist you today?`,
            timestamp: Date.now(),
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [sessionId, setSessionId] = useState(() =>
        window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
    );
    const [showQuickQuestions, setShowQuickQuestions] = useState(true);
    const [agentStatus, setAgentStatus] = useState<string | null>(null);
    const [activeTools, setActiveTools] = useState<string[]>([]);
    const [isListening, setIsListening] = useState(false);

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const greetingSet = useRef(false);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
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
        return () => stopListening();
    }, []);

    useEffect(() => {
        if (!greetingSet.current && user && messages.length === 1 && messages[0].role === "assistant") {
            setMessages([
                {
                    role: "assistant",
                    content: `Namaste ${userName.split(" ")[0]}! How can I assist you today?`,
                    timestamp: Date.now(),
                },
            ]);
            greetingSet.current = true;
        }
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
        setAgentStatus("Thinking...");
        setActiveTools([]);

        const userMessage: ChatMessage = {
            role: "user",
            content: trimmed,
            timestamp: Date.now(),
        };

        setMessages((prev) => [...prev, userMessage]);
        setInput("");
        setIsLoading(true);

        let handledError = false;

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
                            break;
                        case "done":
                            if (event.session_id && event.session_id !== sessionId) {
                                setSessionId(event.session_id);
                            }
                            if (!handledError) {
                                setMessages((prev) => [
                                    ...prev,
                                    {
                                        role: "assistant",
                                        content: event.response || "I can help with that.",
                                        timestamp: Date.now(),
                                    },
                                ]);
                            }
                            setAgentStatus(null);
                            setActiveTools([]);
                            break;
                        case "error":
                            handledError = true;
                            setMessages((prev) => [
                                ...prev,
                                {
                                    role: "assistant",
                                    content: "Sorry, I'm having trouble connecting. Please try again.",
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
                    role: "assistant",
                    content: "Sorry, I'm having trouble connecting. Please try again.",
                    timestamp: Date.now(),
                },
            ]);
        } finally {
            setIsLoading(false);
            setAgentStatus(null);
            setActiveTools([]);
        }
    };

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        await sendMessage(input);
    };

    const quickQuestions = ["Where is my order?", "Product info", "Refund policy"];

    return (
        <div className="flex flex-col w-full h-full md:max-h-[700px] max-w-3xl mx-auto bg-black/60 backdrop-blur-2xl md:rounded-2xl border-y md:border border-white/10 overflow-hidden shadow-2xl relative">
            <div className="px-5 py-3 flex items-center justify-between border-b border-white/5 bg-white/[0.02] relative z-20">
                <div className="flex items-center gap-3">
                    <div className="relative">
                        <div className="w-9 h-9 rounded-full overflow-hidden border border-primary/30 bg-black/40">
                            <img src={logo} alt="Dharma" className="w-full h-full object-cover rounded-full" />
                        </div>
                        <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 border-2 border-black rounded-full" />
                    </div>
                    <div>
                        <span className="text-sm text-white font-bold">Dharma Assistant</span>
                        <p className="text-[10px] text-gray-500">Online · Here to help</p>
                    </div>
                </div>
                {user && <span className="text-xs text-gray-400">{userName.split(" ")[0]}</span>}
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scrollbar-none relative z-10">
                <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                        const isUser = msg.role === "user";
                        return (
                            <motion.div
                                key={idx}
                                layout
                                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={cn("flex gap-4 max-w-[92%] group", isUser ? "ml-auto flex-row-reverse" : "flex-row")}
                            >
                                <div
                                    className={cn(
                                        "w-10 h-10 rounded-full flex-shrink-0 mt-1 border border-white/10 p-0.5 bg-black/40 overflow-hidden",
                                        isUser ? "hidden md:block shadow-lg" : "block shadow-[0_0_20px_rgba(0,0,0,0.3)]"
                                    )}
                                >
                                    <img
                                        src={isUser ? userPhoto : logo}
                                        alt=""
                                        className="w-full h-full object-cover rounded-full grayscale group-hover:grayscale-0 transition-all duration-700"
                                    />
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
                                        {msg.content}
                                    </div>
                                    <span className="text-[9px] text-gray-600 px-1 tracking-widest uppercase font-mono opacity-40">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {showQuickQuestions && messages.length === 1 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="ml-14 flex flex-wrap gap-2">
                        {quickQuestions.map((question) => (
                            <button
                                key={question}
                                type="button"
                                onClick={() => sendMessage(question)}
                                disabled={isLoading}
                                className="rounded-full border border-primary/20 bg-primary/10 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-primary hover:bg-primary/20 disabled:opacity-50"
                            >
                                {question}
                            </button>
                        ))}
                    </motion.div>
                )}

                {isLoading && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 items-start px-2">
                        <div className="w-8 h-8 rounded-full border border-white/10 bg-black/40 overflow-hidden">
                            <img src={logo} alt="" className="w-full h-full object-cover rounded-full grayscale" />
                        </div>
                        <div className="flex flex-col gap-2">
                            {agentStatus && (
                                <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-xs text-gray-400 flex items-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse" />
                                    {agentStatus}
                                </div>
                            )}
                            {activeTools.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {activeTools.map((tool) => (
                                        <span
                                            key={tool}
                                            className="px-2 py-1 rounded-full border border-primary/20 bg-primary/10 text-[10px] text-primary font-bold uppercase tracking-wider flex items-center gap-1"
                                        >
                                            <span className="w-1 h-1 bg-primary rounded-full animate-pulse" />
                                            {toolDisplayName(tool)}
                                        </span>
                                    ))}
                                </div>
                            )}
                            <div className="px-4 py-3 rounded-2xl bg-white/5 border border-white/10 flex gap-1.5">
                                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                                <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                            </div>
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
                        className={cn(
                            "p-2 rounded-lg transition-all text-gray-500 hover:text-primary hover:bg-white/5",
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
                        className="p-2 rounded-lg transition-all text-gray-500 hover:text-white disabled:opacity-20 flex items-center justify-center hover:bg-white/5"
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
};
