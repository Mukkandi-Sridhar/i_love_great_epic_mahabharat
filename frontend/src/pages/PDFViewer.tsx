import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  ExternalLink,
  ZoomIn,
  ZoomOut,
  Lock,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCcw,
  FileWarning,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useFirebase } from "@/contexts/FirebaseContext";
import { PurchaseAccess, subscribeToPurchaseAccess } from "@/services/db";
import { usePageTitle } from "@/hooks/usePageTitle";
import { resolveDocumentSource } from "@/lib/documentUrl";
import { cn } from "@/lib/utils";

const MIN_ZOOM = 50;
const MAX_ZOOM = 200;
const ZOOM_STEP = 10;

const PDFViewer = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useFirebase();
  const [zoom, setZoom] = useState(100);
  const [purchase, setPurchase] = useState<PurchaseAccess | null>(null);
  const [isAllowed, setIsAllowed] = useState<boolean | null>(null);
  const [frameLoaded, setFrameLoaded] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const shellRef = useRef<HTMLDivElement>(null);

  usePageTitle(purchase?.title ? `Reading - ${purchase.title}` : "Reader");

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!id) return;

    // Ownership is enforced live: a revoked purchase closes the reader even if
    // the tab was already open.
    const unsubscribe = subscribeToPurchaseAccess(
      user.uid,
      id,
      (record) => {
        const active =
          !!record && (record.accessStatus ?? record.status ?? "active") !== "revoked";
        setPurchase(record);
        setIsAllowed(active);
        if (!active) {
          setTimeout(() => navigate(`/product/${id}`), 2500);
        }
      },
      () => setIsAllowed(false)
    );

    return () => unsubscribe();
  }, [user, id, authLoading, navigate]);

  const source = useMemo(
    () => resolveDocumentSource(purchase?.downloadLink || purchase?.driveLink),
    [purchase?.downloadLink, purchase?.driveLink]
  );

  // Drive renders inside an opaque iframe, so CSS zoom would scale the whole
  // widget rather than the page; its own controls handle zoom instead.
  const zoomEnabled = Boolean(source.embedUrl) && !source.isDriveEmbed;

  useEffect(() => {
    setFrameLoaded(false);
  }, [source.embedUrl]);

  const toggleFullscreen = useCallback(async () => {
    const el = shellRef.current;
    if (!el) return;
    try {
      if (!document.fullscreenElement) {
        await el.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // Fullscreen can be blocked by browser policy; the reader stays usable.
    }
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!zoomEnabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "=" || e.key === "+") {
        e.preventDefault();
        setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP));
      } else if (e.key === "-") {
        e.preventDefault();
        setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP));
      } else if (e.key === "0") {
        e.preventDefault();
        setZoom(100);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zoomEnabled]);

  if (authLoading || isAllowed === null) {
    return (
      <div className="min-h-screen bg-black flex flex-col items-center justify-center text-primary">
        <Loader2 className="w-10 h-10 animate-spin mb-4" />
        <p className="text-sm font-medium animate-pulse">Verifying access...</p>
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
        <p className="text-gray-400 max-w-sm mb-8">
          This content requires a valid purchase. Taking you to the product page...
        </p>
        <Button onClick={() => navigate(`/product/${id}`)}>Go to Product</Button>
      </div>
    );
  }

  return (
    <div ref={shellRef} className="min-h-screen bg-background flex flex-col">
      <header className="sticky top-0 z-40 bg-card/95 backdrop-blur border-b border-border">
        <div className="flex items-center justify-between gap-2 px-3 md:px-6 h-14">
          <div className="flex items-center gap-2 md:gap-3 min-w-0">
            <button
              onClick={() => navigate("/collection")}
              aria-label="Back to collection"
              className="p-2 hover:bg-muted rounded-lg transition-colors shrink-0"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <h1 className="text-sm md:text-lg font-serif font-semibold truncate">
              {purchase?.title || "Sacred Library"}
            </h1>
          </div>

          <div className="flex items-center gap-1 md:gap-2 shrink-0">
            {zoomEnabled && (
              <div className="hidden sm:flex items-center gap-1 md:gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Zoom out"
                  disabled={zoom <= MIN_ZOOM}
                  onClick={() => setZoom((z) => Math.max(MIN_ZOOM, z - ZOOM_STEP))}
                >
                  <ZoomOut className="w-4 h-4" />
                </Button>
                <button
                  onClick={() => setZoom(100)}
                  title="Reset zoom"
                  className="text-xs md:text-sm font-medium w-12 text-center tabular-nums hover:text-primary transition-colors"
                >
                  {zoom}%
                </button>
                <Button
                  size="sm"
                  variant="outline"
                  aria-label="Zoom in"
                  disabled={zoom >= MAX_ZOOM}
                  onClick={() => setZoom((z) => Math.min(MAX_ZOOM, z + ZOOM_STEP))}
                >
                  <ZoomIn className="w-4 h-4" />
                </Button>
                {zoom !== 100 && (
                  <Button size="sm" variant="ghost" aria-label="Reset zoom" onClick={() => setZoom(100)}>
                    <RotateCcw className="w-4 h-4" />
                  </Button>
                )}
              </div>
            )}

            <Button size="sm" variant="outline" aria-label="Toggle fullscreen" onClick={toggleFullscreen}>
              {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </Button>

            {source.openUrl && (
              <Button size="sm" variant="outline" asChild>
                <a
                  href={source.openUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Open in a new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                  <span className="hidden md:inline ml-2">Open</span>
                </a>
              </Button>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-auto bg-muted/30">
        {source.embedUrl ? (
          <div className="mx-auto py-4 md:py-6 px-2 md:px-6">
            <div
              className={cn(
                "relative bg-white shadow-elegant-lg rounded-lg overflow-hidden mx-auto transition-[width] duration-200",
                "h-[calc(100vh-8.5rem)] md:h-[calc(100vh-9rem)]"
              )}
              style={{ width: zoomEnabled ? `${zoom}%` : "100%", maxWidth: "100%" }}
            >
              {!frameLoaded && (
                <div className="absolute inset-0 grid place-items-center bg-white">
                  <div className="flex flex-col items-center text-muted-foreground">
                    <Loader2 className="w-7 h-7 animate-spin mb-3" />
                    <p className="text-sm">Opening your book...</p>
                  </div>
                </div>
              )}
              <iframe
                src={source.embedUrl}
                onLoad={() => setFrameLoaded(true)}
                className="w-full h-full border-0"
                title={purchase?.title || "Document viewer"}
                allow="autoplay"
              />
            </div>
            <p className="text-center text-[11px] text-muted-foreground mt-3">
              Trouble viewing? Use <span className="font-medium">Open</span> to read it in a new tab.
            </p>
          </div>
        ) : (
          <div className="max-w-md mx-auto px-6 py-16 text-center">
            <div className="w-16 h-16 rounded-full bg-muted grid place-items-center mx-auto mb-5">
              <FileWarning className="w-8 h-8 text-muted-foreground" />
            </div>
            <h2 className="font-semibold text-lg mb-2">This book isn't ready yet</h2>
            <p className="text-sm text-muted-foreground mb-6">
              Your purchase is active, but no readable file is attached to it yet. Our team can
              send it across — support has your order details.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Button onClick={() => navigate("/support")}>Contact support</Button>
              <Button variant="outline" onClick={() => navigate("/collection")}>
                Back to collection
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PDFViewer;
