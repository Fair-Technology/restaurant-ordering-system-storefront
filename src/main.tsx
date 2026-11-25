import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { store } from './store';
import './main.css';
import App from './App.tsx';
import { migrateLegacyCartKeys } from './utils/cartKeyMigration';

// Must run before any component dispatches loadCart.
migrateLegacyCartKeys();

const rootEl = document.getElementById('root');
if (rootEl) {
  const root = createRoot(rootEl);
  root.render(
    <StrictMode>
      <Provider store={store}>
        <App />
      </Provider>
    </StrictMode>
  );
}
