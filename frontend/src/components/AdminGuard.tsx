import { ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useFirebase } from "@/contexts/FirebaseContext";
import { doc, getDoc } from "firebase/firestore";
import { db, firebaseConfigured } from "@/lib/firebase";

const AdminGuard = ({ children }: { children: ReactNode }) => {
    const { user, loading } = useFirebase();
    const navigate = useNavigate();
    const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

    useEffect(() => {
        if (loading) return;
        if (!firebaseConfigured) { navigate("/auth"); return; }
        if (!user) { navigate("/auth"); return; }

        getDoc(doc(db, "admins", user.uid)).then((adminSnap) => {
            if (adminSnap.exists()) {
                setIsAdmin(true);
            } else {
                navigate("/");
            }
        }).catch(() => navigate("/"));
    }, [user, loading, navigate]);

    if (loading || isAdmin === null) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return <>{children}</>;
};

export default AdminGuard;
