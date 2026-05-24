import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const Privacy = () => {
    const navigate = useNavigate();
    usePageTitle("Privacy Policy");

    return (
        <div className="pb-6 px-4">
            <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
                <div className="flex items-center gap-3 px-4 h-14">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <h1 className="text-lg font-serif font-semibold">Privacy Policy</h1>
                </div>
            </header>

            <main className="px-4 pt-6 animate-fade-in max-w-3xl mx-auto">
                <div className="bg-card border border-border rounded-xl p-8 shadow-elegant space-y-8">
                    <header className="mb-8 border-b border-border pb-6">
                        <p className="text-xs text-primary uppercase tracking-widest mb-2 font-semibold">Last Updated: February 21, 2026</p>
                        <h2 className="text-3xl font-serif font-bold text-white">Privacy Policy</h2>
                        <p className="text-sm text-gray-400 mt-2">Your privacy is our utmost priority. This policy outlines how "I Love Great Epic Mahabharat" handles your data.</p>
                    </header>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">01</span> Introduction
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Welcome to <strong>"I Love Great Epic Mahabharat"</strong>. We are committed to protecting your personal data and your right to privacy. If you have any questions or concerns about our policy, or our practices with regards to your personal information, please contact us at support@mahabharat.com.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">02</span> Information We Collect
                        </h3>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                We collect personal information that you voluntarily provide to us when you register on the Website, express an interest in obtaining information about us or our products, or otherwise contact us.
                            </p>
                            <ul className="list-disc list-inside text-sm text-gray-400 space-y-2 ml-4">
                                <li><strong>Personal Identifiers:</strong> Name, email address, phone number, and postal address.</li>
                                <li><strong>Authentication Data:</strong> We use Firebase Authentication for secure login (Google, Email/Password).</li>
                                <li><strong>Payment Information:</strong> We do not store credit card details. All payments are processed through secured third-party gateways (Stripe/Razorpay).</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">03</span> How We Use Your Information
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            We use personal information collected via our Website for a variety of business purposes described below:
                        </p>
                        <ul className="list-disc list-inside text-sm text-gray-400 space-y-2 ml-4 mt-2">
                            <li>To facilitate account creation and logon process through Firebase.</li>
                            <li>To send administrative information to you (Order updates, security alerts).</li>
                            <li>To fulfill and manage your orders, payments, and returns.</li>
                            <li>To deliver targeted advertising and newsletter (with your consent).</li>
                            <li>To protect our Services from fraudulent activity.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">04</span> Data Security & Storage
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            We use <strong>Google Firebase</strong> for database storage and authentication. Your data is protected by industry-standard encryption and security protocols provided by Google Cloud Infrastructure. We implement a variety of security measures to maintain the safety of your personal information when you place an order or enter, submit, or access your personal information.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">05</span> Your Privacy Rights
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Depending on your location, you may have the right to:
                        </p>
                        <ul className="list-disc list-inside text-sm text-gray-400 space-y-2 ml-4 mt-2">
                            <li>Request access to your personal data.</li>
                            <li>Request correction or deletion of your data.</li>
                            <li>Object to the processing of your data.</li>
                            <li>Request data portability.</li>
                        </ul>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">06</span> Contact Us
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            If you have questions or comments about this policy, you may email us at <strong>legal@mahabharat.com</strong> or by post to:
                            <br /><br />
                            Dharma Divine Enterprises<br />
                            Spiritual Hub, Varanasi, India
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default Privacy;
