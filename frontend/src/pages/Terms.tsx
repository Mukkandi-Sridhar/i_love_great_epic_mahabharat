import { useNavigate } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const Terms = () => {
  const navigate = useNavigate();
  usePageTitle("Terms");

  return (
    <div className="pb-6">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center gap-3 px-4 h-14">
          <button
            onClick={() => navigate(-1)}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <h1 className="text-lg font-serif font-semibold">Terms and Conditions</h1>
        </div>
      </header>

      <main className="px-4 pt-6 animate-fade-in max-w-3xl mx-auto">
        <div className="bg-card border border-border rounded-xl p-8 shadow-elegant space-y-8">
          <header className="mb-8 border-b border-border pb-6">
            <p className="text-xs text-primary uppercase tracking-widest mb-2 font-semibold">Effective Date: February 21, 2026</p>
            <h2 className="text-3xl font-serif font-bold text-white">Terms & Conditions</h2>
            <p className="text-sm text-gray-400 mt-2">Please read these terms carefully before using our services.</p>
          </header>

          <section>
            <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
              <span className="text-primary/50 text-2xl">01</span> Acceptance of Terms
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              By accessing or using the <strong>"I Love Great Epic Mahabharat"</strong> platform (the "Service"), you agree to be bound by these Terms and Conditions and our Privacy Policy. If you disagree with any part of the terms, you may not access the Service.
            </p>
          </section>

          <section>
            <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
              <span className="text-primary/50 text-2xl">02</span> Intellectual Property
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              The Service and its original content (including but not limited to ebooks, audio files, images, and brand design) are and will remain the exclusive property of <strong>Dharma Divine Enterprises</strong> and its licensors. Our content is protected by copyright, trademark, and other laws of both India and foreign countries. You may not reproduce, distribute, or create derivative works from our content without express written permission.
            </p>
          </section>

          <section>
            <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
              <span className="text-primary/50 text-2xl">03</span> User Accounts
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              When you create an account with us, you must provide information that is accurate, complete, and current at all times. Failure to do so constitutes a breach of the Terms, which may result in immediate termination of your account on our Service. You are responsible for safeguarding the password that you use to access the Service.
            </p>
          </section>

          <section>
            <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
              <span className="text-primary/50 text-2xl">04</span> Purchases & Payments
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              If you wish to purchase any product made available through the Service, you may be asked to supply certain information relevant to your Purchase. We use third-party services for payment processing (e.g., payment processors). We will not store or collect your payment card details.
            </p>
          </section>

          <section>
            <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
              <span className="text-primary/50 text-2xl">05</span> Disclaimer of Warranties
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed italic">
              "Your use of the Service is at your sole risk. The Service is provided on an 'AS IS' and 'AS AVAILABLE' basis. The Service is provided without warranties of any kind, whether express or implied."
            </p>
          </section>

          <section>
            <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
              <span className="text-primary/50 text-2xl">06</span> Limitation of Liability
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              In no event shall Dharma Divine Enterprises, nor its directors, employees, partners, agents, suppliers, or affiliates, be liable for any indirect, incidental, special, consequential or punitive damages, including without limitation, loss of profits, data, use, goodwill, or other intangible losses.
            </p>
          </section>

          <section>
            <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
              <span className="text-primary/50 text-2xl">07</span> Governing Law
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              These Terms shall be governed and construed in accordance with the laws of <strong>India</strong>, without regard to its conflict of law provisions. Our failure to enforce any right or provision of these Terms will not be considered a waiver of those rights.
            </p>
          </section>

          <section>
            <h3 className="font-serif font-bold text-xl mb-4 text-white flex items-center gap-2">
              <span className="text-primary/50 text-2xl">08</span> Changes to Terms
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              We reserve the right, at our sole discretion, to modify or replace these Terms at any time. We will try to provide at least 30 days' notice prior to any new terms taking effect. By continuing to access or use our Service after those revisions become effective, you agree to be bound by the revised terms.
            </p>
          </section>
        </div>
      </main>
    </div>
  );
};

export default Terms;
