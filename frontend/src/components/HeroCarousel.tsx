import { useState, useEffect, useRef } from "react";
import { ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import heroSlide1 from "@/assets/hero-new-1.png";
import heroSlide2 from "@/assets/hero-new-2.png";
import heroSlide3 from "@/assets/hero-new-3.jpg";
import heroSlide4 from "@/assets/hero-new-4.png";
import heroSlide5 from "@/assets/hero-new-5.png";

const slides = [
  {
    image: heroSlide1,
    title: "The Great Epic Mahabharat",
    subtitle: "Witness the timeless saga of duty, honor, and destiny.",
    cta: "Start Listening"
  },
  {
    image: heroSlide2,
    title: "Divine Wisdom of Krishna",
    subtitle: "Guidance that transcends time and space.",
    cta: "Explore Teachings"
  },
  {
    image: heroSlide3,
    title: "The Battle of Dharma",
    subtitle: "Where righteousness meets the ultimate test.",
    cta: "View Episodes"
  },
  {
    image: heroSlide4,
    title: "Draupadi's Resilience",
    subtitle: "Strength and dignity in the face of adversity.",
    cta: "Read More"
  },
  {
    image: heroSlide5,
    title: "The Pandavas' Journey",
    subtitle: "From exile to the throne of Hastinapur.",
    cta: "Discover the Story"
  },
];

const HeroCarousel = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  const touchStartX = useRef<number | null>(null);
  const touchEndX = useRef<number | null>(null);

  useEffect(() => {
    if (slides.length === 0) return;
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    touchStartX.current = e.changedTouches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    touchEndX.current = e.changedTouches[0].clientX;
    if (touchStartX.current === null || touchEndX.current === null) return;
    const delta = touchEndX.current - touchStartX.current;
    if (Math.abs(delta) < 30) return;
    if (delta > 0) {
      setCurrentSlide((prev) => (prev - 1 + slides.length) % slides.length);
    } else {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }
  };

  if (slides.length === 0) return null;

  return (
    <div
      className="relative w-full h-[500px] md:h-[600px] lg:h-[650px] overflow-hidden bg-black"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {slides.map((slide, index) => {
        const isActive = index === currentSlide;
        return (
          <div
            key={index}
            className={`absolute inset-0 ${isActive ? "opacity-100 z-10" : "opacity-0 z-0"}`}
            style={{ transition: 'none', transform: 'none' }}
          >

            <div className="w-full h-full">
              <img
                src={slide.image}
                alt={slide.title}
                className="absolute inset-0 w-full h-full object-cover object-top pointer-events-none select-none"
                style={{ top: 0, transform: 'none', transition: 'none' }}
              />
            </div>

            {/* Bottom Fade - Only gradient at the bottom for text readability */}
            <div className="absolute bottom-0 left-0 right-0 h-64 bg-gradient-to-t from-background via-background/60 to-transparent" />





            <div className="absolute bottom-0 left-0 right-0 p-6 flex flex-col items-center text-center z-20 pb-12 md:pb-16">
              <h2 className={`text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-serif font-bold text-white mb-2 md:mb-4 drop-shadow-[0_4px_8px_rgba(0,0,0,0.6)] leading-tight ${isActive ? "opacity-100" : "opacity-0"}`}>
                {slide.title}
              </h2>
              <p className={`text-sm sm:text-base md:text-lg text-gray-200 max-w-2xl font-medium drop-shadow-md px-4 leading-relaxed ${isActive ? "opacity-100" : "opacity-0"}`}>
                {slide.subtitle}
              </p>
            </div>
          </div>
        );
      })}
    </div>



  );
};

export default HeroCarousel;
