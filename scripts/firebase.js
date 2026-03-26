import { initializeApp }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js';
import { getAuth, GoogleAuthProvider,
         signInWithPopup, onAuthStateChanged, signOut }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js';
import { getFirestore, doc, getDoc, setDoc,
         collection, getDocs, query, orderBy, limit,
         addDoc, updateDoc, deleteDoc, writeBatch }
  from 'https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js';

const firebaseConfig = {
  apiKey:            "AIzaSyB-Sq-jeNm77DJNpMi6Im4m-7dqNrpOSe4",
  authDomain:        "roberts-tjm-dashboard.firebaseapp.com",
  projectId:         "roberts-tjm-dashboard",
  storageBucket:     "roberts-tjm-dashboard.firebasestorage.app",
  messagingSenderId: "344124779491",
  appId:             "1:344124779491:web:a6f43eb7b8b6888958ced6",
};

const app      = initializeApp(firebaseConfig);
const auth     = getAuth(app);
const db       = getFirestore(app);
const provider = new GoogleAuthProvider();

export {
  app, auth, db, provider,
  signInWithPopup, onAuthStateChanged, signOut,
  doc, getDoc, setDoc,
  collection, getDocs, query, orderBy, limit,
  addDoc, updateDoc, deleteDoc, writeBatch,
};
