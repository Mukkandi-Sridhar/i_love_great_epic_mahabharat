import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import {
    Settings,
    Save,
    AlertTriangle,
    Phone,
    Globe,
    ArrowLeft,
    Loader2,
    Megaphone,
    Hammer,
    Instagram,
    MessageCircle
} from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

interface AppSettings {
    bannerText: string;
    bannerEnabled: boolean;
    maintenanceMode: boolean;
    contactWhatsapp: string;
    contactInstagram: string;
}

const AdminSettings = () => {
    const [settings, setSettings] = useState<AppSettings>({
        bannerText: "",
        bannerEnabled: false,
        maintenanceMode: false,
        contactWhatsapp: "",
        contactInstagram: ""
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const { toast } = useToast();
    usePageTitle("Admin Settings");

    const loadSettings = async () => {
        try {
            const snap = await getDoc(doc(db, "settings", "app"));
            if (snap.exists()) setSettings(snap.data() as AppSettings);
        } catch {
            toast({ title: "Settings unavailable", variant: "destructive" });
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { loadSettings(); }, []);

    const saveSettings = async () => {
        setSaving(true);
        try {
            await setDoc(doc(db, "settings", "app"), {
                ...settings,
                updatedAt: serverTimestamp()
            });
            toast({
                title: "Settings Synchronized",
                description: "Global site configuration has been updated successfully.",
            });
        } catch (e) {
            toast({
                title: "Sync Failed",
                description: "Could not update settings. Please check your connection.",
                variant: "destructive"
            });
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center p-6">
                <Loader2 className="w-10 h-10 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background p-4 md:p-8 text-white">
            <div className="max-w-4xl mx-auto">
                {/* Header Action Bar */}
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                    <div className="flex items-center gap-4">
                        <Link to="/admin" className="p-2 hover:bg-white/10 rounded-xl transition-all border border-white/5">
                            <ArrowLeft className="w-5 h-5 text-gray-400" />
                        </Link>
                        <div>
                            <h1 className="text-2xl md:text-3xl font-bold flex items-center gap-3">
                                <Settings className="w-7 h-7 text-primary" />
                                App Settings
                            </h1>
                            <p className="text-gray-500 text-sm mt-0.5">Manage global configuration and user experience.</p>
                        </div>
                    </div>
                    <Button
                        onClick={saveSettings}
                        disabled={saving}
                        className="w-full md:w-auto gap-2 bg-primary text-black hover:bg-primary/90 rounded-xl h-12 px-8 font-bold shadow-lg shadow-primary/20"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Save Changes
                    </Button>
                </div>

                <div className="grid gap-6 md:gap-8">
                    {/* Site Announcement Banner */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 hover:border-primary/20 transition-all">
                        <div className="flex items-center justify-between mb-8">
                            <div className="flex gap-4">
                                <div className="p-3 bg-primary/10 rounded-2xl border border-primary/20">
                                    <Megaphone className="w-6 h-6 text-primary" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Announcement Banner</h3>
                                    <p className="text-gray-500 text-sm">Site-wide alerts & promotional messages.</p>
                                </div>
                            </div>
                            <Switch
                                checked={settings.bannerEnabled}
                                onCheckedChange={(val) => setSettings({ ...settings, bannerEnabled: val })}
                            />
                        </div>

                        <div className={`space-y-4 transition-all duration-500 ${settings.bannerEnabled ? 'opacity-100 translate-y-0' : 'opacity-30 pointer-events-none -translate-y-2'}`}>
                            <Label className="text-gray-400 text-xs uppercase tracking-widest font-bold">Banner Message Content</Label>
                            <Input
                                placeholder="e.g. ✨ Mahashivratri Special Offer: 20% OFF! ✨"
                                value={settings.bannerText}
                                onChange={e => setSettings({ ...settings, bannerText: e.target.value })}
                                className="bg-black/40 border-white/10 h-14 rounded-2xl text-lg pl-6 focus:border-primary/50 transition-all font-medium"
                            />
                        </div>
                    </div>

                    {/* Maintenance Protocol */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 hover:border-red-500/20 transition-all">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex gap-4">
                                <div className="p-3 bg-red-500/10 rounded-2xl border border-red-500/20">
                                    <Hammer className="w-6 h-6 text-red-500" />
                                </div>
                                <div>
                                    <h3 className="text-xl font-bold">Maintenance Protocol</h3>
                                    <p className="text-gray-500 text-sm">Restrict site access for technical updates.</p>
                                </div>
                            </div>
                            <Switch
                                checked={settings.maintenanceMode}
                                onCheckedChange={(val) => setSettings({ ...settings, maintenanceMode: val })}
                                className="data-[state=checked]:bg-red-500"
                            />
                        </div>

                        {settings.maintenanceMode && (
                            <Alert variant="destructive" className="bg-red-500/10 border-red-500/30 rounded-2xl animate-in zoom-in-95 duration-300">
                                <AlertTriangle className="h-5 w-5" />
                                <AlertTitle className="font-bold uppercase tracking-wider text-xs">High Visibility Warning</AlertTitle>
                                <AlertDescription className="text-sm opacity-90">
                                    Enabling Maintenance Mode will immediately disconnect all regular users. Only administrators will retain access to this dashboard.
                                </AlertDescription>
                            </Alert>
                        )}
                    </div>

                    {/* Support Infrastructure */}
                    <div className="bg-white/5 border border-white/10 rounded-3xl p-6 md:p-8 hover:border-blue-500/20 transition-all">
                        <div className="flex items-center gap-4 mb-8">
                            <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20">
                                <Phone className="w-6 h-6 text-blue-500" />
                            </div>
                            <div>
                                <h3 className="text-xl font-bold">Support Infrastructure</h3>
                                <p className="text-gray-500 text-sm">Update public contact identifiers.</p>
                            </div>
                        </div>

                        <div className="grid md:grid-cols-2 gap-6">
                            <div className="space-y-4">
                                <Label className="text-gray-400 text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-green-500" /> WhatsApp Direct
                                </Label>
                                <Input
                                    placeholder="+91 00000 00000"
                                    value={settings.contactWhatsapp}
                                    onChange={e => setSettings({ ...settings, contactWhatsapp: e.target.value })}
                                    className="bg-black/40 border-white/10 h-14 rounded-2xl pl-6 focus:border-green-500/30 transition-all"
                                />
                            </div>
                            <div className="space-y-4">
                                <Label className="text-gray-400 text-xs uppercase tracking-widest font-bold flex items-center gap-2">
                                    <Instagram className="w-4 h-4 text-pink-500" /> Instagram Handle
                                </Label>
                                <Input
                                    placeholder="@your_profile"
                                    value={settings.contactInstagram}
                                    onChange={e => setSettings({ ...settings, contactInstagram: e.target.value })}
                                    className="bg-black/40 border-white/10 h-14 rounded-2xl pl-6 focus:border-pink-500/30 transition-all"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mt-12 text-center text-[10px] text-gray-500 font-bold uppercase tracking-[0.3em] opacity-30">
                    Sacred Operations Command Central
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;
