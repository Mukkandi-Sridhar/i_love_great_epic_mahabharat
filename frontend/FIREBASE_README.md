# 🔥 Firebase Backend Integration

Your Firebase-based backend structure is ready! Follow these steps to complete the setup.

## ✅ What's Been Created

### 1. **Firebase Configuration** (`src/lib/firebase.ts`)
- Firebase SDK initialization
- Auth, Firestore, Storage, Functions setup

### 2. **Admin Portal** (`/admin`)
- Login page with authentication
- Dashboard with stats overview
- User management interface
- **Current credentials (DEV ONLY):**
  - Username: `sridhar`
  - Password: `xxxxxxx`

### 3. **Database Schema**
Complete Firestore collections:
- `users/{uid}` - User profiles with phone mapping
- `phones/{+91XXXXXXXXXX}` - Phone to UID lookup
- `products/{productId}` - Ebooks & SD cards
- `orders/{orderId}` - Razorpay payments
- `shipments/{shipmentId}` - Delivery tracking
- `coupons/{CODE}` - Discount codes
- `notifications/{id}` - FCM push notifications
- `supportThreads/{id}` - Customer support
- `auditLogs/{id}` - Admin action tracking
- `users/{uid}/library/{productId}` - Purchased ebooks

### 4. **Security Rules**
- ✅ `firestore.rules` - Database security
- ✅ `storage.rules` - File storage security
- ✅ `firestore.indexes.json` - Query optimization

## 🚀 Next Steps

### Step 1: Create Firebase Project
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Authentication (Phone provider)
4. Enable Firestore Database
5. Enable Storage
6. Enable Cloud Functions

### Step 2: Get Firebase Credentials
Copy your config from Firebase Console → Project Settings:

```env
# Create .env.local file with:
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### Step 3: Deploy Security Rules
```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Initialize Firebase in your project
firebase init

# Deploy rules
firebase deploy --only firestore:rules
firebase deploy --only firestore:indexes
firebase deploy --only storage
```

### Step 4: Set Up Razorpay
1. Get Razorpay credentials from [dashboard.razorpay.com](https://dashboard.razorpay.com)
2. Add to Firebase Functions config:
```bash
firebase functions:config:set razorpay.key_id="YOUR_KEY_ID"
firebase functions:config:set razorpay.key_secret="YOUR_KEY_SECRET"
```

### Step 5: Admin Setup (CRITICAL ⚠️)
**Current implementation uses hardcoded credentials for demo only!**

For production:
1. Create an admin user in Firebase Auth
2. Use Cloud Function to set custom claims:
```typescript
admin.auth().setCustomUserClaims(uid, { role: 'admin' });
```
3. Update `AdminLogin.tsx` to use Firebase Auth
4. Remove hardcoded credentials

## 📁 File Structure

```
src/
├── lib/
│   └── firebase.ts              # Firebase initialization
├── contexts/
│   └── FirebaseContext.tsx      # Auth state management
└── pages/
    └── admin/
        ├── AdminLogin.tsx       # Admin login page
        ├── AdminDashboard.tsx   # Admin dashboard
        └── AdminUsers.tsx       # User management

firestore.rules                  # Database security rules
storage.rules                    # Storage security rules
firestore.indexes.json           # Query indexes
```

## 🔒 Security Checklist

- [ ] Deploy Firestore rules
- [ ] Deploy Storage rules
- [ ] Replace hardcoded admin credentials
- [ ] Set up Firebase custom claims for admin role
- [ ] Enable App Check
- [ ] Set up Razorpay webhook with signature verification
- [ ] Add rate limiting
- [ ] Enable audit logging

## 📚 Database Schema Details

See `FIREBASE_SETUP.md` for complete schema with examples.

## 🎯 Admin Features

- **Users**: Search by phone, view all user details
- **Products**: CRUD for ebooks and SD cards
- **Orders**: Track Razorpay payments
- **Shipments**: Manage delivery status
- **Coupons**: Create discount codes
- **Notifications**: Send FCM push notifications
- **Support**: Handle customer queries
- **Audit Logs**: Track all admin actions

## 🔗 Quick Links

- [Firebase Console](https://console.firebase.google.com/)
- [Razorpay Dashboard](https://dashboard.razorpay.com/)
- [Firebase Documentation](https://firebase.google.com/docs)

---

**Need Help?** Check `FIREBASE_SETUP.md` for detailed setup instructions.
