import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Suas chaves de acesso (Não mexa aqui a menos que mude de projeto)
const firebaseConfig = {
  apiKey: "AIzaSyBmYfkgmYMHxDpx-8KlYXz0ZNFWP5B0Axo",
  authDomain: "plantao-zero.firebaseapp.com",
  projectId: "plantao-zero",
  storageBucket: "plantao-zero.firebasestorage.app",
  messagingSenderId: "96539843160",
  appId: "1:96539843160:web:6c54cc238ba057b578882d",
  measurementId: "G-RDKXGCZ7WE"
};

// Inicializa e exporta as ferramentas prontas para uso
const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const appId = "plantao-zero-app";