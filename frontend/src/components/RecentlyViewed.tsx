import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { History, Sparkles } from "lucide-react";
import { allProducts, Product } from "@/data/products";
import { motion, AnimatePresence } from "framer-motion";

export const RecentlyViewed = () => {
    const [history, setHistory] = useState<Product[]>([]);

    useEffect(() => {
        const ids = JSON.parse(localStorage.getItem("sacred_history") || "[]");
        if (ids.length > 0) {
            // Get last 6 items for a compact view
            const products = ids
                .slice(0, 6)
                .map((id: string) => allProducts.find(p => p.id === id))
                .filter(Boolean) as Product[];
            setHistory(products);
        }
    }, []);

    if (history.length === 0) return null;

    return (
        <section className="py-8 px-4 border-t border-white/5 bg-black/20">
            <div className="container-width max-w-4xl mx-auto">
                <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-primary animate-pulse" />
                        <h2 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-400">Sacred History</h2>
                    </div>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 custom-scrollbar-hide -mx-4 px-4">
                    <AnimatePresence>
                        {history.map((product, index) => (
                            <motion.div
                                key={product.id}
                                initial={{ opacity: 0, scale: 0.9 }}
                                animate={{ opacity: 1, scale: 1 }}
                                transition={{ delay: index * 0.05 }}
                                className="w-[140px] md:w-[180px] group flex-shrink-0"
                            >
                                <Link to={`/product/${product.id}`} className="block text-center">
                                    <div className="relative mb-3 aspect-square rounded-2xl overflow-hidden border border-white/10 group-hover:border-primary/50 transition-all duration-500 bg-white/[0.02] p-2">
                                        <img
                                            src={product.image}
                                            alt={product.title}
                                            className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-700 opacity-80 group-hover:opacity-100"
                                        />
                                        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/60 to-transparent pointer-events-none" />
                                    </div>
                                    <h4 className="text-[12px] font-bold text-white group-hover:text-primary transition-colors truncate px-1 uppercase tracking-tight">
                                        {product.title}
                                    </h4>
                                    <p className="text-[11px] font-black text-primary mt-1 tracking-wider">₹{product.price}</p>
                                </Link>
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </div>
            </div>
        </section>
    );
};

export default RecentlyViewed;
