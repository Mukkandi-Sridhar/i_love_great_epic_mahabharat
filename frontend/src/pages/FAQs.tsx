import { useNavigate } from "react-router-dom";
import { ArrowLeft, HelpCircle } from "lucide-react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { usePageTitle } from "@/hooks/usePageTitle";

const FAQs = () => {
    const navigate = useNavigate();
    usePageTitle("FAQs");

    const faqs = [
        {
            question: "How do I access my purchased ebooks?",
            answer: "After purchasing, your ebooks are immediately available in your 'Collection' page. You can read them directly on our platform or download them for offline reading where supported."
        },
        {
            question: "When will my SD card arrive?",
            answer: "SD cards are typically shipped within 1-2 business days. Delivery times vary by location but usually take 3-7 business days within the country. You will receive a tracking number via email."
        },
        {
            question: "Can I use the content on multiple devices?",
            answer: "Yes! Your digital purchases are linked to your account. You can log in and access your content on any supported device, including mobile phones, tablets, and computers."
        },
        {
            question: "What does the 'Support' subscription include?",
            answer: "Our Support/Donation tiers are a way to help us preserve this digital heritage. Depending on the tier, you may receive special badges, early access to new content, or exclusive high-resolution wallpapers."
        },
        {
            question: "Is the audio content available offline?",
            answer: "Currently, audio streaming requires an internet connection on the web. However, our SD card collections include high-quality audio files that can be played completely offline on any device with an SD slot."
        },
        {
            question: "Do you offer refunds?",
            answer: "For digital products, we generally do not offer refunds once the content has been accessed. However, if you experience technical issues, please contact our support team. Physical goods can be returned within 7 days if unopened/defective."
        }
    ];

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
                        <HelpCircle className="w-5 h-5 text-primary" />
                        <h1 className="text-lg font-serif font-semibold">Frequently Asked Questions</h1>
                    </div>
                </div>
            </header>

            <main className="px-4 pt-6 animate-fade-in max-w-2xl mx-auto">
                <div className="bg-card border border-border rounded-xl p-6 shadow-elegant">
                    <Accordion type="single" collapsible className="w-full">
                        {faqs.map((faq, index) => (
                            <AccordionItem key={index} value={`item-${index}`}>
                                <AccordionTrigger className="text-left font-serif text-white hover:text-primary transition-colors">
                                    {faq.question}
                                </AccordionTrigger>
                                <AccordionContent className="text-gray-300 leading-relaxed">
                                    {faq.answer}
                                </AccordionContent>
                            </AccordionItem>
                        ))}
                    </Accordion>
                </div>

                <div className="mt-8 text-center">
                    <p className="text-muted-foreground text-sm">Still have questions?</p>
                    <button
                        onClick={() => navigate('/support')}
                        className="mt-2 text-primary hover:underline text-sm font-medium"
                    >
                        Contact Support
                    </button>
                </div>
            </main>
        </div>
    );
};

export default FAQs;
