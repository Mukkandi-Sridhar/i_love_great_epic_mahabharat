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
    /* 
       Updated Hero: 
       - h-[75vh] on mobile for stable vertical presence without "scaling" jumps.
       - Removed side fades as requested.
       - Reduced bottom fade to 35% height for a cleaner merge with the theme.
    */
    <div className="relative w-full h-[75vh] md:h-[55vw] min-h-[440px] md:min-h-[280px] max-h-[85vh] overflow-hidden bg-[#0a0a0a]">
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
        style={{ background: "linear-gradient(to bottom, rgba(10,10,10,0.5), transparent)" }}
      />

      {/* Balanced bottom fade — reduced height to 35% for cleaner theme merge */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "35%",
          background:
            "linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.8) 35%, rgba(10,10,10,0.3) 70%, transparent 100%)",
        }}
      />
    </div>
  );
};

export default HeroCarousel;
