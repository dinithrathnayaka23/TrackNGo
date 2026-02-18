import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'
import Login from '../pages/auth/Login'
import Signup from '../pages/auth/Signup'
import BusDetail from '../pages/dashboard/BusDetail'
import RoutesPage from '../pages/dashboard/Routes'
import Analytics from '../pages/dashboard/Analytics'
import Users from '../pages/dashboard/Users'

function AppRoutes() {
  return (
    // Route table is intentionally explicit for now while dashboard modules are still evolving.
    <BrowserRouter>
      <Routes>
        {/* Auth entry points */}
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        {/* Dashboard pages */}
        <Route path="/dashboard/buses" element={<BusDetail />} />
        <Route path="/dashboard/buses/busdetails" element={<BusDetail />} />
        <Route path="/dashboard/routes" element={<RoutesPage />} />
        <Route path="/dashboard/analytics" element={<Analytics />} />
        <Route path="/dashboard/users" element={<Users />} />
        <Route path="/dashboard/corporate-users" element={<Users />} />
        {/* Fallback route keeps unknown URLs inside auth flow */}
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  )
}

export default AppRoutes
