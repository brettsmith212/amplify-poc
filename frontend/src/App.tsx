import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import TerminalPage from './pages/TerminalPage';
import { useAuth } from './hooks/useAuth';
import ErrorBoundary from './components/ErrorBoundary';
import { LoadingSpinner } from './components/LoadingSpinner';

import LoginPage from './pages/LoginPage';
import CreateSessionPage from './pages/CreateSessionPage';
import SessionsPage from './pages/SessionsPage';
import DiffPage from './pages/DiffPage';



// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <LoadingSpinner size="lg" text="Loading..." />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
};

// App component with routing
const AppContent = () => {
  const { user } = useAuth();

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route 
            index 
            element={
              user ? <Navigate to="/sessions" replace /> : <Navigate to="/login" replace />
            } 
          />
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/sessions"
            element={
              <ProtectedRoute>
                <SessionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/create-session"
            element={
              <ProtectedRoute>
                <CreateSessionPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/terminal/:sessionId"
            element={
              <ProtectedRoute>
                <TerminalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/terminal"
            element={
              <ProtectedRoute>
                <TerminalPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/diff/:sessionId"
            element={
              <ProtectedRoute>
                <DiffPage />
              </ProtectedRoute>
            }
          />
        </Route>
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
