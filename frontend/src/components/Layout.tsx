import { ReactNode, useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import Navbar from './Navbar';
import Footer from './Footer';
import IntroOverlay from './IntroOverlay';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: ReactNode;
}

// Global flag to track if intro has been shown in this session
let introShown = false;

const Layout = ({ children }: LayoutProps) => {
  const { pathname } = useLocation();
  const [showIntro, setShowIntro] = useState(false);

  useEffect(() => {
    // Check if we should show intro (only on home or explore, and only once)
    const isIntroPage = pathname === '/' || pathname === '/explore';
    if (isIntroPage && !introShown) {
      setShowIntro(true);
    }
  }, [pathname]);

  const handleIntroFinish = () => {
    introShown = true;
    setShowIntro(false);
  };

  // Scroll to top on route change
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' });
  }, [pathname]);

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground antialiased selection:bg-primary/30 selection:text-primary relative z-10">
      {showIntro && <IntroOverlay onFinish={handleIntroFinish} />}
      <Navbar />
      <main className={cn(
        "flex-grow pb-20 md:pb-0 animate-in fade-in duration-500 slide-in-from-bottom-4",
        !(pathname === '/' || pathname === '/explore') && "pt-20"
      )}>
        {children}
      </main>
      <div className="block">
        {(pathname === '/' || pathname === '/explore') && <Footer />}
      </div>
    </div>
  );
};

export default Layout;
