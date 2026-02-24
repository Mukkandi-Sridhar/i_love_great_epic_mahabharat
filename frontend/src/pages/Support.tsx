import { useNavigate } from "react-router-dom";
import { ArrowLeft, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ChatInterface } from "@/components/ChatInterface";

const Support = () => {
  const navigate = useNavigate();

  return (
    <div className="relative flex flex-col bg-background">
      {/* Background Effects */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/20 via-background to-background pointer-events-none" />

      {/* Floating Back Button — Adjusted for mobile navbar height */}
      <div className="absolute top-2 md:top-4 left-4 z-50">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="text-white hover:bg-white/10 rounded-full bg-black/20 backdrop-blur-sm">
          <ArrowLeft className="w-5 h-5 md:w-6 md:h-6" />
        </Button>
      </div>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center p-4 relative z-10">
        <div className="w-full max-w-4xl mx-auto animate-fade-in">
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-2">Divine Support</h2>
            <p className="text-gray-400">Chat with our AI assistant or get help with your orders</p>
          </div>

          <ChatInterface />

          <div className="mt-8 text-center">
            <Button
              variant="link"
              onClick={() => navigate('/')}
              className="text-gray-400 hover:text-white"
            >
              Return Home
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Support;
