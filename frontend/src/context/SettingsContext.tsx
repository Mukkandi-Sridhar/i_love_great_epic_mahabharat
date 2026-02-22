import React, { createContext, useContext, useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "@/lib/firebase";

interface AppSettings {
    bannerText: string;
    bannerEnabled: boolean;
    maintenanceMode: boolean;
    contactWhatsapp: string;
    contactInstagram: string;
}

interface SettingsContextType {
    settings: AppSettings | null;
    loading: boolean;
}

const SettingsContext = createContext<SettingsContextType>({ settings: null, loading: true });

export const SettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<AppSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        // Real-time listener for app settings
        const unsub = onSnapshot(doc(db, "settings", "app"), (doc) => {
            if (doc.exists()) {
                setSettings(doc.data() as AppSettings);
            }
            setLoading(false);
        }, (err) => {
            console.error("Settings listener error:", err);
            setLoading(false);
        });

        return () => unsub();
    }, []);

    return (
        <SettingsContext.Provider value={{ settings, loading }}>
            {children}
        </SettingsContext.Provider>
    );
};

export const useSettings = () => useContext(SettingsContext);
