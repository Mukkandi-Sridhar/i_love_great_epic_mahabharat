import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { collection, getDocs, orderBy, query, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { ArrowLeft, MessageSquare, CheckCircle, Clock, Send, Instagram, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

interface Ticket {
    id: string;
    uid?: string;
    name: string;
    email: string;
    insta?: string;
    issue: string;
    status: "open" | "resolved";
    adminReply?: string;
    createdAt?: any;
}

const AdminTickets = () => {
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [loading, setLoading] = useState(true);
    const [resolving, setResolving] = useState<string | null>(null);
    const [replyText, setReplyText] = useState<Record<string, string>>({});
    const { toast } = useToast();

    const loadTickets = async () => {
        setLoading(true);
        try {
            const snap = await getDocs(query(collection(db, "tickets"), orderBy("createdAt", "desc")));
            setTickets(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Ticket)));
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadTickets(); }, []);

    const sendReplyAndResolve = async (ticket: Ticket) => {
        const reply = replyText[ticket.id];
        if (!reply && ticket.status === "open") {
            toast({ title: "Reply Required", description: "Please enter a response before resolving.", variant: "destructive" });
            return;
        }

        setResolving(ticket.id);
        try {
            const res = await fetch(`http://localhost:8000/admin/tickets/${ticket.id}/reply`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reply })
            });

            if (res.ok) {
                toast({ title: "Ticket Resolved", description: "Reply sent and ticket marked as resolved." });
                loadTickets();
            } else {
                toast({ title: "Operation Failed", variant: "destructive" });
            }
        } catch (e) {
            console.error(e);
        } finally {
            setResolving(null);
        }
    };

    return (
        <div className="min-h-screen bg-background p-6 text-white">
            <div className="max-w-5xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <Link to="/admin" className="p-2 hover:bg-white/10 rounded-lg transition-all"><ArrowLeft className="w-5 h-5 text-white" /></Link>
                    <h1 className="text-2xl font-bold flex-1">Support Tickets</h1>
                    <div className="flex bg-white/5 rounded-full px-3 py-1 gap-4 text-xs font-semibold">
                        <span className="text-yellow-400 flex items-center gap-1"><Clock className="w-3 h-3" /> {tickets.filter(t => t.status === "open").length} OPEN</span>
                        <span className="text-green-400 flex items-center gap-1"><CheckCircle className="w-3 h-3" /> {tickets.filter(t => t.status === "resolved").length} RESOLVED</span>
                    </div>
                </div>

                {loading ? <div className="flex justify-center py-20"><div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" /></div> : (
                    <div className="grid gap-6">
                        {tickets.length === 0 && <p className="text-center text-gray-500 py-20 italic">No support tickets found.</p>}
                        {tickets.map((t) => (
                            <div key={t.id} className={`flex flex-col rounded-2xl border transition-all overflow-hidden ${t.status === "open" ? "bg-white/5 border-yellow-500/20 shadow-lg shadow-yellow-500/5" : "bg-white/[0.02] border-white/5 opacity-80"}`}>
                                <div className="p-5 flex flex-col md:flex-row gap-6">
                                    <div className="flex-1 space-y-4">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="space-y-1">
                                                <h3 className="text-lg font-bold">{t.name || "Anonymous User"}</h3>
                                                <div className="flex flex-wrap items-center gap-3 text-xs text-gray-400">
                                                    <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {t.email}</span>
                                                    {t.insta && <span className="flex items-center gap-1 text-primary"><Instagram className="w-3 h-3" /> @{t.insta}</span>}
                                                    <span>·</span>
                                                    <span>{t.createdAt?.toDate?.().toLocaleString() || "some time ago"}</span>
                                                </div>
                                            </div>
                                            <span className={`shrink-0 px-2 py-1 rounded text-[10px] font-bold uppercase tracking-widest ${t.status === "open" ? "bg-yellow-500/10 text-yellow-400 ring-1 ring-yellow-500/20" : "bg-green-500/10 text-green-400 ring-1 ring-green-500/20"}`}>
                                                {t.status}
                                            </span>
                                        </div>

                                        <div className="bg-black/20 p-4 rounded-xl border border-white/5">
                                            <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">{t.issue}</p>
                                        </div>

                                        {t.adminReply && (
                                            <div className="flex gap-3 pt-2">
                                                <div className="w-1 bg-green-500/30 rounded-full shrink-0" />
                                                <div className="space-y-1">
                                                    <p className="text-[10px] font-bold text-green-400 uppercase tracking-widest">Admin Reply</p>
                                                    <p className="text-sm text-gray-400 italic">{t.adminReply}</p>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {t.status === "open" && (
                                        <div className="w-full md:w-80 flex flex-col gap-3">
                                            <div className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1 flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Write Response</div>
                                            <Textarea
                                                placeholder="Enter your reply to the user..."
                                                value={replyText[t.id] || ""}
                                                onChange={(e) => setReplyText({ ...replyText, [t.id]: e.target.value })}
                                                className="bg-black/40 border-white/10 text-sm min-h-[120px] focus:border-primary/50"
                                            />
                                            <Button
                                                onClick={() => sendReplyAndResolve(t)}
                                                disabled={resolving === t.id}
                                                className="w-full gap-2 bg-green-600 hover:bg-green-700 h-10"
                                            >
                                                {resolving === t.id ? (
                                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <><Send className="w-4 h-4" /> Reply & Resolve</>
                                                )}
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default AdminTickets;
