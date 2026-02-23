import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

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
