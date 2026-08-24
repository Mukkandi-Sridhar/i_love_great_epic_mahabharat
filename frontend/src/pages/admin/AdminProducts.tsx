import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Package, Save, RefreshCw, Sparkles, Loader2 } from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonCard";
import { usePageTitle } from "@/hooks/usePageTitle";
import { refreshProductIndex } from "@/services/api";

interface Product {
    id: string;
    title: string;
    price: number;
    enabled: boolean;
    type: string;
    stockCount?: number;
    isPhysical?: boolean;
}

const AdminProducts = () => {
    const [products, setProducts] = useState<Product[]>([]);
    const [loading, setLoading] = useState(true);
    const [reindexing, setReindexing] = useState(false);
    const { toast } = useToast();
    usePageTitle("Admin Products");

    const loadProducts = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(collection(db, "products"));
            const items = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
            setProducts(items);
        } catch (error) {
            toast({ title: "Error", description: "Failed to load products", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadProducts(); }, []);

    const updateProduct = async (id: string, updates: Partial<Product>) => {
        try {
            await updateDoc(doc(db, "products", id), {
                ...updates,
                updatedAt: serverTimestamp()
            });
            loadProducts();

            // Keep the assistant's product search in step with the catalog.
            // The save already succeeded, so a failure here is a warning.
            const reindexed = await refreshProductIndex();
            toast(
                reindexed
                    ? { title: "Success", description: "Product updated and AI search reindexed." }
                    : {
                        title: "Product updated",
                        description: "Saved, but the AI search index did not refresh. Retry from the header.",
                    }
            );
        } catch (error) {
            toast({ title: "Error", description: "Update failed", variant: "destructive" });
        }
    };

    const handleManualReindex = async () => {
        setReindexing(true);
        const ok = await refreshProductIndex();
        setReindexing(false);
        toast(
            ok
                ? { title: "AI search reindexed", description: "The assistant now sees the current catalog." }
                : { title: "Reindex failed", description: "Could not refresh the AI index.", variant: "destructive" }
        );
    };

    return (
        <div className="p-6 max-w-6xl mx-auto text-white">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="w-6 h-6" /> Product Management
                </h1>
                <div className="flex items-center gap-2">
                    <Button
                        onClick={handleManualReindex}
                        variant="outline"
                        size="sm"
                        disabled={reindexing}
                        className="gap-2"
                        title="Rebuild the assistant's product search index from the catalog"
                    >
                        {reindexing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                        <span className="hidden sm:inline">{reindexing ? "Reindexing..." : "Reindex AI"}</span>
                    </Button>
                    <Button onClick={loadProducts} variant="outline" size="sm" className="gap-2">
                        <RefreshCw className="w-4 h-4" /> Refresh
                    </Button>
                </div>
            </div>

            <div className="grid gap-4">
                {loading ? Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />) : products.map(p => (
                    <Card key={p.id} className="bg-white/5 border-white/10 text-white overflow-hidden">
                        <CardContent className="pt-6">
                            <div className="flex flex-wrap items-center justify-between gap-6">
                                <div className="flex-1 min-w-[200px]">
                                    <p className="text-[10px] font-bold uppercase tracking-widest text-primary mb-1">
                                        {p.type} • {p.id}
                                    </p>
                                    <Input
                                        defaultValue={p.title}
                                        onBlur={(e) => updateProduct(p.id, { title: e.target.value })}
                                        className="bg-transparent border-white/10 text-lg font-serif font-bold"
                                    />
                                </div>

                                <div className="flex gap-4">
                                    <div className="w-24">
                                        <p className="text-[10px] uppercase font-bold text-gray-400 mb-1">Price (₹)</p>
                                        <Input
                                            type="number"
                                            defaultValue={p.price}
                                            onBlur={(e) => updateProduct(p.id, { price: Number(e.target.value) })}
                                            className="bg-transparent border-white/10"
                                        />
                                    </div>

                                    {/* Match the backend, which enforces stock by product type.
                                        Keying this off isPhysical alone hid the field for any
                                        physical product saved without that flag. */}
                                    {(p.isPhysical || p.type === "pendrive" || p.type === "sdcard") && (
                                        <div className="w-24">
                                            <p className="text-[10px] uppercase font-bold text-orange-400 mb-1">In Stock</p>
                                            <Input
                                                type="number"
                                                defaultValue={p.stockCount || 0}
                                                onBlur={(e) => updateProduct(p.id, { stockCount: Number(e.target.value) })}
                                                className="bg-transparent border-white/10 border-orange-400/30"
                                            />
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        onClick={() => updateProduct(p.id, { enabled: !p.enabled })}
                                        variant={p.enabled ? "default" : "secondary"}
                                        className="w-28 text-xs font-bold uppercase tracking-wider"
                                    >
                                        {p.enabled ? "Active" : "Hidden"}
                                    </Button>
                                </div>
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

export default AdminProducts;
