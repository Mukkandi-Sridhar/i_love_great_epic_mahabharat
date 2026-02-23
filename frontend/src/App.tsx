import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import { ReactNode, useEffect, Suspense, lazy } from "react";
import { FirebaseProvider } from "./contexts/FirebaseContext";
import { SettingsProvider, useSettings } from "./context/SettingsContext";

// Lazy Load Pages
// Lazy Load Pages
const Explore = lazy(() => import("./pages/Explore"));
const AllProducts = lazy(() => import("./pages/AllProducts"));
const ProductDetail = lazy(() => import("./pages/ProductDetail"));
const Payment = lazy(() => import("./pages/Payment"));
const ThankYou = lazy(() => import("./pages/ThankYou"));
const Auth = lazy(() => import("./pages/Auth"));
const Collection = lazy(() => import("./pages/Collection"));
const Support = lazy(() => import("./pages/Support"));
const Profile = lazy(() => import("./pages/Profile"));
const ProfileDetails = lazy(() => import("./pages/ProfileDetails"));
const Terms = lazy(() => import("./pages/Terms"));
const About = lazy(() => import("./pages/About"));
const Rate = lazy(() => import("./pages/Rate"));
const Notifications = lazy(() => import("./pages/Notifications"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PDFViewer = lazy(() => import("./pages/PDFViewer"));
// New Footer Pages
const Privacy = lazy(() => import("./pages/Privacy"));
const FAQs = lazy(() => import("./pages/FAQs"));
const Shipping = lazy(() => import("./pages/Shipping"));
const Refunds = lazy(() => import("./pages/Refunds"));

import RequireAuth from "./components/RequireAuth";
import AdminGuard from "./components/AdminGuard";

// Admin Pages
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminOrders = lazy(() => import("./pages/admin/AdminOrders"));
const AdminTickets = lazy(() => import("./pages/admin/AdminTickets"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminProducts = lazy(() => import("./pages/admin/AdminProducts"));
const AdminCoupons = lazy(() => import("./pages/admin/AdminCoupons"));
const AdminAccess = lazy(() => import("./pages/admin/AdminAccess"));
const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminSettings = lazy(() => import("./pages/admin/AdminSettings"));

const queryClient = new QueryClient();

import Layout from "./components/Layout";

import DivineBackground from "./components/DivineBackground";
import CustomCursor from "./components/CustomCursor";
import { useRoutePrefetch } from "./hooks/usePrefetch";

import BackgroundMusic from "./components/BackgroundMusic";

const AppProviders = ({ children }: { children: ReactNode }) => {
  const { settings, loading: settingsLoading } = useSettings();



  if (settingsLoading) return null;

  if (settings?.maintenanceMode && !window.location.pathname.startsWith("/admin")) {
    return (
      <div className="fixed inset-0 z-[9999] bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-24 h-24 bg-primary/10 rounded-full flex items-center justify-center mb-8 animate-pulse text-primary border border-primary/20">
          <svg className="w-12 h-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        </div>
        <h1 className="text-4xl font-bold text-white mb-3">Divine Maintenance</h1>
        <p className="text-gray-400 max-w-md text-lg leading-relaxed">The Dharma Divine experience is currently being refined for excellence. We'll be back online momentarily.</p>
        <div className="mt-8 text-xs text-primary font-mono tracking-widest opacity-50 uppercase">Om Namo Narayanaya</div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <FirebaseProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <DivineBackground />
          <CustomCursor />
          <BackgroundMusic />
          {children}
        </TooltipProvider>
      </FirebaseProvider>
    </QueryClientProvider>
  );
};

const AppRoutes = () => (
  <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
    <Layout>
      <Suspense fallback={
        <div className="flex items-center justify-center min-h-screen bg-black text-primary">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
        </div>
      }>
        <Routes>
          <Route path="/" element={<Explore />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="/explore" element={<Explore />} />
          <Route path="/all-products" element={<AllProducts />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/payment/:id" element={<Payment />} />
          <Route path="/thank-you" element={<ThankYou />} />
          <Route path="/collection" element={<RequireAuth><Collection /></RequireAuth>} />
          <Route path="/support" element={<RequireAuth><Support /></RequireAuth>} />
          <Route path="/profile" element={<RequireAuth><Profile /></RequireAuth>} />
          <Route path="/profile/details" element={<RequireAuth><ProfileDetails /></RequireAuth>} />

          <Route path="/profile/terms" element={<Terms />} />
          <Route path="/profile/about" element={<About />} />
          <Route path="/profile/rate" element={<Rate />} />
          <Route path="/notifications" element={<RequireAuth><Notifications /></RequireAuth>} />
          <Route path="/pdf/:id" element={<RequireAuth><PDFViewer /></RequireAuth>} />

          {/* Footer Pages Routes */}
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/faqs" element={<FAQs />} />
          <Route path="/shipping" element={<Shipping />} />
          <Route path="/refunds" element={<Refunds />} />
          <Route path="/terms" element={<Terms />} />

          {/* Admin Panel Routes */}
          <Route path="/admin" element={<AdminGuard><AdminDashboard /></AdminGuard>} />
          <Route path="/admin/orders" element={<AdminGuard><AdminOrders /></AdminGuard>} />
          <Route path="/admin/tickets" element={<AdminGuard><AdminTickets /></AdminGuard>} />
          <Route path="/admin/users" element={<AdminGuard><AdminUsers /></AdminGuard>} />
          <Route path="/admin/products" element={<AdminGuard><AdminProducts /></AdminGuard>} />
          <Route path="/admin/coupons" element={<AdminGuard><AdminCoupons /></AdminGuard>} />
          <Route path="/admin/access" element={<AdminGuard><AdminAccess /></AdminGuard>} />
          <Route path="/admin/notifications" element={<AdminGuard><AdminNotifications /></AdminGuard>} />
          <Route path="/admin/settings" element={<AdminGuard><AdminSettings /></AdminGuard>} />

          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </Layout>
  </BrowserRouter>
);

import GlobalErrorBoundary from "./components/GlobalErrorBoundary";


const App = () => (
  <GlobalErrorBoundary>
    <SettingsProvider>
      <AppProviders>
        <AppRoutes />
      </AppProviders>
    </SettingsProvider>
  </GlobalErrorBoundary>
);

export default App;
