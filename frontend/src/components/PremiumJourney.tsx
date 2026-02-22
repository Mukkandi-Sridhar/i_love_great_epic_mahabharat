import { motion, useMotionValue, useSpring, useTransform } from "framer-motion";
import { Sparkles, Feather, BookOpen, Target } from "lucide-react";
import { useRef } from "react";

const TiltCard = ({ children, className }: { children: React.ReactNode; className?: string }) => {
    const x = useMotionValue(0);
    const y = useMotionValue(0);

    const mouseX = useSpring(x, { stiffness: 500, damping: 100 });
    const mouseY = useSpring(y, { stiffness: 500, damping: 100 });

    const rotateX = useTransform(mouseY, [-0.5, 0.5], ["17.5deg", "-17.5deg"]);
    const rotateY = useTransform(mouseX, [-0.5, 0.5], ["-17.5deg", "17.5deg"]);

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const rect = e.currentTarget.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;
        const mouseXFromCenter = e.clientX - rect.left - width / 2;
        const mouseYFromCenter = e.clientY - rect.top - height / 2;
        x.set(mouseXFromCenter / width);
        y.set(mouseYFromCenter / height);
    };

    const handleMouseLeave = () => {
        x.set(0);
        y.set(0);
    };

    return (
        <motion.div
            style={{
                rotateX,
                rotateY,
                transformStyle: "preserve-3d",
            }}
            onMouseMove={handleMouseMove}
            onMouseLeave={handleMouseLeave}
            className={`relative transition-all duration-200 ease-linear ${className}`}
        >
            <div style={{ transform: "translateZ(75px)", transformStyle: "preserve-3d" }}>
                {children}
            </div>
        </motion.div>
    );
};

const AnimatedStat = ({ number, label }: { number: string; label: string }) => {
    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5 }}
            className="text-center p-4 bg-white/[0.02] rounded-xl border border-white/10 backdrop-blur-sm hover:bg-white/[0.05] transition-colors"
        >
            <div className="text-2xl md:text-3xl font-black text-primary mb-1">{number}</div>
            <div className="text-xs md:text-sm text-gray-400">{label}</div>
        </motion.div>
    );
};

const PremiumJourney = () => {
    return (
        <section className="py-24 relative overflow-hidden">
            {/* Deep Black Gradient Background - Elegant Depth */}
            <div className="absolute inset-0 bg-gradient-to-br from-black/40 via-black/20 to-black/50 opacity-70" style={{ filter: 'blur(100px)' }} />
            <div className="absolute top-20 left-20 md:top-24 md:left-24 w-56 h-56 md:w-80 md:h-80 bg-black/50 rounded-full opacity-60" style={{ filter: 'blur(140px)' }} />
            <div className="absolute bottom-20 right-20 md:bottom-24 md:right-24 w-64 h-64 md:w-96 md:h-96 bg-black/60 rounded-full opacity-65" style={{ filter: 'blur(150px)' }} />

            <div className="relative container-width mx-auto px-4">
                {/* Premium Header with Pill Badge */}
                <div className="text-center max-w-4xl mx-auto mb-20">
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        className="inline-flex items-center gap-2 px-5 py-2 bg-gradient-to-r from-primary/20 to-purple-500/20 border border-primary/40 rounded-full mb-6 backdrop-blur-xl"
                    >
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        <Sparkles className="w-4 h-4 text-primary" />
                        <span className="text-xs font-black text-primary uppercase tracking-[0.2em]">Premium Experience</span>
                    </motion.div>

                    <motion.h2
                        initial={{ opacity: 0, scale: 0.9 }}
                        whileInView={{ opacity: 1, scale: 1 }}
                        viewport={{ once: true }}
                        transition={{ duration: 0.6 }}
                        className="text-4xl md:text-6xl font-serif font-black mb-6 text-white leading-tight"
                    >
                        Your Journey to
                        <span className="block bg-gradient-to-r from-primary via-yellow-300 to-primary bg-clip-text text-transparent bg-[length:200%_auto] animate-shine">
                            Divine Wisdom
                        </span>
                    </motion.h2>

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        viewport={{ once: true }}
                        transition={{ delay: 0.2 }}
                        className="text-gray-300 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed"
                    >
                        Immerse yourself in the timeless teachings of Mahabharat with cutting-edge technology and authentic Sanskrit narration
                    </motion.p>
                </div>

                {/* Stats Bar - E-Commerce Inspired */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-20 max-w-5xl mx-auto">
                    {[
                        { number: "10,000+", label: "Happy Devotees" },
                        { number: "500+", label: "Hours of Content" },
                        { number: "100%", label: "Authentic Sources" },
                        { number: "24/7", label: "Instant Access" },
                    ].map((stat, i) => (
                        <AnimatedStat key={i} {...stat} />
                    ))}
                </div>

                {/* Benefits Grid - Unique & Compelling */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto perspective-1000">
                    {[
                        {
                            icon: <Feather className="w-6 h-6 text-primary" />,
                            title: "Narrated by Sanskrit Scholars",
                            desc: "Authentic pronunciation and deep cultural context in every word",
                            badge: "Premium"
                        },
                        {
                            icon: <BookOpen className="w-6 h-6 text-primary" />,
                            title: "Offline Forever Access",
                            desc: "Download once, access eternally. No subscriptions, no internet needed",
                            badge: "One-Time"
                        },
                        {
                            icon: <Target className="w-6 h-6 text-primary" />,
                            title: "Life Lessons Included",
                            desc: "Modern interpretations and practical dharma for daily life",
                            badge: "Exclusive"
                        },
                    ].map((feature, i) => (
                        <TiltCard
                            key={i}
                            className="group bg-gradient-to-br from-white/5 to-transparent border border-white/10 p-8 rounded-2xl hover:border-primary/30 backdrop-blur-sm relative overflow-hidden"
                        >
                            {/* Badge */}
                            <div className="absolute top-4 right-4 transform translate-z-20">
                                <span className="text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 bg-primary/20 text-primary rounded-full border border-primary/30">
                                    {feature.badge}
                                </span>
                            </div>

                            {/* Icon */}
                            <div className="w-14 h-14 bg-gradient-to-br from-primary/20 to-primary/5 rounded-xl flex items-center justify-center mb-6 border border-primary/20 group-hover:border-primary/40 transition-colors transform translate-z-30">
                                {feature.icon}
                            </div>

                            {/* Content */}
                            <h3 className="font-serif font-bold text-xl mb-3 text-white group-hover:text-primary transition-colors transform translate-z-20">
                                {feature.title}
                            </h3>
                            <p className="text-sm text-gray-400 leading-relaxed transform translate-z-10">
                                {feature.desc}
                            </p>
                        </TiltCard>
                    ))}
                </div>

                {/* Trust Badge - Indian Faces */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.4 }}
                    className="mt-20 text-center"
                >
                    <div className="inline-flex items-center gap-3 px-6 py-3 bg-green-500/10 border border-green-500/30 rounded-full hover:bg-green-500/20 transition-colors cursor-default">
                        <div className="flex -space-x-2">
                            {[
                                "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=100&h=100&fit=crop&crop=faces",
                                "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100&h=100&fit=crop&crop=faces",
                                "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=100&h=100&fit=crop&crop=faces",
                                "https://images.unsplash.com/photo-1539571696357-5a69c17a67c6?w=100&h=100&fit=crop&crop=faces"
                            ].map((avatar, i) => (
                                <img
                                    key={i}
                                    src={avatar}
                                    alt={`User ${i + 1}`}
                                    className="w-10 h-10 rounded-full border-2 border-background object-cover"
                                />
                            ))}
                        </div>
                        <div className="text-left">
                            <div className="text-sm font-bold text-white">Trusted by Thousands</div>
                            <div className="text-xs text-gray-400">⭐ 4.9/5 from 2,340 reviews</div>
                        </div>
                    </div>
                </motion.div>
            </div>
        </section>
    );
};

export default PremiumJourney;
