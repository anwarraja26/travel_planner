//it is the code imported from firebase

// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import {getFirestore} from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCoV6oBBkIyr9iPOoZMEl6KWAlmOXE3YI0",
  authDomain: "travelplanner-2523a.firebaseapp.com",
  projectId: "travelplanner-2523a",
  storageBucket: "travelplanner-2523a.firebasestorage.app",
  messagingSenderId: "1032527854045",
  appId: "1:1032527854045:web:8094650846510bd19e1e34",
  measurementId: "G-R82NNVH4WR"
};                                                                                                    

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const db=getFirestore(app);// added