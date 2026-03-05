import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInterface } from "@/components/ChatInterface";
import sriYantraGold from "@/assets/sri_yantra_gold.png";

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col relative overflow-hidden w-full h-[calc(100dvh-136px)] md:h-[calc(100dvh-80px)]">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/40 via-background to-background pointer-events-none" />


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

      <main className="flex-1 flex min-h-0 items-center justify-center p-0 md:p-6 relative z-10 w-full">
        <div className="w-full h-full max-h-[800px] max-w-4xl mx-auto animate-fade-in flex items-center justify-center">
          <ChatInterface />
        </div>
      </main>
    </div>
  );
};

export default Support;
