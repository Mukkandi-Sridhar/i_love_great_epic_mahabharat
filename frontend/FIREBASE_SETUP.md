# Firebase Setup Guide

## 1. Install Firebase CLI
```bash
npm install -g firebase-tools
firebase login
```

## 2. Initialize Firebase Project
```bash
firebase init
```
Select:
- Firestore
- Storage
- Functions
- Hosting (optional)

## 3. Environment Variables
Create `.env.local` file:
```env
VITE_FIREBASE_API_KEY=your_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

## 4. Deploy Firestore Rules & Indexes
```bash
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

## 5. Firestore Schema

### Collection: `users/{uid}`
```json
{
  "uid": "firebase_uid",
  "phoneE164": "+91XXXXXXXXXX",
  "displayName": "User Name",
  "email": "user@example.com",
  "role": "user",
  "createdAt": "Timestamp",
  "lastActiveAt": "Timestamp"
}
```

### Collection: `phones/{+91XXXXXXXXXX}`
```json
{
  "uid": "firebase_uid"
}
```

### Collection: `products/{productId}`
```json
{
  "type": "ebook" | "sdcard",
  "title": "Product Title",
  "description": "Product description",
  "language": "hindi" | "english",
  "images": ["url1", "url2"],
  "files": {
    "pdf": "storage_path",
    "zip": "storage_path"
  },
  "price": 9900,
  "currency": "INR",
  "stock": 100,
  "visible": true,
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Collection: `orders/{orderId}`
```json
{
  "uid": "firebase_uid",
  "phoneE164": "+91XXXXXXXXXX",
  "items": [{
    "productId": "prod_id",
    "qty": 1,
    "priceAtPurchase": 9900
  }],
  "subtotal": 9900,
  "discount": 0,
  "total": 9900,
  "couponCode": "SAVE10",
  "payment": {
    "provider": "razorpay",
    "status": "pending" | "paid" | "failed",
    "orderId": "rzp_order_id",
    "paymentId": "rzp_payment_id",
    "signature": "signature_hash"
  },
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Collection: `shipments/{shipmentId}`
```json
{
  "uid": "firebase_uid",
  "phoneE164": "+91XXXXXXXXXX",
  "item": {
    "productId": "prod_id",
    "qty": 1
  },
  "address": {
    "name": "Customer Name",
    "phone": "+91XXXXXXXXXX",
    "email": "customer@example.com",
    "pincode": "400001",
    "addressLine": "Address line 1",
    "area": "Area/Locality",
    "landmark": "Near XYZ",
    "city": "Mumbai",
    "state": "Maharashtra"
  },
  "status": "created" | "packed" | "shipped" | "delivered" | "cancelled",
  "tracking": {
    "carrier": "Delhivery",
    "trackingId": "TRACK123",
    "events": [{
      "status": "shipped",
      "timestamp": "Timestamp",
      "location": "Mumbai Hub"
    }]
  },
  "createdAt": "Timestamp",
  "updatedAt": "Timestamp"
}
```

### Collection: `coupons/{CODE}`
```json
{
  "type": "percent" | "fixed",
  "value": 10,
  "appliesToAll": true,
  "productIds": [],
  "enabled": true,
  "validFrom": "Timestamp",
  "validUntil": "Timestamp",
  "perUserLimit": 1,
  "maxRedemptions": 1000,
  "usageCount": 0
}
```

### Subcollection: `users/{uid}/library/{productId}`
```json
{
  "productId": "prod_id",
  "orderId": "order_id",
  "grantedAt": "Timestamp"
}
```

## 6. Firebase Functions (Cloud Functions)

Create these functions in `functions/src/index.ts`:

### createRazorpayOrder
```typescript
// Creates Razorpay order and Firestore order doc
```

### razorpayWebhook
```typescript
// Verify signature, update payment status, grant entitlements
```

### sendNotification
```typescript
// Send FCM notifications to segmented users
```

### processImageOnUpload
```typescript
// Generate thumbnails on image upload
```

### setUserRole
```typescript
// Set custom claims for admin users
```

## 7. Security Implementation

### Production Checklist:
- ✅ Deploy Firestore security rules
- ✅ Deploy Storage security rules
- ✅ Implement Firebase Auth with phone verification
- ✅ Set up custom claims for admin role
- ✅ Replace hardcoded admin credentials with proper auth
- ✅ Enable App Check for anti-abuse
- ✅ Set up audit logging
- ✅ Configure Razorpay webhooks with signature verification
- ✅ Enable Firebase Functions CORS

## 8. Razorpay Integration

### Environment Variables:
```env
RAZORPAY_KEY_ID=your_key_id
RAZORPAY_KEY_SECRET=your_key_secret
```

### Webhook URL:
```
https://your-region-your-project.cloudfunctions.net/razorpayWebhook
```

## 9. Admin Dashboard Security

**⚠️ CRITICAL**: Current implementation uses hardcoded credentials for demo purposes only.

### Production Implementation:
1. Remove hardcoded credentials from `AdminLogin.tsx`
2. Implement Firebase Auth login
3. Use Cloud Functions to set custom claims:
```typescript
admin.auth().setCustomUserClaims(uid, { role: 'admin' });
```
4. Check claims in security rules and client-side:
```typescript
const idTokenResult = await user.getIdTokenResult();
const isAdmin = idTokenResult.claims.role === 'admin';
```

## 10. Seed Data Script

Create sample products, coupons, and users for testing.
