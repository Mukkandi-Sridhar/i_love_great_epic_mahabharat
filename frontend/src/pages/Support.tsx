import { ChatInterface } from "@/components/ChatInterface";

const Support = () => {
  return (
    <div className="flex flex-col relative overflow-hidden w-full h-[calc(100dvh-136px)] md:h-[calc(100dvh-80px)]">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-amber-900/40 via-background to-background pointer-events-none" />

      <main className="flex-1 flex min-h-0 items-center justify-center p-0 md:p-6 relative z-10 w-full">
        <div className="w-full h-full max-h-[800px] max-w-4xl mx-auto animate-fade-in flex items-center justify-center">
          <ChatInterface />
        </div>
      </main>
    </div>
  );
};

export default Support;
