import { Link } from 'react-router-dom';
import logo from "@/assets/logo.png";
import { useState } from 'react';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { db } from '@/lib/firebase';
import { BookOpen, Target, ArrowRight } from "lucide-react";
import { useFirebase } from "@/contexts/FirebaseContext";
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';

const Footer = () => {
    const currentYear = new Date().getFullYear();
    const { toast } = useToast();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async (e: React.FormEvent) => {
        // ... (existing logic)
    };

    const footerLinks = {
        Shop: [
            { name: 'All Products', path: '/all-products' },
            { name: 'Best Sellers', path: '/all-products?filter=bestseller' },
            { name: 'New Arrivals', path: '/all-products?filter=new' },
        ],
        Support: [
            { name: 'Contact Us', path: '/support' },
            { name: 'FAQs', path: '/faqs' },
            { name: 'Shipping Policy', path: '/shipping' },
            { name: 'Refunds & Cancellation', path: '/refunds' },
        ],
        Company: [
            { name: 'About Us', path: '/profile/about' },
            { name: 'Terms of Service', path: '/terms' },
            { name: 'Privacy Policy', path: '/privacy' },
        ],
        Social: [
            { name: 'Instagram', path: '#' },
            { name: 'YouTube', path: '#' },
            { name: 'Twitter', path: '#' },
        ]
    };

    return (
        <footer className="relative bg-black text-white pt-16 pb-32 md:pb-12 overflow-hidden">
            {/* Top Golden Energy Border */}
            <div
                className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-yellow-600 via-yellow-200 via-yellow-600 to-transparent animate-energy-flow"
                style={{ backgroundSize: '200% 100%' }}
            />

            {/* Background Glow Effect */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-4xl h-32 bg-primary/5 blur-[100px] pointer-events-none" />

            <div className="container-width px-4 relative z-10">
                <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-5 gap-8 md:gap-12 mb-12 md:mb-16">
                    {/* Brand Column - Full width on mobile */}
                    <div className="col-span-2 md:col-span-1 lg:col-span-2 flex flex-col items-center md:items-start text-center md:text-left space-y-6">
                        {/* Circle Shape Logo Container */}
                        <div className="w-20 h-20 relative rounded-full overflow-hidden border-2 border-[#FFD700]/30 shadow-[0_0_20px_rgba(255,215,0,0.15)] bg-black/50 backdrop-blur-sm flex items-center justify-center p-1">
                            <img
                                src={logo}
                                alt="Dharma Divine"
                                className="w-full h-full object-cover rounded-full"
                            />
                        </div>
                        <div>
                            <h3 className="text-xl font-serif font-bold bg-clip-text text-transparent bg-gradient-to-r from-[#FFD700] to-[#FDB931] mb-2">
                                I Love Great Epic Mahabharat
                            </h3>
                            <p className="text-white/60 text-sm leading-relaxed max-w-xs mx-auto md:mx-0">
                                Preserving ancient wisdom for the modern seeker. Discover our collection of divine ebooks and audio archives.
                            </p>
                        </div>

                        {/* Newsletter Section */}
                        <div className="w-full max-w-sm">
                            <h4 className="text-sm font-bold text-primary uppercase tracking-widest mb-3">Divine Updates</h4>
                            <p className="text-xs text-gray-500 mb-4">Join our community of 5000+ devotees.</p>
                            <form onSubmit={handleSubscribe} className="flex gap-2">
                                <Input
                                    type="email"
                                    placeholder="your@email.com"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-600 focus-visible:ring-primary/30"
                                />
                                <Button type="submit" disabled={loading} className="bg-primary text-black font-bold uppercase text-[10px] tracking-widest h-10 px-4">
                                    {loading ? "..." : "Subscribe"}
                                </Button>
                            </form>
                        </div>
                    </div>

                    {/* Links Columns - 2 col grid on mobile automatically due to parent grid-cols-2 */}
                    {Object.entries(footerLinks).map(([category, links]) => (
                        <div key={category} className="text-center md:text-left">
                            <h3 className="font-bold mb-4 md:mb-6 text-sm tracking-widest uppercase text-[#FFD700]">{category}</h3>
                            <ul className="space-y-3 md:space-y-4">
                                {links.map((link) => (
                                    <li key={link.name}>
                                        <Link
                                            to={link.path}
                                            className="text-sm text-white/70 hover:text-white hover:translate-x-1 transition-all duration-300 inline-block"
                                        >
                                            {link.name}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))}
                </div>

                {/* Bottom Bar */}
                <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row justify-between items-center gap-6 text-center md:text-left">
                    <p className="text-xs text-white/50">
                        &copy; {currentYear} I Love Great Epic Mahabharat. All rights reserved.
                    </p>
                    <div className="flex flex-wrap justify-center gap-6">
                        <Link to="/privacy" className="text-xs text-white/50 hover:text-[#FFD700] transition-colors">Privacy Policy</Link>
                        <Link to="/terms" className="text-xs text-white/50 hover:text-[#FFD700] transition-colors">Terms of Use</Link>
                        <Link to="/support" className="text-xs text-white/50 hover:text-[#FFD700] transition-colors">Support</Link>
                    </div>
                </div>
            </div>
        </footer>
    );
};

export default Footer;
