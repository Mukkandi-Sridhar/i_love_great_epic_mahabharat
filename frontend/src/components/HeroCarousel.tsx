import { useRef, useEffect } from "react";
import heroVideo from "@/assets/video.mp4";

const HeroCarousel = () => {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.play().catch(() => { });
    }
  }, []);

  return (
    /* Taller mobile hero (120vw) for "big zoom" — video fills it with object-top so faces are never trimmed */
    <div className="relative w-full h-[120vw] md:h-[55vw] min-h-[460px] md:min-h-[280px] max-h-[90vh] overflow-hidden bg-black">
      <video
        ref={videoRef}
        src={heroVideo}
        autoPlay
        muted
        loop
        playsInline
        className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
      />

      {/* Top fade — keeps transparent navbar readable */}
      <div
        className="absolute inset-x-0 top-0 pointer-events-none h-28"
        style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0.55), transparent)" }}
      />

      {/* Cinematic bottom fade — Improved color matching (#0a0a0a) */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "65%",
          background:
            "linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.95) 20%, rgba(10,10,10,0.7) 45%, rgba(10,10,10,0.3) 75%, transparent 100%)",
        }}
      />

      {/* Side fades */}
      <div className="absolute inset-y-0 left-0 pointer-events-none w-12"
        style={{ background: "linear-gradient(to right, #0a0a0a, transparent)" }} />
      <div className="absolute inset-y-0 right-0 pointer-events-none w-12"
        style={{ background: "linear-gradient(to left, #0a0a0a, transparent)" }} />
    </div>
  );
};

export default HeroCarousel;
