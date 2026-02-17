import { Navigate, Route, Routes } from 'react-router-dom'
import DashboardLayout from '../../components/layout/DashboardLayout'
import Analytics from './Analytics'
import Booking from './Booking'
import Buses from './Buses'
import Complaints from './Complaints'
import Corporate from './Corporate'
import Driver from './Driver'
import Passenger from './Passenger'
import Users from './Users'

function DashboardRoutes() {
  return (
    <DashboardLayout>
      <Routes>
        <Route path="analytics" element={<Analytics />} />
        <Route path="booking" element={<Booking />} />
        <Route path="buses" element={<Buses />} />
        <Route path="users" element={<Users />} />
        <Route path="passenger" element={<Passenger />} />
        <Route path="driver" element={<Driver />} />
        <Route path="corporate" element={<Corporate />} />
        <Route path="complaints" element={<Complaints />} />
        <Route path="*" element={<Navigate to="analytics" replace />} />
      </Routes>
    </DashboardLayout>
  )
}

export default DashboardRoutes
