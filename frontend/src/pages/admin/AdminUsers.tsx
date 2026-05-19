import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, Ban, ShieldCheck, Mail, Calendar, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BACKEND_URL, adminHeaders } from "@/services/api";
import { SkeletonCard } from "@/components/SkeletonCard";

interface AdminUser {
    id: string;
    uid: string;
    name: string;
    email: string;
    photoURL?: string;
    createdAt?: any;
    lastLoginAt?: any;
    blocked?: boolean;
}

const AdminUsers = () => {
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState("");
    const { toast } = useToast();

    const loadUsers = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, "users"), orderBy("createdAt", "desc")));
            setUsers(snap.docs.map((d) => ({ id: d.id, ...d.data() } as AdminUser)));
        } catch (e) {
            toast({ title: "Failed to load users", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadUsers(); }, []);

    const toggleBlock = async (uid: string, currentBlocked: boolean) => {
        try {
            const res = await fetch(`${BACKEND_URL}/admin/users/${uid}/block?blocked=${!currentBlocked}`, {
                method: "PATCH",
                headers: await adminHeaders(),
            });
            if (res.ok) {
                toast({
                    title: !currentBlocked ? "User Blocked" : "User Unblocked",
                    variant: !currentBlocked ? "destructive" : "default"
                });
                loadUsers();
            }
        } catch (e) {
            toast({ title: "Update failed", variant: "destructive" });
        }
    };

    const filtered = users.filter((u) =>
        !search || u.name?.toLowerCase().includes(search.toLowerCase()) || u.email?.toLowerCase().includes(search.toLowerCase())
    );

    return (
        <div className="min-h-screen bg-background p-6 text-white">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <Link to="/admin" className="p-2 hover:bg-white/10 rounded-lg transition-all"><ArrowLeft className="w-5 h-5 text-white" /></Link>
                    <h1 className="text-2xl font-bold flex-1">User Management <span className="text-gray-500 font-normal text-lg">({users.length})</span></h1>
                </div>

                <div className="relative mb-6">
                    <Mail className="absolute left-4 top-3.5 w-4 h-4 text-gray-500" />
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search users by name or email..."
                        className="w-full bg-white/5 border border-white/10 rounded-2xl pl-11 pr-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50 transition-all"
                    />
                </div>

                {loading ? <div className="grid md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}</div> : (
                    <div className="grid gap-3">
                        {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No users found matching your search.</p>}
                        {filtered.map((u) => (
                            <div key={u.id} className={`flex items-center gap-4 p-4 rounded-2xl border transition-all ${u.blocked ? 'bg-red-500/5 border-red-500/20 opacity-75' : 'bg-white/5 border-white/10'}`}>
                                <div className="relative shrink-0">
                                    {u.photoURL ? (
                                        <img src={u.photoURL} alt={u.name} className="w-12 h-12 rounded-full object-cover ring-2 ring-white/10" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center ring-2 ring-white/10">
                                            <UserIcon className="w-6 h-6 text-primary" />
                                        </div>
                                    )}
                                    {u.blocked && <div className="absolute -top-1 -right-1 bg-red-500 p-1 rounded-full"><Ban className="w-3 h-3 text-white" /></div>}
                                </div>

                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <h3 className="font-bold text-sm truncate">{u.name || "Anonymous User"}</h3>
                                        {u.blocked && <span className="text-[10px] bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded font-bold uppercase tracking-tighter">Blocked</span>}
                                    </div>
                                    <div className="flex items-center gap-3 text-xs text-gray-500">
                                        <span className="truncate">{u.email}</span>
                                        <span className="opacity-30">·</span>
                                        <span className="flex items-center gap-1"><Calendar className="w-3 h-3" /> {u.createdAt?.toDate?.().toLocaleDateString() || "unknown"}</span>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => toggleBlock(u.uid, !!u.blocked)}
                                        className={`gap-2 h-9 px-3 ${u.blocked ? 'text-green-400 hover:text-green-300 hover:bg-green-400/10' : 'text-red-400 hover:text-red-300 hover:bg-red-400/10'}`}
                                    >
                                        {u.blocked ? (
                                            <><ShieldCheck className="w-4 h-4" /> Unblock</>
                                        ) : (
                                            <><Ban className="w-4 h-4" /> Block</>
                                        )}
                                    </Button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminUsers;
