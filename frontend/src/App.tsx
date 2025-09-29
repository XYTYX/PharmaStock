import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { LanguageProvider } from './contexts/LanguageContext';
import Layout from './components/Layout';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import CurrentStockPage from './pages/CurrentStockPage';
import DispensationTrackingPage from './pages/DispensationTrackingPage';
import UsersPage from './pages/UsersPage';

// Protected route component for admin-only pages
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore();
  
  if (user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" replace />;
  }
  
  return <>{children}</>;
}

function App() {
  const { isAuthenticated } = useAuthStore();

  if (!isAuthenticated) {
    return (
      <LanguageProvider>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </LanguageProvider>
    );
  }

  return (
    <LanguageProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/current-stock" element={<CurrentStockPage />} />
          <Route path="/dispensation-tracking" element={<DispensationTrackingPage />} />
          <Route path="/users" element={
            <AdminRoute>
              <UsersPage />
            </AdminRoute>
          } />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Layout>
    </LanguageProvider>
  );
}

export default App;
