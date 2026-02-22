import { useNavigate } from "react-router-dom";
import { ArrowLeft, Truck } from "lucide-react";

const Shipping = () => {
    const navigate = useNavigate();

    return (
        <div className="min-h-screen bg-background pb-6">
            <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
                <div className="flex items-center gap-3 px-4 h-14">
                    <button
                        onClick={() => navigate(-1)}
                        className="p-2 hover:bg-muted rounded-lg transition-colors"
                    >
                        <ArrowLeft className="w-5 h-5" />
                    </button>
                    <div className="flex items-center gap-2">
                        <Truck className="w-5 h-5 text-primary" />
                        <h1 className="text-lg font-serif font-semibold">Shipping & Returns</h1>
                    </div>
                </div>
            </header>

            <main className="px-4 pt-6 animate-fade-in max-w-3xl mx-auto">
                <div className="bg-card border border-border rounded-xl p-8 shadow-elegant space-y-8">
                    <header className="mb-8 border-b border-border pb-6">
                        <p className="text-xs text-primary uppercase tracking-widest mb-2 font-semibold">Shipping Guidelines</p>
                        <h2 className="text-3xl font-serif font-bold text-white">Logistics & Delivery</h2>
                        <p className="text-sm text-gray-400 mt-2">Our commitment to delivering the divine knowledge of Mahabharata to your doorstep.</p>
                    </header>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">01</span> Domestic Shipping (India)
                        </h3>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                We pride ourselves on efficient delivery across the Indian subcontinent.
                            </p>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h4 className="text-primary font-bold text-sm mb-2 italic">Metro Cities</h4>
                                    <p className="text-xs text-gray-400 font-medium">3-5 Business Days</p>
                                </div>
                                <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                                    <h4 className="text-primary font-bold text-sm mb-2 italic">Non-Metro/Rural</h4>
                                    <p className="text-xs text-gray-400 font-medium">5-8 Business Days</p>
                                </div>
                            </div>
                        </div>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">02</span> International Shipping
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            We ship our physical SD Cards globally. International orders typically take <strong>10-15 business days</strong> depending on the destination country and customs clearance procedures. Please note that any customs duties or taxes levied by the destination country are the responsibility of the customer.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">03</span> Order Processing Time
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Every order for a physical product is inspected for quality. Processing usually takes <strong>24-48 hours</strong>. You will receive a tracking number via email as soon as your order is dispatched.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">04</span> Digital Delivery
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            For our Ebooks and PDF materials, delivery is <strong>instant</strong>. Upon successful payment, a download link will be shared with you via email, and the content will be available in your personal library on the platform.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">05</span> Returns & Refunds
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed italic">
                            Looking for our return policy? Please visit our dedicated <button onClick={() => navigate('/refunds')} className="text-primary font-bold underline hover:text-primary/80 transition-colors uppercase tracking-tight">Refunds & Cancellation Page</button> for detailed information on how to return an item or request a refund.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default Shipping;
