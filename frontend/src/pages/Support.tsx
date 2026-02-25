import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInterface } from "@/components/ChatInterface";
import sriYantraGold from "@/assets/sri_yantra_gold.png";

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="flex-1 flex flex-col relative overflow-hidden">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/40 via-background to-background pointer-events-none" />

      {/* Divine Mandala Background Element */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none opacity-[0.03] w-[150%] md:w-[100%] aspect-square">
        <img
          src={sriYantraGold}
          alt="Divine Mandala"
          className="w-full h-full object-contain animate-spin-slow"
        />
      </div>

      {/* Floating Back Button — Clean and subtle */}
      <div className="absolute top-4 md:top-8 left-4 md:left-8 z-50">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate(-1)}
          className="text-white/20 hover:text-white hover:bg-white/5 rounded-full transition-all"
        >
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
        </Button>
      </div>

      <main className="flex-1 flex items-center justify-center p-4 md:p-12 relative z-10">
        <div className="w-full max-w-4xl mx-auto animate-fade-in flex items-center justify-center">
          <ChatInterface />
        </div>
      </main>
    </div>
  );
};

export default Support;
