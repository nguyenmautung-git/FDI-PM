// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getAuth } from "firebase/auth";
import { getAnalytics, isSupported } from "firebase/analytics";

// Firebase config đọc từ .env hoặc fallback mặc định của quanlytailieu-demo
const firebaseConfig = {
  apiKey:            import.meta.env.VITE_FIREBASE_API_KEY            || "AIzaSyAEJOzWMbRt8eHofI88MqyTr1dWWPdGIAU",
  authDomain:        import.meta.env.VITE_FIREBASE_AUTH_DOMAIN        || "quanlytailieu-demo.firebaseapp.com",
  projectId:         import.meta.env.VITE_FIREBASE_PROJECT_ID         || "quanlytailieu-demo",
  storageBucket:     import.meta.env.VITE_FIREBASE_STORAGE_BUCKET     || "quanlytailieu-demo.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "19661308499",
  appId:             import.meta.env.VITE_FIREBASE_APP_ID             || "1:19661308499:web:2ee7127f3fb566472cfca6",
  measurementId:     import.meta.env.VITE_FIREBASE_MEASUREMENT_ID     || "G-8EX9RN3ZWH",
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const auth = getAuth(app);

// Analytics is optional and might not work perfectly in localhost without full setup
let analytics = null;
isSupported().then((supported) => {
  if (supported) {
    try {
      analytics = getAnalytics(app);
    } catch (e) {
      console.warn("Firebase Analytics could not be initialized:", e);
    }
  }
}).catch((err) => {
  console.warn("Firebase Analytics support check failed:", err);
});

export { analytics };
