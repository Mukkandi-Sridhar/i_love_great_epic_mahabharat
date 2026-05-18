import { useEffect, useMemo, useState } from "react";
import { Play, Package, Download, ShoppingBag, Book, Sparkles, Calendar } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";
import { useFirebase } from "@/contexts/FirebaseContext";
import { subscribeToPurchases } from "@/services/db";
import { allProducts } from "@/data/products";
import { SkeletonCard } from "@/components/SkeletonCard";

type PurchaseItem = {
  id: string;
  productId: string;
  type: "ebook" | "sdcard" | "pendrive";
  title?: string | null;
  price?: number | null;
  imageUrl?: string | null;
  createdAt?: any;
};

const Collection = () => {
  const navigate = useNavigate();
  const { user } = useFirebase();
  const [activeFilter, setActiveFilter] = useState<"all" | "ebook" | "pendrive">("all");
  const [purchases, setPurchases] = useState<PurchaseItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setPurchases([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    // Subscribe to purchases in real-time
    const unsubscribe = subscribeToPurchases(user.uid, (items) => {
      // Enrich items with product details
      const enrichedItems = items.map((item: any) => {
        const product = allProducts.find(p => p.id === item.productId);
        return {
          ...item,
          title: item.title || product?.title || item.productId,
          imageUrl: item.imageUrl || product?.image,
          type: item.type || product?.type || "ebook"
        };
      });

      setPurchases(enrichedItems as PurchaseItem[]);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredPurchases = useMemo(
    () =>
      purchases.filter((item) =>
        activeFilter === "all" || item.type === activeFilter
      ),
    [purchases, activeFilter]
  );

  const stats = {
    total: purchases.length,
    ebooks: purchases.filter((p) => p.type === "ebook").length,
    pendrives: purchases.filter((p) => p.type === "pendrive").length,
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-background border-b border-border">
        <div className="px-4 md:px-6 h-16 flex items-center justify-between max-w-7xl mx-auto">
          <h1 className="text-xl md:text-2xl font-serif font-bold text-foreground">My Collection</h1>
          <div className="flex items-center gap-2">
            <span className="text-xs bg-foreground text-background px-3 py-1.5 rounded-full font-semibold">
              {stats.total} Total
            </span>
            {stats.ebooks > 0 && (
              <span className="text-xs bg-primary/10 text-primary border border-primary/20 px-3 py-1.5 rounded-full font-semibold">
                {stats.ebooks} Ebooks
              </span>
            )}
            {stats.pendrives > 0 && (
              <span className="text-xs bg-white/5 text-gray-400 border border-white/10 px-3 py-1.5 rounded-full font-semibold">
                {stats.pendrives} Pendrives
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="px-4 md:px-6 pt-6 max-w-7xl mx-auto">
        {loading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 animate-fade-in">
            {Array.from({ length: 4 }).map((_, index) => (
              <SkeletonCard key={index} />
            ))}
          </div>
        ) : purchases.length > 0 ? (
          <div className="space-y-6 animate-fade-in">
            {/* Filters */}
            <div className="flex gap-2 mb-4">
              <Button
                variant={activeFilter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("all")}
              >
                All ({stats.total})
              </Button>
              <Button
                variant={activeFilter === "ebook" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("ebook")}
              >
                Ebooks ({stats.ebooks})
              </Button>
              <Button
                variant={activeFilter === "pendrive" ? "default" : "outline"}
                size="sm"
                onClick={() => setActiveFilter("pendrive")}
              >
                Pendrives ({stats.pendrives})
              </Button>
            </div>

            {/* List */}
            <div className="space-y-4">
              {filteredPurchases.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 bg-card border border-border rounded-xl p-4 shadow-sm"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      {item.type === "ebook" ? (
                        <Download className="w-5 h-5 text-primary" />
                      ) : (
                        <Package className="w-5 h-5 text-primary" />
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-semibold">
                        {item.title || item.productId}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                        <span className="inline-flex items-center gap-1">
                          <ShoppingBag className="w-3 h-3" />
                          {item.type === "ebook" ? "Digital Ebook" : "Pendrive"}
                        </span>
                        {item.createdAt && (
                          <span className="inline-flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(item.createdAt.toDate?.() ?? item.createdAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <Button
                    size="sm"
                    className="gap-1"
                    onClick={() => navigate(`/product/${item.productId}`)}
                  >
                    <Play className="w-4 h-4" />
                    View
                  </Button>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-20 md:py-32 animate-fade-in px-4">
            <div className="w-32 h-32 md:w-40 md:h-40 bg-muted rounded-full flex items-center justify-center mb-6 md:mb-8">
              <Book className="w-16 h-16 md:w-20 md:h-20 text-muted-foreground" />
            </div>
            <h3 className="text-2xl md:text-3xl font-serif font-bold mb-3 md:mb-4 text-foreground text-center">
              No purchases yet. Explore our collection &rarr;
            </h3>
            <p className="text-sm md:text-base text-muted-foreground text-center max-w-md mb-8 md:mb-10 leading-relaxed">
              Start your spiritual journey by exploring our authentic Mahabharat collection
            </p>
            <Button
              size="lg"
              className="gap-2 h-12 md:h-14 px-8 md:px-10 font-semibold text-sm md:text-base transition-all"
              onClick={() => navigate("/explore")}
            >
              <Sparkles className="w-4 h-4 md:w-5 md:h-5" />
              Explore Collection
            </Button>
          </div>
        )}
      </main>


    </div>
  );
};

export default Collection;
