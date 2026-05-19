import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2, CreditCard, Hash, Mail, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useEffect, useState } from "react";

const ThankYou = () => {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const [countdown, setCountdown] = useState(6);
  const location = useLocation();
  const state = (location.state || {}) as {
    mode?: "prepaid" | "physical-paid";
    orderId?: string;
    transactionId?: string;
    phone?: string;
  };

  useEffect(() => {
    if (!user) return;

    const interval = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          navigate("/collection");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [user, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md animate-fade-in">
        <div className="flex justify-center mb-6">
          <div className="relative">
            <CheckCircle2 className="w-24 h-24 text-primary animate-scale-in" />
            <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-30 animate-pulse" />
          </div>
        </div>

        <h1 className="text-3xl font-serif font-bold mb-3">Thank You!</h1>

        <p className="text-muted-foreground mb-2">Your purchase was successful</p>

        <div className="bg-card border border-primary/20 rounded-xl p-4 mb-6 text-left shadow-elegant space-y-3">
          {state.orderId && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <Hash className="w-4 h-4 text-primary" />
              <span>
                <span className="font-semibold text-foreground">Order ID:</span> {state.orderId}
              </span>
            </div>
          )}
          {state.transactionId && (
            <div className="flex items-center gap-3 text-sm text-muted-foreground">
              <CreditCard className="w-4 h-4 text-primary" />
              <span>
                <span className="font-semibold text-foreground">Transaction ID:</span> {state.transactionId}
              </span>
            </div>
          )}
          <div className="flex items-start gap-3 text-sm text-muted-foreground">
            <Mail className="w-4 h-4 text-primary mt-0.5" />
            <p>You will receive a confirmation on WhatsApp/Email.</p>
          </div>
          {state.mode === "physical-paid" ? (
            <div className="flex items-start gap-3 text-sm text-muted-foreground">
              <Package className="w-4 h-4 text-primary mt-0.5" />
              <p>We will ship within 24-48 hours.</p>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Check your email for download link.</p>
          )}
        </div>

        <div className="space-y-3">
          {user ? (
            <Button variant="gradient" size="lg" className="w-full" onClick={() => navigate("/collection")}>
              View Your Collection
            </Button>
          ) : (
            <Button variant="gradient" size="lg" className="w-full" onClick={() => navigate("/auth")}>
              Login to Check Collection
            </Button>
          )}

          <Button variant="outline" size="lg" className="w-full" onClick={() => navigate("/explore")}>
            Explore More
          </Button>

          {user && countdown > 0 && (
            <p className="text-xs text-muted-foreground mt-4">
              Redirecting to your collection in {countdown}s...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ThankYou;
