// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword, 
    signInWithEmailAndPassword, 
    signOut, 
    onAuthStateChanged,
    updateProfile,
    deleteUser,
    GoogleAuthProvider,
    signInWithPopup
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { 
    getFirestore, 
    collection, 
    addDoc, 
    getDocs, 
    doc, 
    updateDoc, 
    deleteDoc, 
    query, 
    where, 
    orderBy, 
    serverTimestamp,
    writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
    getStorage, 
    ref, 
    uploadBytes, 
    getDownloadURL 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-storage.js";

// مفاتيح مشروعك ErrorBook الخاصة
const firebaseConfig = {
  apiKey: "AIzaSyC73zel6kVZawa6YVtU_2l40VcLzvF-XYE",
  authDomain: "errorbook-d4aa4.firebaseapp.com",
  projectId: "errorbook-d4aa4",
  storageBucket: "errorbook-d4aa4.firebasestorage.app",
  messagingSenderId: "842910389468",
  appId: "1:842910389468:web:0939ce620f59442daa5019",
  measurementId: "G-GT26VTZJEY"
};

// تهيئة خدمات Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export {
    auth,
    db,
    storage,
    signOut,
    onAuthStateChanged,
    updateProfile,
    deleteUser,
    GoogleAuthProvider,
    signInWithPopup,
    collection,
    addDoc,
    getDocs,
    doc,
    updateDoc,
    deleteDoc,
    query,
    where,
    orderBy,
    serverTimestamp,
    writeBatch,
    ref,
    uploadBytes,
    getDownloadURL
};