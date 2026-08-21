import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../components/layout/DashboardLayout'
import Dashboard from '../pages/dashboard/Analytics'
import AnalyticsPage from '../pages/dashboard/AnalyticsPage'
import Booking from '../pages/dashboard/Booking'
import BusDetail from '../pages/dashboard/BusDetail'
import Buses from '../pages/dashboard/Buses'
import Chat from '../pages/dashboard/Chat'
import Complaints from '../pages/dashboard/Complaints'
import Corporate from '../pages/dashboard/Corporate'
import CorporateDetail from '../pages/dashboard/CorporateDetail'
import Contracts from '../pages/dashboard/Contracts'
import CorporatePricingSettings from '../pages/dashboard/CorporatePricingSettings'
import RoutesPage from '../pages/dashboard/RoutesPage'
import Settings from '../pages/dashboard/Settings'
import Profile from '../pages/dashboard/Profile'
import Driver from '../pages/dashboard/Driver'
import Passenger from '../pages/dashboard/Passenger'
import Promotions from '../pages/dashboard/Promotions'
import Users from '../pages/dashboard/Users'

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Routes>
        <Route index element={<Dashboard />} />
        <Route path="analytics" element={<AnalyticsPage />} />
        <Route path="booking" element={<Booking />} />
        <Route path="buses" element={<Buses />} />
        <Route path="buses/:busId" element={<BusDetail />} />
        <Route path="chat" element={<Chat />} />
        <Route path="users" element={<Users />} />
        <Route path="passenger" element={<Passenger />} />
        <Route path="driver" element={<Driver />} />
        <Route path="corporate" element={<Corporate />} />
        <Route path="corporate/contracts" element={<Contracts />} />
        <Route path="corporate/pricing-settings" element={<CorporatePricingSettings />} />
        <Route path="corporate/:id" element={<CorporateDetail />} />
        <Route path="users/corporate-users" element={<Users />} />
        <Route path="cooperate" element={<Navigate to="/dashboard/corporate" replace />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="promotions" element={<Promotions />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="settings" element={<Settings />} />
        <Route path="settings/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

export default DashboardRoutes
