import { Link } from "react-router-dom";
import { ChevronRight, User, BookOpen, FileText, Info, Star, ArrowLeft, LogOut, LayoutDashboard } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useFirebase } from "@/contexts/FirebaseContext";
import { useEffect, useState } from "react";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";

const Profile = () => {
  const navigate = useNavigate();
  const { user, logout } = useFirebase();
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      getDoc(doc(db, "admins", user.uid)),
      getDoc(doc(db, "users", user.uid)),
    ])
      .then(([adminSnap, userSnap]) => {
        setIsAdmin(adminSnap.exists() || (userSnap.exists() && userSnap.data()?.isAdmin === true));
      })
      .catch(() => setIsAdmin(false));
  }, [user]);

  const menuItems = [
    { icon: User, label: "Profile", path: "/profile/details", color: "text-primary" },
    { icon: BookOpen, label: "My Selection", path: "/collection", color: "text-primary" },
    { icon: FileText, label: "Terms and Conditions", path: "/profile/terms", color: "text-primary" },
    { icon: Info, label: "About us", path: "/profile/about", color: "text-primary" },
    { icon: Star, label: "Rate us", path: "/profile/rate", color: "text-primary" },
  ];

  const handleLogout = async () => {
    await logout();
    navigate("/auth");
  };

  return (
    <div className="min-h-screen bg-background pb-6">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-bold">My Account</h1>
        </div>
      </header>

      <main className="px-4 pt-6 animate-fade-in">
        {/* User Info Card */}
        <div className="bg-card border border-border rounded-xl p-6 mb-6 text-center shadow-elegant">
          <div className="w-20 h-20 bg-muted rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden">
            {user?.photoURL ? (
              <img src={user.photoURL} alt={user.displayName || "User"} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-muted-foreground" />
            )}
          </div>
          <h2 className="font-serif font-bold text-xl mb-1">{user?.displayName || "Guest"}</h2>
          <p className="text-sm text-muted-foreground">
            {user?.email || "Sign in to manage your account"}
          </p>
          {isAdmin && (
            <span className="inline-block mt-2 px-3 py-0.5 rounded-full text-xs font-bold bg-primary/20 text-primary border border-primary/30">
              Admin
            </span>
          )}
        </div>

        {/* Admin Panel Button — only visible to admins */}
        {isAdmin && (
          <Link
            to="/admin"
            className="flex items-center justify-between bg-primary/10 border border-primary/40 rounded-xl p-4 mb-4 hover:bg-primary/20 transition-all group"
          >
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-primary/20 rounded-full flex items-center justify-center">
                <LayoutDashboard className="w-5 h-5 text-primary" />
              </div>
              <div>
                <span className="font-medium text-primary">Admin Panel</span>
                <p className="text-xs text-primary/60">Manage orders, tickets & users</p>
              </div>
            </div>
            <ChevronRight className="w-5 h-5 text-primary/50 group-hover:text-primary transition-colors" />
          </Link>
        )}

        {/* Menu Items */}
        <div className="space-y-2">
          {menuItems.map((item, index) => {
            const Icon = item.icon;
            return (
              <Link
                key={index}
                to={item.path}
                className="flex items-center justify-between bg-card border border-border rounded-xl p-4 hover:shadow-elegant transition-all group"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-muted rounded-full flex items-center justify-center">
                    <Icon className={`w-5 h-5 ${item.color}`} />
                  </div>
                  <span className="font-medium">{item.label}</span>
                </div>
                <ChevronRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
              </Link>
            );
          })}

          {/* Logout Button */}
          {user && (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-between bg-secondary/10 border border-destructive/30 rounded-xl p-4 hover:bg-destructive/10 transition-all group mt-4"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-destructive/10 rounded-full flex items-center justify-center">
                  <LogOut className="w-5 h-5 text-destructive" />
                </div>
                <span className="font-medium text-destructive">Logout</span>
              </div>
              <ChevronRight className="w-5 h-5 text-destructive/50 group-hover:text-destructive transition-colors" />
            </button>
          )}
        </div>
      </main>
    </div>
  );
};

export default Profile;
