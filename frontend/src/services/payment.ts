import { BACKEND_URL, authHeaders } from "@/services/api";

export interface OrderOptions {
  uid: string;
  email: string;
  name: string;
  phone: string;
  productType: string;
  productId: string;
  productTitle?: string;
  productLanguage?: string;
  productImage?: string;
  basePrice: number;
  couponCode?: string;
  shipping?: Record<string, any>;
  downloadLink?: string;
  paymentMode?: string;
  paymentRef?: string;
  testPayment?: boolean;
  transactionDetails?: Record<string, any>;
  razorpayOrderId?: string;
  razorpayPaymentId?: string;
  razorpaySignature?: string;
}

export interface OrderResult {
  success: boolean;
  orderId?: string;
  transactionId?: string;
  error?: string;
}

export interface RazorpayOrderResult {
  success: boolean;
  orderId?: string;
  amount?: number;
  currency?: string;
  key?: string;
  error?: string;
}

export const createRazorpayOrder = async (options: { uid: string; amount: number }): Promise<RazorpayOrderResult> => {
  try {
    const res = await fetch(`${BACKEND_URL}/create-razorpay-order`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        uid: options.uid,
        amount: options.amount,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || "Could not start payment" };
    }

    const data = await res.json();
    return {
      success: true,
      orderId: data.order_id,
      amount: data.amount,
      currency: data.currency,
      key: data.key,
    };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error" };
  }
};

/**
 * Completes an order by calling the backend /complete-order route.
 * Backend verifies payment and writes transaction, order, and purchase records to Firestore.
 */
export const completeOrder = async (options: OrderOptions): Promise<OrderResult> => {
  try {
    const res = await fetch(`${BACKEND_URL}/complete-order`, {
      method: "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        uid: options.uid,
        email: options.email,
        name: options.name,
        phone: options.phone,
        product_type: options.productType,
        product_id: options.productId,
        product_title: options.productTitle || null,
        product_language: options.productLanguage || null,
        product_image: options.productImage || null,
        base_price: options.basePrice,
        coupon_code: options.couponCode || null,
        shipping: options.shipping || null,
        download_link: options.downloadLink || null,
        payment_mode: options.paymentMode || null,
        payment_ref: options.paymentRef || null,
        test_payment: options.testPayment || false,
        transaction_details: options.transactionDetails || null,
        razorpay_order_id: options.razorpayOrderId || options.transactionDetails?.razorpay_order_id || null,
        razorpay_payment_id: options.razorpayPaymentId || options.transactionDetails?.razorpay_payment_id || null,
        razorpay_signature: options.razorpaySignature || options.transactionDetails?.razorpay_signature || null,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      return { success: false, error: err.detail || "Order failed" };
    }

    const data = await res.json();
    return { success: true, orderId: data.order_id, transactionId: data.transaction_id };
  } catch (e: any) {
    return { success: false, error: e.message || "Network error" };
  }
};
