import { motion, useScroll, useTransform, useSpring } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { useRef, useState, useEffect } from "react";
import krishnaPencil from "@/assets/krishna_pencil.png";

const KrishnaHero = () => {
    const ref = useRef(null);
    const [isMobile, setIsMobile] = useState(false);

    useEffect(() => {
        const checkMobile = () => setIsMobile(window.innerWidth < 768);
        checkMobile();
        window.addEventListener("resize", checkMobile);
        return () => window.removeEventListener("resize", checkMobile);
    }, []);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"]
    });

    const yBackground = useTransform(scrollYProgress, [0, 1], ["0%", "20%"]);
    const yText = useTransform(scrollYProgress, [0, 1], ["0%", "-10%"]);
    const yImage = useTransform(scrollYProgress, [0, 1], ["0%", "-5%"]);
    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

    // Feather Transforms
    const rotateFeather = useTransform(scrollYProgress, [0, 1], [0, 90]);
    const yFeather = useTransform(scrollYProgress, [0, 1], ["20%", "-80%"]); // Move up through section
    const scaleFeather = useTransform(scrollYProgress, [0, 0.5, 1], [0.8, 1, 0.8]);
    const opacityFeather = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);

    // Smooth spring animation for 3D tilt effect based on mouse could be added here, 
    // but for now let's stick to scroll parallax for robustness.
    return (
        <motion.section
            ref={ref}
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="relative overflow-hidden bg-black"
            style={{
                opacity,
                transformStyle: "preserve-3d",
                perspective: "1000px"
            }}
        >
            <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none z-20" />
            <div className="absolute top-0 left-0 right-0 h-32 bg-gradient-to-b from-background via-[#0a0a0a] to-transparent pointer-events-none z-10" />

            {/* Bottom gradient border — Matched to #0a0a0a background */}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-primary/50 to-transparent pointer-events-none z-20" />
            <div className="absolute bottom-0 left-0 right-0 h-60 bg-gradient-to-t from-[#0a0a0a] via-[#0a0a0a]/80 to-transparent pointer-events-none z-10" />

            {/* Parallax Background Layer - Only for particles/decorations if needed */}
            <motion.div
                style={{ y: yBackground }}
                className="absolute inset-0 pointer-events-none"
            >
                {/* Content can go here if we want background parallax */}
            </motion.div>

            {/* Floating Particles - Divine Atmosphere */}
            <div className="absolute inset-0 pointer-events-none z-0">
                {Array.from({ length: 20 }).map((_, i) => (
                    <motion.div
                        key={i}
                        className="absolute rounded-full bg-[#FFD700]"
                        initial={{
                            x: Math.random() * 100 + "%",
                            y: Math.random() * 100 + "%",
                            opacity: Math.random() * 0.5 + 0.2,
                            scale: Math.random() * 0.5 + 0.5
                        }}
                        animate={{
                            y: [null, Math.random() * -100],
                            opacity: [null, 0]
                        }}
                        transition={{
                            duration: Math.random() * 10 + 10,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        style={{
                            width: Math.random() * 3 + "px",
                            height: Math.random() * 3 + "px",
                            filter: "blur(1px)"
                        }}
                    />
                ))}
            </div>

            {/* Premium corner accents with animation */}
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1.5, delay: 0.3 }}
                className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-primary/8 via-primary/3 to-transparent pointer-events-none blur-3xl"
            />
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1.5, delay: 0.4 }}
                className="absolute top-0 right-0 w-96 h-96 bg-gradient-to-bl from-primary/8 via-primary/3 to-transparent pointer-events-none blur-3xl"
            />
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1.5, delay: 0.5 }}
                className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-primary/6 via-primary/2 to-transparent pointer-events-none blur-3xl"
            />
            <motion.div
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                transition={{ duration: 1.5, delay: 0.6 }}
                className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-tl from-primary/6 via-primary/2 to-transparent pointer-events-none blur-3xl"
            />



            {/* Decorative circle element */}
            <div className="absolute left-2 md:left-12 top-16 md:top-32 z-20 pointer-events-none mix-blend-screen">
                <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                    className="w-16 md:w-24 h-16 md:h-24 opacity-40"
                >
                    <svg viewBox="0 0 100 100" className="w-full h-full">
                        {Array.from({ length: 16 }).map((_, i) => (
                            <line
                                key={i}
                                x1="50"
                                y1="50"
                                x2="50"
                                y2="15"
                                stroke="#FFD700"
                                strokeWidth="2"
                                transform={`rotate(${i * 22.5} 50 50)`}
                                opacity="0.6"
                            />
                        ))}
                    </svg>
                </motion.div>
            </div>

            {/* Flowing decorative path with dots and flute */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-20" style={{ transform: "translateZ(20px)" }}>
                <defs>
                    <linearGradient id="pathGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" stopColor="#FFD700" stopOpacity="0.3" />
                        <stop offset="50%" stopColor="#FFD700" stopOpacity="0.6" />
                        <stop offset="100%" stopColor="#FFD700" stopOpacity="0.3" />
                    </linearGradient>
                </defs>

                {/* Flowing path */}
                <motion.path
                    d="M 0,200 Q 300,150 600,200 T 1200,200"
                    stroke="url(#pathGradient)"
                    strokeWidth="2"
                    fill="none"
                    initial={{ pathLength: 0 }}
                    whileInView={{ pathLength: 1 }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                />

                {/* Animated dots along path */}
                {[0, 1, 2, 3, 4].map((i) => (
                    <motion.circle
                        key={i}
                        r="4"
                        fill="#FFD700"
                        initial={{ offsetDistance: "0%", opacity: 0 }}
                        animate={{
                            offsetDistance: "100%",
                            opacity: [0, 1, 1, 0]
                        }}
                        transition={{
                            duration: 3,
                            delay: i * 0.6,
                            repeat: Infinity,
                            ease: "linear"
                        }}
                        style={{
                            offsetPath: "path('M 0,200 Q 300,150 600,200 T 1200,200')"
                        }}
                    />
                ))}
            </svg>

            <div className="container-width px-4 md:px-12 max-w-7xl mx-auto py-10 md:py-24">
                <div className="flex flex-col md:flex-row items-center justify-center gap-8 md:gap-20" style={{ transform: "translateZ(30px)" }}>

                    {/* Pencil Art Portrait */}
                    <motion.div
                        initial={{ opacity: 0, y: 50 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, ease: "easeOut", delay: 0.2 }}
                        className="w-full md:w-auto relative z-10"
                        style={{ y: yImage }}
                    >
                        {/* Pencil art with black gradient fade wrapper */}
                        <div className="relative">
                            <motion.img
                                src={krishnaPencil}
                                alt="Lord Krishna - Pencil Art"
                                className="w-full h-auto max-w-sm md:max-w-md mx-auto relative z-10"
                                initial={{ scale: 0.9, opacity: 0 }}
                                whileInView={{ scale: 1, opacity: 1 }}
                                viewport={{ once: true }}
                                transition={{ duration: 0.8, delay: 0.4 }}
                            />
                        </div>

                        {/* Circular scrolling text */}
                        <div className="absolute -right-4 top-8 md:-right-8 md:top-12 z-10 w-32 h-32 md:w-40 md:h-40">
                            <motion.div
                                animate={{ rotate: 360 }}
                                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                                className="w-full h-full relative"
                            >
                                <svg viewBox="0 0 100 100" className="w-full h-full drop-shadow-[0_0_15px_rgba(255,215,0,0.6)]">
                                    <defs>
                                        <path id="textCircle" d="M 50, 50 m -35, 0 a 35,35 0 1,1 70,0 a 35,35 0 1,1 -70,0" />
                                    </defs>
                                    <text className="text-[10px] md:text-[11px] font-bold fill-[#FFD700] uppercase tracking-[0.3em]">
                                        <textPath href="#textCircle" startOffset="0%">
                                            ॐ • क्लीं • कृष्णाय • नमः • ह्रीं • श्रीं • गोविन्दाय • नमः •
                                        </textPath>
                                    </text>
                                </svg>
                            </motion.div>
                        </div>
                    </motion.div>

                    {/* Content */}
                    <motion.div
                        initial={{ opacity: 0, x: 30 }}
                        whileInView={{ opacity: 1, x: 0 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.7, delay: 0.2 }}
                        className="w-full md:w-1/2 text-center md:text-left space-y-6 md:space-y-8"
                        style={{ y: yText }}
                    >
                        {/* Heading */}
                        <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold text-white leading-tight tracking-tight">
                            <span className="block mb-2">NAMASTE!</span>
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FFD700] via-[#FFA500] to-[#FFD700]">
                                I'M KRISHNA
                            </span>
                        </h1>

                        {/* Description */}
                        <div className="space-y-4 text-gray-300 text-base md:text-lg leading-relaxed max-w-xl mx-auto md:mx-0">
                            <p>
                                I am the soul of the Mahabharata, guiding you through divine stories and eternal wisdom.
                            </p>
                            <p>
                                Experience dharma teachings, spiritual insights, and the timeless knowledge of the Bhagavad Gita.
                            </p>
                        </div>

                        {/* CTA Button - Premium Theme Style */}
                        <Link to="/all-products" className="mt-6 md:mt-8 inline-block">
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.98 }}
                                className="group relative px-10 py-5 md:px-12 md:py-6
                                         bg-gradient-to-r from-primary via-primary to-primary/90
                                         text-black rounded-full 
                                         font-bold text-base md:text-lg tracking-wide 
                                         transition-all duration-300 
                                         hover:shadow-[0_0_40px_rgba(255,215,0,0.5)]
                                         border-2 border-primary/20
                                         overflow-hidden"
                                style={{ transform: "translateZ(40px)" }}
                            >
                                {/* Animated shine effect */}
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />

                                <span className="relative z-10 flex items-center justify-center gap-2">
                                    Explore Divine Chapters
                                    <ArrowRight className="w-5 h-5 transition-transform group-hover:translate-x-1" />
                                </span>
                            </motion.button>
                        </Link>

                        {/* Decorative line */}
                        <div className="pt-6 md:pt-8">
                            <div className="w-16 h-1 bg-gradient-to-r from-[#FFD700] to-transparent mx-auto md:mx-0 rounded-full" />
                        </div>
                    </motion.div>

                </div>
            </div >
        </motion.section >
    );
};

export default KrishnaHero;
