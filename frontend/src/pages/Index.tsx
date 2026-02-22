import { useEffect } from "react";
import { useNavigate } from "react-router-dom";

const Index = () => {
  const navigate = useNavigate();
  
  useEffect(() => {
    // Check if user has seen intro
    const hasSeenIntro = localStorage.getItem("hasSeenIntro");
    
    if (hasSeenIntro) {
      navigate("/explore");
    } else {
      navigate("/intro");
    }
  }, [navigate]);
  
  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
};

export default Index;
