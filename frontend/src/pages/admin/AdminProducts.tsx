import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Package, Save, RefreshCw } from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonCard";

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
    const { toast } = useToast();

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
            toast({ title: "Success", description: "Product updated" });
            loadProducts();
        } catch (error) {
            toast({ title: "Error", description: "Update failed", variant: "destructive" });
        }
    };

    return (
        <div className="p-6 max-w-6xl mx-auto text-white">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <Package className="w-6 h-6" /> Product Management
                </h1>
                <Button onClick={loadProducts} variant="outline" size="sm" className="gap-2">
                    <RefreshCw className="w-4 h-4" /> Refresh
                </Button>
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

                                    {p.isPhysical && (
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
