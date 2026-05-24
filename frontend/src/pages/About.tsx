import { useNavigate } from "react-router-dom";
import { ArrowLeft, Heart, Book, Users } from "lucide-react";
import { usePageTitle } from "@/hooks/usePageTitle";

const About = () => {
  const navigate = useNavigate();
  usePageTitle("About");

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
          <h1 className="text-lg font-serif font-semibold">About Us</h1>
        </div>
      </header>

      <main className="px-4 pt-8 animate-fade-in max-w-4xl mx-auto space-y-12">
        {/* Brand Story Hero */}
        <div className="text-center space-y-4">
          <h2 className="text-4xl md:text-5xl font-serif font-bold text-white tracking-tight">
            Preserving Divine Wisdom <br />
            <span className="text-primary italic">For the Modern Seeker</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto leading-relaxed">
            "I Love Great Epic Mahabharat" is more than a platform; it is a sacred digital space dedicated to the timeless teachings of the greatest epic ever told.
          </p>
        </div>

        {/* Vision & Mission Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-card border border-border p-8 rounded-2xl shadow-elegant hover:border-primary/30 transition-all group">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Heart className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-serif font-bold text-xl mb-3 text-white">Our Mission</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              To bridge the gap between ancient Vedic wisdom and the digital age, making the Mahabharata's teachings accessible, relatable, and transformative for everyone.
            </p>
          </div>

          <div className="bg-card border border-border p-8 rounded-2xl shadow-elegant hover:border-primary/30 transition-all group">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Book className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-serif font-bold text-xl mb-3 text-white">Authentic Roots</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              We meticulously curate every Ebook, PDF, and audio recording to ensure that the core essence and philosophical depth of the original texts remain untouched.
            </p>
          </div>

          <div className="bg-card border border-border p-8 rounded-2xl shadow-elegant hover:border-primary/30 transition-all group">
            <div className="w-14 h-14 bg-primary/10 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
              <Users className="w-7 h-7 text-primary" />
            </div>
            <h3 className="font-serif font-bold text-xl mb-3 text-white">Global Sangha</h3>
            <p className="text-sm text-gray-400 leading-relaxed">
              Building a global community of seekers, scholars, and devotees united by their love for the Dharma and the epic journey of the Pandavas.
            </p>
          </div>
        </div>

        {/* Founder's Note / Commitment */}
        <div className="bg-gradient-to-br from-primary/10 to-transparent border border-primary/20 rounded-3xl p-8 md:p-12 relative overflow-hidden">
          <div className="relative z-10 space-y-6">
            <h3 className="text-2xl font-serif font-bold text-white italic">A Commitment to Dharma</h3>
            <p className="text-gray-300 leading-relaxed max-w-3xl">
              "Since our inception, our goal has remained singular: to ensure that the light of the Mahabharata never fades. We believe that the questions asked on the battlefield of Kurukshetra are the same questions we face in our daily lives. Our platform is dedicated to providing the tools and knowledge to navigate life's battles with grace and wisdom."
            </p>
            <div className="pt-4">
              <p className="text-primary font-bold uppercase tracking-widest text-sm">— The Dharma Divine Team</p>
            </div>
          </div>
          {/* Subtle Decorative Element */}
          <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 bg-primary/5 rounded-full blur-3xl"></div>
        </div>

        {/* Professional Contact Footer */}
        <div className="border-t border-border pt-12 text-center space-y-6">
          <h3 className="text-xl font-serif font-bold text-white">Connect with the Divine</h3>
          <div className="flex flex-wrap justify-center gap-8 text-sm">
            <div className="space-y-1">
              <p className="text-gray-500 uppercase tracking-tighter">Inquiries</p>
              <p className="text-white font-medium">support@mahabharat.com</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-500 uppercase tracking-tighter">Global Headquarters</p>
              <p className="text-white font-medium">Varanasi, Uttar Pradesh, India</p>
            </div>
            <div className="space-y-1">
              <p className="text-gray-500 uppercase tracking-tighter">Hours</p>
              <p className="text-white font-medium">Mon - Sat: 9 AM - 6 PM IST</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default About;
