import { useState } from "react";
import { collection, query, where, getDocs, doc, setDoc, deleteDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Key, Search, ShieldCheck, ShieldAlert, Package, Trash2 } from "lucide-react";

interface UserProfile {
    uid: string;
    email: string;
    name: string;
}

interface Purchase {
    productId: string;
    title: string;
    type: string;
}

const AdminAccess = () => {
    const [email, setEmail] = useState("");
    const [targetUser, setTargetUser] = useState<UserProfile | null>(null);
    const [userPurchases, setUserPurchases] = useState<Purchase[]>([]);
    const [loading, setLoading] = useState(false);
    const { toast } = useToast();

    const searchUser = async () => {
        if (!email) return;
        setLoading(true);
        try {
            const q = query(collection(db, "users"), where("email", "==", email.toLowerCase()));
            const snap = await getDocs(q);
            if (snap.empty) {
                toast({ title: "User not found", variant: "destructive" });
                setTargetUser(null);
            } else {
                const userData = { uid: snap.docs[0].id, ...snap.docs[0].data() } as UserProfile;
                setTargetUser(userData);
                loadPurchases(userData.uid);
            }
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    const loadPurchases = async (uid: string) => {
        const snap = await getDocs(collection(db, "users", uid, "purchases"));
        setUserPurchases(snap.docs.map(d => d.data() as Purchase));
    };

    const grantAccess = async (productId: string, type: string, title: string) => {
        if (!targetUser) return;
        try {
            const res = await fetch("http://localhost:8000/admin/grant-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    uid: targetUser.uid,
                    email: targetUser.email,
                    product_id: productId,
                    product_type: type,
                    title: title,
                    price: 0
                })
            });
            if (res.ok) {
                toast({ title: "Access Granted" });
                loadPurchases(targetUser.uid);
            }
        } catch (e) { console.error(e); }
    };

    const revokeAccess = async (productId: string) => {
        if (!targetUser) return;
        if (!confirm("Revoke access to this product?")) return;
        try {
            const res = await fetch("http://localhost:8000/admin/revoke-access", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ uid: targetUser.uid, product_id: productId })
            });
            if (res.ok) {
                toast({ title: "Access Revoked" });
                loadPurchases(targetUser.uid);
            }
        } catch (e) { console.error(e); }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto text-white">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Key className="w-6 h-6" /> Access Control
            </h1>

            <div className="flex gap-4 mb-8">
                <Input
                    placeholder="Search user by email..."
                    value={email}
                    onChange={e => setEmail(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && searchUser()}
                    className="bg-white/5 border-white/10"
                />
                <Button onClick={searchUser} disabled={loading} className="gap-2">
                    <Search className="w-4 h-4" /> Search
                </Button>
            </div>

            {targetUser && (
                <div className="space-y-6 animate-fade-in">
                    <Card className="bg-white/5 border-white/10 text-white">
                        <CardHeader>
                            <CardTitle className="text-lg flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-green-400" /> User Profile: {targetUser.name}
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-gray-400">UID: {targetUser.uid}</p>
                            <p className="text-gray-400">Email: {targetUser.email}</p>
                        </CardContent>
                    </Card>

                    <div className="grid md:grid-cols-2 gap-6">
                        <Card className="bg-white/5 border-white/10 text-white">
                            <CardHeader><CardTitle className="text-md">Current Access</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                {userPurchases.length === 0 && <p className="text-sm text-gray-500 italic">No products owned</p>}
                                {userPurchases.map(p => (
                                    <div key={p.productId} className="flex items-center justify-between p-2 bg-black/20 rounded-md">
                                        <span className="text-sm">{p.title}</span>
                                        <Button variant="ghost" size="sm" onClick={() => revokeAccess(p.productId)} className="text-red-400 hover:text-red-300 p-0">
                                            <Trash2 className="w-4 h-4" />
                                        </Button>
                                    </div>
                                ))}
                            </CardContent>
                        </Card>

                        <Card className="bg-white/5 border-white/10 text-white">
                            <CardHeader><CardTitle className="text-md">Quick Grant</CardTitle></CardHeader>
                            <CardContent className="space-y-2">
                                <Button onClick={() => grantAccess("ebook-1", "ebook", "Full Mahabharat Ebook")} variant="outline" className="w-full justify-start gap-2 border-white/10 bg-white/5">
                                    <Package className="w-4 h-4" /> Grant Mahabharat Ebook
                                </Button>
                                <Button onClick={() => grantAccess("sdcard-1", "sdcard", "128GB SD Card Contents")} variant="outline" className="w-full justify-start gap-2 border-white/10 bg-white/5">
                                    <Package className="w-4 h-4" /> Grant SD Card Access
                                </Button>
                            </CardContent>
                        </Card>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminAccess;
