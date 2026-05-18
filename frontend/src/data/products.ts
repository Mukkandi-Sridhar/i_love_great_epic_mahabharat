import product1 from "@/assets/product-1.png";
import ebook2 from "@/assets/ebook-2.jpeg";
import pendrive1 from "@/assets/pendrive 1.jpeg";
import pendrive2 from "@/assets/pendrive 2.jpeg";
import pendrive3 from "@/assets/pendrive 3.jpeg";
import pendrive4 from "@/assets/pendrive 4.jpeg";

export interface Product {
    id: string;
    image: string;
    title: string;
    subtitle: string;
    rating: number;
    reviewCount: number;
    price: number;
    originalPrice: number;
    tag: string;
    type: 'ebook' | 'pendrive' | 'sdcard';
    language: string;
    totalSales: number;
    description: string;
    highlights: { icon: string; text: string; }[];
    driveLink?: string;
    stockCount?: number;
    isPhysical?: boolean;
}

export const ebooks: Product[] = [
    {
        id: "ebook-1",
        image: product1,
        title: "Vijnana Bhairava Tantra (Ebook)",
        subtitle: "Complete Digital Edition • English",
        rating: 4.9,
        reviewCount: 1247,
        price: 499,
        originalPrice: 999,
        tag: "Bestseller",
        type: "ebook",
        language: "English",
        totalSales: 1200,
        description: "A profound exploration of the Vijnana Bhairava Tantra, presenting the original 112 meditation techniques with contemporary insights for modern spiritual seekers. This comprehensive ebook includes Sanskrit verses, transliteration, and detailed English commentary.",
        highlights: [
            { icon: "book", text: "112 Meditation Techniques" },
            { icon: "language", text: "Sanskrit + English" },
            { icon: "download", text: "Instant PDF Download" },
            { icon: "clock", text: "Lifetime Access" },
        ],
        driveLink: "https://drive.google.com/file/d/example-ebook-link/view",
        isPhysical: false
    },
    {
        id: "ebook-2",
        image: ebook2,
        title: "Mahabharatam (Complete Telugu Edition)",
        subtitle: "18 Parvas • Simple Telugu • Digital",
        rating: 5.0,
        reviewCount: 42,
        price: 299,
        originalPrice: 599,
        tag: "New Arrival",
        type: "ebook",
        language: "Telugu",
        totalSales: 150,
        description: "Immerse yourself in the eternal wisdom of the Mahabharatam. This complete digital edition covers all 18 Parvas in crystal-clear, easy-to-understand Telugu. Perfectly formatted for modern reading on phones, tablets, and Kindles. Rediscover the Dharma, the intricate characters, and the divine song of the Bhagavad Gita in your mother tongue.",
        highlights: [
            { icon: "book", text: "All 18 Parvas Included" },
            { icon: "language", text: "Simple Modern Telugu" },
            { icon: "mobile", text: "Mobile Optimized PDF" },
            { icon: "download", text: "Instant Download" }
        ],
        // TODO: Add real drive link before launch.
        isPhysical: false
    },
];

export const pendrives: Product[] = [
    {
        id: "pd-1",
        image: pendrive1,
        title: "Sri Mahabharatam (Telugu - Complete)",
        subtitle: "All Main Episodes • Crystal Clear Audio",
        rating: 4.9,
        reviewCount: 342,
        price: 1499,
        originalPrice: 2999,
        tag: "Bestseller",
        type: "pendrive",
        language: "Telugu",
        totalSales: 890,
        description: "Experience the complete Sri Mahabharatam in Telugu. This collection covers all the major parvas and episodes, narrated with profound clarity and devotion. Perfect for daily listening.",
        highlights: [
            { icon: "usb", text: "32GB Sandisk Drive" },
            { icon: "audio", text: "Complete Series" },
            { icon: "language", text: "Pure Telugu" },
            { icon: "gift", text: "Free OTG Adapter" },
        ],
        isPhysical: true,
        stockCount: 45
    },
    {
        id: "pd-2",
        image: pendrive2,
        title: "Sri Mahabharatam (Telugu - Unseen)",
        subtitle: "Rare & Untold Stories • Deep Wisdom",
        rating: 4.8,
        reviewCount: 156,
        price: 1299,
        originalPrice: 2499,
        tag: "Exclusive",
        type: "pendrive",
        language: "Telugu",
        totalSales: 420,
        description: "Discover the hidden gems of the epic. This special collection focuses on the 'Unseen' or rarely told stories and deeper philosophical insights of the Mahabharatam that are often skipped in mainstream narrations.",
        highlights: [
            { icon: "usb", text: "16GB Metal Drive" },
            { icon: "eye", text: "Rare Episodes" },
            { icon: "star", text: "Untold Stories" },
            { icon: "audio", text: "HD Audio" },
        ],
        isPhysical: true,
        stockCount: 22
    },
    {
        id: "pd-3",
        image: pendrive3,
        title: "Sri Mahabharatam (Telugu - Ultimate)",
        subtitle: "Complete + Unseen Episodes • 64GB",
        rating: 5.0,
        reviewCount: 520,
        price: 1999,
        originalPrice: 3999,
        tag: "Premium Choice",
        type: "pendrive",
        language: "Telugu",
        totalSales: 650,
        description: "The ultimate collection for the true devotee. Contains BOTH the Complete Series and the Unseen Episodes. This massive library offering hundreds of hours of divine wisdom comes on a premium 64GB drive.",
        highlights: [
            { icon: "usb", text: "64GB Premium Drive" },
            { icon: "collection", text: "All + Unseen Pack" },
            { icon: "value", text: "Best Value" },
            { icon: "gift", text: "Free OTG Cable" },
        ],
        isPhysical: true,
        stockCount: 15
    },
    {
        id: "pd-4",
        image: pendrive4,
        title: "Sri Mahabharat (Hindi - Complete)",
        subtitle: "Full Series • Hindi Narration",
        rating: 4.9,
        reviewCount: 210,
        price: 1499,
        originalPrice: 2999,
        tag: "Hindi Edition",
        type: "pendrive",
        language: "Hindi",
        totalSales: 310,
        description: "For our Hindi-speaking devotees, this is the complete Sri Mahabharat narration. Relive the epic dharma yuddha with powerful storytelling and emotional depth in vivid Hindi.",
        highlights: [
            { icon: "usb", text: "32GB Metal Drive" },
            { icon: "language", text: "Shuddh Hindi" },
            { icon: "audio", text: "Studio Quality" },
            { icon: "plug", text: "Plug & Play" },
        ],
        isPhysical: true,
        stockCount: 30
    },
];

export const allProducts = [...ebooks, ...pendrives];
