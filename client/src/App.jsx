// client/src/App.jsx
import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './layouts/AppLayout';
import { SocketProvider } from './contexts/SocketContext';

// Auth Pages
import Login from './pages/Login';
import Register from './pages/Register';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';

// Dashboard Pages
import Dashboard from './pages/Dashboard';
import MyTrips from './pages/trips/MyTrips';
import TripDetail from './pages/trips/TripDetail';
import CreateTrip from './pages/trips/CreateTrip';
import EditTrip from './pages/trips/EditTrip';
import Calendar from './pages/Calendar';
import Profile from './pages/Profile';
import BudgetDashboard from './pages/budget/BudgetDashboard';
import BrainstormDashboard from './pages/brainstorm/BrainstormDashboard';
import DocumentDashboard from './pages/documents/DocumentDashboard';
import Brainstorm from './pages/trips/Brainstorm';

// Public Pages
import PublicTripView from './pages/trips/PublicTripView';

// Not Found Page
import NotFound from './pages/NotFound';

function App() {
  return (
    <Router>
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            borderRadius: '10px',
            background: '#333',
            color: '#fff',
          },
          duration: 3000,
        }}
      />
      <Routes>
        {/* Public Routes */}
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password/:token" element={<ResetPassword />} />
        <Route path="/trip/public/:token" element={<PublicTripView />} />

        {/* App Routes */}
        <Route path="/" element={
          <ProtectedRoute>
            <SocketProvider>
              <AppLayout />
            </SocketProvider>
          </ProtectedRoute>
        }>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="trips" element={<MyTrips />} />
          <Route path="trips/new" element={<CreateTrip />} />
          <Route path="trips/:tripId" element={<TripDetail />} />
          <Route path="trips/:tripId/edit" element={<EditTrip />} />
          <Route path="trips/:tripId/brainstorm" element={<Brainstorm />} />
          <Route path="calendar" element={<Calendar />} />
          <Route path="budgets" element={<BudgetDashboard />} />
          <Route path="budgets/:tripId" element={<BudgetDashboard />} />
          <Route path="brainstorm" element={<BrainstormDashboard />} />
          <Route path="brainstorm/:tripId" element={<BrainstormDashboard />} />
          <Route path="documents" element={<DocumentDashboard />} />
          <Route path="documents/:tripId" element={<DocumentDashboard />} />
          <Route path="profile" element={<Profile />} />
        </Route>

        {/* Not Found */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    </Router>
  );
}

export default App;
