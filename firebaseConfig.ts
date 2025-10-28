import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAsx5LZGPwQ1Ta4qlpb2Cryylwq_4akUSQ",
  authDomain: "pinepacenew.firebaseapp.com",
  projectId: "pinepacenew",
  storageBucket: "pinepacenew.firebasestorage.app",
  messagingSenderId: "760077723309",
  appId: "1:760077723309:web:ac7bca2c8e950afbeec824",
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
