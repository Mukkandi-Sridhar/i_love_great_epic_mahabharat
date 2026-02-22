import ProductCard from "./ProductCard";

interface ProductMarqueeProps {
    products: any[];
    reverse?: boolean;
    pauseOnHover?: boolean;
}

const ProductMarquee = ({ products, reverse = false, pauseOnHover = true }: ProductMarqueeProps) => {
    return (
        <div className="relative overflow-hidden py-4 md:py-8">
            {/* Gradient Masks */}
            <div className="absolute left-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-r from-background to-transparent z-10 pointer-events-none" />
            <div className="absolute right-0 top-0 bottom-0 w-12 md:w-24 bg-gradient-to-l from-background to-transparent z-10 pointer-events-none" />

            <div className={`flex ${reverse ? 'animate-marquee-reverse' : 'animate-marquee'} ${pauseOnHover ? 'hover:[animation-play-state:paused]' : ''} w-fit`}>
                <div className="flex gap-4 md:gap-6 px-3">
                    {products.map((product) => (
                        <div key={product.id} className="w-[170px] md:w-[240px] flex-shrink-0">
                            <ProductCard {...product} />
                        </div>
                    ))}
                </div>
                {/* Clone for seamless loop */}
                <div className="flex gap-4 md:gap-6 px-3" aria-hidden="true">
                    {products.map((product) => (
                        <div key={`${product.id}-clone`} className="w-[170px] md:w-[240px] flex-shrink-0">
                            <ProductCard {...product} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default ProductMarquee;
