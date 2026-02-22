import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Download, ZoomIn, ZoomOut, Lock, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState, useEffect } from "react";
import { useFirebase } from "@/contexts/FirebaseContext";
import { subscribeToOwnedProductIds } from "@/services/db";

const PDFViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useFirebase();
  const [zoom, setZoom] = useState(100);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }

    if (!id) return;

    // Real-time ownership enforcement
    const unsubscribe = subscribeToOwnedProductIds(user.uid, (ownedIds) => {
      const allowed = ownedIds.has(id);
      setIsAllowed(allowed);
      if (!allowed) {
        console.warn(`[Security] Unauthorized access to PDF: ${id}. Redirecting...`);
        // Small delay to allow user to see the "Restricted" state or just redirect
        setTimeout(() => navigate(`/product/${id}`), 2000);
      }
    });

    return () => unsubscribe();
  }, [user, id, authLoading, navigate]);

  // PDF URL will be fetched from Firestore/Storage later
  const pdfUrl: string | null = null;

  if (authLoading || isAllowed === null) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-primary">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">Verifying Sacred Access...</p>
      </div>
    );
  }

  if (isAllowed === false) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-red-500/10 rounded-full flex items-center justify-center mb-6 border border-red-500/20">
          <Lock className="w-10 h-10 text-red-500" />
        </div>
        <h2 className="text-2xl font-bold text-white mb-2">Access Restricted</h2>
        <p className="text-gray-400 max-w-sm mb-8">This content requires a valid purchase. Redirecting you to the product page...</p>
        <Button onClick={() => navigate(`/product/${id}`)}>Go to Product</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between px-4 h-14">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/collection")}
              className="p-2 hover:bg-muted rounded-lg transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-lg font-serif font-semibold">Sacred Mahabharat</h1>
          </div>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(Math.max(50, zoom - 10))}
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <span className="text-sm font-medium w-12 text-center">{zoom}%</span>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setZoom(Math.min(200, zoom + 10))}
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button size="sm" variant="outline">
              <Download className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* PDF Viewer */}
      <main className="flex-1 overflow-auto bg-muted/30">
        <div className="container mx-auto py-6">
          {pdfUrl ? (
            <div
              className="bg-white shadow-elegant-lg rounded-lg overflow-hidden mx-auto"
              style={{
                width: `${zoom}%`,
                maxWidth: '100%',
                minHeight: '80vh'
              }}
            >
              <iframe
                src={pdfUrl}
                className="w-full h-full min-h-[80vh]"
                title="PDF Viewer"
              />
            </div>
          ) : (
            <div className="bg-card border border-border rounded-xl p-6 text-center">
              <p className="text-muted-foreground">No PDF available for this item.</p>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default PDFViewer;
