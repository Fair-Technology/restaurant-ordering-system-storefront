import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ShopView from './features/shop/ShopView';
import LegalPage from './features/legal/LegalPage';
import SubProcessorsPage from './features/legal/SubProcessorsPage';
import CustomerOrderPage from './features/order/CustomerOrderPage';
import NotFound from './pages/NotFound';
import { CheckoutPageSkeleton } from './shared/Skeletons';

const CheckoutPage = lazy(() => import('./features/checkout/CheckoutPage'));

const App: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/shops/:slug" element={<ShopView />} />
        <Route path="/shops/:slug/checkout" element={
            <Suspense fallback={<CheckoutPageSkeleton />}>
              <CheckoutPage />
            </Suspense>
          } />
        <Route path="/shops/:slug/orders/:orderId" element={<CustomerOrderPage />} />
        <Route path="/shops/:slug/legal/:doc" element={<LegalPage />} />
        <Route path="/legal/sub-processors" element={<SubProcessorsPage />} />
        <Route path="/*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default App;
