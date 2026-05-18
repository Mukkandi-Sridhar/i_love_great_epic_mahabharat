import { useState, useEffect, useMemo } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ShieldCheck,
  X,
  Lock,
  BadgeCheck,
  Zap,
  CreditCard
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { useFirebase } from "@/contexts/FirebaseContext";
import { getUserProfile } from "@/services/db";
import { completeOrder } from "@/services/payment";
import { allProducts } from "@/data/products";
import { BACKEND_URL } from "@/services/api";

const Payment = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const { user } = useFirebase();

  const product = useMemo(() => allProducts.find(p => p.id === id), [id]);

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
  const [fakeGatewayOpen, setFakeGatewayOpen] = useState(false);
  const [fakeGatewayProcessing, setFakeGatewayProcessing] = useState(false);

  const [couponCode, setCouponCode] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number; type: string } | null>(null);
  const [validatingCoupon, setValidatingCoupon] = useState(false);

  const basePrice = product?.price || 0;
  const [finalPrice, setFinalPrice] = useState(0);

  useEffect(() => {
    setLoadingProduct(false);
    if (product) setFinalPrice(product.price);
  }, [product]);

  useEffect(() => {
    if (!loadingProduct && !product) {
      navigate("/explore", { replace: true });
    }
  }, [loadingProduct, navigate, product]);

  useEffect(() => {
    const load = async () => {
      if (user) {
        if (user.email) setEmail(user.email);
        if (user.displayName) setName(user.displayName);
        try {
          const profile = await getUserProfile(user.uid);
          if (profile) {
            if (profile.phone) setPhone(profile.phone);
            if (profile.name) setName(profile.name);
          }
        } catch (e) { }
      }
    };
    load();
  }, [user]);

  const type = searchParams.get("type");
  const isPhysical = product?.type === "sdcard" || product?.type === "pendrive" || type === "sdcard" || type === "pendrive";
  const fakePaymentEnabled = import.meta.env.DEV || import.meta.env.VITE_ENABLE_FAKE_PAYMENT === "true";

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
        body: JSON.stringify({ code: couponCode, amount: basePrice })
      });
      const data = await res.json();
      if (res.ok && data.valid) {
        setAppliedCoupon({ code: couponCode, discount: data.discount, type: data.type });
        setFinalPrice(data.final_amount);
        toast({ title: "Applied!", description: `₹${data.discount} discount applied.` });
      } else {
        toast({ title: "Invalid Code", variant: "destructive" });
        setAppliedCoupon(null);
        setFinalPrice(basePrice);
      }
    } catch (e) {
      toast({ title: "Error", description: "Server unreachable.", variant: "destructive" });
    } finally {
      setValidatingCoupon(false);
    }
  };

  const validateCheckout = () => {
    if (!user) { navigate("/auth"); return; }
    if (!product) { navigate("/explore", { replace: true }); return; }
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

  const submitCompletedOrder = async (payment?: { mode: string; ref: string; test: boolean }) => {
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
        paymentMode: payment?.mode,
        paymentRef: payment?.ref,
        testPayment: payment?.test,
      });

      if (!result.success) {
        toast({ title: "Failed", description: result.error, variant: "destructive" });
        return;
      }
      navigate("/thank-you", { state: { mode: isPhysical ? "physical-paid" : "prepaid", orderId: result.orderId, phone } });
    } catch (e) {
      toast({ title: "Error", description: "Failed to create order.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handlePayment = async () => {
    if (!validateCheckout()) return;

    if (fakePaymentEnabled) {
      setFakeGatewayOpen(true);
      return;
    }

    await submitCompletedOrder();
  };

  const simulateSandboxPayment = async (outcome: "success" | "failure") => {
    if (!validateCheckout()) return;

    setFakeGatewayProcessing(true);
    await new Promise((resolve) => setTimeout(resolve, 900));

    if (outcome === "failure") {
      setFakeGatewayProcessing(false);
      toast({
        title: "Sandbox payment failed",
        description: "No order was created. Try the success path when you are ready.",
        variant: "destructive",
      });
      return;
    }

    const paymentRef = `sandbox_${Date.now()}`;
    setFakeGatewayOpen(false);
    setFakeGatewayProcessing(false);
    await submitCompletedOrder({
      mode: "sandbox_gateway",
      ref: paymentRef,
      test: true,
    });
  };

  if (loadingProduct || (finalPrice === 0 && !appliedCoupon)) {
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
      {/* Mini Top Bar */}
      <header className="px-5 h-16 flex items-center justify-between border-b border-white/5 bg-black/40 sticky top-0 z-50 backdrop-blur-md">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-white/5 rounded-full transition-all">
          <ArrowLeft className="w-5 h-5 text-gray-400" />
        </button>
        <div className="text-center">
          <h1 className="text-[10px] font-black uppercase tracking-[0.2em] text-primary">Checkout</h1>
          <p className="text-[8px] text-gray-600 font-bold uppercase">Safe & Secure</p>
        </div>
        <div className="w-9" /> {/* Spacer */}
      </header>

      <div className="max-w-[480px] mx-auto px-5 py-8 space-y-10">

        {/* Simplified Product Header */}
        <div className="flex items-center gap-5 p-4 bg-white/[0.02] rounded-3xl border border-white/5">
          <div className="w-20 h-20 bg-black/40 rounded-2xl p-2 border border-white/5 flex items-center justify-center shrink-0">
            <img src={product.image} alt={product.title} className="w-full h-full object-contain" />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-bold truncate uppercase tracking-tight">{product.title}</h2>
            <p className="text-[10px] text-gray-500 uppercase tracking-widest mt-1">
              {product.type === 'ebook' ? "Digital Access" : "Physical Artifact"}
            </p>
            <p className="text-lg font-black text-primary mt-1">₹{finalPrice}</p>
            {finalPrice > 999 && (
              <span className="mt-2 inline-flex rounded-full border border-emerald-500/20 bg-emerald-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-widest text-emerald-400">
                Free Delivery
              </span>
            )}
          </div>
        </div>

        {/* Unified Form */}
        <div className="space-y-8">
          {/* 1. Contact Info */}
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
                    onChange={e => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
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
                  onChange={e => setEmail(e.target.value)}
                  className="h-12 bg-black border-white/10 rounded-xl px-4 focus:border-primary/50"
                  placeholder="your@email.com"
                />
              </div>
            </div>
          </div>

          {/* 2. Shipping Info (Conditionally Rendered) */}
          {isPhysical && (
            <div className="space-y-4 pt-4 border-t border-white/5">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-[10px] font-black text-primary">2</div>
                <h3 className="text-xs font-black uppercase tracking-widest text-gray-400">Shipping Details</h3>
              </div>
              <div className="grid gap-3">
                <Input placeholder="Full Name" value={name} onChange={e => setName(e.target.value)} className="h-12 bg-black border-white/10 rounded-xl" />
                <Input placeholder="House No, Street, Area" value={address} onChange={e => setAddress(e.target.value)} className="h-12 bg-black border-white/10 rounded-xl" />
                <div className="grid grid-cols-2 gap-3">
                  <Input placeholder="City" value={city} onChange={e => setCity(e.target.value)} className="h-12 bg-black border-white/10 rounded-xl" />
                  <Input placeholder="Pincode" value={pincode} onChange={e => setPincode(e.target.value.replace(/\D/g, "").slice(0, 6))} className="h-12 bg-black border-white/10 rounded-xl font-mono" />
                </div>
                <Input placeholder="State" value={state} onChange={e => setState(e.target.value)} className="h-12 bg-black border-white/10 rounded-xl" />
              </div>
            </div>
          )}

          {/* 3. Promo Code */}
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
                  onChange={e => setCouponCode(e.target.value.toUpperCase())}
                  disabled={!!appliedCoupon}
                  className="h-12 bg-black border-white/10 rounded-xl font-mono px-4 tracking-[0.2em] text-primary"
                />
                {appliedCoupon && (
                  <button onClick={() => { setAppliedCoupon(null); setFinalPrice(basePrice); setCouponCode(""); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-red-500/50 p-1">
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

        {/* Final Payment Panel */}
        <div className="pt-10 space-y-6">
          <div className="flex items-end justify-between px-2">
            <div>
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest mb-1">Total Payable</p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-black text-white px-1">₹{finalPrice}</span>
                {appliedCoupon && (
                  <span className="text-sm text-emerald-500 font-bold">(-₹{appliedCoupon.discount})</span>
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
              {loading ? "Processing..." : fakePaymentEnabled ? "Open Sandbox Gateway" : "Pay & Start Journey"}
            </Button>
          </div>

          {fakePaymentEnabled && (
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-[11px] text-amber-200">
              Sandbox checkout is enabled for local testing. No real money will be charged.
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

      {fakeGatewayOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 px-5 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-3xl border border-white/10 bg-[#080808] p-5 shadow-2xl">
            <div className="mb-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full border border-primary/20 bg-primary/10 text-primary">
                  <CreditCard className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-widest text-white">Sandbox Gateway</h3>
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500">Testing only</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setFakeGatewayOpen(false)}
                disabled={fakeGatewayProcessing}
                className="rounded-full p-2 text-gray-500 hover:bg-white/5 hover:text-white disabled:opacity-40"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-3 rounded-2xl border border-white/5 bg-white/[0.03] p-4">
              <div className="flex justify-between gap-4 text-xs">
                <span className="text-gray-500">Product</span>
                <span className="truncate text-right font-bold text-white">{product.title}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Amount</span>
                <span className="font-black text-primary">Rs.{finalPrice}</span>
              </div>
              <div className="flex justify-between text-xs">
                <span className="text-gray-500">Customer</span>
                <span className="truncate text-right text-white">{email}</span>
              </div>
            </div>

            <p className="my-5 text-xs leading-relaxed text-gray-400">
              Choose success to create a paid test order and grant access. Choose failure to verify the failed-payment UI without creating an order.
            </p>

            <div className="space-y-3">
              <Button
                type="button"
                onClick={() => simulateSandboxPayment("success")}
                disabled={fakeGatewayProcessing}
                className="h-12 w-full rounded-xl bg-primary text-black font-black uppercase tracking-widest hover:bg-primary/90"
              >
                {fakeGatewayProcessing ? "Processing..." : "Simulate Success"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => simulateSandboxPayment("failure")}
                disabled={fakeGatewayProcessing}
                className="h-12 w-full rounded-xl border-red-500/20 bg-red-500/10 text-red-300 hover:bg-red-500/20"
              >
                Simulate Failure
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Payment;
