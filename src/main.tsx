// src/main.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App'; // <--- Sin el .tsx
import './index.css';
import { AuthProvider } from './context/AuthContext'; // <--- Sin el .tsx

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </React.StrictMode>,
);