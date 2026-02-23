import sriYantraGold from "@/assets/sri_yantra_gold.png";

const DivineSeparator = () => {
    return (
        <div className="relative py-2 flex items-center justify-center overflow-hidden">
            <div className="w-full max-w-2xl flex items-center gap-6 px-4">
                {/* Left Gradient Line */}
                <div
                    className="flex-1 h-[2px] bg-gradient-to-r from-transparent via-yellow-600/50 via-yellow-200 via-yellow-600/50 to-transparent animate-energy-flow"
                    style={{ backgroundSize: '200% 100%' }}
                />

                {/* Sri Yantra — circular clip, clean spin, no glow */}
                <div className="flex-shrink-0 w-20 h-20 md:w-28 md:h-28 rounded-full overflow-hidden">
                    <img
                        src={sriYantraGold}
                        alt="Sri Yantra"
                        className="w-full h-full object-contain"
                        style={{ animation: "spin 20s linear infinite" }}
                    />
                </div>

                {/* Right Gradient Line */}
                <div
                    className="flex-1 h-[2px] bg-gradient-to-l from-transparent via-yellow-600/50 via-yellow-200 via-yellow-600/50 to-transparent animate-energy-flow"
                    style={{ backgroundSize: '200% 100%' }}
                />
            </div>
        </div>
    );
};

export default DivineSeparator;
