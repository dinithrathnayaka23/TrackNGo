import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import Login from "../pages/auth/Login";
import Signup from "../pages/auth/Signup";
import Buses from "../pages/dashboard/Buses";
import Complaints from "../pages/dashboard/Complaints";
import DashboardLayout from "../components/layout/DashboardLayout";

function AppRoutes() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/buses"
          element={
            <DashboardLayout title="Buses" breadcrumb={["Home", "Buses"]}>
              <Buses />
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
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default AppRoutes;
