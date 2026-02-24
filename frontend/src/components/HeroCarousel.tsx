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
       Reduced mobile zoom: 
       - h-[60vh] for a more balanced presence.
       - min-h-[340px] to prevent it from being too small.
    */
    <div className="relative w-full h-[60vh] md:h-[55vw] min-h-[340px] md:min-h-[280px] max-h-[85vh] overflow-hidden bg-[#0a0a0a]">
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

      {/* Balanced bottom fade — reduced height to 25% for ultra-clean theme merge */}
      <div
        className="absolute inset-x-0 bottom-0 pointer-events-none"
        style={{
          height: "25%",
          background:
            "linear-gradient(to top, #0a0a0a 0%, rgba(10,10,10,0.7) 40%, transparent 100%)",
        }}
      />
    </div>
  );
};

export default HeroCarousel;
