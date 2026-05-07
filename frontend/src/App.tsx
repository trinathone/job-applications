import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import CursorTrail from "./components/ui/CursorTrail";
import ProtectedRoute from "./components/layout/ProtectedRoute";
import Shell from "./components/layout/Shell";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NotFoundPage from "./pages/NotFoundPage";
import WeeklyPage from "./pages/WeeklyPage";
import ResumePage from "./pages/ResumePage";
import ResumeBuilderPage from "./pages/ResumeBuilderPage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  return (
    <BrowserRouter>
      <CursorTrail />
      <Routes>
        {/* Public */}
        <Route path="/login" element={<LoginPage />} />

        {/* Protected — must be authenticated */}
        <Route element={<ProtectedRoute />}>
          <Route element={<Shell />}>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/dashboard/week" element={<WeeklyPage />} />
            <Route path="/resume" element={<ResumePage />} />
            <Route path="/resume/builder" element={<ResumeBuilderPage />} />
            <Route path="/admin" element={<AdminPage />} />
          </Route>
        </Route>

        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}
