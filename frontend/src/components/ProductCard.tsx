import type { KeyboardEvent, MouseEvent } from "react";
import { useNavigate } from "react-router-dom";
import { Star, Zap } from "lucide-react";
import ThreeDBook from "./ThreeDBook";

interface ProductCardProps {
  id: string;
  image: string;
  title: string;
  rating: number;
  reviewCount?: number;
  price: number;
  originalPrice?: number;
  tag?: string;
  driveLink?: string;
  isOwned?: boolean;
  type?: string;
  isLimitedDeal?: boolean;
}

const ProductCard = ({
  id,
  image,
  title,
  rating,
  reviewCount = 100,
  price,
  originalPrice,
  driveLink,
  isOwned,
  type = "ebook",
  isLimitedDeal,
}: ProductCardProps) => {
  const navigate = useNavigate();
  const showDiscount = typeof originalPrice === "number" && originalPrice > price;
  const discount = showDiscount ? Math.round(((originalPrice - price) / originalPrice) * 100) : 0;

  const handleClick = (e?: MouseEvent<HTMLElement> | KeyboardEvent<HTMLElement>) => {
    if (isOwned && driveLink) {
      e?.stopPropagation();
      window.open(driveLink, "_blank", "noopener,noreferrer");
    } else {
      navigate(`/product/${id}`);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLElement>) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick(e);
    }
  };

  const formatReviews = (count: number) => {
    if (count >= 1000) return `${(count / 1000).toFixed(1)}k`;
    return count.toString();
  };

  return (
    <article
      onClick={handleClick}
      onKeyDown={handleKeyDown}
      tabIndex={0}
      role="button"
      aria-label={`${isOwned ? "Open" : "View"} ${title} - ₹${price}`}
      className="group cursor-pointer flex flex-col h-full rounded-2xl overflow-hidden transition-all duration-300 hover:scale-[1.02] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 bg-gradient-to-b from-white/[0.08] to-white/[0.02] border border-white/10 hover:border-primary/30 hover:shadow-[0_0_30px_rgba(255,215,0,0.15)]"
    >
      <div className="relative aspect-[3/4] overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent" />

        <div className="absolute top-2 left-2 z-10 flex flex-col gap-1">
          {isOwned && (
            <span className="bg-emerald-500 text-white px-2 py-0.5 rounded-full text-[9px] font-bold uppercase shadow-lg">
              Owned
            </span>
          )}
          {showDiscount && discount > 0 && !isOwned && (
            <span className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-2 py-0.5 rounded-full text-[8px] md:text-[9px] font-bold shadow-lg">
              {discount}% OFF
            </span>
          )}
        </div>

        <div className="absolute top-2 right-2 z-10">
          <div className="flex items-center gap-1 bg-black/60 backdrop-blur-md border border-white/10 text-white px-1.5 py-1 rounded-lg text-[9px] md:text-[10px] font-bold shadow-lg">
            <span>{rating.toFixed(1)}</span>
            <Star className="w-2 md:w-2.5 h-2 md:h-2.5 fill-yellow-400 text-yellow-400" />
          </div>
        </div>

        <div className="absolute inset-0 w-full h-full flex items-center justify-center p-6">
          {type === "ebook" ? (
            <ThreeDBook src={image} alt={title} className="transition-transform duration-500 group-hover:scale-110" />
          ) : (
            <img
              src={image}
              alt={title}
              className="w-full h-full object-contain drop-shadow-2xl transition-transform duration-500 group-hover:scale-110"
            />
          )}
        </div>
      </div>

      <div className="flex flex-col flex-grow p-3 md:p-4">
        <h3 className="font-bold text-sm md:text-base text-white/90 leading-tight mb-2 group-hover:text-primary transition-colors line-clamp-2 uppercase tracking-tight">
          {title}
        </h3>

        <div className="hidden md:flex items-center gap-2 mb-3">
          <div className="flex items-center gap-0.5 bg-emerald-600 text-white px-1.5 py-0.5 rounded text-[10px] font-bold">
            {rating.toFixed(1)}
            <Star className="w-2.5 h-2.5 fill-white" />
          </div>
          <span className="text-[10px] text-gray-500">({formatReviews(reviewCount)})</span>
        </div>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-base md:text-lg font-bold text-white">₹{price}</span>
          {showDiscount && (
            <>
              <span className="text-[10px] md:text-xs text-gray-500 line-through">₹{originalPrice}</span>
              {!isOwned && <span className="text-[10px] text-emerald-400 font-semibold">{discount}% off</span>}
            </>
          )}
        </div>

        {(isLimitedDeal || (showDiscount && discount >= 20)) && (
          <div className="hidden md:flex items-center gap-2 mt-auto pt-4 border-t border-white/5">
            <Zap className="w-3 h-3 text-primary fill-primary" />
            <span className="text-[10px] text-primary font-bold uppercase tracking-wider">Limited Time Deal</span>
          </div>
        )}
      </div>
    </article>
  );
};

export default ProductCard;
