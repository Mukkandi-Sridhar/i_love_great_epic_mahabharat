import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { Search, ShoppingBag, Menu, X, User, ArrowRight, Compass, Store, Headphones, Sparkles, TrendingUp } from 'lucide-react';
import { motion, AnimatePresence } from "framer-motion";
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { useSettings } from '@/contexts/SettingsContext';
import logo from '@/assets/logo.png';
import { allProducts } from '@/data/products';
import { SearchIndex } from '@/lib/search';
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db } from "@/lib/firebase";
import { collection, getDocs } from "firebase/firestore";

const TICKER_LINES = [
    "నా దేశం భగవద్గీత...!",
    "నా దేశం అగ్ని పునీత సీత!",
    "నా దేశం కరుణాంతరంగ...!",
    "నా దేశం సంస్కార గంగ!",
    "నమస్తే 🙏🏽",
];

const Navbar = () => {
    const location = useLocation();
    const [isScrolled, setIsScrolled] = useState(false);
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [searchResults, setSearchResults] = useState<any[]>([]);
    const [isSearchOpen, setIsSearchOpen] = useState(false);
    const [firestoreProducts, setFirestoreProducts] = useState<any[]>([]);
    const { settings } = useSettings();

    const [tickerIndex, setTickerIndex] = useState(0);

    useEffect(() => {
        const interval = setInterval(() => {
            setTickerIndex(prev => (prev + 1) % TICKER_LINES.length);
        }, 2500);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const fetchExtra = async () => {
            try {
                if (!db) return;
                const snap = await getDocs(collection(db, "products"));
                const live = snap.docs.map((doc) => {
                    const data = doc.data();
                    return {
                        id: doc.id,
                        ...data,
                        image: data.image || data.imageUrl || "",
                        title: data.title || "Untitled product",
                        type: data.type || "ebook",
                        rating: data.rating || 0,
                        price: data.price || 0,
                    };
                });
                setFirestoreProducts(live);
            } catch {
                // Static products remain available when Firestore search is unavailable.
            }
        };
        fetchExtra();
    }, []);

    const catalogProducts = useMemo(() => {
        const byId = new Map(allProducts.map((product) => [product.id, product]));
        firestoreProducts.forEach((product) => byId.set(product.id, { ...byId.get(product.id), ...product }));
        return Array.from(byId.values());
    }, [firestoreProducts]);

    const searchIndex = useMemo(() => new SearchIndex(catalogProducts), [catalogProducts]);

    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 10);
        };
        window.addEventListener('scroll', handleScroll);
        return () => window.removeEventListener('scroll', handleScroll);
    }, []);

    useEffect(() => {
        setIsMobileMenuOpen(false);
        setIsSearchOpen(false); // Close search on navigation
    }, [location]);


    useEffect(() => {
        if (searchQuery.trim()) {
            setSearchResults(searchIndex.search(searchQuery));
        } else {
            setSearchResults([]);
        }
    }, [searchQuery, searchIndex]);

    const navLinks = [
        { name: 'Store', path: '/all-products' },
        { name: 'Ebooks', path: '/all-products?type=ebooks' },
        { name: 'Pendrives', path: '/all-products?type=pendrives' },
        { name: 'Support', path: '/support' },
    ];

    return (
        <>
            {settings?.bannerEnabled && settings?.bannerText && (
                <div className="fixed top-0 left-0 right-0 z-[60] bg-primary text-black py-2 overflow-hidden shadow-lg border-b border-primary/20">
                    <div className="whitespace-nowrap animate-infiniteLine font-mono text-[10px] md:text-sm font-bold uppercase tracking-[0.2em] flex items-center justify-center gap-10">
                        <span>{settings.bannerText}</span>
                        <span className="opacity-30">✦</span>
                        <span>{settings.bannerText}</span>
                        <span className="opacity-30">✦</span>
                        <span>{settings.bannerText}</span>
                        <span className="opacity-30">✦</span>
                    </div>
                </div>
            )}
            <header
                className={cn(
                    "fixed top-0 left-0 right-0 z-50",
                    isScrolled ? "glass shadow-elegant border-none" : "bg-transparent",
                    settings?.bannerEnabled ? "mt-9 md:mt-10" : "mt-0"
                )}
            >


                {/* Mobile Header - Single Row - Optimised for small screens */}
                <div className="md:hidden flex items-center w-full px-3 h-14 gap-2">

                    {/* Left: Logo + Full Brand Name */}
                    <Link to="/" className="flex items-center gap-1.5 shrink-0">
                        <div className="w-7 h-7 flex-shrink-0">
                            <img src={logo} alt="Logo" className="w-full h-full object-cover rounded-full shadow-lg" />
                        </div>
                        <div className="flex flex-col leading-tight">
                            <span className="text-[9px] font-serif font-bold text-[#FFD700] whitespace-nowrap">I Love Great</span>
                            <span className="text-[9px] font-serif font-bold text-[#FFD700] whitespace-nowrap">Epic Mahabharat</span>
                        </div>
                    </Link>

                    {/* Center: One-at-a-time Ticker */}
                    <div className="flex-1 min-w-0 flex items-center justify-center overflow-hidden px-2">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={tickerIndex}
                                initial={{ y: -18, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 18, opacity: 0 }}
                                transition={{ duration: 0.4, ease: "easeInOut" }}
                                className="text-[12px] leading-snug font-serif font-bold text-[#FFD700] text-center select-none line-clamp-2 w-full"
                            >
                                {TICKER_LINES[tickerIndex]}
                            </motion.span>
                        </AnimatePresence>
                    </div>

                    {/* Right: Cart shortcut */}
                    <Link to="/all-products" aria-label="Go to store" className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 border border-primary/20">
                        <ShoppingBag className="w-4 h-4 text-primary" />
                    </Link>
                </div>


                {/* Desktop Header Row */}
                <div className="hidden md:flex w-full px-8 h-20 items-center gap-8 relative">
                    {/* Logo */}
                    <Link to="/" className="flex items-center gap-3 group z-50 relative shrink-0">
                        <div className="relative w-10 h-10 flex items-center justify-center flex-shrink-0">
                            <img src={logo} alt="Logo" className="w-full h-full object-cover rounded-full drop-shadow-md" />
                        </div>
                        {/* Show full text only on large desktop */}
                        <span className="hidden lg:block text-2xl font-serif font-bold tracking-tight text-[#FFD700] group-hover:opacity-90 transition-opacity">
                            I Love Great Epic Mahabharat
                        </span>
                        {/* Show abbreviated on tablet */}
                        <span className="block lg:hidden text-xl font-serif font-bold text-[#FFD700] group-hover:opacity-90 transition-opacity">
                            ILGEM
                        </span>
                    </Link>

                    {/* Desktop: One-at-a-time Ticker */}
                    <div className="flex-1 h-12 flex items-center justify-center overflow-hidden relative">
                        <AnimatePresence mode="wait">
                            <motion.span
                                key={tickerIndex}
                                initial={{ y: -28, opacity: 0 }}
                                animate={{ y: 0, opacity: 1 }}
                                exit={{ y: 28, opacity: 0 }}
                                transition={{ duration: 0.45, ease: "easeInOut" }}
                                className="text-lg font-serif font-bold text-[#FFD700] tracking-widest text-center select-none"
                            >
                                {TICKER_LINES[tickerIndex]}
                            </motion.span>
                        </AnimatePresence>
                    </div>

                    {/* Desktop Navigation & Icons - Grouped Right */}
                    <div className="hidden md:flex items-center gap-6 shrink-0 z-50">
                        <nav className="flex items-center gap-1">
                            {navLinks.map((link) => (
                                <Link
                                    key={link.name}
                                    to={link.path}
                                    className="relative px-4 py-2 rounded-full text-sm font-medium text-muted-foreground/90 hover:text-primary transition-all duration-300 hover:bg-primary/5 border border-transparent hover:border-primary/20 tracking-wider hover:shadow-[0_0_15px_-3px_rgba(255,215,0,0.15)] group"
                                >
                                    {link.name}
                                </Link>
                            ))}
                        </nav>

                        <div className="flex items-center gap-3 pl-4 border-l border-white/10">
                            {/* Search Modal - Minimized */}
                            <Dialog open={isSearchOpen} onOpenChange={setIsSearchOpen}>
                                <DialogTrigger asChild>
                                    <button aria-label="Open search" className="group relative flex items-center justify-center w-10 h-10 bg-secondary/10 hover:bg-secondary/20 border border-white/10 hover:border-primary/30 rounded-full transition-all duration-300">
                                        <Search className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                        <div className="absolute inset-0 rounded-full bg-primary/5 opacity-0 group-hover:opacity-100 blur-md transition-opacity duration-500 -z-10" />
                                    </button>
                                </DialogTrigger>
                                <DialogContent className="sm:max-w-[600px] bg-black/80 backdrop-blur-2xl border-white/10 text-white p-0 gap-0 overflow-hidden shadow-2xl shadow-primary/10">
                                    <div className="p-6 border-b border-white/10 flex items-center gap-4">
                                        <Search className="w-6 h-6 text-primary animate-pulse" />
                                        <Input
                                            placeholder="What wisdom do you seek?"
                                            className="bg-transparent border-none focus-visible:ring-0 text-xl md:text-2xl placeholder:text-muted-foreground/50 h-auto p-0 font-serif tracking-wide"
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            autoFocus
                                        />
                                        {searchQuery && (
                                            <button aria-label="Clear search" onClick={() => setSearchQuery("")} className="text-muted-foreground hover:text-white transition-colors">
                                                <X className="w-5 h-5" />
                                            </button>
                                        )}
                                    </div>

                                    <div className="max-h-[60vh] overflow-y-auto p-4 custom-scrollbar">
                                        <AnimatePresence mode="wait">
                                            {searchResults.length > 0 ? (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    exit={{ opacity: 0 }}
                                                    className="space-y-2"
                                                >
                                                    <div className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3 px-2">
                                                        Found {searchResults.length} Treasures
                                                    </div>
                                                    {searchResults.map((product, index) => (
                                                        <motion.div
                                                            key={product.id}
                                                            initial={{ opacity: 0, y: 10 }}
                                                            animate={{ opacity: 1, y: 0 }}
                                                            transition={{ delay: index * 0.05 }}
                                                        >
                                                            <Link
                                                                to={`/product/${product.id}`}
                                                                className="flex items-center gap-4 p-3 rounded-xl hover:bg-white/5 border border-transparent hover:border-white/5 transition-all group"
                                                                onClick={() => setIsSearchOpen(false)}
                                                            >
                                                                <div className="relative w-16 h-16 rounded-lg overflow-hidden bg-secondary/20">
                                                                    <img src={product.image} alt={product.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                                                                </div>
                                                                <div className="flex-1">
                                                                    <h4 className="font-medium text-lg text-white group-hover:text-primary transition-colors font-serif">{product.title}</h4>
                                                                    <div className="flex items-center gap-3 text-xs text-muted-foreground mt-1">
                                                                        <span className="capitalize bg-white/5 px-2 py-0.5 rounded-full">{product.type}</span>
                                                                        <span>₹{product.price}</span>
                                                                        <span className="flex items-center gap-1 text-yellow-500">
                                                                            ★ {product.rating}
                                                                        </span>
                                                                    </div>
                                                                </div>
                                                                <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary -translate-x-4 opacity-0 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-300" />
                                                            </Link>
                                                        </motion.div>
                                                    ))}
                                                </motion.div>
                                            ) : searchQuery ? (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="py-12 text-center text-muted-foreground"
                                                >
                                                    <Search className="w-12 h-12 mx-auto mb-4 opacity-20" />
                                                    <p className="text-lg">No wisdom found for "{searchQuery}"</p>
                                                    <p className="text-sm opacity-50">Try searching for "Gita", "Karma", or "Dharma"</p>
                                                </motion.div>
                                            ) : (
                                                <motion.div
                                                    initial={{ opacity: 0 }}
                                                    animate={{ opacity: 1 }}
                                                    className="space-y-6"
                                                >
                                                    {/* Popular Suggestions */}
                                                    <div>
                                                        <div className="flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider mb-3 px-2">
                                                            <TrendingUp className="w-3 h-3" />
                                                            Popular Wisdom
                                                        </div>
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            {catalogProducts.slice(0, 4).map((product, index) => (
                                                                <Link
                                                                    key={product.id}
                                                                    to={`/product/${product.id}`}
                                                                    onClick={() => setIsSearchOpen(false)}
                                                                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 transition-colors group"
                                                                >
                                                                    <div className="w-10 h-10 rounded bg-secondary/20 overflow-hidden">
                                                                        <img src={product.image} alt={product.title} className="w-full h-full object-cover" />
                                                                    </div>
                                                                    <div className="overflow-hidden">
                                                                        <p className="text-sm font-medium truncate group-hover:text-primary transition-colors">{product.title}</p>
                                                                        <p className="text-xs text-muted-foreground capitalize">{product.type}</p>
                                                                    </div>
                                                                </Link>
                                                            ))}
                                                        </div>
                                                    </div>

                                                    {/* Quick Categories */}
                                                    <div>
                                                        <div className="flex items-center gap-2 text-xs font-medium text-primary uppercase tracking-wider mb-3 px-2">
                                                            <Sparkles className="w-3 h-3" />
                                                            Explore Categories
                                                        </div>
                                                        <div className="flex gap-2 px-2">
                                                            <button onClick={() => setSearchQuery("ebook")} className="px-4 py-2 rounded-full bg-secondary/10 hover:bg-primary/20 hover:text-primary text-sm transition-colors border border-white/5">
                                                                E-books
                                                            </button>
                                                            <button onClick={() => setSearchQuery("pendrive")} className="px-4 py-2 rounded-full bg-secondary/10 hover:bg-primary/20 hover:text-primary text-sm transition-colors border border-white/5">
                                                                Pendrives
                                                            </button>
                                                            <button onClick={() => setSearchQuery("audio")} className="px-4 py-2 rounded-full bg-secondary/10 hover:bg-primary/20 hover:text-primary text-sm transition-colors border border-white/5">
                                                                Audio
                                                            </button>
                                                        </div>
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                </DialogContent>
                            </Dialog>

                            <Link to="/profile" aria-label="Go to profile">
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10 transition-all">
                                    <User className="w-5 h-5" />
                                </Button>
                            </Link>

                            <Link to="/all-products" aria-label="Go to store">
                                <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary hover:bg-primary/10 relative transition-all">
                                    <ShoppingBag className="w-5 h-5" />
                                </Button>
                            </Link>
                        </div>
                    </div>

                    {/* Mobile: Empty spacer for layout balance */}
                    <div className="md:hidden w-10" />
                </div>
            </header>

            {/* Mobile: Bottom Navigation Bar - Fixed to Viewport Bottom */}
            <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-black/95 backdrop-blur-xl border-t border-white/10 pb-safe">
                <div className="flex items-center justify-around h-16 px-2">
                    {[
                        { name: 'Explore', path: '/', icon: Compass },
                        { name: 'Store', path: '/all-products', icon: Store },
                        { name: 'Support', path: '/support', icon: Headphones },
                        { name: 'Profile', path: '/profile', icon: User },
                    ].map((item) => {
                        const Icon = item.icon;
                        const isActive = location.pathname === item.path ||
                            (item.path === '/all-products' && location.pathname.startsWith('/all-products'));

                        return (
                            <Link
                                key={item.name}
                                to={item.path}
                                aria-label={`Go to ${item.name.toLowerCase()}`}
                                aria-current={isActive ? "page" : undefined}
                                className={cn(
                                    "flex flex-col items-center justify-center gap-1.5 px-4 py-2 rounded-xl transition-all duration-300 min-w-[70px] relative",
                                    isActive
                                        ? "text-primary"
                                        : "text-gray-400 hover:text-white active:scale-95"
                                )}
                            >
                                {/* Glow effect for active item */}
                                {isActive && (
                                    <div className="absolute inset-0 bg-primary/10 rounded-xl blur-sm" />
                                )}

                                {/* Icon with glow */}
                                <div className="relative">
                                    <Icon className={cn(
                                        "w-6 h-6 transition-all duration-300",
                                        isActive && "drop-shadow-[0_0_8px_rgba(255,215,0,0.5)]"
                                    )} />
                                </div>

                                {/* Label */}
                                <span className={cn(
                                    "text-[10px] font-bold tracking-wide transition-all duration-300",
                                    isActive && "text-primary"
                                )}>
                                    {item.name}
                                </span>
                            </Link>
                        );
                    })}
                </div>
            </nav>
        </>
    );
};

export default Navbar;
