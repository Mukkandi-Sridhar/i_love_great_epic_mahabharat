import { Link } from "react-router-dom";
import { ArrowRight, BrainCircuit, Database, Gauge, ShieldCheck, Workflow, Zap } from "lucide-react";

const capabilities = [
    {
        icon: Database,
        title: "Grounded RAG",
        text: "Product, shipping, refund, privacy, and company answers are pulled from a maintained knowledge base before the model responds.",
        stat: "Policy KB",
    },
    {
        icon: Workflow,
        title: "Tool Calling",
        text: "Support problems become structured Firestore tickets through an OpenAI function call, with user identity attached when available.",
        stat: "Live tools",
    },
    {
        icon: ShieldCheck,
        title: "Guardrails",
        text: "Rate limits, security headers, scoped support flows, and cache exclusions protect payment, identity, and account questions.",
        stat: "20 req/min",
    },
    {
        icon: Gauge,
        title: "Fast UX",
        text: "Frontend tracing, response caching for stable FAQs, lazy routes, and optimistic chat states keep the assistant responsive.",
        stat: "Trace UI",
    },
];

const AIEngineeringShowcase = () => {
    return (
        <section className="relative overflow-hidden border-y border-white/10 bg-[linear-gradient(135deg,rgba(8,47,73,0.18),rgba(0,0,0,0.82),rgba(6,78,59,0.16))]">
            <div className="mx-auto grid max-w-[1400px] gap-8 px-4 py-10 md:grid-cols-[0.9fr_1.1fr] md:px-8 md:py-14">
                <div className="flex flex-col justify-center">
                    <div className="mb-4 inline-flex w-fit items-center gap-2 rounded-lg border border-cyan-400/20 bg-cyan-400/10 px-3 py-2 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-200">
                        <BrainCircuit className="h-4 w-4" />
                        AI Engineering Layer
                    </div>

                    <h2 className="max-w-2xl font-serif text-3xl font-black leading-tight text-white md:text-5xl">
                        Commerce support powered by a grounded AI system
                    </h2>

                    <p className="mt-5 max-w-xl text-sm leading-7 text-gray-300 md:text-base">
                        Ask about products, refunds, shipping, access problems, or contact requests. The assistant retrieves the right business context, reasons over the conversation, and escalates real issues into support workflows.
                    </p>

                    <div className="mt-7 flex flex-wrap gap-3">
                        <Link
                            to="/support"
                            className="inline-flex items-center gap-2 rounded-lg bg-primary px-5 py-3 text-sm font-bold text-black transition hover:bg-white"
                        >
                            Open AI Support
                            <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                            to="/all-products"
                            className="inline-flex items-center gap-2 rounded-lg border border-white/15 px-5 py-3 text-sm font-bold text-white transition hover:border-cyan-300/50 hover:text-cyan-100"
                        >
                            Explore Products
                        </Link>
                    </div>
                </div>

                <div className="grid gap-3 sm:grid-cols-2">
                    {capabilities.map(({ icon: Icon, title, text, stat }) => (
                        <article key={title} className="rounded-lg border border-white/10 bg-black/35 p-5 backdrop-blur-md transition hover:border-cyan-300/35 hover:bg-white/[0.04]">
                            <div className="mb-5 flex items-center justify-between gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg border border-primary/25 bg-primary/10 text-primary">
                                    <Icon className="h-5 w-5" />
                                </div>
                                <span className="rounded-lg border border-emerald-300/20 bg-emerald-300/10 px-2 py-1 text-[10px] font-bold uppercase tracking-widest text-emerald-200">
                                    {stat}
                                </span>
                            </div>
                            <h3 className="text-lg font-bold text-white">{title}</h3>
                            <p className="mt-3 text-sm leading-6 text-gray-400">{text}</p>
                        </article>
                    ))}
                </div>

                <div className="md:col-span-2">
                    <div className="grid gap-2 rounded-lg border border-white/10 bg-black/45 p-3 text-xs text-gray-300 md:grid-cols-4">
                        {["Query", "Retrieve", "Generate", "Act"].map((step, index) => (
                            <div key={step} className="flex items-center gap-2 rounded-lg bg-white/[0.03] px-3 py-3">
                                <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-cyan-300/10 font-mono text-cyan-200">{index + 1}</span>
                                <span className="font-semibold text-white">{step}</span>
                                {index === 3 && <Zap className="ml-auto h-4 w-4 text-primary" />}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AIEngineeringShowcase;
