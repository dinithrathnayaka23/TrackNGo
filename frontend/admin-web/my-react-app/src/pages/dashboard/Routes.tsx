import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Dashboard from './Analytics'
import AnalyticsPage from './AnalyticsPage'
import Booking from './Booking'
import BusDetail from './BusDetail'
import Buses from './Buses'
import Chat from './Chat'
import Complaints from './Complaints'
import Corporate from './Corporate'
import CorporateDetail from './CorporateDetail'
import RoutesPage from './RoutesPage'
import Driver from './Driver'
import Passenger from './Passenger'
import Users from './Users'

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
        <Route path="corporate/:id" element={<CorporateDetail />} />
        <Route path="users/corporate-users" element={<Users />} />
        <Route path="cooperate" element={<Navigate to="/dashboard/corporate" replace />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="routes" element={<RoutesPage />} />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

export default DashboardRoutes
