import { useEffect, useState } from "react";

const DivineBackground = () => {
    const [particles, setParticles] = useState<Array<{ id: number; left: string; top: string; delay: string; duration: string; size: string }>>([]);

    useEffect(() => {
        const newParticles = Array.from({ length: 20 }).map((_, i) => ({
            id: i,
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            delay: `${Math.random() * 5}s`,
            duration: `${10 + Math.random() * 20}s`,
            size: `${2 + Math.random() * 4}px`,
        }));
        setParticles(newParticles);
    }, []);

    return (
        <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
            {/* Deep Cosmic Gradient */}
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#0d0d00] via-background to-background opacity-95" />

            {/* Floating Gold Particles */}
            {particles.map((p) => (
                <div
                    key={p.id}
                    className="absolute rounded-full bg-primary/40 blur-[1px]"
                    style={{
                        left: p.left,
                        top: p.top,
                        width: p.size,
                        height: p.size,
                        animation: `float ${p.duration} ease-in-out infinite`,
                        animationDelay: p.delay,
                    }}
                />
            ))}

            {/* Divine Glow Orbs */}
            {/* Top-left glow removed as requested */}
            <div className="absolute bottom-[-10%] right-[-10%] w-[30vw] h-[30vw] bg-primary/15 rounded-full blur-[100px] animate-pulse-slow" style={{ animationDelay: "2s" }} />
        </div>
    );
};

export default DivineBackground;
