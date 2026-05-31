import { useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Navbar from './components/Navbar';
import AuthModal from './components/AuthModal';
import AiChat from './components/AiChat';
import Catalog from './pages/Catalog';
import RecordDetail from './pages/RecordDetail';
import Profile from './pages/Profile';
import './index.css';

export default function App() {
  const [authOpen, setAuthOpen] = useState(false);

  return (
    <AuthProvider>
      <BrowserRouter>
        <Navbar onOpenAuth={() => setAuthOpen(true)} />
        {authOpen && <AuthModal onClose={() => setAuthOpen(false)} />}

        <Routes>
          <Route path="/" element={<Catalog />} />
          <Route path="/records/:id" element={<RecordDetail onRequestAuth={() => setAuthOpen(true)} />} />
          <Route path="/profile" element={<Profile />} />
        </Routes>

        <AiChat onRequestAuth={() => setAuthOpen(true)} />
      </BrowserRouter>
    </AuthProvider>
  );
}
