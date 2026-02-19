import React from 'react';
import { MemoryRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Welcome from '../../pages/auth/Welcome';
import Register from '../../pages/auth/Register';
import Login from '../../pages/auth/Login';
import ResetVault from '../../pages/auth/ResetVault';
import VaultHome from '../../pages/vault/VaultHome';
import CredentialForm from '../../pages/vault/CredentialForm';
import PasswordGenerator from '../../pages/generator/PasswordGenerator';
import SettingsPage from '../../pages/settings/SettingsPage';
import SecurityDashboard from '../../pages/settings/subpages/SecurityDashboard';
import SecurityAudit from '../../pages/security/SecurityAudit';
import SyncSettings from '../../pages/settings/subpages/SyncSettings';
import ChangePassword from '../../pages/settings/subpages/ChangePassword';
import AppearanceSettings from '../../pages/settings/subpages/AppearanceSettings';
import AutoLockSettings from '../../pages/settings/subpages/AutoLockSettings';
import ExportVault from '../../pages/settings/subpages/ExportVault';
import ImportVault from '../../pages/settings/subpages/ImportVault';
import BiometricSetup from '../../pages/settings/subpages/BiometricSetup';
import { useAuthStore } from '../../store/authStore';

const App = () => {
    const { isRegistered, isAuthenticated } = useAuthStore();

    return (
        <Router>
            <div className="w-[380px] h-[600px] bg-background text-foreground overflow-y-auto">
                <Routes>
                    <Route
                        path="/"
                        element={
                            !isRegistered ? <Navigate to="/welcome" /> :
                                !isAuthenticated ? <Navigate to="/login" /> : <Navigate to="/vault" />
                        }
                    />
                    <Route path="/welcome" element={<Welcome />} />
                    <Route path="/register" element={<Register />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/reset" element={<ResetVault />} />
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
                    <Route path="/settings/security" element={isAuthenticated ? <SecurityDashboard /> : <Navigate to="/login" />} />
                    <Route path="/security-audit" element={isAuthenticated ? <SecurityAudit /> : <Navigate to="/login" />} />
                    <Route path="/settings/sync" element={isAuthenticated ? <SyncSettings /> : <Navigate to="/login" />} />
                    <Route path="/settings/password" element={isAuthenticated ? <ChangePassword /> : <Navigate to="/login" />} />
                    <Route path="/settings/appearance" element={isAuthenticated ? <AppearanceSettings /> : <Navigate to="/login" />} />
                    <Route path="/settings/autolock" element={isAuthenticated ? <AutoLockSettings /> : <Navigate to="/login" />} />
                    <Route path="/settings/export" element={isAuthenticated ? <ExportVault /> : <Navigate to="/login" />} />
                    <Route path="/settings/import" element={isAuthenticated ? <ImportVault /> : <Navigate to="/login" />} />
                    <Route path="/settings/biometric" element={isAuthenticated ? <BiometricSetup /> : <Navigate to="/login" />} />
                </Routes>
            </div>
        </Router>
    );
};

export default App;
