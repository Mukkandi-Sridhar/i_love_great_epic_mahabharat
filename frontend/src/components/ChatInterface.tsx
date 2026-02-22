import { useState, useRef, useEffect } from 'react';
import { Send, Loader2, LogOut, Mic, MicOff } from 'lucide-react';
import { chatService, ChatMessage } from '@/services/chat';
import { cn } from '@/lib/utils';
import logo from '@/assets/logo.png';
import { useFirebase } from '@/contexts/FirebaseContext';

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
            content: `Namaste ${userName !== "Guest" ? userName.split(' ')[0] : ''}! I am your Dharma guide. How can I assist you today with the Mahabharata or our products?`,
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
                    content: `Namaste ${userName.split(' ')[0]}! I am your Dharma guide. How can I assist you today with the Mahabharata or our products?`,
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
        <div className="flex flex-col h-[600px] w-full max-w-2xl mx-auto bg-black/40 backdrop-blur-xl rounded-2xl border border-white/10 overflow-hidden shadow-2xl">
            {/* Header */}
            <div className="p-4 border-b border-white/10 bg-white/5 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full overflow-hidden border border-primary/30">
                        <img src={logo} alt="Dharma Assistant" className="w-full h-full object-cover" />
                    </div>
                    <div>
                        <h3 className="font-serif font-bold text-white">Dharma Assistant</h3>
                        <div className="flex items-center gap-2">
                            <p className="text-xs text-gray-400">Powered by Divine Intelligence</p>
                            {user && (
                                <span className="text-[10px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full border border-primary/20">
                                    {userName}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                {user && (
                    <button
                        onClick={logout}
                        className="text-gray-400 hover:text-white transition-colors"
                        title="Logout"
                    >
                        <LogOut className="w-4 h-4" />
                    </button>
                )}
            </div>

            {/* Messages Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin scrollbar-thumb-primary/20 scrollbar-track-transparent">
                {messages.map((msg, idx) => (
                    <div
                        key={idx}
                        className={cn(
                            "flex gap-3 max-w-[85%]",
                            msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                        )}
                    >
                        <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 border overflow-hidden",
                            msg.role === 'user'
                                ? "bg-primary/20 border-primary/30"
                                : "bg-white/10 border-white/20"
                        )}>
                            {msg.role === 'user' ? (
                                <img
                                    src={userPhoto}
                                    alt={userName}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <img src={logo} alt="Bot" className="w-full h-full object-cover" />
                            )}
                        </div>

                        <div className={cn(
                            "p-3 rounded-2xl text-sm leading-relaxed",
                            msg.role === 'user'
                                ? "bg-primary/20 text-white rounded-tr-none border border-primary/20"
                                : "bg-white/10 text-gray-200 rounded-tl-none border border-white/10"
                        )}>
                            {msg.content}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 max-w-[85%]">
                        <div className="w-8 h-8 rounded-full bg-white/10 border border-white/20 flex items-center justify-center flex-shrink-0 overflow-hidden">
                            <img src={logo} alt="Bot" className="w-full h-full object-cover" />
                        </div>
                        <div className="bg-white/5 p-3 rounded-2xl rounded-tl-none border border-white/5 flex items-center gap-2">
                            <Loader2 className="w-4 h-4 text-primary animate-spin" />
                            <span className="text-xs text-gray-400">Consulting the archives...</span>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input Area */}
            <form onSubmit={handleSend} className="p-4 border-t border-white/10 bg-white/5">
                <div className="flex gap-2 relative">
                    {/* Premium Microphone Button */}
                    <button
                        type="button"
                        onClick={startListening}
                        className={cn(
                            "relative overflow-hidden p-3 rounded-xl transition-all duration-500 ease-out group",
                            isListening
                                ? "bg-primary text-black shadow-[0_0_20px_rgba(255,215,0,0.5)] scale-110" // Gold glow
                                : "bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white border border-white/5"
                        )}
                        title={isListening ? "Listening..." : "Start voice input"}
                    >
                        {/* Pulse Ring Animation */}
                        {isListening && (
                            <span className="absolute inset-0 rounded-xl border-2 border-primary/50 animate-ping opacity-75"></span>
                        )}

                        {/* Icon Transition */}
                        <div className={cn("transition-transform duration-300", isListening ? "scale-110" : "scale-100")}>
                            {isListening ? <Mic className="w-5 h-5 animate-pulse" /> : <Mic className="w-5 h-5" />}
                        </div>
                    </button>

                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder={
                            isListening
                                ? "Listening to your voice..."
                                : isProcessing
                                    ? "Processing speech..."
                                    : "Ask about Mahabharata or our products..."
                        }
                        className={cn(
                            "flex-1 bg-black/20 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/50 transition-all",
                            isListening && "border-primary/50 ring-1 ring-primary/30 bg-primary/5 placeholder:text-primary/70"
                        )}
                        disabled={isLoading || isProcessing}
                    />
                    <button
                        type="submit"
                        disabled={isLoading || !input.trim()}
                        className={cn(
                            "bg-primary hover:bg-primary/90 text-black p-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:scale-105 active:scale-95",
                        )}
                    >
                        <Send className="w-5 h-5" />
                    </button>
                </div>
            </form>
        </div>
    );
};
