import { useState, useEffect } from 'react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
    src: string;
    alt: string;
    className?: string;
    placeholderColor?: string;
}

export function OptimizedImage({
    src,
    alt,
    className = '',
    placeholderColor = '#1a1a1a',
    ...props
}: OptimizedImageProps) {
    const [isLoaded, setIsLoaded] = useState(false);
    const [isInView, setIsInView] = useState(false);

    useEffect(() => {
        const img = new Image();
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setIsInView(true);
                    observer.disconnect();
                }
            },
            { rootMargin: '50px' } // Start loading 50px before visible
        );

        const element = document.getElementById(`img-${src}`);
        if (element) observer.observe(element);

        return () => observer.disconnect();
    }, [src]);

    useEffect(() => {
        if (!isInView) return;

        const img = new Image();
        img.src = src;
        img.onload = () => setIsLoaded(true);
    }, [isInView, src]);

    return (
        <div
            id={`img-${src}`}
            className={`relative overflow-hidden ${className}`}
            style={{ backgroundColor: placeholderColor }}
        >
            {isInView && (
                <img
                    src={src}
                    alt={alt}
                    className={`transition-opacity duration-300 ${isLoaded ? 'opacity-100' : 'opacity-0'
                        } ${className}`}
                    loading="lazy"
                    {...props}
                />
            )}
            {!isLoaded && isInView && (
                <div className="absolute inset-0 animate-pulse bg-gradient-to-r from-transparent via-white/5 to-transparent" />
            )}
        </div>
    );
}
