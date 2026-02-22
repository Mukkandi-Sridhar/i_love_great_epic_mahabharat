const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:8000";

export interface OrderOptions {
  uid: string;
  email: string;
  name: string;
  phone: string;
  productType: string;
  productId: string;
  basePrice: number;
  couponCode?: string;
  shipping?: Record<string, any>;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  error?: string;
}

/**
 * Completes an order by calling the backend /complete-order route.
 * Backend writes to Firestore (orders + purchases) — no payment gateway.
 */
export const completeOrder = async (options: OrderOptions): Promise<OrderResult> => {
  try {
    const res = await fetch(`${BACKEND_URL}/complete-order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        uid: options.uid,
        email: options.email,
        name: options.name,
        phone: options.phone,
        product_type: options.productType,
        product_id: options.productId,
        base_price: options.basePrice,
        coupon_code: options.couponCode || null,
        shipping: options.shipping || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || "Order failed" };
    }

    const data = await res.json();
    return { success: true, orderId: data.order_id };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error" };
  }
};
