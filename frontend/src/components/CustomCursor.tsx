import { useEffect, useState } from "react";

const CustomCursor = () => {
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isHovering, setIsHovering] = useState(false);
    const [isVisible, setIsVisible] = useState(false);
    const [cursorVariant, setCursorVariant] = useState<'vishnu' | 'shiva'>('vishnu');

    useEffect(() => {
        const updatePosition = (e: MouseEvent) => {
            setPosition({ x: e.clientX, y: e.clientY });
            setIsVisible(true);
        };

        const handleMouseOver = (e: MouseEvent) => {
            const target = e.target as HTMLElement;
            if (target.tagName === "BUTTON" || target.tagName === "A" || target.closest(".cursor-pointer")) {
                setIsHovering(true);
            } else {
                setIsHovering(false);
            }
        };

        const handleClick = () => {
            // Randomly switch between Vishnu and Shiva tilak on click
            setCursorVariant(Math.random() > 0.5 ? 'vishnu' : 'shiva');
        };

        const handleMouseLeave = () => setIsVisible(false);
        const handleMouseEnter = () => setIsVisible(true);

        window.addEventListener("mousemove", updatePosition);
        window.addEventListener("mouseover", handleMouseOver);
        window.addEventListener("mouseup", handleClick);
        document.addEventListener("mouseleave", handleMouseLeave);
        document.addEventListener("mouseenter", handleMouseEnter);

        return () => {
            window.removeEventListener("mousemove", updatePosition);
            window.removeEventListener("mouseover", handleMouseOver);
            window.removeEventListener("mouseup", handleClick);
            document.removeEventListener("mouseleave", handleMouseLeave);
            document.removeEventListener("mouseenter", handleMouseEnter);
        };
    }, []);

    if (!isVisible) return null;

    return (
        <div
            className={`custom-cursor ${isHovering ? "hovering" : ""} hidden md:block`}
            style={{
                position: 'fixed',
                left: `${position.x}px`,
                top: `${position.y}px`,
                transform: `translate(-50%, -50%)`,
                width: 'auto',
                height: 'auto',
                background: 'transparent',
                boxShadow: 'none',
                border: 'none',
                mixBlendMode: 'normal',
                pointerEvents: 'none',
                zIndex: 9999,
            }}
        >
            {cursorVariant === 'vishnu' ? (
                /* Vishnu Tilak SVG */
                <svg
                    width="40"
                    height="60"
                    viewBox="0 0 100 150"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-[0_0_15px_rgba(255,215,0,0.5)]"
                >
                    <defs>
                        <linearGradient id="sandalwoodGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#FFF8DC" />
                            <stop offset="50%" stopColor="#FFE4B5" />
                            <stop offset="100%" stopColor="#FFF8DC" />
                        </linearGradient>
                        <linearGradient id="kumkumGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#FF0000" />
                            <stop offset="100%" stopColor="#8B0000" />
                        </linearGradient>
                    </defs>

                    {/* Outer White U (Sandalwood) */}
                    <path
                        d="M20 10 L20 100 Q50 140 80 100 L80 10"
                        stroke="url(#sandalwoodGradient)"
                        strokeWidth="12"
                        strokeLinecap="round"
                        fill="none"
                        className="drop-shadow-md"
                    />

                    {/* Inner Red Line (Kumkum) */}
                    <path
                        d="M50 20 L50 110"
                        stroke="url(#kumkumGradient)"
                        strokeWidth="6"
                        strokeLinecap="round"
                    />

                    {/* Base/Lotus Hint */}
                    <path
                        d="M30 120 Q50 135 70 120"
                        stroke="#DAA520"
                        strokeWidth="2"
                        fill="none"
                        opacity="0.8"
                    />
                </svg>
            ) : (
                /* Shiva Tilak (Tripundra) SVG */
                <svg
                    width="60"
                    height="40"
                    viewBox="0 0 150 100"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="drop-shadow-[0_0_15px_rgba(200,200,255,0.5)]"
                >
                    <defs>
                        <linearGradient id="ashGradient" x1="0" y1="0" x2="1" y2="0">
                            <stop offset="0%" stopColor="#E0E0E0" />
                            <stop offset="50%" stopColor="#F5F5F5" />
                            <stop offset="100%" stopColor="#E0E0E0" />
                        </linearGradient>
                    </defs>

                    {/* Three Horizontal Lines (Bhasma) */}
                    <path
                        d="M10 20 Q75 5 140 20"
                        stroke="url(#ashGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        fill="none"
                    />
                    <path
                        d="M10 50 Q75 35 140 50"
                        stroke="url(#ashGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        fill="none"
                    />
                    <path
                        d="M10 80 Q75 65 140 80"
                        stroke="url(#ashGradient)"
                        strokeWidth="8"
                        strokeLinecap="round"
                        fill="none"
                    />

                    {/* Third Eye / Bindu (Red) */}
                    <circle cx="75" cy="50" r="6" fill="#8B0000" stroke="#FF0000" strokeWidth="2" />
                </svg>
            )}

            {/* Divine Glow/Trail */}
            <div className="absolute top-1/2 left-1/2 w-full h-full -translate-x-1/2 -translate-y-1/2 pointer-events-none">
                <div className="absolute top-[80%] left-1/2 w-1 h-1 bg-red-500 rounded-full animate-ping opacity-50" />
            </div>
        </div>
    );
};

export default CustomCursor;
