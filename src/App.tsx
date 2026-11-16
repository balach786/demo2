import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/Layout';
import { ToastStack } from './components/ui';
import Dashboard from './pages/Dashboard';
import AiCommandCenter from './pages/AiCommandCenter';
import Parties from './pages/Parties';
import PartyDetail from './pages/PartyDetail';
import ChartOfAccounts from './pages/ChartOfAccounts';
import Transactions from './pages/Transactions';
import Ledgers from './pages/Ledgers';
import BankAccounts from './pages/BankAccounts';
import IncomeExpenses from './pages/IncomeExpenses';
import Reports from './pages/Reports';
import Documents from './pages/Documents';
import Approvals from './pages/Approvals';
import Settings from './pages/Settings';
import Imports from './pages/Imports';
import Exports from './pages/Exports';
import Inventory from './pages/Inventory';
import StockTransfers from './pages/StockTransfers';
import CurrencyExchange from './pages/CurrencyExchange';
import CurrencyReports from './pages/CurrencyReports';

export default function App() {
  return (
    <>
      <AppLayout>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/ai" element={<AiCommandCenter />} />
          <Route path="/parties" element={<Parties />} />
          <Route path="/parties/:id" element={<PartyDetail />} />
          <Route path="/chart-of-accounts" element={<ChartOfAccounts />} />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/ledgers" element={<Ledgers />} />
          <Route path="/banks" element={<BankAccounts />} />
          <Route path="/imports" element={<Imports />} />
          <Route path="/exports" element={<Exports />} />
          <Route path="/inventory" element={<Inventory />} />
          <Route path="/stock-transfers" element={<StockTransfers />} />
          <Route path="/currency-exchange" element={<CurrencyExchange />} />
          <Route path="/currency-reports" element={<CurrencyReports />} />
          <Route path="/income-expenses" element={<IncomeExpenses />} />
          <Route path="/reports" element={<Reports />} />
          <Route path="/documents" element={<Documents />} />
          <Route path="/approvals" element={<Approvals />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppLayout>
      <ToastStack />
    </>
  );
}
