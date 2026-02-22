import { useNavigate, useLocation } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useEffect } from "react";

const ThankYou = () => {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const location = useLocation();
  const state = (location.state || {}) as {
    mode?: "prepaid" | "cod";
    orderId?: string;
    transactionId?: string;
    phone?: string;
  };

  useEffect(() => {
    // If user is already logged in, redirect to collection after 2 seconds
    if (user) {
      const timer = setTimeout(() => {
        navigate("/collection");
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [user, navigate]);
  
  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4">
      <div className="text-center max-w-md animate-fade-in">
        {/* Success Icon */}
        <div className="flex justify-center mb-6">
          <div className="relative">
            <CheckCircle2 className="w-24 h-24 text-primary animate-scale-in" />
            <div className="absolute inset-0 bg-primary rounded-full blur-xl opacity-30 animate-pulse" />
          </div>
        </div>
        
        {/* Message */}
        <h1 className="text-3xl font-serif font-bold mb-3">
          Thank You!
        </h1>
        
        <p className="text-muted-foreground mb-2">
          Your purchase was successful
        </p>

        {/* Test Mode Details (Fake PhonePe) */}
        <div className="bg-card border border-dashed border-primary/40 rounded-xl p-4 mb-6 text-left shadow-elegant">
          <p className="text-xs font-semibold text-primary mb-1 uppercase tracking-wide">
            Test Mode – Fake Payment (For verification only)
          </p>
          {state.orderId && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Order ID:</span> {state.orderId}
            </p>
          )}
          {state.transactionId && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Transaction ID:</span> {state.transactionId}
            </p>
          )}
          {state.phone && (
            <p className="text-sm text-muted-foreground">
              <span className="font-semibold">Phone:</span> {state.phone}
            </p>
          )}
          {!state.orderId && !state.transactionId && !state.phone && (
            <p className="text-xs text-muted-foreground mt-1">
              No test details available for this session.
            </p>
          )}
        </div>
        
        {/* Action Buttons */}
        <div className="space-y-3">
          {user ? (
            <Button 
              variant="gradient" 
              size="lg" 
              className="w-full"
              onClick={() => navigate("/collection")}
            >
              View Your Collection
            </Button>
          ) : (
            <Button 
              variant="gradient" 
              size="lg" 
              className="w-full"
              onClick={() => navigate("/auth")}
            >
              Login to Check Collection
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="lg" 
            className="w-full"
            onClick={() => navigate("/explore")}
          >
            Explore More
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ThankYou;
