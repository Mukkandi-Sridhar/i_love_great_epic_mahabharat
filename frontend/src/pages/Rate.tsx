import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";

const Rate = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [rating, setRating] = useState(0);
  const [hoveredRating, setHoveredRating] = useState(0);
  const [feedback, setFeedback] = useState("");
  usePageTitle("Rate Us");
  
  const handleSubmit = () => {
    if (rating === 0) {
      toast({
        title: "Please select a rating",
        variant: "destructive",
      });
      return;
    }
    
    toast({
      title: "Thank you for your feedback!",
      description: "Your rating helps us improve.",
    });
    
    setTimeout(() => {
      navigate(-1);
    }, 1500);
  };
  
  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button 
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-semibold">Rate Us</h1>
        </div>
      </header>
      
      <main className="px-4 pt-6 animate-fade-in max-w-md mx-auto">
        <div className="bg-card border border-border rounded-xl p-6 shadow-elegant">
          <h2 className="font-serif font-bold text-xl text-center mb-2">
            How was your experience?
          </h2>
          <p className="text-sm text-muted-foreground text-center mb-6">
            Your feedback helps us serve you better
          </p>
          
          {/* Star Rating */}
          <div className="flex justify-center gap-3 mb-6">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                onMouseEnter={() => setHoveredRating(star)}
                onMouseLeave={() => setHoveredRating(0)}
                className="transition-transform hover:scale-110"
              >
                <Star
                  className={`w-10 h-10 ${
                    star <= (hoveredRating || rating)
                      ? "fill-primary text-primary"
                      : "text-muted"
                  }`}
                />
              </button>
            ))}
          </div>
          
          {rating > 0 && (
            <p className="text-center font-semibold mb-4">
              {rating === 5 && "Excellent! 🎉"}
              {rating === 4 && "Great! 😊"}
              {rating === 3 && "Good! 👍"}
              {rating === 2 && "Fair 🙂"}
              {rating === 1 && "Needs Improvement 😔"}
            </p>
          )}
          
          {/* Feedback Text */}
          <div className="mb-6">
            <label className="text-sm font-medium mb-2 block">
              Additional Feedback (Optional)
            </label>
            <Textarea
              placeholder="Tell us what you think..."
              value={feedback}
              onChange={(e) => setFeedback(e.target.value)}
              rows={4}
              className="resize-none"
            />
          </div>
          
          <Button 
            variant="gradient" 
            size="lg" 
            className="w-full"
            onClick={handleSubmit}
          >
            Submit Feedback
          </Button>
        </div>
      </main>
    </div>
  );
};

export default Rate;
