import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ShopView from './features/shop/ShopView';
import CheckoutPage from './features/checkout/CheckoutPage';
import NotFound from './pages/NotFound';

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shops/:slug" element={<ShopView />} />
        <Route path="/shops/:slug/checkout" element={<CheckoutPage />} />
        <Route path="/*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default App;
