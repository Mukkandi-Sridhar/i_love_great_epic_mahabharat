import { useState, useEffect } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { ArrowLeft, SlidersHorizontal, Sparkles, Search } from "lucide-react";
import { motion } from "framer-motion";
import ProductCard from "@/components/ProductCard";

import { Button } from "@/components/ui/button";
import { useFirebase } from "@/contexts/FirebaseContext";
import { subscribeToOwnedProductIds } from "@/services/db";
import { ebooks, pendrives } from "@/data/products";
import { SkeletonCard } from "@/components/SkeletonCard";

const AllProducts = () => {
  const { user } = useFirebase();
  const [owned, setOwned] = useState<Set<string>>(new Set());
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get("type") || "ebooks";

  const [filterPrice, setFilterPrice] = useState<string>("all");
  const [filterRating, setFilterRating] = useState<string>("all");
  const [loading, setLoading] = useState(true);



  // Determine which products to show based on type parameter
  const getProducts = () => {
    if (typeParam === "ebooks") return ebooks;
    if (typeParam === "sdcards" || typeParam === "pendrives") return pendrives;
    return [];
  };

  const [products, setProducts] = useState(getProducts());

  useEffect(() => {
    setLoading(true);
    let filtered = getProducts();

    // Apply price filter
    if (filterPrice !== "all") {
      if (filterPrice === "low") {
        filtered = filtered.filter(p => p.price < 500);
      } else if (filterPrice === "mid") {
        filtered = filtered.filter(p => p.price >= 500 && p.price < 1000);
      } else if (filterPrice === "high") {
        filtered = filtered.filter(p => p.price >= 1000);
      }
    }

    // Apply rating filter
    if (filterRating !== "all") {
      const minRating = parseInt(filterRating);
      filtered = filtered.filter(p => p.rating >= minRating);
    }

    setProducts(filtered);
    const timer = window.setTimeout(() => setLoading(false), 150);
    return () => window.clearTimeout(timer);
  }, [filterPrice, filterRating, typeParam]);

  useEffect(() => {
    if (!user) {
      setOwned(new Set());
      return;
    }

    const unsubscribe = subscribeToOwnedProductIds(user.uid, setOwned);
    return () => unsubscribe();
  }, [user]);

  const getTitle = () => {
    if (typeParam === "ebooks") return "All Ebooks";
    if (typeParam === "sdcards" || typeParam === "pendrives") return "All Pendrives";
    return "All Products";
  };

  return (
    <div className="pb-20">


      {/* Hero Section - Clean & Modern */}
      <div className="relative pt-6 pb-8 md:pt-12 md:pb-16 px-4 overflow-hidden">


        <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-transparent opacity-30" />

        <div className="relative z-10 text-center space-y-3">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-primary text-[10px] font-bold uppercase tracking-widest mb-1"
          >
            <Sparkles className="w-3 h-3" />
            <span>Divine Collection</span>
          </motion.div>
          <motion.h1
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-3xl md:text-5xl font-serif font-bold text-white tracking-tight"
          >
            Sacred Artifacts
          </motion.h1>
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="text-gray-400 text-sm md:text-base max-w-md mx-auto leading-relaxed"
          >
            Ancient wisdom preserved for your spiritual journey.
          </motion.p>
        </div>
      </div>

      {/* Sticky Tabs & Filters - Premium App Feel */}
      <div className="sticky top-16 z-30 bg-background/95 backdrop-blur-xl border-b border-white/5 py-3 shadow-2xl shadow-black/20">
        <div className="w-full max-w-[1400px] mx-auto px-4 space-y-3">

          {/* Tabs - IOS Style Segmented Control */}
          <div className="flex justify-center">
            <div className="inline-flex p-1 bg-white/5 rounded-full border border-white/5 relative w-full max-w-xs">
              <button
                onClick={() => setSearchParams({ type: "ebooks" })}
                className={`relative z-10 flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${typeParam === "ebooks"
                  ? "text-black"
                  : "text-gray-400 hover:text-white"
                  }`}
              >
                E-books
                {typeParam === "ebooks" && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary rounded-full -z-10 shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                  />
                )}
              </button>
              <button
                onClick={() => setSearchParams({ type: "pendrives" })}
                className={`relative z-10 flex-1 py-2 text-xs font-bold uppercase tracking-wider transition-all duration-300 ${typeParam === "sdcards" || typeParam === "pendrives"
                  ? "text-black"
                  : "text-gray-400 hover:text-white"
                  }`}
              >
                Pendrives
                {(typeParam === "sdcards" || typeParam === "pendrives") && (
                  <motion.div
                    layoutId="activeTab"
                    className="absolute inset-0 bg-primary rounded-full -z-10 shadow-[0_0_15px_rgba(255,215,0,0.3)]"
                  />
                )}
              </button>
            </div>
          </div>

          {/* Filters - Horizontal Scroll */}
          <div className="flex items-center justify-center gap-2 overflow-x-auto pb-1 no-scrollbar mask-linear-fade">
            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 text-gray-400 shrink-0">
              <SlidersHorizontal className="w-3 h-3" />
              <span className="text-[10px] font-bold uppercase tracking-wider">Filter</span>
            </div>

            <div className="relative group shrink-0">
              <select
                value={filterPrice}
                onChange={(e) => setFilterPrice(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 text-gray-300 transition-colors cursor-pointer min-w-[100px]"
              >
                <option value="all">Price: All</option>
                <option value="low">Under ₹500</option>
                <option value="mid">₹500 - ₹1000</option>
                <option value="high">Above ₹1000</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-white" />
              </div>
            </div>

            <div className="relative group shrink-0">
              <select
                value={filterRating}
                onChange={(e) => setFilterRating(e.target.value)}
                className="appearance-none pl-3 pr-7 py-1.5 bg-white/5 hover:bg-white/10 border border-white/5 rounded-full text-[11px] font-medium focus:outline-none focus:ring-1 focus:ring-primary/50 text-gray-300 transition-colors cursor-pointer min-w-[100px]"
              >
                <option value="all">Rating: All</option>
                <option value="5">5 Stars</option>
                <option value="4">4+ Stars</option>
              </select>
              <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none opacity-50">
                <div className="w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] border-t-white" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <main className="w-full max-w-[1400px] mx-auto px-4 pt-6 pb-32">
        {/* Products Grid - Optimized for Mobile */}
        <section className="animate-fade-in">
          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6">
              {Array.from({ length: 8 }).map((_, index) => (
                <SkeletonCard key={index} />
              ))}
            </div>
          ) : products.length > 0 ? (
            <motion.div
              layout
              className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4 md:gap-6"
            >
              {products.map((product, index) => (
                <motion.div
                  key={product.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <ProductCard {...product} isOwned={owned.has(product.id)} tag={product.tag} />
                </motion.div>
              ))}
            </motion.div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mb-4">
                <Search className="w-8 h-8 text-gray-500" />
              </div>
              <h3 className="text-lg font-bold mb-2 text-white">No treasures found</h3>
              <p className="text-sm text-gray-400 mb-6">Try adjusting your filters</p>
              <Button
                variant="outline"
                onClick={() => {
                  setFilterPrice("all");
                  setFilterRating("all");
                }}
                className="rounded-full px-6 border-white/10 hover:bg-white/5"
              >
                Reset Filters
              </Button>
            </div>
          )}
        </section>
      </main>


    </div>
  );
};

export default AllProducts;
