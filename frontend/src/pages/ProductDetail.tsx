import { useParams, useNavigate } from "react-router-dom";
import { useState, useCallback, useMemo, useEffect } from "react";
import { Star, Shield, Download, Smartphone, Check, Share2, ShoppingBag, ArrowLeft, ExternalLink, Heart, Truck, ChevronDown, ChevronUp, MessageCircle, ThumbsUp, Verified, Package, Clock, Award, Headphones, Zap, BookOpen, Target, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useFirebase } from "@/contexts/FirebaseContext";
import { PurchaseAccess, subscribeToPurchaseAccess } from "@/services/db";
import ThreeDBook from "@/components/ThreeDBook";
import { allProducts } from "@/data/products";
import RecentlyViewed from "@/components/RecentlyViewed";
import { useToast } from "@/hooks/use-toast";
import { usePageTitle } from "@/hooks/usePageTitle";

// Rating Bar Component - Premium Design
const RatingBar = ({ stars, percentage }: { stars: number; percentage: number }) => (
  <div className="flex items-center gap-3">
    <span className="w-6 text-xs font-medium text-gray-400">{stars}★</span>
    <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
      <div
        className="h-full bg-gradient-to-r from-amber-500 to-amber-400 rounded-full"
        style={{ width: `${percentage}%` }}
      />
    </div>
    <span className="w-8 text-right text-xs text-gray-500">{percentage}%</span>
  </div>
);

interface Review {
  name: string;
  rating: number;
  date: string;
  comment: string;
  verified: boolean;
}

// Review Card Component - Premium Design
const ReviewCard = ({ review }: { review: Review }) => (
  <div className="p-5 bg-gradient-to-br from-white/[0.03] to-white/[0.01] rounded-2xl border border-white/[0.06] hover:border-white/10 transition-colors">
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="w-11 h-11 rounded-full bg-gradient-to-br from-primary/40 to-primary/20 flex items-center justify-center text-primary font-bold text-sm shadow-lg shadow-primary/10">
          {review.name.charAt(0)}
        </div>
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            <span className="font-semibold text-white text-sm">{review.name}</span>
            {review.verified && (
              <span className="flex items-center gap-1 text-[9px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full font-medium">
                <Verified className="w-2.5 h-2.5" /> Verified Purchase
              </span>
            )}
          </div>
          <span className="text-[11px] text-gray-500">{review.date}</span>
        </div>
      </div>
      <div className="flex items-center gap-0.5 bg-white/5 px-2 py-1 rounded-lg">
        {Array.from({ length: 5 }).map((_, i) => (
          <Star key={i} className={`w-3 h-3 ${i < review.rating ? 'fill-amber-400 text-amber-400' : 'text-gray-700'}`} />
        ))}
      </div>
    </div>
    <p className="text-[13px] text-gray-300 leading-relaxed mb-4">{review.comment}</p>
    <div className="flex items-center gap-4 pt-3 border-t border-white/5">
      <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors">
        <ThumbsUp className="w-3.5 h-3.5" /> Helpful (12)
      </button>
      <button className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-primary transition-colors">
        <MessageCircle className="w-3.5 h-3.5" /> Reply
      </button>
    </div>
  </div>
);

// FAQ Item Component - Premium Design
const FAQItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div className="border-b border-white/5 last:border-0">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between py-4 text-left group"
      >
        <span className="text-sm font-medium text-gray-200 group-hover:text-white transition-colors pr-4">{question}</span>
        <div className={`w-6 h-6 rounded-full bg-white/5 flex items-center justify-center transition-colors ${isOpen ? 'bg-primary/20' : ''}`}>
          {isOpen ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
        </div>
      </button>
      <div className={`overflow-hidden transition-all duration-300 ${isOpen ? 'max-h-40 pb-4' : 'max-h-0'}`}>
        <p className="text-[13px] text-gray-400 leading-relaxed">{answer}</p>
      </div>
    </div>
  );
};

// Reviews Data
// Context-Aware Data
const productContent = {
  ebook: {
    reviews: [
      { name: "Ramesh K.", rating: 5, date: "2 days ago", comment: "Divine experience! The text is so clear and easy to read. Having the complete Mahabharat in Telugu on my tablet is a blessing.", verified: true },
      { name: "Priya Sharma", rating: 5, date: "1 week ago", comment: "Best digital purchase. The layout is perfect for mobile reading. Highly recommend for anyone wanting to read our epics.", verified: true },
      { name: "Arun Menon", rating: 4, date: "2 weeks ago", comment: "Great translation. Simple language that even my children can understand. Instant download worked perfectly.", verified: true },
      { name: "Lakshmi R.", rating: 5, date: "3 weeks ago", comment: "Spiritual treasure. I read a chapter every night. Thank you for making this accessible digitally.", verified: true },
    ],
    faqs: [
      { question: "What format is the ebook in?", answer: "The ebook is in a high-quality PDF format that is optimized for reading on all devices including smartphones, tablets, Kindles, and laptops." },
      { question: "How do I receive the book?", answer: "Immediately after purchase, you will receive an email with a secure download link. You can also download it directly from the 'My Profile' section." },
      { question: "Is the Telugu language difficult?", answer: "Not at all. This edition uses 'Sarala Telugu' (Simple Telugu) specifically designed for modern readers while preserving the poetic beauty of the original." },
      { question: "Can I print it?", answer: "Yes, the PDF is print-friendly. You can print specific chapters or the whole book for personal reading." },
    ]
  },
  pendrive: {
    reviews: [
      { name: "Suresh Babu", rating: 5, date: "1 day ago", comment: "Excellent Metal Pendrive. Very sturdy and looks premium. The audio clarity is amazing.", verified: true },
      { name: "Anita Reddy", rating: 5, date: "3 days ago", comment: "Just plug and play! Works perfectly on my TV and Car. The collection is huge.", verified: true },
      { name: "Venkatesh", rating: 4, date: "1 week ago", comment: "Good packaging and fast delivery. A must-have for every Telugu home.", verified: true },
      { name: "Krishna M.", rating: 5, date: "2 weeks ago", comment: "I gifted this to my parents and they are very happy. It's very easy for them to use.", verified: true },
    ],
    faqs: [
      { question: "Is this a normal USB Pendrive?", answer: "Yes, it is a high-quality SanDisk/HP Metal Pendrive (depends on availability) that works with any device having a USB port (TV, Laptop, Car, etc.)." },
      { question: "Does it work in my Car?", answer: "Absolutely! Just plug it into your car's USB port and it will start playing automatically." },
      { question: "Can I copy the files?", answer: "Yes, the files are DRM-free MP3s. You can copy them to your phone or computer for personal use." },
      { question: "Is OTG supported?", answer: "Yes, we provide a free OTG adapter so you can connect this pendrive directly to your Android phone." },
    ]
  }
};

const ProductDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useFirebase();
  const { toast } = useToast();
  const [isOwned, setIsOwned] = useState(false);
  const [ownershipLoading, setOwnershipLoading] = useState(false);
  const [purchaseAccess, setPurchaseAccess] = useState<PurchaseAccess | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Use the imported allProducts directly. No useMemo needed for a static import array.
  const product = useMemo(() => allProducts.find((p) => p.id === id), [id]);
  usePageTitle(product?.title || "Product");

  const contentData = product ? productContent[product.type as keyof typeof productContent] || productContent["pendrive"] : productContent.ebook;
  const { reviews, faqs } = contentData;

  // Shared Rating Distribution
  const ratingBreakdown = [
    { stars: 5, percentage: 85 },
    { stars: 4, percentage: 10 },
    { stars: 3, percentage: 3 },
    { stars: 2, percentage: 1 },
    { stars: 1, percentage: 1 },
  ];

  useEffect(() => {
    if (!user || !id) {
      setIsOwned(false);
      setOwnershipLoading(false);
      setPurchaseAccess(null);
      return;
    }

    setOwnershipLoading(true);
    const unsubscribe = subscribeToPurchaseAccess(
      user.uid,
      id,
      (purchase) => {
        setPurchaseAccess(purchase);
        setIsOwned(Boolean(purchase));
        setOwnershipLoading(false);
      },
      () => {
        setPurchaseAccess(null);
        setIsOwned(false);
        setOwnershipLoading(false);
      }
    );

    return () => unsubscribe();
  }, [user, id]);

  // Recently Viewed Logic
  useEffect(() => {
    if (!id) return;
    const history = JSON.parse(localStorage.getItem("sacred_history") || "[]");
    const updatedHistory = [id, ...history.filter((i: string) => i !== id)].slice(0, 10);
    localStorage.setItem("sacred_history", JSON.stringify(updatedHistory));
  }, [id]);

  const handleShare = async (platform?: 'whatsapp' | 'twitter' | 'copy') => {
    if (!product) return;
    const url = window.location.href;
    const text = `Check out this divine collection: ${product.title}`;

    if (platform === 'whatsapp') {
      window.open(`https://api.whatsapp.com/send?text=${encodeURIComponent(text + ' ' + url)}`, '_blank');
    } else if (platform === 'twitter') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
    } else if (navigator.share) {
      await navigator.share({ title: product.title, text, url }).catch(() => undefined);
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Product link copied to clipboard." });
    }
  };

  const handleAction = () => {
    if (!product) return;
    if (isOwned && product?.type === "ebook") {
      if (product.driveLink) {
        window.open(product.driveLink, "_blank");
      } else {
        toast({ title: "Access pending", description: "The download link will be added shortly." });
      }
    } else if (isOwned && product?.isPhysical) {
      toast({ title: "Tracking info", description: "Check your email for tracking info." });
    } else {
      if (product.stockCount === 0) return; // Locked
      // Pass the product type to payment page to trigger correct flow (Shipping vs Digital)
      const query = (product?.type === "sdcard" || product?.type === "pendrive")
        ? `?type=${product.type}`
        : "";
      navigate(`/payment/${product?.id}${query}`);
    }
  };

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <p className="text-muted-foreground">Product not available.</p>
      </div>
    );
  }

  const discount = Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100);
  const displayedReviews = showAllReviews ? reviews : reviews.slice(0, 2);

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-8">
      {/* Mobile Header */}
      <div className="sticky top-0 z-50 md:hidden bg-black/90 backdrop-blur-xl border-b border-white/5">

        <div className="flex items-center justify-between px-4 h-14">
          <button onClick={() => navigate(-1)} className="w-10 h-10 -ml-2 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
            <ArrowLeft className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-1">
            <button onClick={() => handleShare('whatsapp')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
              <MessageCircle className="w-5 h-5 text-emerald-500" />
            </button>
            <button onClick={() => handleShare('copy')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
              <Share2 className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>


      {/* Product Image - Premium Dark Theme */}
      <div className="relative">
        {/* Subtle Background Glow */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-64 h-64 bg-primary/10 rounded-full blur-[100px]" />
        </div>

        {/* Purchased Badge */}
        {isOwned && (
          <div className="absolute top-4 left-4 z-20 bg-emerald-500 text-white px-3 py-1.5 rounded-full text-xs font-bold uppercase tracking-wider shadow-lg flex items-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Purchased
          </div>
        )}

        {/* Image Container */}
        <div className="relative aspect-square max-w-sm mx-auto py-6 flex items-center justify-center">
          {product.type === 'ebook' ? (
            <ThreeDBook
              src={product.image}
              alt={product.title}
              className="drop-shadow-[0_20px_50px_rgba(0,0,0,0.5)]"
            />
          ) : (
            <img
              src={product.image}
              alt={product.title}
              className="w-full h-full object-contain drop-shadow-2xl hover:scale-105 transition-transform duration-500"
            />
          )}
        </div>
      </div>

      {/* Content Container */}
      <div className="px-5 md:px-8 max-w-3xl mx-auto space-y-6">

        {/* Brand & Category */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-primary tracking-wide">DHARMA DIVINE</span>
            <span className="w-1 h-1 rounded-full bg-gray-600" />
            <span className="text-xs text-gray-500">{product.type === 'ebook' ? 'Digital Product' : 'Physical Product'}</span>
          </div>
          <div className="flex items-center gap-1 bg-emerald-500/10 text-emerald-400 px-2 py-1 rounded-full">
            <Verified className="w-3 h-3" />
            <span className="text-[10px] font-bold">VERIFIED</span>
          </div>
        </div>

        {/* Title Block */}
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-white mb-2 leading-tight tracking-tight">
            {product.title}
          </h1>
          <p className="text-sm text-gray-400">{product.subtitle}</p>
        </div>

        {/* Rating Row */}
        <div className="flex items-center gap-4 pb-5 border-b border-white/5">
          <div className="flex items-center gap-1.5 bg-emerald-600 text-white px-2.5 py-1 rounded-lg">
            <span className="text-sm font-bold">{product.rating}</span>
            <Star className="w-3.5 h-3.5 fill-white" />
          </div>
          <div className="flex flex-col">
            <span className="text-sm font-medium text-white">{product.reviewCount.toLocaleString()} Ratings</span>
            <span className="text-[11px] text-gray-500">{product.totalSales.toLocaleString()}+ sold</span>
          </div>
        </div>

        {/* Price Card */}
        <div className="p-5 bg-gradient-to-br from-white/[0.04] to-white/[0.01] rounded-2xl border border-white/[0.06]">
          <div className="flex items-end gap-3 mb-2">
            <span className="text-3xl font-bold text-white">₹{product.price}</span>
            <span className="text-lg text-gray-500 line-through mb-0.5">₹{product.originalPrice}</span>
            <span className="px-2.5 py-1 bg-emerald-500/20 text-emerald-400 text-xs font-bold rounded-lg mb-0.5">
              {discount}% OFF
            </span>
          </div>
          <p className="text-xs text-gray-500">Inclusive of all taxes • No hidden charges</p>

          {/* Stock Indicator - High Aesthetic */}
          {product.isPhysical && (
            <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full animate-pulse ${product.stockCount && product.stockCount > 0 ? 'bg-emerald-500' : 'bg-red-500'}`} />
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">Sacred Status</span>
              </div>
              <span className={`text-[11px] font-black uppercase tracking-widest px-2 py-0.5 rounded ${product.stockCount && product.stockCount > 20
                ? 'text-emerald-400 bg-emerald-500/10'
                : product.stockCount && product.stockCount > 0
                  ? 'text-orange-400 bg-orange-500/10'
                  : 'text-red-400 bg-red-500/10'
                }`}>
                {product.stockCount && product.stockCount > 20
                  ? "In Stock"
                  : product.stockCount && product.stockCount <= 5 && product.stockCount > 0
                    ? `Only ${product.stockCount} left!`
                    : product.stockCount && product.stockCount <= 20 && product.stockCount > 0
                      ? "Limited Stock"
                    : "Out of Reach"}
              </span>
            </div>
          )}
        </div>

        {/* Delivery Banner */}
        <div className="flex items-center gap-4 p-4 bg-gradient-to-r from-primary/5 to-transparent rounded-xl border border-primary/10">
          {product.isPhysical ? (
            <>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Truck className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Free Express Delivery</p>
                <p className="text-xs text-gray-400">Arrives in 3-5 business days</p>
              </div>
            </>
          ) : (
            <>
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <div>
                <p className="font-semibold text-white text-sm">Instant Digital Delivery</p>
                <p className="text-xs text-gray-400">Download immediately after purchase</p>
              </div>
            </>
          )}
        </div>

        {/* Live Access Status */}
        {user && (
          <div className={`flex items-start gap-4 p-4 rounded-xl border ${isOwned
            ? "bg-emerald-500/10 border-emerald-500/20"
            : "bg-white/[0.02] border-white/10"
            }`}>
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${isOwned ? "bg-emerald-500/15 text-emerald-400" : "bg-primary/10 text-primary"}`}>
              {ownershipLoading ? <Clock className="w-5 h-5 animate-pulse" /> : isOwned ? <Check className="w-5 h-5" /> : <ShoppingBag className="w-5 h-5" />}
            </div>
            <div className="flex-1">
              <p className="text-sm font-bold text-white">
                {ownershipLoading ? "Checking your account access..." : isOwned ? "Purchased in your account" : "Not purchased yet"}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {isOwned
                  ? `Access is active${purchaseAccess?.orderId ? ` from order ${purchaseAccess.orderId}` : ""}. Support can see this purchase if you need help.`
                  : "After checkout, access is saved to your account and support can help with this product."}
              </p>
            </div>
          </div>
        )}

        {/* Highlights Grid */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Key Highlights</h3>
          <div className="grid grid-cols-2 gap-3">
            {product.highlights.map((item, i) => (
              <div key={i} className="flex items-center gap-3 p-3.5 bg-white/[0.02] rounded-xl border border-white/5">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Check className="w-4 h-4 text-primary" />
                </div>
                <span className="text-[13px] text-gray-200 font-medium">{item.text}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Description */}
        <div>
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">About This Product</h3>
          <p className="text-[14px] text-gray-300 leading-relaxed">{product.description}</p>
        </div>

        {/* Trust Badges */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { icon: Shield, label: "Secure" },
            { icon: Clock, label: "Lifetime" },
            { icon: Award, label: "Premium" },
            { icon: Headphones, label: "Support" },
          ].map((item, i) => (
            <div key={i} className="flex flex-col items-center p-3 bg-white/[0.02] rounded-xl text-center">
              <item.icon className="w-5 h-5 text-primary mb-1.5" />
              <span className="text-[10px] text-gray-400 font-medium">{item.label}</span>
            </div>
          ))}
        </div>

        {/* Ratings Section */}
        <div className="pt-6 border-t border-white/5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Ratings & Reviews</h3>

          <div className="flex gap-6 p-5 bg-white/[0.02] rounded-2xl border border-white/5 mb-5">
            <div className="text-center pr-6 border-r border-white/5">
              <div className="text-4xl font-bold text-white mb-1">{product.rating}</div>
              <div className="flex justify-center gap-0.5 mb-1">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                ))}
              </div>
              <div className="text-[11px] text-gray-500">{product.reviewCount.toLocaleString()} reviews</div>
            </div>
            <div className="flex-1 space-y-2">
              {ratingBreakdown.map((item) => (
                <RatingBar key={item.stars} stars={item.stars} percentage={item.percentage} />
              ))}
            </div>
          </div>

          <div className="space-y-4">
            {displayedReviews.map((review, i) => (
              <ReviewCard key={i} review={review} />
            ))}
          </div>

          {reviews.length > 2 && (
            <button
              onClick={() => setShowAllReviews(!showAllReviews)}
              className="w-full mt-5 py-3.5 text-sm font-semibold text-primary border border-primary/30 rounded-xl hover:bg-primary/5 transition-colors"
            >
              {showAllReviews ? 'Show Less Reviews' : `View All ${reviews.length} Reviews`}
            </button>
          )}
        </div>

        {/* FAQ Section */}
        <div className="pt-6 border-t border-white/5">
          <h3 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Frequently Asked Questions</h3>
          <div className="bg-white/[0.02] rounded-2xl border border-white/5 px-5">
            {faqs.map((faq, i) => (
              <FAQItem key={i} question={faq.question} answer={faq.answer} />
            ))}
          </div>
        </div>

        {/* Seller Info */}
        <div className="p-5 bg-gradient-to-br from-primary/[0.03] to-transparent rounded-2xl border border-primary/10">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-xl bg-primary/20 flex items-center justify-center">
              <Package className="w-7 h-7 text-primary" />
            </div>
            <div className="flex-1">
              <p className="font-bold text-white text-sm mb-0.5">Dharma Divine Archives</p>
              <p className="text-xs text-gray-400">Official Store • Since 2020 • 5000+ Happy Customers</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 bg-black/95 backdrop-blur-xl border-t border-white/[0.06] z-50 md:hidden">
        <div className="flex items-center gap-4 p-4 max-w-3xl mx-auto">
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold text-white">₹{product.price}</span>
              <span className="text-xs text-gray-500 line-through">₹{product.originalPrice}</span>
            </div>
            <span className="text-[10px] text-emerald-400 font-semibold">{discount}% off • Limited Offer</span>
          </div>
          <Button
            size="lg"
            disabled={!isOwned && product.isPhysical && product.stockCount === 0}
            className={`h-12 px-8 text-sm font-bold rounded-xl shadow-lg ${isOwned ? "bg-emerald-600 hover:bg-emerald-700 text-white" : product.isPhysical && product.stockCount === 0 ? "bg-gray-800 text-gray-500" : "bg-primary text-black hover:bg-primary/90"}`}
            onClick={handleAction}
          >
            {isOwned ? (
              <><ExternalLink className="mr-2 w-4 h-4" /> Access Your Purchase</>
            ) : product.isPhysical && product.stockCount === 0 ? (
              "Out Of Stock"
            ) : (
              <><ShoppingBag className="mr-2 w-4 h-4" /> Buy Now</>
            )}
          </Button>
        </div>
      </div>

      {/* Desktop FAB */}
      <div className="hidden md:block fixed bottom-8 right-8 z-40">
        <Button
          size="lg"
          className={`h-14 px-8 text-base font-bold rounded-2xl shadow-2xl hover:scale-105 transition-transform ${isOwned ? "bg-emerald-600 hover:bg-emerald-700 text-white" : "bg-primary text-black"}`}
          onClick={handleAction}
        >
          {isOwned ? (
            <><ExternalLink className="mr-2 w-5 h-5" /> Access Your Purchase</>
          ) : (
            <><ShoppingBag className="mr-2 w-5 h-5" /> Buy Now • ₹{product.price}</>
          )}
        </Button>
      </div>

      {/* Recommended / Recently Viewed Section */}
      <div className="mt-12 md:mt-16">
        <RecentlyViewed />
      </div>
    </div>
  );
};

export default ProductDetail;
