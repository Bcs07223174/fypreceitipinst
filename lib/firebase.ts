import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { getDatabase } from 'firebase/database';
import firebaseConfigJson from '../firebase-applet-config.json';

const runtimeEnv = {
	apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || process.env.VITE_FIREBASE_API_KEY,
	authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || process.env.VITE_FIREBASE_AUTH_DOMAIN,
	databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || process.env.VITE_FIREBASE_DATABASE_URL,
	projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || process.env.VITE_FIREBASE_PROJECT_ID,
	storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || process.env.VITE_FIREBASE_STORAGE_BUCKET,
	messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
	appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || process.env.VITE_FIREBASE_APP_ID,
	measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || process.env.VITE_FIREBASE_MEASUREMENT_ID,
	firestoreDatabaseId: process.env.NEXT_PUBLIC_FIREBASE_FIRESTORE_DATABASE_ID || process.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID,
};

const firebaseConfig = {
	...firebaseConfigJson,
	apiKey: runtimeEnv.apiKey || firebaseConfigJson.apiKey,
	authDomain: runtimeEnv.authDomain || firebaseConfigJson.authDomain,
	databaseURL: runtimeEnv.databaseURL || firebaseConfigJson.databaseURL,
	projectId: runtimeEnv.projectId || firebaseConfigJson.projectId,
	storageBucket: runtimeEnv.storageBucket || firebaseConfigJson.storageBucket,
	messagingSenderId: runtimeEnv.messagingSenderId || firebaseConfigJson.messagingSenderId,
	appId: runtimeEnv.appId || firebaseConfigJson.appId,
	measurementId: runtimeEnv.measurementId || firebaseConfigJson.measurementId,
	firestoreDatabaseId: runtimeEnv.firestoreDatabaseId || firebaseConfigJson.firestoreDatabaseId,
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const rtdb = getDatabase(app);
export const auth = getAuth(app);
