import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, LogOut, Mic, MicOff } from 'lucide-react';
import { chatService, ChatMessage } from '@/services/chat';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import { useFirebase } from '@/contexts/FirebaseContext';
import { motion, AnimatePresence } from "framer-motion";

// Add type definition for Web Speech API
interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start: () => void;
    stop: () => void;
    abort: () => void;
    onstart: (event: Event) => void;
    onend: (event: Event) => void;
    onerror: (event: any) => void;
    onresult: (event: any) => void;
    onspeechend: (event: Event) => void; // Added for auto-stop
    onsoundstart: (event: Event) => void; // Added for silence detection
}

declare global {
    interface Window {
        SpeechRecognition: any;
        webkitSpeechRecognition: any;
    }
}

export const ChatInterface = () => {
    const { user, logout } = useFirebase();

    // Derived user details with fallbacks
    const userName = user?.displayName || user?.email?.split('@')[0] || "Guest";
    const userEmail = user?.email || "guest@example.com";
    const userPhoto = user?.photoURL || "https://images.unsplash.com/photo-1633332755192-727a05c4013d?w=100&h=100&fit=crop";

    const [messages, setMessages] = useState<ChatMessage[]>([
        {
            role: 'assistant',
            content: `Namaste${userName !== "Guest" ? ' ' + userName.split(' ')[0] : ''}! How can I assist you today?`,
            timestamp: Date.now()
        }
    ]);
    const [input, setInput] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    // Voice State
    const [isListening, setIsListening] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false); // New state for "Thinking/Processing"

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const recognitionRef = useRef<SpeechRecognition | null>(null);
    const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
    const inputRef = useRef<HTMLInputElement>(null); // For auto-focus

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

    // Cleanup speech recognition on unmount
    useEffect(() => {
        return () => {
            stopListening();
        };
    }, []);


    // Debugging: Log user state changes
    useEffect(() => {
        console.log("ChatInterface - Current User:", user);
        console.log("ChatInterface - Computed Name:", userName);
    }, [user, userName]);

    // Update greeting when user logs in
    useEffect(() => {
        if (user && messages.length === 1 && messages[0].role === 'assistant') {
            setMessages([
                {
                    role: 'assistant',
                    content: `Namaste ${userName.split(' ')[0]}! How can I assist you today?`,
                    timestamp: Date.now()
                }
            ]);
        }
    }, [user, userName]);

    // --- Premium Speech-to-Text Logic ---

    const resetSilenceTimer = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);

        // Auto-stop after 5 seconds of silence (increased for better UX)
        silenceTimerRef.current = setTimeout(() => {
            console.log("Silence detected, stopping...");
            stopListening();
        }, 5000);
    };

    const startListening = () => {
        if (isListening || isProcessing) {
            stopListening();
            return;
        }

        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

        if (!SpeechRecognition) {
            alert("Your browser does not support voice input. Please use Chrome or Edge.");
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.continuous = true; // Changed to true for longer sentences
        recognition.interimResults = true; // Show text as you speak
        recognition.lang = 'en-IN'; // Optimized for Indian accent

        recognition.onstart = () => {
            setIsListening(true);
            setIsProcessing(false);
            resetSilenceTimer();
            console.log("Speech recognition started");
        };

        recognition.onsoundstart = () => {
            resetSilenceTimer(); // Reset timer when sound is detected
        };

        recognition.onspeechend = () => {
            // In continuous mode, this might not trigger until fully stopped.
            // We rely on silence timer for auto-stop.
            console.log("Speech ended event");
        };

        recognition.onend = () => {
            setIsListening(false);
            setIsProcessing(false);
            if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
            console.log("Speech recognition ended");
        };

        recognition.onerror = (event: any) => {
            console.error("Speech recognition error", event.error);
            setIsListening(false);
            setIsProcessing(false);
        };

        recognition.onresult = (event: any) => {
            resetSilenceTimer(); // Reset timer on every result (interim or final)

            let interimTranscript = '';
            let finalTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    finalTranscript += event.results[i][0].transcript;
                } else {
                    interimTranscript += event.results[i][0].transcript;
                }
            }

            if (finalTranscript || interimTranscript) {
                setInput(prev => {
                    // This is a bit tricky with continuous and interim.
                    // For now, let's just append final results to keep it simple and reliable.
                    if (finalTranscript) {
                        const cleanFinal = finalTranscript.trim();
                        if (!cleanFinal) return prev;

                        const updated = prev
                            ? prev.trim() + ' ' + cleanFinal
                            : cleanFinal.charAt(0).toUpperCase() + cleanFinal.slice(1);
                        return updated;
                    }
                    return prev;
                });

                // Focus input after speech
                setTimeout(() => inputRef.current?.focus(), 100);
            }
        };

        recognitionRef.current = recognition;
        recognition.start();
    };

    const stopListening = () => {
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
        setIsProcessing(false);
    };
    // ---------------------------

    const handleSend = async (e?: React.FormEvent) => {
        e?.preventDefault();
        if (!input.trim() || isLoading) return;

        // Stop listening if sending
        stopListening();

        const userMessage: ChatMessage = {
            role: 'user',
            content: input.trim(),
            timestamp: Date.now()
        };

        const newMessages = [...messages, userMessage];
        setMessages(newMessages);
        setInput('');
        setIsLoading(true);

        try {
            // Format messages for backend
            const apiMessages = newMessages.map(msg => ({
                role: msg.role,
                content: msg.content
            }));

            console.log("Sending payload with name:", userName);

            const response = await chatService.sendMessage({
                messages: apiMessages,
                email: userEmail,
                name: userName,
                uid: user?.uid
            });

            const botMessage: ChatMessage = {
                role: 'assistant',
                content: response,
                timestamp: Date.now()
            };

            setMessages(prev => [...prev, botMessage]);
        } catch (error) {
            const errorMessage: ChatMessage = {
                role: 'assistant',
                content: "I apologize, but I'm having trouble connecting to the divine knowledge base right now. Please try again later.",
                timestamp: Date.now()
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col h-[600px] md:h-[700px] w-full max-w-2xl mx-auto bg-black/60 backdrop-blur-2xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl relative">
            {/* Header - Premium Windowed Identity */}
            <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02] backdrop-blur-md relative z-20">
                <div className="flex items-center gap-4">
                    <div className="relative">
                        <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/30 p-0.5 bg-black/40 shadow-[0_0_15px_rgba(255,215,0,0.1)]">
                            <img src={logo} alt="IA" className="w-full h-full object-cover rounded-full" />
                        </div>
                        <span className="absolute bottom-0 right-0 w-3 h-3 bg-green-500 border-2 border-black rounded-full shadow-lg" />
                    </div>
                    <div className="flex flex-col leading-tight">
                        <span className="text-[13px] text-white font-bold tracking-[0.1em] uppercase">Divine Assistant</span>
                        <span className="text-[9px] text-primary/60 uppercase tracking-tighter font-bold">M.Sridhar Guide</span>
                    </div>
                </div>
                {user && (
                    <div className="flex items-center gap-4">
                        <div className="flex flex-col items-end leading-tight">
                            <span className="text-[11px] text-white font-medium uppercase tracking-widest">{userName}</span>
                            <span className="text-[8px] text-gray-500 uppercase tracking-tighter mt-0.5">Premium Account</span>
                        </div>
                        <button
                            onClick={logout}
                            className="p-2 rounded-xl text-gray-500 hover:text-white hover:bg-white/5 transition-all"
                            title="Logout"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                )}
            </div>

            {/* Messages Area - Polished Flow */}
            <div className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scrollbar-none relative z-10">
                <AnimatePresence initial={false}>
                    {messages.map((msg, idx) => {
                        const isUser = msg.role === 'user';
                        return (
                            <motion.div
                                key={idx}
                                layout
                                initial={{ opacity: 0, scale: 0.98, y: 10 }}
                                animate={{ opacity: 1, scale: 1, y: 0 }}
                                className={cn(
                                    "flex gap-4 max-w-[92%] group",
                                    isUser ? "ml-auto flex-row-reverse" : "flex-row"
                                )}
                            >
                                {/* Person Profile Avatars */}
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex-shrink-0 mt-1 border border-white/10 p-0.5 bg-black/40 overflow-hidden",
                                    isUser ? "hidden md:block shadow-lg" : "block shadow-[0_0_20px_rgba(0,0,0,0.3)]"
                                )}>
                                    <img
                                        src={isUser ? userPhoto : logo}
                                        alt=""
                                        className="w-full h-full object-cover rounded-full grayscale group-hover:grayscale-0 transition-all duration-700"
                                    />
                                </div>

                                <div className={cn(
                                    "flex flex-col gap-1.5",
                                    isUser ? "items-end text-right" : "items-start text-left"
                                )}>
                                    {/* Name label for 'person' feel */}
                                    <span className="text-[10px] text-gray-500 font-bold tracking-[0.1em] uppercase px-1 opacity-70">
                                        {isUser ? userName : "Assistant"}
                                    </span>

                                    <div className={cn(
                                        "px-5 py-3.5 rounded-2xl text-[15px] leading-relaxed backdrop-blur-3xl border transition-all duration-500",
                                        isUser
                                            ? "bg-primary/20 text-white border-primary/20 rounded-tr-none shadow-xl shadow-primary/5"
                                            : "bg-white/5 text-gray-300 border-white/10 rounded-tl-none hover:bg-white/10 shadow-xl shadow-black/20"
                                    )}>
                                        {msg.content}
                                    </div>
                                    <span className="text-[9px] text-gray-600 px-1 tracking-widest uppercase font-mono opacity-40">
                                        {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                    </span>
                                </div>
                            </motion.div>
                        );
                    })}
                </AnimatePresence>

                {isLoading && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex gap-4 items-center px-2"
                    >
                        <div className="w-10 h-10 rounded-full border border-white/10 p-0.5 bg-black/40 shadow-lg animate-pulse">
                            <img src={logo} alt="" className="w-full h-full object-cover rounded-full grayscale" />
                        </div>
                        <div className="px-5 py-3 rounded-2xl bg-white/5 border border-white/10 flex gap-2 shadow-xl">
                            <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 bg-primary/40 rounded-full animate-bounce" />
                        </div>
                    </motion.div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area - Window Integrated Bar */}
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
                        disabled={isLoading || isProcessing}
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
