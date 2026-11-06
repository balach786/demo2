import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { RangeProvider, StoreProvider } from './demo/store';
import './styles.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <StoreProvider>
        <RangeProvider>
          <App />
        </RangeProvider>
      </StoreProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
