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
    /* Fixed height hero — video fills it with object-top so faces are never trimmed */
    <div className="relative w-full h-[55vw] min-h-[280px] max-h-[85vh] overflow-hidden bg-black">
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

      {/* Cinematic bottom fade */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "45%",
          background:
            "linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.85) 25%, rgba(10,10,10,0.5) 55%, rgba(10,10,10,0.15) 80%, transparent 100%)",
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
