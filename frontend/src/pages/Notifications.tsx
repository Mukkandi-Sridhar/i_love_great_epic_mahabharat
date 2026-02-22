import { useNavigate } from "react-router-dom";
import { ArrowLeft, Bell, Package, Star, Gift, Zap } from "lucide-react";

const Notifications = () => {
  const navigate = useNavigate();
  const notifications: any[] = [];

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-semibold">Notifications</h1>
        </div>
      </header>
      
      <main className="px-4 pt-4 animate-fade-in">
        <div className="space-y-3">
        </div>

        {notifications.length === 0 && (
          <div className="text-center py-16">
            <Bell className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
            <h3 className="font-semibold mb-2">No Notifications</h3>
            <p className="text-sm text-muted-foreground">
              You're all caught up!
            </p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Notifications;
