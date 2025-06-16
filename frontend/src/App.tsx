import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import Layout from './components/Layout';
import TerminalPage from './pages/TerminalPage';
import { useAuth } from './hooks/useAuth';

// Placeholder components for routes that will be implemented in later steps
const LoginPage = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-white mb-4">Welcome to Amplify</h1>
      <p className="text-gray-400 mb-8">Sign in with GitHub to get started</p>
      <button
        onClick={() => window.location.href = '/api/auth/github'}
        className="bg-gray-800 hover:bg-gray-700 text-white px-6 py-3 rounded-lg transition-colors"
      >
        Sign in with GitHub
      </button>
    </div>
  </div>
);

const SessionsPage = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-white mb-4">Sessions Dashboard</h1>
      <p className="text-gray-400">Session management will be implemented in Step 8</p>
    </div>
  </div>
);

const CreateSessionPage = () => (
  <div className="flex-1 flex items-center justify-center">
    <div className="text-center">
      <h1 className="text-2xl font-bold text-white mb-4">Create New Session</h1>
      <p className="text-gray-400">Session creation form will be implemented in Step 7</p>
    </div>
  </div>
);

// Protected Route wrapper
const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-400">Loading...</p>
        </div>
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
            path="/create"
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
        </Route>
      </Routes>
    </Router>
  );
};

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
