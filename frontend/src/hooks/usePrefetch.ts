import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import product1 from '@/assets/product-1.png';
import product2 from '@/assets/product-2.jpg';
import product4 from '@/assets/product-4.jpg';

// Preload critical routes for instant navigation
const routesToPrefetch = [
    '/all-products',
    '/support',
    '/profile',
    '/collection',
];

export function useRoutePrefetch() {
    const location = useLocation();

    useEffect(() => {
        // Prefetch routes when user hovers over nav links
        const prefetchRoute = (path: string) => {
            // Dynamically import the route component
            if (path === '/all-products') {
                import('../pages/AllProducts');
            } else if (path === '/support') {
                import('../pages/Support');
            } else if (path === '/profile') {
                import('../pages/Profile');
            } else if (path === '/collection') {
                import('../pages/Collection');
            }
        };

        // Prefetch routes after initial load
        const timer = setTimeout(() => {
            routesToPrefetch.forEach(route => {
                if (route !== location.pathname) {
                    prefetchRoute(route);
                }
            });
        }, 2000); // Wait 2s after page load

        return () => clearTimeout(timer);
    }, [location.pathname]);
}

// Aggressive resource preloading
export function preloadCriticalResources() {
    // Preload product images
    const productImages = [
        product1,
        product2,
        product4,
    ];

    productImages.forEach(src => {
        const link = document.createElement('link');
        link.rel = 'prefetch';
        link.as = 'image';
        link.href = src;
        document.head.appendChild(link);
    });
}
