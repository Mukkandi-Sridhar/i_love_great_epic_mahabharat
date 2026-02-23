import { useEffect, useState } from "react";
import logo from "@/assets/logo.png";



type IntroOverlayProps = {
  onFinish: () => void;
  durationMs?: number;
};

const IntroOverlay = ({ onFinish, durationMs = 5000 }: IntroOverlayProps) => {
  const [isExiting, setIsExiting] = useState(false);
  const [showContent, setShowContent] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState(0);
  const [loadingComplete, setLoadingComplete] = useState(false);

  // Lock scroll during intro
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  // Aggressive preloading during intro
  useEffect(() => {
    const imagesToPreload: string[] = [];
    let loadedCount = 0;

    // Preload all images
    const preloadPromises = imagesToPreload.map((src) => {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          loadedCount++;
          setLoadingProgress((loadedCount / imagesToPreload.length) * 100);
          resolve(src);
        };
        img.onerror = () => {
          loadedCount++;
          setLoadingProgress((loadedCount / imagesToPreload.length) * 100);
          resolve(src);
        };
        img.src = src;
      });
    });

    // Wait for all images to load
    Promise.all(preloadPromises).then(() => {
      setLoadingComplete(true);
    });

    // Trigger audio explicitly when intro starts
    if ((window as any).playBackgroundMusic) {
      (window as any).playBackgroundMusic();
    }

    // Prefetch routes in background
    setTimeout(() => {
      import("../pages/AllProducts");
      import("../pages/Support");
      import("../pages/Profile");
      import("../pages/Collection");
    }, 1000);
  }, []);

  // Only finish when BOTH timer AND loading are complete
  useEffect(() => {
    const minTimer = setTimeout(() => {
      if (loadingComplete) {
        handleFinish();
      }
    }, durationMs);

    return () => clearTimeout(minTimer);
  }, [durationMs, loadingComplete]);

  // Trigger finish when loading completes after minimum time
  useEffect(() => {
    if (loadingComplete) {
      const currentTime = Date.now();
      const elapsedTime = currentTime - (window as any)._introStartTime;

      if (elapsedTime >= durationMs) {
        handleFinish();
      }
    }
  }, [loadingComplete, durationMs]);

  // Track start time
  useEffect(() => {
    (window as any)._introStartTime = Date.now();
  }, []);

  const handleFinish = () => {
    setIsExiting(true);
    setTimeout(() => {
      setShowContent(false);
      onFinish();
    }, 1000);
  };

  if (!showContent) return null;



  const title = "MAHABHARAT";
  const letters = title.split("");

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-auto touch-none overflow-hidden" style={{ touchAction: 'none' }}>
      {/* Left Curtain */}
      <div
        className={`absolute top-0 left-0 w-1/2 h-full bg-black z-20 transition-transform duration-1000 ease-in-out ${isExiting ? "-translate-x-full" : "translate-x-0"}`}
        style={{ borderRight: '1px solid rgba(255,215,0,0.1)' }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_right,_var(--tw-gradient-stops))] from-primary/10 to-transparent opacity-50" />
      </div>

      {/* Right Curtain */}
      <div
        className={`absolute top-0 right-0 w-1/2 h-full bg-black z-20 transition-transform duration-1000 ease-in-out ${isExiting ? "translate-x-full" : "translate-x-0"}`}
        style={{ borderLeft: '1px solid rgba(255,215,0,0.1)' }}
      >
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_left,_var(--tw-gradient-stops))] from-primary/10 to-transparent opacity-50" />
      </div>

      {/* Content Container */}
      <div className={`relative z-30 flex flex-col items-center text-center px-4 transition-opacity duration-500 ${isExiting ? "opacity-0" : "opacity-100"}`}>

        {/* Mystical Fog Background */}
        <div className="absolute inset-0 w-[200%] h-[200%] -left-[50%] -top-[50%] bg-[radial-gradient(circle,_rgba(255,215,0,0.1)_0%,_transparent_70%)] animate-[fog-flow_10s_infinite_alternate] pointer-events-none" />

        {/* Logo Reveal */}
        <div className="mb-8 animate-bounce-in relative">
          <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full animate-pulse-gold" />
          <div className="w-32 h-32 md:w-48 md:h-48 rounded-full p-1 bg-gradient-to-br from-primary via-yellow-500 to-transparent shadow-[0_0_60px_rgba(255,215,0,0.4)] relative z-10">
            <div className="w-full h-full rounded-full overflow-hidden bg-black border-4 border-black relative">
              <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
            </div>
          </div>
        </div>

        {/* Text Reveal */}
        <div className="space-y-2 relative z-10">
          <h2 className="text-xl md:text-2xl font-medium tracking-[0.3em] text-primary/80 uppercase animate-slide-up" style={{ animationDelay: '0.2s', animationFillMode: 'both' }}>
            Welcome to the Epic
          </h2>

          <div className="relative">
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-serif font-bold text-transparent bg-clip-text bg-gradient-to-r from-white via-primary to-white drop-shadow-lg mb-2 animate-scale-in" style={{ animationDelay: '0.5s', animationFillMode: 'both' }}>
              I LOVE GREAT EPIC
            </h1>
            <div className="flex justify-center gap-1 md:gap-2 overflow-hidden">
              {letters.map((letter, index) => (
                <span
                  key={index}
                  className="text-5xl md:text-7xl lg:text-9xl font-serif font-bold text-primary drop-shadow-[0_0_30px_rgba(255,215,0,0.6)] inline-block"
                  style={{
                    animation: `letter-reveal 0.8s cubic-bezier(0.34, 1.56, 0.64, 1) forwards`,
                    animationDelay: `${0.8 + (index * 0.1)}s`,
                    opacity: 0
                  }}
                >
                  {letter}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Loading Indicator with REAL Progress */}
        <div className="mt-16 animate-fade-in" style={{ animationDelay: '2.5s', animationFillMode: 'both' }}>
          <div className="h-0.5 w-64 bg-white/10 rounded-full overflow-hidden relative">
            <div
              className="absolute inset-0 bg-gradient-to-r from-primary via-yellow-400 to-primary transition-all duration-300 ease-out"
              style={{ width: `${loadingProgress}%` }}
            />
          </div>
          <p className="mt-4 text-[10px] md:text-xs text-primary/60 uppercase tracking-[0.3em]">
            {loadingProgress < 100 ? 'Awakening the Legend...' : 'Ready!'}
          </p>
          <p className="mt-1 text-[8px] md:text-[10px] text-primary/40">
            {Math.round(loadingProgress)}%
          </p>
        </div>
      </div>
    </div>
  );
};

export default IntroOverlay;

