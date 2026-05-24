import { useNavigate, Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Shield, CheckCircle2, Lock } from "lucide-react";
import { useFirebase } from "@/contexts/FirebaseContext";
import logo from "@/assets/logo.png";
import { usePageTitle } from "@/hooks/usePageTitle";

const Auth = () => {
  const navigate = useNavigate();
  const { user, signInWithGoogle } = useFirebase();
  usePageTitle("Sign In");

  // Redirect if already logged in
  if (user) {
    return <Navigate to="/profile" replace />;
  }

  const handleGoogleLogin = async () => {
    await signInWithGoogle();
    // Navigation is handled by the redirect or state change in App/Context
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center px-4 py-8 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/10 via-background to-background pointer-events-none" />

      <div className="w-full max-w-md animate-fade-in relative z-10">
        {/* Logo & Header */}
        <div className="text-center mb-10">
          <div className="w-24 h-24 bg-secondary/30 backdrop-blur-xl rounded-full flex items-center justify-center mx-auto mb-6 shadow-glow border border-white/10 overflow-hidden p-1">
            <img src={logo} alt="Logo" className="w-full h-full object-cover rounded-full" />
          </div>
          <h1 className="text-4xl font-bold text-center mb-2 text-gradient-gold">
            I Love Great Epic Mahabharat
          </h1>
          <p className="text-muted-foreground text-lg font-medium">
            Your gateway to eternal wisdom
          </p>
        </div>

        {/* Login Card */}
        <div className="glass-card rounded-3xl p-8 shadow-2xl">
          <div className="space-y-6">
            <div className="text-center space-y-2">
              <h2 className="text-xl font-bold">Welcome Back</h2>
              <p className="text-sm text-muted-foreground">Sign in to access your collection</p>
            </div>

            <Button
              size="lg"
              className="w-full h-14 text-base font-bold shadow-glow hover:scale-[1.02] transition-all bg-white text-black hover:bg-white/90"
              onClick={handleGoogleLogin}
            >
              <svg className="mr-2 h-5 w-5" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512">
                <path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path>
              </svg>
              Sign in with Google
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-white/10" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Secured by Google</span>
              </div>
            </div>
          </div>
        </div>

        {/* Trust Indicators */}
        <div className="grid grid-cols-3 gap-4 mt-8">
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-2 rounded-full bg-secondary/20 text-primary">
              <Shield className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Secure</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-2 rounded-full bg-secondary/20 text-primary">
              <CheckCircle2 className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Verified</p>
          </div>
          <div className="flex flex-col items-center gap-2 text-center">
            <div className="p-2 rounded-full bg-secondary/20 text-primary">
              <Lock className="w-4 h-4" />
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Private</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Auth;
