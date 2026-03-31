/** @format */

import {
	getAuth,
	GoogleAuthProvider,
	sendPasswordResetEmail,
	signInWithEmailAndPassword,
	createUserWithEmailAndPassword,
	signInWithRedirect,
	getRedirectResult,
	sendEmailVerification,
} from 'firebase/auth';
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { toast } from 'react-toastify';

const firebaseConfig = {
	apiKey: import.meta.env.VITE_ApiKey,
	authDomain: import.meta.env.VITE_AuthDomain,
	projectId: import.meta.env.VITE_ProjectId,
	storageBucket: import.meta.env.VITE_StorageBucket,
	messagingSenderId: import.meta.env.VITE_MessagingSenderId,
	appId: import.meta.env.VITE_AppId,
	measurementId: import.meta.env.VITE_MeasurementId,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const firestore = getFirestore(app);
const storage = getStorage(app);
const functions = getFunctions(app);

/** Redirect-based Google sign-in (avoids COOP/popup issues). Call getRedirectResult() on app load to complete. */
export const signInWithGoogleRedirect = () => {
	const provider = new GoogleAuthProvider();
	return signInWithRedirect(auth, provider);
};

/** Call once on app load (e.g. in UserDataProvider) to complete redirect sign-in. */
export const getGoogleRedirectResult = () => getRedirectResult(auth);

export const signinwithemail = async (email, pass) => {
	try {
		const trimmedEmail = (email || '').trim();
		const data = await signInWithEmailAndPassword(auth, trimmedEmail, pass || '');
		return data;
	} catch (err) {
		console.error('[Auth] signinwithemail error', err?.code, err?.message, err);
		const code = err?.code || '';
		if (code === 'auth/invalid-email') {
			toast.error('Invalid email address.');
		} else if (code === 'auth/user-not-found' || code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
			toast.error('Email or password is incorrect.');
		} else if (code === 'auth/too-many-requests') {
			toast.error('Too many attempts. Try again later or reset your password.');
		} else if (code === 'auth/user-disabled') {
			toast.error('This account has been disabled.');
		} else if (code === 'auth/network-request-failed') {
			toast.error('Network error. Check your connection and try again.');
		} else {
			toast.error(err?.message || 'Sign in failed. Please try again.');
		}
		return null;
	}
};

export const signupwithemail = async (email, pass) => {
	try {
		const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
		const user = userCredential?.user;
		if (user) {
			await sendEmailVerification(user);
			toast.success('Account created. Check your email to verify.');
			return userCredential;
		}
		return null;
	} catch (err) {
		console.error(err?.code, err);
		if (err.code === 'auth/email-already-in-use') {
			toast.error('This email is already registered. Sign in instead or use a different email.');
		} else if (err.code === 'auth/invalid-email') {
			toast.error('Invalid email or password.');
		} else if (err.code === 'auth/weak-password') {
			toast.error('Password is too weak. Use at least 6 characters.');
		} else {
			toast.error('Sign up failed. Try again.');
		}
		return null;
	}
};
export const forget_password = async (email) => {
	try {
		const data = await sendPasswordResetEmail(auth, email);
		return data;
	} catch (err) {
		console.error(err);
	}
};

/** Admin-only: create a new user (Auth + profile). Requires caller to be admin. */
export const adminCreateUser = async ({ email, password, name, username }) => {
	const fn = httpsCallable(functions, 'adminCreateUser');
	const { data } = await fn({ email, password, name, username });
	return data;
};

/** Get AI-suggested search filters from a natural language query. Returns { filters: { keyword?, classificationTagId?, [customFieldKey]? } }. */
export const suggestSearchFiltersCallable = async (query, filterSchema) => {
	const fn = httpsCallable(functions, 'suggestSearchFilters');
	const { data } = await fn({ query: (query || '').trim(), filterSchema: filterSchema || {} });
	return data;
};

export { auth, app, firestore, storage };
