import { createContext, useContext, useEffect, useState } from 'react';
import { User, setPersistence, browserLocalPersistence, GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { doc, setDoc, serverTimestamp, getFirestore } from 'firebase/firestore';

interface FirebaseContextType {
  user: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const FirebaseContext = createContext<FirebaseContextType>({
  user: null,
  loading: true,
  signInWithGoogle: async () => { },
  logout: async () => { },
});

export const useFirebase = () => useContext(FirebaseContext);

/** Save/merge user profile into Firestore users/{uid} on every login */
const saveUserProfile = async (user: User) => {
  try {
    const db = getFirestore();
    const userRef = doc(db, 'users', user.uid);

    // Check if user exists to handle createdAt
    const { getDoc } = await import('firebase/firestore');
    const docSnap = await getDoc(userRef);

    const userData: any = {
      uid: user.uid,
      name: user.displayName || '',
      email: user.email || '',
      photoURL: user.photoURL || '',
      lastLoginAt: serverTimestamp(),
    };

    if (!docSnap.exists()) {
      userData.createdAt = serverTimestamp();
      await setDoc(userRef, userData);
    } else {
      await setDoc(userRef, userData, { merge: true });
    }

  } catch (err) {
    console.error('Failed to save user profile:', err);
  }
};

export const FirebaseProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const signInWithGoogle = async () => {
    try {
      const provider = new GoogleAuthProvider();
      const result = await signInWithPopup(auth, provider);
      // Auto-save profile to Firestore on every login
      await saveUserProfile(result.user);
      toast({ title: "Welcome!", description: `Signed in as ${result.user.displayName || result.user.email}` });
    } catch (error: any) {
      console.error("Google Sign In Error:", error);
      toast({
        title: "Login Failed",
        description: error.message || "Could not sign in with Google.",
        variant: "destructive"
      });
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast({ title: "Signed out", description: "See you soon!" });
    } catch (error) {
      console.error("Logout Error:", error);
    }
  };

  useEffect(() => {
    // Make login persistent across refresh and navigation
    setPersistence(auth, browserLocalPersistence).catch(() => { });

    const unsubscribe = auth.onAuthStateChanged((u) => {
      setUser(u);
      if (u) {
        // Ensure user exists in Firestore on every session start/login
        saveUserProfile(u);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  return (
    <FirebaseContext.Provider value={{ user, loading, signInWithGoogle, logout }}>
      {children}
    </FirebaseContext.Provider>
  );
};
