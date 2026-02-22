import { useEffect, useRef, useState } from "react";
import introAudioFile from "@/assets/intro.mp3";
import { Volume2, VolumeX } from "lucide-react";

const BackgroundMusic = () => {
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);

    useEffect(() => {
        const audio = audioRef.current;
        if (!audio) return;

        // Set initial volume
        audio.volume = 0.5;

        const attemptPlay = async () => {
            try {
                await audio.play();
                setIsPlaying(true);
                cleanupListeners();
            } catch (err) {
                // Autoplay blocked by browser — will play on first user interaction
                // Add listeners for fallback
                document.addEventListener("click", attemptPlay);
                document.addEventListener("touchstart", attemptPlay);
                document.addEventListener("keydown", attemptPlay);
                document.addEventListener("mousemove", attemptPlay);
                document.addEventListener("scroll", attemptPlay);
            }
        };

        const cleanupListeners = () => {
            document.removeEventListener("click", attemptPlay);
            document.removeEventListener("touchstart", attemptPlay);
            document.removeEventListener("keydown", attemptPlay);
            document.removeEventListener("mousemove", attemptPlay);
            document.removeEventListener("scroll", attemptPlay);
        };

        // Expose play function globally
        (window as any).playBackgroundMusic = attemptPlay;

        // Try immediately
        attemptPlay();

        return () => {
            cleanupListeners();
            delete (window as any).playBackgroundMusic;
        };
    }, []);

    const toggleMute = () => {
        if (audioRef.current) {
            audioRef.current.muted = !audioRef.current.muted;
            setIsMuted(!isMuted);
        }
    };

    return (
        <>
            <audio
                ref={audioRef}
                src={introAudioFile}
                preload="auto"
                autoPlay
                onEnded={() => setIsPlaying(false)}
                onPlay={() => setIsPlaying(true)}
            />

            {isPlaying && (
                <button
                    onClick={toggleMute}
                    className="fixed bottom-24 md:bottom-4 right-4 z-[9999] p-3 rounded-full bg-black/40 backdrop-blur-md border border-[#FFD700]/20 text-[#FFD700] hover:bg-[#FFD700]/10 transition-all duration-300 group"
                    title={isMuted ? "Unmute" : "Mute"}
                >
                    {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5 animate-pulse" />}
                    <div className="absolute inset-0 rounded-full bg-[#FFD700]/5 group-hover:bg-[#FFD700]/10 animate-ping opacity-20" />
                </button>
            )}
        </>
    );
};

export default BackgroundMusic;
