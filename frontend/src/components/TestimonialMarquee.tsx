import { Star, Quote } from "lucide-react";

const testimonials = [
    {
        name: "Rajesh Kumar",
        quote: "The best digital collection of Mahabharat. Authentic and beautifully presented.",
        role: "Verified Buyer",
        image: "https://images.unsplash.com/photo-1506794778202-cad84cf45f1d?w=150&h=150&fit=crop&crop=faces",
    },
    {
        name: "Priya Sharma",
        quote: "SD card option is perfect for offline listening. Highly recommended!",
        role: "Verified Buyer",
        image: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop&crop=faces",
    },
    {
        name: "Amit Patel",
        quote: "Excellent narration and quality. Worth every rupee!",
        role: "Verified Buyer",
        image: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop&crop=faces",
    },
    {
        name: "Sneha Gupta",
        quote: "A spiritual treasure. My family listens to it every evening.",
        role: "Verified Buyer",
        image: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&h=150&fit=crop&crop=faces",
    },
    {
        name: "Vikram Singh",
        quote: "The depth of knowledge in these archives is unmatched.",
        role: "Verified Buyer",
        image: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=faces",
    },
    {
        name: "Anjali Desai",
        quote: "Beautiful interface and crystal clear audio. A divine experience.",
        role: "Verified Buyer",
        image: "https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=150&h=150&fit=crop&crop=faces",
    },
];

const TestimonialCard = ({ t }: { t: typeof testimonials[0] }) => (
    <div className="w-[300px] md:w-[400px] flex-shrink-0 mx-3 md:mx-4 p-6 rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-md hover:bg-white/[0.05] hover:border-primary/30 transition-all duration-300 group">
        <div className="flex gap-1 mb-3">
            {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="w-4 h-4 fill-yellow-500 text-yellow-500" />
            ))}
        </div>
        <div className="relative mb-4">
            <Quote className="absolute -top-2 -left-2 w-8 h-8 text-primary/10 rotate-180" />
            <p className="text-sm md:text-base text-gray-300 leading-relaxed relative z-10 pl-2">
                "{t.quote}"
            </p>
        </div>
        <div className="flex items-center gap-3 pt-4 border-t border-white/5">
            <img
                src={t.image}
                alt={t.name}
                className="w-10 h-10 rounded-full object-cover border border-primary/20"
            />
            <div>
                <h4 className="text-sm font-bold text-white">{t.name}</h4>
                <p className="text-xs text-primary/80">{t.role}</p>
            </div>
        </div>
    </div>
);

const TestimonialMarquee = () => {
    return (
        <div className="relative overflow-hidden py-10">
            {/* Gradient Masks for smooth fade out at edges */}
            <div className="absolute left-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-20 md:w-32 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            {/* Row 1: Left to Right */}
            <div className="flex mb-8 overflow-hidden">
                <div className="flex animate-marquee hover:[animation-play-state:paused]">
                    {[...testimonials, ...testimonials].map((t, i) => (
                        <TestimonialCard key={`row1-${i}`} t={t} />
                    ))}
                </div>
                <div className="flex animate-marquee hover:[animation-play-state:paused]" aria-hidden="true">
                    {[...testimonials, ...testimonials].map((t, i) => (
                        <TestimonialCard key={`row1-clone-${i}`} t={t} />
                    ))}
                </div>
            </div>

            {/* Row 2: Right to Left */}
            <div className="flex overflow-hidden">
                <div className="flex animate-marquee-reverse hover:[animation-play-state:paused]">
                    {[...testimonials, ...testimonials].reverse().map((t, i) => (
                        <TestimonialCard key={`row2-${i}`} t={t} />
                    ))}
                </div>
                <div className="flex animate-marquee-reverse hover:[animation-play-state:paused]" aria-hidden="true">
                    {[...testimonials, ...testimonials].reverse().map((t, i) => (
                        <TestimonialCard key={`row2-clone-${i}`} t={t} />
                    ))}
                </div>
            </div>
        </div>
    );
};

export default TestimonialMarquee;
