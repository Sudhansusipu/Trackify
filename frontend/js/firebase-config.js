// Firebase Configuration (Compat SDK for easy integration with existing codebase)
const firebaseConfig = {
  apiKey: "AIzaSyACtsDC4mVLYwpH438IVjJscomfqe_EcDw",
  authDomain: "trackify-bcae3.firebaseapp.com",
  projectId: "trackify-bcae3",
  storageBucket: "trackify-bcae3.firebasestorage.app",
  messagingSenderId: "978515875343",
  appId: "1:978515875343:web:1991f3201f5c714aa1357a",
  measurementId: "G-LLCMGM6XVH"
};

// Initialize Firebase if not already initialized
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

// Global references
const auth = firebase.auth();
const db = firebase.firestore();

// Optional: Enable offline persistence for Firestore
db.enablePersistence().catch((err) => {
  console.warn("Firestore offline persistence failed: ", err);
});
