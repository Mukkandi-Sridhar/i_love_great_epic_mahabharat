import { ReactNode, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebase } from "@/contexts/FirebaseContext";

const RequireAuth = ({ children }: { children: ReactNode }) => {
  const { user, loading } = useFirebase();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) return null;
  return <>{children}</>;
};

export default RequireAuth;
