import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/contexts/FirebaseContext";
import { updateUserProfile, getUserProfile } from "@/services/db";
import { updateProfile } from "firebase/auth";
import { usePageTitle } from "@/hooks/usePageTitle";

const ProfileDetails = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useFirebase();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  usePageTitle("Profile Details");

  useEffect(() => {
    const load = async () => {
      if (user) {
        setName(user.displayName || "");
        setEmail(user.email || "");
        setPhone(user.phoneNumber || "");

        try {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            if (profile.name) setName(profile.name);
            if (profile.phone) setPhone(profile.phone);
            // Don't overwrite email from auth usually, but if needed:
            // if (profile.email) setEmail(profile.email);
          }
        } catch {
          toast({ title: "Profile unavailable", description: "Could not load saved profile details.", variant: "destructive" });
        }
      }
    };
    load();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    try {
      // Update Firebase Auth Profile
      if (name !== user.displayName) {
        await updateProfile(user, { displayName: name });
      }

      // Update Firestore User Doc
      await updateUserProfile(user.uid, {
        name,
        phone,
        email
      });

      toast({
        title: "Profile Updated",
        description: "Your details have been saved successfully.",
      });
    } catch (error) {
      toast({
        title: "Update Failed",
        description: "Could not save profile details.",
        variant: "destructive"
      });
    }
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 md:px-6 h-14 max-w-xl mx-auto w-full">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-semibold">Personal Details</h1>
        </div>
      </header>

      <main className="px-4 md:px-6 pt-6 md:pt-8 animate-fade-in max-w-xl mx-auto w-full">
        <div className="space-y-4 mb-6">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              placeholder="Your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1.5"
            />
          </div>

          <div>
            <Label htmlFor="phone">Phone Number</Label>
            <Input
              id="phone"
              type="tel"
              placeholder="10-digit number"
              value={phone}
              onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
              className="mt-1.5"
              maxLength={10}
            />
          </div>

          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="your@email.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1.5"
            />
          </div>
        </div>

        <Button
          variant="gradient"
          size="lg"
          className="w-full"
          onClick={handleSave}
        >
          Save Changes
        </Button>

        <p className="text-xs text-muted-foreground text-center mt-4">
          Contact customer support for any queries
        </p>
      </main>
    </div>
  );
};

export default ProfileDetails;
