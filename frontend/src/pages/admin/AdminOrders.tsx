import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, ChevronDown, ChevronUp, Save, Truck, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { BACKEND_URL, adminHeaders } from "@/services/api";
import { SkeletonCard } from "@/components/SkeletonCard";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Order {
    id: string;
    uid: string;
    userName: string;
    email: string;
    phone: string;
    productTitle: string;
    productType: string;
    amount: number;
    status: string;
    trackingNumber?: string;
    adminNote?: string;
    razorpayPaymentId?: string;
    shipping?: Record<string, string>;
    createdAt?: any;
}

const statusColor: Record<string, string> = {
    paid: "bg-green-500/20 text-green-400",
    pending: "bg-yellow-500/20 text-yellow-400",
    processing: "bg-orange-500/20 text-orange-400",
    shipped: "bg-blue-500/20 text-blue-400",
    delivered: "bg-purple-500/20 text-purple-400",
};

const AdminOrders = () => {
    const [orders, setOrders] = useState<Order[]>([]);
    const [filtered, setFiltered] = useState<Order[]>([]);
    const [search, setSearch] = useState("");
    const [statusFilter, setStatusFilter] = useState("all");
    const [expanded, setExpanded] = useState<string | null>(null);
    const [loading, setLoading] = useState(true);
    const { toast } = useToast();
    usePageTitle("Admin Orders");

    const loadOrders = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, "orders_index"), orderBy("createdAt", "desc")));
            const data: Order[] = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order));
            setOrders(data);
            setFiltered(data);
        } catch (e) {
            toast({ title: "Failed to load orders", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadOrders(); }, []);

    useEffect(() => {
        let result = orders;
        if (statusFilter !== "all") result = result.filter((o) => o.status === statusFilter);
        if (search) result = result.filter((o) =>
            o.email?.toLowerCase().includes(search.toLowerCase()) ||
            o.userName?.toLowerCase().includes(search.toLowerCase()) ||
            o.id.includes(search)
        );
        setFiltered(result);
    }, [search, statusFilter, orders]);

    const updateOrder = async (orderId: string, status: string, tracking: string, note: string) => {
        try {
            const res = await fetch(`${BACKEND_URL}/admin/orders/${orderId}`, {
                method: "PATCH",
                headers: await adminHeaders(),
                body: JSON.stringify({ status, tracking_number: tracking, admin_note: note })
            });

            if (res.ok) {
                toast({ title: "Order Updated", description: `Order ${orderId} is now ${status}` });
                loadOrders();
            } else {
                toast({ title: "Update Failed", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Update Failed", variant: "destructive" });
        }
    };

    const exportCSV = () => {
        const rows = [["Date", "OrderID", "Name", "Email", "Phone", "Product", "Amount", "Status", "Tracking"]];
        filtered.forEach((o) => rows.push([
            o.createdAt?.toDate?.()?.toLocaleDateString() || "",
            o.id, o.userName, o.email, o.phone, o.productTitle,
            `₹${o.amount}`, o.status, o.trackingNumber || ""
        ]));
        const csv = rows.map((r) => r.join(",")).join("\n");
        const a = document.createElement("a"); a.href = "data:text/csv," + encodeURIComponent(csv);
        a.download = "orders.csv"; a.click();
    };

    return (
        <div className="min-h-screen bg-background p-6 text-white">
            <div className="max-w-6xl mx-auto">
                <div className="flex items-center gap-4 mb-6">
                    <Link to="/admin" className="p-2 hover:bg-white/10 rounded-lg transition-all"><ArrowLeft className="w-5 h-5 text-white" /></Link>
                    <h1 className="text-2xl font-bold flex-1 text-pretty">Order Management</h1>
                    <button onClick={exportCSV} className="px-4 py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm transition-all">Export CSV</button>
                </div>

                <div className="flex gap-3 mb-6">
                    <input value={search} onChange={(e) => setSearch(e.target.value)}
                        placeholder="Search by email, name, or order ID..."
                        className="flex-1 bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm text-white placeholder:text-gray-500 focus:outline-none focus:border-primary/50"
                    />
                    <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}
                        className="bg-white/5 border border-white/10 rounded-xl px-4 py-2 text-sm text-white focus:outline-none">
                        <option value="all">All Status</option>
                        <option value="paid">Paid</option>
                        <option value="processing">Processing</option>
                        <option value="shipped">Shipped</option>
                        <option value="delivered">Delivered</option>
                    </select>
                </div>

                {loading ? <div className="grid md:grid-cols-3 gap-4">{Array.from({ length: 3 }).map((_, index) => <SkeletonCard key={index} />)}</div> : (
                    <div className="space-y-4">
                        {filtered.length === 0 && <p className="text-center text-gray-400 py-10">No orders yet. Start your spiritual journey →</p>}
                        {filtered.map((o) => (
                            <div key={o.id} className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden transition-all">
                                <div className="flex flex-wrap items-center gap-4 p-4 cursor-pointer hover:bg-white/8" onClick={() => setExpanded(expanded === o.id ? null : o.id)}>
                                    <div className="flex-1 min-w-[200px]">
                                        <div className="flex items-center gap-2 mb-1">
                                            <span className="font-bold text-white text-sm">{o.userName || "Guest"}</span>
                                            <span className="text-gray-500 text-xs truncate max-w-[150px]">{o.email}</span>
                                        </div>
                                        <div className="flex items-center gap-3 text-xs text-gray-400">
                                            <span className="text-white font-semibold">₹{o.amount}</span>
                                            <span>·</span>
                                            <span className="truncate max-w-[200px]">{o.productTitle}</span>
                                            <span>·</span>
                                            <span className="text-[10px] font-mono opacity-50">{o.id.slice(0, 8)}</span>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${statusColor[o.status] || "bg-white/10 text-gray-400"}`}>{o.status}</span>
                                        {expanded === o.id ? <ChevronUp className="w-5 h-5 text-gray-500" /> : <ChevronDown className="w-5 h-5 text-gray-500" />}
                                    </div>
                                </div>

                                {expanded === o.id && (
                                    <div className="border-t border-white/5 p-6 bg-white/[0.02] space-y-6">
                                        <div className="grid md:grid-cols-2 gap-8">
                                            {/* Shipping Details */}
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold uppercase text-gray-500 flex items-center gap-2 tracking-widest"><Truck className="w-3 h-3" /> Shipping Address</h4>
                                                {o.shipping && Object.keys(o.shipping).length > 0 ? (
                                                    <div className="text-sm space-y-1 text-gray-300">
                                                        {Object.entries(o.shipping).map(([k, v]) => v && (
                                                            <div key={k} className="flex gap-2">
                                                                <span className="text-gray-500 w-20 flex-shrink-0 capitalize">{k}:</span>
                                                                <span>{v}</span>
                                                            </div>
                                                        ))}
                                                        <div className="flex gap-2 text-primary mt-2">
                                                            <span className="text-gray-500 w-20 flex-shrink-0">Phone:</span>
                                                            <a href={`tel:${o.phone}`} className="underline">{o.phone}</a>
                                                        </div>
                                                    </div>
                                                ) : (
                                                    <p className="text-sm text-gray-500 italic">No shipping info (Digital product)</p>
                                                )}
                                            </div>

                                            {/* Admin Controls */}
                                            <div className="space-y-4">
                                                <h4 className="text-xs font-bold uppercase text-gray-500 tracking-widest">Update Order</h4>
                                                <div className="space-y-3">
                                                    <div>
                                                        <label className="text-[10px] text-gray-400 block mb-1">Set Status</label>
                                                        <select
                                                            defaultValue={o.status}
                                                            id={`status-${o.id}`}
                                                            className="w-full bg-black/40 border-white/10 border rounded-lg h-9 px-3 text-sm"
                                                        >
                                                            <option value="paid">Paid</option>
                                                            <option value="processing">Processing</option>
                                                            <option value="shipped">Shipped</option>
                                                            <option value="delivered">Delivered</option>
                                                        </select>
                                                    </div>
                                                    <div>
                                                        <label className="text-[10px] text-gray-400 block mb-1">Tracking Number</label>
                                                        <input
                                                            id={`tracking-${o.id}`}
                                                            defaultValue={o.trackingNumber}
                                                            placeholder="e.g. DTDC123456"
                                                            className="w-full bg-black/40 border-white/10 border rounded-lg h-9 px-3 text-sm text-white"
                                                        />
                                                    </div>
                                                    <Button
                                                        className="w-full gap-2"
                                                        size="sm"
                                                        onClick={() => {
                                                            const status = (document.getElementById(`status-${o.id}`) as HTMLSelectElement).value;
                                                            const tracking = (document.getElementById(`tracking-${o.id}`) as HTMLInputElement).value;
                                                            updateOrder(o.id, status, tracking, "");
                                                        }}
                                                    >
                                                        <Save className="w-4 h-4" /> Save Changes
                                                    </Button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminOrders;
