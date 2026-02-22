import sriYantraGold from "@/assets/sri_yantra_gold.png";

const DivineSeparator = () => {
    return (
        <div className="relative py-2 flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-2xl flex items-center gap-6 px-4">
                {/* Left Gradient Line - Liquid Gold Flowing In */}
                <div
                    className="flex-1 h-[2px] bg-gradient-to-r from-transparent via-yellow-600/50 via-yellow-200 via-yellow-600/50 to-transparent animate-energy-flow"
                    style={{ backgroundSize: '200% 100%' }}
                />

                {/* Central Complex Motif - Realistic Sri Yantra */}
                <div className="relative flex-shrink-0 flex items-center justify-center w-24 h-24 md:w-32 md:h-32">
                    {/* Rotating Sri Yantra Image - Ultra Slow Circular Rotation */}
                    <img
                        src={sriYantraGold}
                        alt="Sri Chakra Yantra"
                        className="w-full h-full object-contain animate-spin-slow mix-blend-screen opacity-80"
                        style={{ animationDuration: '30s', animationTimingFunction: 'linear' }}
                    />
                    {/* Inner Glow */}
                    <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full scale-50 pointer-events-none" />
                </div>

                {/* Right Gradient Line - Liquid Gold Flowing In */}
                <div
                    className="flex-1 h-[2px] bg-gradient-to-l from-transparent via-yellow-600/50 via-yellow-200 via-yellow-600/50 to-transparent animate-energy-flow"
                    style={{ backgroundSize: '200% 100%' }}
                />

            </div>
        </div>
    );
};

export default DivineSeparator;
