import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Welcome from './pages/auth/Welcome';
import Register from './pages/auth/Register';
import Login from './pages/auth/Login';
import ResetVault from './pages/auth/ResetVault';
import VaultHome from './pages/vault/VaultHome';
import CredentialForm from './pages/vault/CredentialForm';
import PasswordGenerator from './pages/generator/PasswordGenerator';
import SettingsPage from './pages/settings/SettingsPage';
import SecurityAudit from './pages/security/SecurityAudit';
import { useAuthStore } from './store/authStore';
import './App.css';

/**
 * Simplified App Routing
 * 
 * Clean routing logic:
 * - Welcome page for new users
 * - Login/Register for authentication
 * - Vault for authenticated users
 */
const App = () => {
    const { isRegistered, isAuthenticated } = useAuthStore();

    return (
        <Router>
            <div className="min-h-screen bg-background text-foreground">
                <Routes>
                    {/* Root route - direct to appropriate page */}
                    <Route
                        path="/"
                        element={
                            !isRegistered ? <Navigate to="/welcome" /> :
                                !isAuthenticated ? <Navigate to="/login" /> : <Navigate to="/vault" />
                        }
                    />
                    
                    {/* Auth routes */}
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/reset" element={<ResetVault />} />
                    
                    {/* Protected routes */}
                    <Route
                        path="/vault"
                        element={isAuthenticated ? <VaultHome /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/add-credential"
                        element={isAuthenticated ? <CredentialForm /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/edit-credential/:id"
                        element={isAuthenticated ? <CredentialForm /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/generator"
                        element={isAuthenticated ? <PasswordGenerator /> : <Navigate to="/login" />}
                    />
                    <Route
                        path="/settings"
                        element={isAuthenticated ? <SettingsPage /> : <Navigate to="/login" />}
                    />
                    <Route 
                        path="/security-audit" 
                        element={isAuthenticated ? <SecurityAudit /> : <Navigate to="/login" />} 
                    />
                </Routes>
            </div>
        </Router>
    );
};

export default App;
