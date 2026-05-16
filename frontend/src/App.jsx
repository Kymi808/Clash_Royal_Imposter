import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider, createTheme } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import CircularProgress from '@mui/material/CircularProgress';
import Box from '@mui/material/Box';
import { AuthProvider, useAuth } from './context/AuthContext';
import Login from './components/Login';
import Lobby from './components/Lobby';
import Room from './components/Room';
import Game from './components/Game';

const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#4169e1',
    },
    secondary: {
      main: '#ff6b6b',
    },
    background: {
      default: '#0a0e27',
      paper: '#1a1f3a',
    },
  },
  typography: {
    fontFamily: '"Supercell-Magic", "Roboto", "Arial", sans-serif',
  },
});

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  
  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <CircularProgress />
      </Box>
    );
  }
  
  if (!isAuthenticated) {
    return <Navigate to="/login" />;
  }
  
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();
  
  return (
    <Routes>
      <Route 
        path="/login" 
        element={isAuthenticated ? <Navigate to="/lobby" /> : <Login />} 
      />
      <Route 
        path="/lobby" 
        element={
          <ProtectedRoute>
            <Lobby />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/room/:roomId" 
        element={
          <ProtectedRoute>
            <Room />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/game/:roomId" 
        element={
          <ProtectedRoute>
            <Game />
          </ProtectedRoute>
        } 
      />
      <Route 
        path="/" 
        element={<Navigate to={isAuthenticated ? "/lobby" : "/login"} />} 
      />
    </Routes>
  );
}

function DemoBanner() {
  if (!import.meta.env.VITE_API_URL) {
    return (
      <Box sx={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 2000,
        bgcolor: 'warning.dark', color: 'warning.contrastText',
        py: 0.75, px: 2, textAlign: 'center', fontSize: 13,
      }}>
        UI demo only — multiplayer backend not deployed. Code on{' '}
        <Box component="a" href="https://github.com/Kymi808/Clash_Royal_Imposter" target="_blank" rel="noreferrer" sx={{ color: 'inherit', textDecoration: 'underline' }}>
          GitHub
        </Box>.
      </Box>
    );
  }
  return null;
}

function App() {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <DemoBanner />
      <AuthProvider>
        <Router>
          <AppRoutes />
        </Router>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
