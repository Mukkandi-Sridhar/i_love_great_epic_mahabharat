import { motion, useScroll, useSpring, useTransform } from "framer-motion";
import { Sparkles, Feather, BookOpen, Target } from "lucide-react";
import { useRef, useState, useEffect } from "react";

const FeatureNode = ({
    icon,
    title,
    desc,
    align = "left",
    index,
}: {
    icon: React.ReactNode;
    title: string;
    desc: string;
    align?: "left" | "right";
    index: number;
}) => {
    return (
        <div className={`flex flex-col md:flex-row items-center justify-between w-full mb-16 md:mb-12 relative ${align === "right" ? "md:flex-row-reverse" : ""}`}>
            {/* Content Side - Compact Glass Pill */}
            <motion.div
                initial={{ opacity: 0, x: align === "left" ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-50px" }}
                transition={{ duration: 0.6, delay: 0.1 }}
                className={`w-full md:w-[40%] pl-[60px] md:pl-0 ${align === "right" ? "md:text-right" : "md:text-left"} text-left`}
            >
                <div className={`group inline-flex flex-col p-6 rounded-2xl bg-black/40 border border-white/10 backdrop-blur-xl hover:bg-white/[0.03] transition-all duration-500 hover:border-primary/30 hover:shadow-[0_0_30px_-10px_rgba(255,215,0,0.15)] ${align === "right" ? "md:items-end" : "md:items-start"} w-full md:w-auto`}>
                    <div className="flex items-center gap-4 mb-3">
                        <div className="p-2.5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-primary border border-primary/20 shadow-[0_0_10px_rgba(255,215,0,0.1)] group-hover:scale-110 transition-transform duration-500">
                            {icon}
                        </div>
                        <h3 className="text-xl md:text-2xl font-serif font-bold text-white tracking-wide">{title}</h3>
                    </div>
                    <p className="text-gray-300 text-base leading-relaxed max-w-sm">{desc}</p>
                </div>
            </motion.div>

            {/* Center Node (Desktop) / Left Node (Mobile) */}
            <div className="absolute left-[24px] md:left-1/2 top-0 md:top-1/2 -translate-x-1/2 md:-translate-y-1/2 z-10 h-full md:h-auto flex items-start md:items-center pt-8 md:pt-0">
                <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                    className="w-4 h-4 md:w-3 md:h-3 rounded-full bg-[#FFD700] shadow-[0_0_15px_rgba(255,215,0,0.8)] relative z-20 ring-4 ring-black"
                >
                    <div className="absolute inset-0 bg-[#FFD700] rounded-full animate-ping opacity-40" />
                </motion.div>
            </div>

            {/* Empty Side for Balance (Desktop only) */}
            <div className="hidden md:block w-[40%]" />
        </div>
    );
};

const Particle = ({ delay }: { delay: number }) => (
    <motion.div
        initial={{ y: 0, opacity: 0 }}
        animate={{ y: -100, opacity: [0, 1, 0] }}
        transition={{ duration: Math.random() * 5 + 5, repeat: Infinity, delay, ease: "linear" }}
        className="absolute w-[2px] h-[2px] bg-[#FFD700]/40 rounded-full blur-[0.5px]"
        style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
        }}
    />
);

const DivineJourney = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);

    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end end"],
    });

    const smoothProgress = useSpring(scrollYProgress, {
        stiffness: 60,
        damping: 20,
        restDelta: 0.001
    });

    // Animation Transforms
    // Rotate from 0deg (vertical) to 90deg (horizontal)
    const rotate = useTransform(smoothProgress, [0, 1], [0, 90]);
    const y = useTransform(smoothProgress, [0, 1], ["0%", "80%"]);
    const scale = useTransform(smoothProgress, [0, 0.5, 1], [1, 1.2, 1]);
    const opacity = useTransform(smoothProgress, [0, 0.1, 0.9, 1], [0, 1, 1, 0]);

    return (
        <section ref={containerRef} className="py-6 md:py-20 relative overflow-hidden">
            {/* Deep Void Background - Removed to merge with global theme */}
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(255,215,0,0.03)_0%,transparent_60%)]" />

            {/* Floating Gold Dust */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                {Array.from({ length: 30 }).map((_, i) => (
                    <Particle key={i} delay={i * 0.3} />
                ))}
            </div>

            {/* The Real Peacock Feather Animation */}
            <div className={`fixed top-0 bottom-0 w-full h-full pointer-events-none z-50 flex justify-center items-start pt-32 ${isMobile ? 'justify-start pl-4' : ''}`}>
                <div className="relative h-full w-full max-w-4xl mx-auto">
                    <motion.div
                        style={{
                            rotate,
                            top: y,
                            scale,
                            opacity,
                            position: "absolute",
                            left: isMobile ? "0" : "50%",
                            x: isMobile ? "0" : "-50%",
                            transformOrigin: "top center"
                        }}
                        animate={{
                            y: [0, 15, 0],
                            rotate: [0, 3, -3, 0],
                        }}
                        transition={{
                            duration: 6,
                            repeat: Infinity,
                            ease: "easeInOut"
                        }}
                        className="w-64 md:w-96 h-auto z-10"
                    >
                        {/* User's Peacock Feather - Masked & Blended */}
                        <img
                            src="/peacock-feather.jpg"
                            alt="Divine Peacock Feather"
                            className="w-full h-auto mix-blend-screen filter brightness-125 contrast-125 drop-shadow-[0_0_15px_rgba(0,255,255,0.2)]"
                            style={{
                                maskImage: "radial-gradient(closest-side, black 40%, transparent 100%)",
                                WebkitMaskImage: "radial-gradient(closest-side, black 40%, transparent 100%)"
                            }}
                        />
                    </motion.div>

                    {/* Guide Line (Subtle) */}
                    <div className={`absolute top-0 bottom-0 w-[1px] bg-gradient-to-b from-transparent via-primary/10 to-transparent ${isMobile ? 'left-[24px]' : 'left-1/2 -translate-x-1/2'}`} />
                </div>
            </div>

            <div className="container-width relative z-10">
                {/* Header - Minimalist */}
                <div className="text-center mb-16 md:mb-24">
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-primary/20 bg-primary/5 backdrop-blur-md mb-4"
                    >
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-bold text-primary uppercase tracking-[0.2em]">The Path</span>
                    </motion.div>
                    <h2 className="text-3xl md:text-5xl font-serif font-black text-white mb-4">
                        Your Journey to <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-b from-[#FFD700] to-[#B8860B]">
                            Enlightenment
                        </span>
                    </h2>
                </div>

                {/* Journey Nodes - Concise & Compact */}
                <div className="relative max-w-4xl mx-auto">
                    <FeatureNode
                        index={0}
                        align="left"
                        icon={<Feather className="w-5 h-5" />}
                        title="Authentic Wisdom"
                        desc="Mahabharat narrated by distinguished scholars. Authentic pronunciation bridging millennia of tradition."
                    />

                    <FeatureNode
                        index={1}
                        align="right"
                        icon={<BookOpen className="w-5 h-5" />}
                        title="Lifetime Ownership"
                        desc="No subscriptions. Download once, own forever. Access your divine archives offline, anywhere."
                    />

                    <FeatureNode
                        index={2}
                        align="left"
                        icon={<Target className="w-5 h-5" />}
                        title="Modern Application"
                        desc="Practical life lessons derived from Dharma to help you navigate modern day challenges."
                    />
                </div>

                {/* Final Call to Action - Sleek */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    viewport={{ once: true }}
                    className="text-center mt-12"
                >
                    <button className="group relative px-10 py-4 rounded-full border border-[#FFD700]/30 bg-black/20 backdrop-blur-sm transition-all duration-500 hover:border-[#FFD700] hover:bg-[#FFD700]/10 hover:shadow-[0_0_30px_rgba(255,215,0,0.2)] overflow-hidden">
                        <span className="relative z-10 font-serif text-[#FFD700] tracking-[0.2em] text-sm uppercase group-hover:text-white transition-colors duration-500">Begin Your Journey</span>
                        <div className="absolute inset-0 rounded-full bg-gradient-to-r from-transparent via-[#FFD700]/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                    </button>
                </motion.div>
            </div>
        </section>
    );
};

export default DivineJourney;
