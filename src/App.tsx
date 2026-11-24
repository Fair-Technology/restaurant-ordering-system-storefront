import React, { lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import HomePage from './pages/HomePage';
import ShopView from './features/shop/ShopView';
import LegalPage from './features/legal/LegalPage';
import ContentReportPage from './features/legal/ContentReportPage';
import SubProcessorsPage from './features/legal/SubProcessorsPage';
import CustomerOrderPage from './features/order/CustomerOrderPage';
import NotFound from './pages/NotFound';
import { CheckoutPageSkeleton } from './shared/Skeletons';
import { useDocumentTitle } from './hooks/useDocumentTitle';
import { useDocumentLanguage } from './hooks/useDocumentLanguage';

const CheckoutPage = lazy(() => import('./features/checkout/CheckoutPage'));

const DocumentTitleSync: React.FC = () => {
  useDocumentTitle();
  return null;
};

const DocumentLanguageSync: React.FC = () => {
  useDocumentLanguage();
  return null;
};

const App: React.FC = () => {
  return (
    <Router>
      <DocumentTitleSync />
      <DocumentLanguageSync />
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
        <Route path="/shops/:slug/report" element={<ContentReportPage />} />
        <Route path="/legal/sub-processors" element={<SubProcessorsPage />} />
        <Route path="/*" element={<NotFound />} />
      </Routes>
    </Router>
  );
};

export default App;
