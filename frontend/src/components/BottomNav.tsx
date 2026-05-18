import { Link, useLocation } from "react-router-dom";
import { Book, User, MessageCircle, UserCircle } from "lucide-react";

const BottomNav = () => {
  const location = useLocation();

  const navItems = [
    { name: "Explore", path: "/explore", icon: Book },
    { name: "Collection", path: "/collection", icon: User },
    { name: "Support", path: "/support", icon: MessageCircle },
    { name: "Profile", path: "/profile", icon: UserCircle },
  ];

  const isActive = (path: string) => {
    return location.pathname === path || location.pathname.startsWith(path + "/");
  };

  return (
    <nav className="fixed bottom-6 left-4 right-4 z-50 animate-slide-up">
      <div className="glass-dock rounded-2xl h-16 px-6 flex justify-between items-center max-w-md mx-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <Link
              key={item.name}
              to={item.path}
              aria-label={item.name}
              aria-current={active ? "page" : undefined}
              className={`relative flex flex-col items-center justify-center w-12 h-12 transition-all duration-300 ${active ? "text-primary -translate-y-2" : "text-muted-foreground hover:text-foreground"
                }`}
            >
              <div className={`absolute inset-0 bg-primary/20 blur-xl rounded-full transition-opacity duration-300 ${active ? "opacity-100" : "opacity-0"}`} />
              <Icon className={`w-6 h-6 z-10 transition-transform duration-300 ${active ? "scale-110 drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]" : ""}`} />
              {active && (
                <span className="absolute -bottom-6 text-[10px] font-bold tracking-wide text-primary animate-fade-in whitespace-nowrap">
                  {item.name}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
};

export default BottomNav;
