import { useNavigate } from "react-router-dom";
import { ArrowLeft, RefreshCw } from "lucide-react";

const Refunds = () => {
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
                        <RefreshCw className="w-5 h-5 text-primary" />
                        <h1 className="text-lg font-serif font-semibold">Refunds & Cancellation</h1>
                    </div>
                </div>
            </header>

            <main className="px-4 pt-6 animate-fade-in max-w-3xl mx-auto">
                <div className="bg-card border border-border rounded-xl p-8 shadow-elegant space-y-8">
                    <header className="mb-8 border-b border-border pb-6">
                        <p className="text-xs text-primary uppercase tracking-widest mb-2 font-semibold">Return Guidelines</p>
                        <h2 className="text-3xl font-serif font-bold text-white">Refunds & Returns</h2>
                        <p className="text-sm text-gray-400 mt-2">Clear and fair policies for our digital and physical products.</p>
                    </header>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">01</span> Digital Products (Ebooks/PDFs)
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            Due to the nature of digital content, <strong>all sales of digital products (Ebooks, PDFs, and Audio Books) are final</strong>. Once the digital content has been accessed, downloaded, or viewed, we cannot offer a refund.
                            <br /><br />
                            However, if you experience technical issues accessing the content, please contact our support team immediately. We will ensure you receive the access you paid for.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">02</span> Physical Products (Pendrives)
                        </h3>
                        <div className="space-y-4">
                            <p className="text-sm text-gray-300 leading-relaxed">
                                We accept returns for physical pendrives within <strong>7 days</strong> of delivery under the following conditions:
                            </p>
                            <ul className="list-disc list-inside text-sm text-gray-400 space-y-2 ml-4">
                                <li>The product must be unused and in the same condition that you received it.</li>
                                <li>It must be in the original packaging.</li>
                                <li>The seal on the pendrive package must be intact.</li>
                            </ul>
                        </div>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">03</span> Damaged or Defective Items
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            If you receive a damaged or defective physical product, we will replace it at no additional cost. Please contact us within <strong>48 hours</strong> of delivery with photos of the damaged item and packaging.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">04</span> Cancellation Policy
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            <strong>Physical Orders:</strong> You can cancel your order within 12 hours of placing it, as long as it has not been shipped. Once shipped, the return policy applies.
                            <br /><br />
                            <strong>Digital Orders:</strong> Digital orders cannot be cancelled once the payment is confirmed and access is granted.
                        </p>
                    </section>

                    <section>
                        <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
                            <span className="text-primary/50 text-2xl">05</span> Process for Refunds
                        </h3>
                        <p className="text-sm text-gray-300 leading-relaxed">
                            To initiate a refund request, please raise a ticket on our <button onClick={() => navigate('/support')} className="text-primary font-bold underline">Support Page</button>. Once your return is received and inspected, we will send you an email to notify you that we have received your returned item and the status of your refund.
                            <br /><br />
                            Approved refunds will be processed to your original method of payment within <strong>5-7 business days</strong>.
                        </p>
                    </section>
                </div>
            </main>
        </div>
    );
};

export default Refunds;
