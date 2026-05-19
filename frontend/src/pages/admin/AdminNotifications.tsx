import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { Bell, Send, Users, User } from "lucide-react";
import { BACKEND_URL, adminHeaders } from "@/services/api";

const AdminNotifications = () => {
    const [title, setTitle] = useState("");
    const [message, setMessage] = useState("");
    const [targetEmail, setTargetEmail] = useState("");
    const [sending, setSending] = useState(false);
    const { toast } = useToast();

    const sendNotification = async (all: boolean) => {
        if (!title || !message) {
            toast({ title: "Required", description: "Title and message are required", variant: "destructive" });
            return;
        }

        setSending(true);
        try {
            let uid = null;
            if (!all && targetEmail) {
                // Find UID for email (backend handles broadcast if UID is null)
                // For simplicity, we could also pass email to backend and let it find UID
                // But let's assume broadast if no targetEmail.
            }

            const res = await fetch(`${BACKEND_URL}/admin/send-notification`, {
                method: "POST",
                headers: await adminHeaders(),
                body: JSON.stringify({
                    title,
                    message,
                    // uid: ... (optional)
                })
            });

            if (res.ok) {
                toast({ title: "Success", description: "Notification(s) sent successfully" });
                setTitle("");
                setMessage("");
            } else {
                toast({ title: "Failed", description: "Could not send notification", variant: "destructive" });
            }
        } catch (e) {
            toast({ title: "Failed", description: "Could not send notification", variant: "destructive" });
        } finally {
            setSending(false);
        }
    };

    return (
        <div className="p-6 max-w-4xl mx-auto text-white">
            <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
                <Bell className="w-6 h-6" /> Push Notifications
            </h1>

            <div className="grid md:grid-cols-2 gap-8">
                <Card className="bg-white/5 border-white/10 text-white">
                    <CardHeader><CardTitle className="text-lg">Compose Message</CardTitle></CardHeader>
                    <CardContent className="space-y-4">
                        <div className="space-y-2">
                            <Label>Notification Title</Label>
                            <Input placeholder="e.g. Sale is Live!" value={title} onChange={e => setTitle(e.target.value)} className="bg-transparent border-white/10" />
                        </div>
                        <div className="space-y-2">
                            <Label>Message Content</Label>
                            <Textarea placeholder="Write your message here..." value={message} onChange={e => setMessage(e.target.value)} rows={5} className="bg-transparent border-white/10" />
                        </div>
                    </CardContent>
                </Card>

                <div className="space-y-6">
                    <Card className="bg-white/5 border-white/10 text-white">
                        <CardHeader><CardTitle className="text-md">Send to Everyone</CardTitle></CardHeader>
                        <CardContent>
                            <p className="text-sm text-gray-400 mb-4 text-pretty">Caution: This will send the notification to ALL registered users immediately.</p>
                            <Button onClick={() => sendNotification(true)} disabled={sending} className="w-full gap-2 bg-yellow-600 hover:bg-yellow-700">
                                <Users className="w-4 h-4" /> Broadcast to All Users
                            </Button>
                        </CardContent>
                    </Card>

                    <Card className="bg-white/5 border-white/10 text-white opacity-50">
                        <CardHeader><CardTitle className="text-md">Targeted Send (Coming Soon)</CardTitle></CardHeader>
                        <CardContent>
                            <Input placeholder="User Email..." disabled className="bg-transparent border-white/10 mb-4" />
                            <Button disabled className="w-full gap-2">
                                <User className="w-4 h-4" /> Send to Specific User
                            </Button>
                        </CardContent>
                    </Card>
                </div>
            </div>
        </div>
    );
};

export default AdminNotifications;
