import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, query, orderBy, limit, Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Package, DollarSign, Ticket, Users, BookOpen, Key, Bell, Settings, ArrowRight } from "lucide-react";
import { SkeletonCard } from "@/components/SkeletonCard";
import { usePageTitle } from "@/hooks/usePageTitle";

interface Stats {
    totalOrders: number;
    totalRevenue: number;
    openTickets: number;
    totalUsers: number;
    totalBooks: number;
}

interface DailyRevenue {
    date: string;
    amount: number;
}

const AdminDashboard = () => {
    const [stats, setStats] = useState<Stats>({ totalOrders: 0, totalRevenue: 0, openTickets: 0, totalUsers: 0, totalBooks: 0 });
    const [dailyRevenue, setDailyRevenue] = useState<DailyRevenue[]>([]);
    const [loading, setLoading] = useState(true);
    usePageTitle("Admin Dashboard");

    useEffect(() => {
        const load = async () => {
            try {
                const [ordersSnap, ticketsSnap, usersSnap] = await Promise.all([
                    getDocs(collection(db, "orders_index")),
                    getDocs(collection(db, "tickets")),
                    getDocs(collection(db, "users")),
                ]);

                let revenue = 0;
                let books = 0;
                const daily: Record<string, number> = {};

                ordersSnap.forEach((d) => {
                    const data = d.data();
                    const amount = data.amount || 0;
                    revenue += amount;
                    if ((data.productType || "").toLowerCase() === "ebook") books++;

                    // Group by date for chart
                    if (data.createdAt) {
                        const date = (data.createdAt as Timestamp).toDate().toLocaleDateString();
                        daily[date] = (daily[date] || 0) + amount;
                    }
                });

                setStats({
                    totalOrders: ordersSnap.size,
                    totalRevenue: revenue,
                    openTickets: ticketsSnap.docs.filter(d => d.data().status === "open").length,
                    totalUsers: usersSnap.size,
                    totalBooks: books,
                });

                // Convert daily record to sorted array for chart
                const sortedDaily = Object.entries(daily)
                    .map(([date, amount]) => ({ date, amount }))
                    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
                    .slice(-7);
                setDailyRevenue(sortedDaily);

            } catch {
                setStats({ totalOrders: 0, totalRevenue: 0, openTickets: 0, totalUsers: 0, totalBooks: 0 });
            } finally {
                setLoading(false);
            }
        };
        load();
    }, []);

    const cards = [
        { label: "Total Orders", value: stats.totalOrders, icon: Package, color: "text-blue-400", link: "/admin/orders" },
        { label: "Total Revenue", value: `₹${stats.totalRevenue.toLocaleString()}`, icon: DollarSign, color: "text-green-400", link: "/admin/orders" },
        { label: "Books Sold", value: stats.totalBooks, icon: BookOpen, color: "text-orange-400", link: "/admin/orders" },
        { label: "Open Tickets", value: stats.openTickets, icon: Ticket, color: "text-yellow-400", link: "/admin/tickets" },
    ];

    const quickLinks = [
        { label: "Grant Access", icon: Key, color: "bg-purple-500", link: "/admin/access" },
        { label: "Coupons", icon: Ticket, color: "bg-pink-500", link: "/admin/coupons" },
        { label: "Notifications", icon: Bell, color: "bg-blue-500", link: "/admin/notifications" },
        { label: "Settings", icon: Settings, color: "bg-gray-500", link: "/admin/settings" },
    ];

    return (
        <div className="min-h-screen bg-background p-6 text-white">
            <div className="max-w-6xl mx-auto">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div>
                        <h1 className="text-3xl font-bold">Admin Dashboard</h1>
                        <p className="text-gray-400 mt-1">Overview of your store performance</p>
                    </div>
                    <div className="flex flex-wrap gap-3">
                        {["Products", "Orders", "Tickets", "Users"].map((label) => (
                            <Link
                                key={label}
                                to={`/admin/${label.toLowerCase()}`}
                                className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg text-sm transition-all"
                            >
                                {label}
                            </Link>
                        ))}
                    </div>
                </div>

                {loading ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        {Array.from({ length: 4 }).map((_, index) => (
                            <SkeletonCard key={index} />
                        ))}
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Stats Cards */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {cards.map(({ label, value, icon: Icon, color, link }) => (
                                <Link key={label} to={link} className="block bg-white/5 border border-white/10 rounded-2xl p-6 hover:bg-white/10 transition-all group">
                                    <div className={`mb-3 ${color}`}><Icon className="w-7 h-7" /></div>
                                    <div className="text-2xl font-bold mb-1">{value}</div>
                                    <div className="text-sm text-gray-400 group-hover:text-gray-300">{label}</div>
                                </Link>
                            ))}
                        </div>

                        <div className="grid md:grid-cols-3 gap-6">
                            {/* Revenue Visualization */}
                            <div className="md:col-span-2 bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-lg font-semibold mb-6 flex items-center gap-2">
                                    <DollarSign className="w-5 h-5 text-green-400" /> Revenue (Last 7 Days)
                                </h3>
                                <div className="h-48 flex items-end gap-2">
                                    {dailyRevenue.length > 0 ? dailyRevenue.map((d, i) => (
                                        <div key={i} className="flex-1 flex flex-col items-center group cursor-help">
                                            <div className="text-[10px] text-gray-500 mb-1 opacity-0 group-hover:opacity-100 transition-opacity">₹{d.amount}</div>
                                            <div
                                                className="w-full bg-green-500/30 group-hover:bg-green-500/50 rounded-t-sm transition-all"
                                                style={{ height: `${Math.max(10, (d.amount / (Math.max(...dailyRevenue.map(v => v.amount)) || 1)) * 100)}%` }}
                                            />
                                            <div className="text-[10px] text-gray-400 mt-2 truncate w-full text-center">{d.date.split('/')[0]}/{d.date.split('/')[1]}</div>
                                        </div>
                                    )) : (
                                        <div className="w-full h-full flex items-center justify-center text-gray-500 italic">No sales data yet</div>
                                    )}
                                </div>
                            </div>

                            {/* Quick Actions */}
                            <div className="bg-white/5 border border-white/10 rounded-2xl p-6">
                                <h3 className="text-lg font-semibold mb-6">Quick Actions</h3>
                                <div className="grid gap-3">
                                    {quickLinks.map((q) => (
                                        <Link
                                            key={q.label}
                                            to={q.link}
                                            className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-all group"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div className={`w-10 h-10 rounded-lg ${q.color} flex items-center justify-center`}>
                                                    <q.icon className="w-5 h-5 text-white" />
                                                </div>
                                                <span className="font-medium">{q.label}</span>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-gray-500 group-hover:translate-x-1 transition-transform" />
                                        </Link>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminDashboard;
