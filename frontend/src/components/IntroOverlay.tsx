/**
 * IntroOverlay — The "Apple / Figma" Refinement
 * ─────────────────────────────────────────────
 * Style: Hyper-Minimalist / High-Contrast
 * Focus: Typographical precision, physical lighting, buttery easing.
 * No theatrical curtains. No busy particles. No gimmicks.
 */

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import logo from "@/assets/logo.png";

interface IntroOverlayProps {
  onFinish: () => void;
  durationMs?: number;
}

const IntroOverlay = ({ onFinish, durationMs = 3800 }: IntroOverlayProps) => {
  const [phase, setPhase] = useState(0);
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    document.body.style.overflow = "hidden";

    const timers = [
      setTimeout(() => setPhase(1), 30),
      setTimeout(() => setPhase(2), 300),
      setTimeout(() => setPhase(3), 700),
      setTimeout(() => setPhase(4), 1100),
      setTimeout(() => {
        setIsExiting(true);
        setTimeout(onFinish, 800);
      }, durationMs - 800)
    ];

    if ((window as any).playBackgroundMusic) (window as any).playBackgroundMusic();

    return () => {
      document.body.style.overflow = "unset";
      timers.forEach(clearTimeout);
    };
  }, [durationMs, onFinish]);

  const TITLE = "MAHABHARAT";

  return (
    <AnimatePresence>
      {!isExiting && (
        <motion.div
          key="intro-container"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.05, filter: "blur(40px)" }}
          transition={{ duration: 0.9, ease: [0.25, 0.46, 0.45, 0.94] }}
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black overflow-hidden"
          style={{ touchAction: "none" }}
        >
          {/* ══ Ambient Background (High-End Bloom) ══ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1 : 0.8 }}
            transition={{ duration: 2, ease: "easeOut" }}
            className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none"
            style={{ willChange: "opacity, transform" }}
          >
            {/* Single golden core light */}
            <div className="w-[60vw] h-[60vw] max-w-[600px] max-h-[600px] rounded-full bg-[radial-gradient(circle,rgba(255,190,0,0.1)_0%,transparent_70%)] blur-[40px] md:blur-[80px]" />
          </motion.div>

          {/* ══ Content Structure ══ */}
          <div className="relative z-10 flex flex-col items-center gap-10 px-8 text-center max-w-4xl">

            {/* Logo Section (Restrained) */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{
                opacity: phase >= 2 ? 1 : 0,
                y: phase >= 2 ? 0 : 30
              }}
              transition={{ duration: 1.2, ease: [0.25, 1, 0.5, 1] }}
              className="relative"
            >
              {/* Ultra-thin precision ring */}
              <div className="absolute inset-[-8px] rounded-full border-[0.5px] border-white/10" />

              {/* Logo Portrait (Crisp) */}
              <div className="w-28 h-28 md:w-40 md:h-40 rounded-full border-white/5 shadow-2xl overflow-hidden bg-black">
                <img src={logo} alt="Mahabharat" className="w-full h-full object-cover" />
                {/* Minimalist bottom gradient */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
              </div>
            </motion.div>

            {/* Typography Section (The Hero) */}
            <div className="flex flex-col items-center gap-3">

              {/* Subheading (Clean Sans or Light Serif) */}
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: phase >= 3 ? 1 : 0, y: phase >= 3 ? 0 : 10 }}
                transition={{ duration: 1, ease: "easeOut" }}
                className="text-[9px] md:text-sm font-['Cinzel'] tracking-[0.5em] text-white/50 uppercase"
              >
                Welcome to the Epic
              </motion.p>

              {/* Main Title — MAHABHARAT (Light Reveal) */}
              <div className="relative">
                <h1
                  className="text-5xl md:text-8xl lg:text-9xl font-['Cinzel'] font-bold tracking-tight transition-opacity duration-300"
                  style={{
                    opacity: phase >= 4 ? 1 : 0,
                    background: "linear-gradient(90deg, #ffffff00 0%, #ffffffcc 40%, #ffffff 50%, #ffffffcc 60%, #ffffff00 100%)",
                    backgroundSize: "300% 100%",
                    WebkitBackgroundClip: "text",
                    WebkitTextFillColor: "transparent",
                    backgroundClip: "text",
                    animation: phase >= 4 ? "light-sweep 1.6s cubic-bezier(0.25, 1, 0.5, 1) forwards" : "none"
                  }}
                >
                  {TITLE}
                </h1>

                {/* Fallback for browsers that don't support text mask perfectly */}
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: phase >= 4 ? 1 : 0 }}
                  transition={{ duration: 2, delay: 0.5 }}
                  className="absolute inset-0 flex items-center justify-center -z-10"
                >
                  <h1 className="text-5xl md:text-8xl lg:text-9xl font-['Cinzel'] font-bold tracking-tight text-white/5 blur-sm select-none">
                    {TITLE}
                  </h1>
                </motion.div>
              </div>

              {/* Tagline (Infinite Wisdom) */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: phase >= 4 ? 0.3 : 0 }}
                transition={{ duration: 2, delay: 1 }}
                className="text-[7px] md:text-[9px] font-['Cinzel'] tracking-[0.6em] text-white uppercase"
              >
                Ancient wisdom. Modern discovery.
              </motion.p>
            </div>

          </div>

          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-3 z-50">
            <div className="w-32 h-[1px] bg-white/10 relative overflow-hidden rounded-full">
              <motion.div
                initial={{ width: "0%" }}
                animate={{ width: "100%" }}
                transition={{ duration: (durationMs - 1000) / 1000, ease: "linear" }}
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-transparent via-white to-transparent"
              />
            </div>
            <motion.span
              animate={{ opacity: [0.2, 0.5, 0.2] }}
              transition={{ duration: 1.8, repeat: Infinity }}
              className="text-[8px] tracking-[0.5em] text-white/30 uppercase font-mono"
            >
              Loading
            </motion.span>
          </div>

          {/* Clean background — removed side vignettes */}
          <div className="absolute inset-0 z-50 pointer-events-none" />

          {/* Inline Styles for the Light Sweep */}
          <style>{`
            @keyframes light-sweep {
              0% { background-position: 200% 0; opacity: 0; }
              20% { opacity: 1; }
              100% { background-position: -100% 0; opacity: 1; }
            }
          `}</style>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default IntroOverlay;
