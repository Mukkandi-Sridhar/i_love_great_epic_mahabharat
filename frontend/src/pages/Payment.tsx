import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  X,
  Lock,
  BadgeCheck,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/contexts/FirebaseContext";
import { getUserProfile, subscribeToProducts } from "@/services/db";
import { completeOrder, createRazorpayOrder } from "@/services/payment";
import { FALLBACK_PRODUCTS, Product } from "@/data/products";
import { BACKEND_URL } from "@/services/api";
import { usePageTitle } from "@/hooks/usePageTitle";

interface RazorpaySuccessResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

interface RazorpayCheckout {
  open: () => void;
}

declare global {
  interface Window {
    Razorpay?: new (options: Record<string, any>) => RazorpayCheckout;
  }
}

const Payment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useFirebase();

  const [catalog, setCatalog] = useState<Product[]>(FALLBACK_PRODUCTS);
  const product = useMemo(() => catalog.find((item) => item.id === id), [catalog, id]);
  usePageTitle(product ? `Checkout - ${product.title}` : "Checkout");

  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState(user?.email || "");
  const [name, setName] = useState(user?.displayName || "");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [pincode, setPincode] = useState("");
  const [state, setState] = useState("");
  const [altPhone, setAltPhone] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingProduct, setLoadingProduct] = useState(true);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; type: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const basePrice = product?.price || 0;
  const [finalPrice, setFinalPrice] = useState(0);

  useEffect(() => {
    const unsubscribe = subscribeToProducts((products) => {
      setCatalog(products.length > 0 ? products : FALLBACK_PRODUCTS);
      setLoadingProduct(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (product) setFinalPrice(product.price);
  }, [product]);

  useEffect(() => {
    if (!loadingProduct && !product) {
      navigate("/explore", { replace: true });
    }
  }, [loadingProduct, navigate, product]);

  useEffect(() => {
    const load = async () => {
      if (!user) return;
      if (user.email) setEmail(user.email);
      if (user.displayName) setName(user.displayName);
      try {
        const profile = await getUserProfile(user.uid);
        if (profile) {
          if (profile.phone) setPhone(profile.phone);
          if (profile.name) setName(profile.name);
        }
      } catch {
        // Profile hydration is optional for checkout.
      }
    };
    load();
  }, [user]);

  const type = searchParams.get("type");
  const isPhysical = product?.type === "sdcard" || product?.type === "pendrive" || type === "sdcard" || type === "pendrive";
  const isLocalBackend = BACKEND_URL.includes("localhost") || BACKEND_URL.includes("127.0.0.1");
  const paymentBypassEnabled = import.meta.env.DEV || isLocalBackend || import.meta.env.VITE_ENABLE_PAYMENT_BYPASS === "true";

  const missingFields = useMemo(() => {
    const missing: string[] = [];
    if (!/^[6-9]\d{9}$/.test(phone)) missing.push("valid WhatsApp number");
    if (!email.trim()) missing.push("email");
    if (isPhysical) {
      if (!name.trim()) missing.push("full name");
      if (!address.trim()) missing.push("address");
      if (!city.trim()) missing.push("city");
      if (!/^\d{6}$/.test(pincode)) missing.push("6-digit pincode");
      if (!state.trim()) missing.push("state");
    }
    return missing;
  }, [address, city, email, isPhysical, name, phone, pincode, state]);

  const isFormIncomplete = missingFields.length > 0;

  const validateCoupon = async () => {
    if (!couponCode) return;
    setValidatingCoupon(true);
    try {
      const res = await fetch(`${BACKEND_URL}/validate-coupon`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: couponCode, amount: basePrice }),
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon({ code: couponCode, discount: data.discount, type: data.type });
        setFinalPrice(data.final_amount);
        toast({ title: "Applied!", description: `Rs.${data.discount} discount applied.` });
      } else {
        toast({ title: "Invalid Code", variant: "destructive" });
        setAppliedCoupon(null);
        setFinalPrice(basePrice);
      }
    } catch {
      toast({ title: "Error", description: "Server unreachable.", variant: "destructive" });
    } finally {
      setValidatingCoupon(false);
    }
  };

  const validateCheckout = () => {
    if (!user) {
      navigate("/auth");
      return false;
    }
    if (!product) {
      navigate("/explore", { replace: true });
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(phone)) {
      toast({ title: "Required", description: "Please enter a valid WhatsApp number.", variant: "destructive" });
      return false;
    }
    if (isPhysical && !/^\d{6}$/.test(pincode)) {
      toast({ title: "Required", description: "Please enter a valid 6-digit pincode.", variant: "destructive" });
      return false;
    }
    if (isPhysical && (!name || !address || !city || !pincode || !state)) {
      toast({ title: "Required", description: "Please complete the shipping address.", variant: "destructive" });
      return false;
    }
    return true;
  };

  const submitCompletedOrder = async (payment: {
    mode: string;
    ref: string;
    test: boolean;
    transactionDetails: Record<string, any>;
  }) => {
    if (!user || !product) return;
    try {
      setLoading(true);
      const result = await completeOrder({
        uid: user.uid,
        email: user.email || email,
        name: user.displayName || name,
        phone,
        productType: product.type,
        productId: id || "",
        productTitle: product.title,
        productLanguage: product.language,
        productImage: product.image,
        basePrice: product.price,
        couponCode: appliedCoupon?.code,
        shipping: isPhysical ? { name, address, city, pincode, state, altPhone } : undefined,
        downloadLink: product.driveLink,
        paymentMode: payment.mode,
        paymentRef: payment.ref,
        testPayment: payment.test,
        transactionDetails: payment.transactionDetails,
        razorpayOrderId: payment.transactionDetails.razorpay_order_id,
        razorpayPaymentId: payment.transactionDetails.razorpay_payment_id,
        razorpaySignature: payment.transactionDetails.razorpay_signature,
      });

      if (!result.success) {
        toast({ title: "Failed", description: result.error, variant: "destructive" });
        return;
      }
      navigate("/thank-you", {
        state: {
          mode: isPhysical ? "physical-paid" : "prepaid",
          orderId: result.orderId,
          transactionId: result.transactionId || payment.ref,
          phone,
        },
      });
    } catch {
      toast({ title: "Error", description: "Failed to create order.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const loadRazorpaySdk = async () => {
    if (window.Razorpay) return true;
    const existingScript = document.querySelector<HTMLScriptElement>('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    if (existingScript) {
      await new Promise((resolve, reject) => {
        existingScript.addEventListener("load", resolve, { once: true });
        existingScript.addEventListener("error", reject, { once: true });
      });
      return Boolean(window.Razorpay);
    }

    return new Promise<boolean>((resolve) => {
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.async = true;
      script.onload = () => resolve(Boolean(window.Razorpay));
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handlePayment = async () => {
    if (!validateCheckout() || !user || !product) return;

    setLoading(true);
    try {
      const sdkReady = await loadRazorpaySdk();
      if (!sdkReady || !window.Razorpay) {
        if (paymentBypassEnabled) {
          toast({
            title: "Using test payment",
            description: "Razorpay checkout could not load, so a test transaction will be saved.",
          });
          await handlePaymentBypass();
          return;
        }
        toast({ title: "Payment unavailable", description: "Could not load Razorpay checkout.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const order = await createRazorpayOrder({ uid: user.uid, amount: finalPrice });
      const razorpayKey = order.key || import.meta.env.VITE_RAZORPAY_KEY_ID;
      if (!order.success || !order.orderId || !razorpayKey) {
        if (paymentBypassEnabled) {
          toast({
            title: "Using test payment",
            description: order.error || "Razorpay could not start, so a test transaction will be saved.",
          });
          await handlePaymentBypass();
          return;
        }
        toast({ title: "Payment unavailable", description: order.error || "Could not start payment.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const checkout = new window.Razorpay({
        key: razorpayKey,
        amount: Math.round(finalPrice * 100),
        currency: order.currency || "INR",
        name: "I Love Great Epic Mahabharat",
        description: product.title,
        image: product.image,
        order_id: order.orderId,
        prefill: { name, email, contact: phone },
        notes: {
          uid: user.uid,
          product_id: product.id,
          product_type: product.type,
        },
        theme: { color: "#D4AF37" },
        handler: async (response: RazorpaySuccessResponse) => {
          await submitCompletedOrder({
            mode: "razorpay",
            ref: response.razorpay_payment_id,
            test: false,
            transactionDetails: {
              transaction_id: response.razorpay_payment_id,
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              gateway: "razorpay",
              status: "captured",
              amount: finalPrice,
              currency: "INR",
              paid_at: new Date().toISOString(),
            },
          });
        },
        modal: {
          ondismiss: () => setLoading(false),
        },
      });
      checkout.open();
    } catch {
      if (paymentBypassEnabled) {
        toast({
          title: "Using test payment",
          description: "Payment gateway failed, so a test transaction will be saved.",
        });
        await handlePaymentBypass();
        return;
      }
      toast({ title: "Payment failed", description: "Please try again.", variant: "destructive" });
      setLoading(false);
    }
  };

  const makeTestPaymentId = (prefix: string) => {
    const suffix = window.crypto?.randomUUID?.().replace(/-/g, "").slice(0, 14) || Math.random().toString(36).slice(2, 16);
    return `${prefix}_test_${Date.now()}_${suffix}`;
  };

  const handlePaymentBypass = async () => {
    if (!validateCheckout() || !user || !product) return;

    const now = new Date();
    const fakeOrderId = makeTestPaymentId("order");
    const fakePaymentId = makeTestPaymentId("pay");
    const fakeSignature = makeTestPaymentId("sig");

    await submitCompletedOrder({
      mode: "payment_bypass",
      ref: fakePaymentId,
      test: true,
      transactionDetails: {
        transaction_id: fakePaymentId,
        razorpay_order_id: fakeOrderId,
        razorpay_payment_id: fakePaymentId,
        razorpay_signature: fakeSignature,
        gateway: "razorpay_test_bypass",
        method: "payment_bypass",
        status: "captured",
        amount: finalPrice,
        currency: "INR",
        paid_at: now.toISOString(),
        test: true,
        bypass: true,
      },
    });
  };

  if (loadingProduct) {
    return (
      <div className="min-h-screen bg-[#050505] text-white pb-20">
        <header className="px-5 h-16 flex items-center justify-between border-b border-white/5 bg-black/40 sticky top-0 z-50 backdrop-blur-md">
          <Skeleton className="h-9 w-9 rounded-full bg-white/10" />
          <Skeleton className="h-4 w-24 bg-white/10" />
          <div className="w-9" />
        </header>
        <div className="max-w-[480px] mx-auto px-5 py-8 space-y-8">
          <Skeleton className="h-28 rounded-3xl bg-white/10" />
          <Skeleton className="h-40 rounded-3xl bg-white/10" />
          <Skeleton className="h-52 rounded-3xl bg-white/10" />
        </div>
      </div>
    );
  }

  if (!product) return null;

  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-primary/30 font-sans pb-20">
      <header className="px-5 h-16 flex items-center justify-between border-b border-white/5 bg-black/40 sticky top-0 z-50 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-full transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-center">
          <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Checkout</h1>
          <p className="text-[8px] text-gray-600 font-bold uppercase">Safe & Secure</p>
        </div>
        <div className="w-9" />
      </header>

      <div className="max-w-[480px] mx-auto px-5 py-8 space-y-10">
        <div className="flex items-center gap-5 p-4 bg-white/[0.02] rounded-3xl border border-white/5">
          <div className="w-20 h-20 bg-black/40 rounded-2xl p-2 border border-white/5 flex items-center justify-center shrink-0">
            <img src={product.image} alt={product.title} className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate uppercase tracking-tight">{product.title}</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
              {product.type === "ebook" ? "Digital Access" : "Physical Artifact"}
            </p>
            <p className="text-lg font-black text-primary mt-1">Rs.{finalPrice}</p>
            {finalPrice > 999 && (
              <span className="mt-2 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                Free Delivery
              </span>
            )}
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">1</div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Contact Details</h3>
            </div>

            <div className="grid gap-4">
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-bold text-gray-500 tracking-wider ml-1">WhatsApp Number</Label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-500 pr-3 border-r border-white/10">+91</span>
                  <Input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    className="h-12 bg-black border-white/10 rounded-xl pl-14 focus:border-primary/50 text-base font-mono"
                    placeholder="93928xxxxx"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label className="text-[9px] uppercase font-bold text-gray-500 tracking-wider ml-1">Email Address</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 bg-black border-white/10 rounded-xl px-4 focus:border-primary/50"
                  placeholder="your@email.com"
                />
              </div>
            </div>
          </div>

          {isPhysical && (
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">2</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Shipping Details</h3>
              </div>
              <div className="grid gap-3">
                <Input placeholder="Full Name" value={name} onChange={(e) => setName(e.target.value)} className="h-12 bg-black border-white/10 rounded-xl" />
                <Input placeholder="House No, Street, Area" value={address} onChange={(e) => setAddress(e.target.value)} className="h-12 bg-black border-white/10 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="City" value={city} onChange={(e) => setCity(e.target.value)} className="h-12 bg-black border-white/10 rounded-xl" />
                  <Input placeholder="Pincode" value={pincode} onChange={(e) => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="h-12 bg-black border-white/10 rounded-xl font-mono" />
                </div>
                <Input placeholder="State" value={state} onChange={(e) => setState(e.target.value)} className="h-12 bg-black border-white/10 rounded-xl" />
              </div>
            </div>
          )}

          <div className="space-y-4 pt-4 border-t border-white/5">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">{isPhysical ? 3 : 2}</div>
              <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Promo Code</h3>
            </div>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Input
                  placeholder="OPTIONAL"
                  value={couponCode}
                  onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
                  disabled={!!appliedCoupon}
                  className="h-12 bg-black border-white/10 rounded-xl font-mono px-4 tracking-[0.2em] text-primary"
                />
                {appliedCoupon && (
                  <button
                    onClick={() => {
                      setAppliedCoupon(null);
                      setFinalPrice(basePrice);
                      setCouponCode("");
                    }}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500/50 p-1"
                  >
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
              {!appliedCoupon && (
                <Button onClick={validateCoupon} disabled={!couponCode || validatingCoupon} className="h-12 px-6 bg-white/5 hover:bg-white/10 rounded-xl text-[10px] font-black uppercase border border-white/10">
                  Apply
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="pt-10 space-y-6">
          <div className="flex items-end justify-between px-2">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Payable</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white px-1">Rs.{finalPrice}</span>
                {appliedCoupon && (
                  <span className="text-sm text-emerald-500 font-bold">(-Rs.{appliedCoupon.discount})</span>
                )}
              </div>
            </div>
            <div className="text-right hidden sm:block">
              <div className="flex items-center gap-2 text-[9px] font-bold text-gray-500 uppercase tracking-widest mb-1">
                <Lock className="w-3 h-3 text-emerald-500" /> Secure Encryption
              </div>
              <p className="text-[8px] text-gray-600">256-bit SSL Protected</p>
            </div>
          </div>

          <div title={isFormIncomplete ? `Missing: ${missingFields.join(", ")}` : "Ready to pay"}>
            <Button
              onClick={handlePayment}
              disabled={loading || isFormIncomplete}
              className="w-full h-16 rounded-[1.5rem] bg-primary text-black text-base font-black uppercase tracking-widest shadow-[0_15px_30px_-10px_rgba(212,175,55,0.4)] hover:scale-[1.01] active:scale-95 transition-all disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? "Processing..." : "Pay Now"}
            </Button>
          </div>

          {paymentBypassEnabled && (
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={handlePaymentBypass}
                disabled={loading || isFormIncomplete}
                className="w-full h-12 rounded-2xl border-amber-500/30 bg-amber-500/10 text-amber-200 hover:bg-amber-500/20"
              >
                Generate Test Payment
              </Button>
              <p className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-200">
                Test bypass is enabled. It creates Razorpay-shaped transaction details and saves them through the same order flow.
              </p>
            </div>
          )}

          <div className="flex justify-center gap-6 pt-4 grayscale opacity-30">
            <BadgeCheck className="w-5 h-5" />
            <ShieldCheck className="w-5 h-5" />
            <Lock className="w-5 h-5" />
            <Zap className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
};

export default Payment;
