import { useState, useEffect } from "react";
import { collection, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Ticket, Plus, Trash2, Check, X } from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonCard";

interface Coupon {
    id: string;
    code: string;
    type: "percent" | "fixed";
    value: number;
    enabled: boolean;
    usedCount: number;
    maxUses?: number;
}

const AdminCoupons = () => {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [loading, setLoading] = useState(true);
    const [newCoupon, setNewCoupon] = useState({ code: "", type: "percent" as "percent" | "fixed", value: 0 });
    const { toast } = useToast();

    const loadCoupons = async () => {
        try {
            const snap = await getDocs(collection(db, "coupons"));
            setCoupons(snap.docs.map(d => ({ id: d.id, ...d.data() } as Coupon)));
        } catch (e) {
            toast({ title: "Error", description: "Failed to load coupons", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadCoupons(); }, []);

    const createCoupon = async () => {
        if (!newCoupon.code) return;
        try {
            const code = newCoupon.code.toUpperCase();
            await setDoc(doc(db, "coupons", code), {
                ...newCoupon,
                code,
                enabled: true,
                usedCount: 0,
                createdAt: serverTimestamp()
            });
            toast({ title: "Coupon Created", description: code });
            setNewCoupon({ code: "", type: "percent", value: 0 });
            loadCoupons();
        } catch (e) {
            toast({ title: "Error", description: "Failed to create", variant: "destructive" });
        }
    };

    const toggleCoupon = async (coupon: Coupon) => {
        try {
            await setDoc(doc(db, "coupons", coupon.id), { enabled: !coupon.enabled }, { merge: true });
            loadCoupons();
        } catch (e) { toast({ title: "Error", description: "Failed to update coupon", variant: "destructive" }); }
    };

    const deleteCoupon = async (id: string) => {
        if (!confirm("Delete this coupon?")) return;
        try {
            await deleteDoc(doc(db, "coupons", id));
            loadCoupons();
        } catch (e) { toast({ title: "Error", description: "Failed to delete coupon", variant: "destructive" }); }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto text-white">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Ticket className="w-6 h-6" /> Coupon Management
            </h1>

            <Card className="bg-white/5 border-white/10 text-white mb-8">
                <CardHeader><CardTitle className="text-lg">Create New Coupon</CardTitle></CardHeader>
                <CardContent className="flex flex-wrap gap-4 items-end">
                    <div className="flex-1 min-w-[200px]">
                        <p className="text-xs text-gray-400 mb-1">CODE (e.g. DHARMA20)</p>
                        <Input value={newCoupon.code} onChange={e => setNewCoupon({ ...newCoupon, code: e.target.value })} className="bg-transparent border-white/10" />
                    </div>
                    <div className="w-32">
                        <p className="text-xs text-gray-400 mb-1">Type</p>
                        <select
                            value={newCoupon.type}
                            onChange={e => setNewCoupon({ ...newCoupon, type: e.target.value as "percent" | "fixed" })}
                            className="w-full bg-black/40 border-white/10 border rounded-md h-10 px-3"
                        >
                            <option value="percent">% Off</option>
                            <option value="fixed">₹ Off</option>
                        </select>
                    </div>
                    <div className="w-24">
                        <p className="text-xs text-gray-400 mb-1">Value</p>
                        <Input type="number" value={newCoupon.value} onChange={e => setNewCoupon({ ...newCoupon, value: Number(e.target.value) })} className="bg-transparent border-white/10" />
                    </div>
                    <Button onClick={createCoupon} className="gap-2"><Plus className="w-4 h-4" /> Create</Button>
                </CardContent>
            </Card>

            <div className="grid gap-4">
                {loading ? Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />) : coupons.map(c => (
                    <div key={c.id} className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
                        <div>
                            <span className="text-lg font-mono font-bold text-yellow-400 mr-4">{c.code}</span>
                            <span className="text-sm text-gray-400">{c.value}{c.type === "percent" ? "%" : "₹"} OFF • {c.usedCount} uses</span>
                        </div>
                        <div className="flex gap-2">
                            <Button variant="ghost" size="sm" onClick={() => toggleCoupon(c)} className={c.enabled ? "text-green-400" : "text-red-400"}>
                                {c.enabled ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteCoupon(c.id)} className="text-red-400 hover:text-red-300">
                                <Trash2 className="w-4 h-4" />
                            </Button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AdminCoupons;
