import { BrowserRouter, Navigate, Route, Routes as RouterRoutes } from "react-router-dom";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import Dashboard from "../pages/dashboard/Dashboard";
import Buses from "../pages/dashboard/Buses";
import Complaints from "../pages/dashboard/Complaints";
import Driver from "../pages/dashboard/Driver";
import Analytics from "../pages/dashboard/Analytics";
import Booking from "../pages/dashboard/Booking";
import RoutesPage from "../pages/dashboard/Routes";
import Users from "../pages/dashboard/Users";
import Chat from "../pages/dashboard/Chat";
import DashboardLayout from "../components/layout/DashboardLayout";

function AppRoutes() {
  return (
    <BrowserRouter>
      <RouterRoutes>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/dashboard"
          element={
            <DashboardLayout title="Dashboard" breadcrumb={["Home", "Dashboard"]}>
              <Dashboard />
            </DashboardLayout>
          }
        />
        <Route
          path="/users"
          element={
            <DashboardLayout title="Users" breadcrumb={["Home", "Users"]}>
              <Users />
            </DashboardLayout>
          }
        />
        <Route
          path="/buses"
          element={
            <DashboardLayout title="Buses" breadcrumb={["Home", "Buses"]}>
              <Buses />
            </DashboardLayout>
          }
        />
        <Route
          path="/routes"
          element={
            <DashboardLayout title="Routes" breadcrumb={["Home", "Routes"]}>
              <RoutesPage />
            </DashboardLayout>
          }
        />
        <Route
          path="/bookings"
          element={
            <DashboardLayout title="Bookings" breadcrumb={["Home", "Bookings"]}>
              <Booking />
            </DashboardLayout>
          }
        />
        <Route
          path="/driver"
          element={
            <DashboardLayout
              title="Driver"
              breadcrumb={["Home", "Driver"]}
            >
              <Driver />
            </DashboardLayout>
          }
        />
        <Route
          path="/complaints"
          element={
            <DashboardLayout
              title="Complaints"
              breadcrumb={["Home", "Complaints"]}
            >
              <Complaints />
            </DashboardLayout>
          }
        />
        <Route
          path="/analytics"
          element={
            <DashboardLayout
              title="Analytics"
              breadcrumb={["Home", "Analytics"]}
            >
              <Analytics />
            </DashboardLayout>
          }
        />
        <Route
          path="/chat"
          element={
            <DashboardLayout
              title="Chat"
              breadcrumb={["Home", "Chat"]}
            >
              <Chat />
            </DashboardLayout>
          }
        />
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </RouterRoutes>
    </BrowserRouter>
  );
}

export default AppRoutes;
