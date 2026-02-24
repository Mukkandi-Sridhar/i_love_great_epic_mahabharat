import { useNavigate } from "react-router-dom";
import { useState, useCallback, useEffect, useRef } from "react";
import HeroCarousel from "@/components/HeroCarousel";
import ProductCard from "@/components/ProductCard";

import TestimonialMarquee from "@/components/TestimonialMarquee";
import DivineJourney from "@/components/DivineJourney";
import { ebooks, sdCards } from "@/data/products";
import KrishnaHero from "@/components/KrishnaHero";
import DivineSeparator from "@/components/DivineSeparator";
import brandLogo from "@/assets/logo.png";
import RecentlyViewed from "@/components/RecentlyViewed";
import { BookOpen, Target, ArrowRight } from "lucide-react";
import { useFirebase } from "@/contexts/FirebaseContext";



const Explore = () => {
  const navigate = useNavigate();


  return (
    <div className="min-h-screen bg-background pb-20">


      {/* Hero Section - Full Width */}
      <section className="relative w-full overflow-hidden pointer-events-none select-none">
        <HeroCarousel />
      </section>

      <div className="w-full max-w-[1400px] mx-auto px-4 md:px-8 space-y-8 md:space-y-12">
        {/* Latest Ebooks */}
        <section>
          <div className="mb-6 md:mb-8 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-bold text-white">Latest Ebooks</h2>
                <p className="text-xs md:text-sm text-gray-500">Digital wisdom collection</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/all-products?type=ebooks")}
              className="group flex items-center text-xs md:text-sm font-semibold text-primary hover:text-white transition-colors"
            >
              View all <ArrowRight className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>
          <div
            className="flex overflow-x-auto gap-4 pb-6 -mx-4 px-4 md:mx-0 md:px-0 md:grid md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 md:gap-6 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:'none'] [scrollbar-width:'none']"
          >
            {ebooks.map((product) => (
              <div
                key={product.id}
                className="min-w-[170px] w-[45vw] md:min-w-0 md:w-auto"
              >
                <ProductCard {...product} />
              </div>
            ))}
          </div>
        </section>

        {/* Visual Separator */}
        <div>
          <DivineSeparator />
        </div>

        {/* SD Cards Collection */}
        <section>
          <div className="mb-4 md:mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 md:w-12 md:h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Target className="w-5 h-5 md:w-6 md:h-6 text-primary" />
              </div>
              <div>
                <h2 className="text-lg md:text-2xl font-bold text-white">SD Cards Collection</h2>
                <p className="text-xs md:text-sm text-gray-500">Physical delivery to doorstep</p>
              </div>
            </div>
            <button
              onClick={() => navigate("/all-products?type=sdcards")}
              className="group flex items-center text-xs md:text-sm font-semibold text-primary hover:text-white transition-colors"
            >
              View all <ArrowRight className="ml-1 w-4 h-4 transition-transform group-hover:translate-x-1" />
            </button>
          </div>

          <div
            className="flex overflow-x-auto gap-4 pb-6 -mx-4 px-4 md:mx-0 md:px-0 scrollbar-hide"
          >
            {sdCards.map((product) => (
              <div key={product.id} className="min-w-[170px] w-[45vw] md:min-w-0 md:w-auto">
                <ProductCard {...product} />
              </div>
            ))}
          </div>
        </section>

        {/* Krishna Hero Section */}
        <div>
          <KrishnaHero />
        </div>

        {/* Your Journey to Dharma - Divine Thread Section */}
        <div className="py-0">
          <DivineJourney />
        </div>

        {/* ULTRA-MODERN: Testimonials Section */}
        <section className="pb-0 md:pb-8 relative">


          <div className="relative">
            {/* Header */}
            <div className="text-center mb-8 md:mb-12">
              <div className="inline-flex items-center gap-2 px-4 py-1.5 bg-yellow-500/10 border border-yellow-500/30 rounded-full mb-6">
                <span className="text-yellow-500 text-lg">⭐</span>
                <span className="text-xs font-bold text-yellow-500 uppercase tracking-wider">4.9/5 Rating</span>
              </div>
              <h2 className="text-3xl md:text-5xl font-serif font-black text-white mb-4">
                Loved by Devotees Worldwide
              </h2>
              <p className="text-gray-400 text-sm md:text-lg max-w-2xl mx-auto">Join thousands experiencing spiritual transformation through our sacred collections.</p>
            </div>

            {/* Infinite Marquee */}
            <div className="py-8">
              <TestimonialMarquee />
            </div>

            {/* Trust Indicator */}
            <div className="text-center mt-12 md:mt-16">
              <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-[#FFD700]/30">
                <div className="w-8 h-8 rounded-full border border-[#FFD700]/50 overflow-hidden flex items-center justify-center bg-black/50">
                  <img src={brandLogo} alt="Logo" className="w-full h-full object-cover" />
                </div>
                <div className="flex items-center gap-2 text-[#FFD700]">
                  <span className="text-lg font-bold">2,340+</span>
                  <span className="text-sm">Happy Customers</span>
                  <span className="text-white/30">•</span>
                  <span className="text-sm">Since 2020</span>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Premium Bottom Fade transition into Footer — Matched to Theme Background */}
      <div className="h-64 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none mt-[-160px] relative z-20" />
    </div>
  );
};

export default Explore;
