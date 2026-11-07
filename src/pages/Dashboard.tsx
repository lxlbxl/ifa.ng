
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import UserDashboard from "./dashboard/UserDashboard";
import BabalawoDashboard from "./dashboard/BabalawoDashboard";
import AdminDashboard from "./dashboard/AdminDashboard";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { hasRole, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cloth">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  // Highest privilege wins. Roles come from the user_roles table, not the profile.
  const view = hasRole("admin") ? "admin" : hasRole("babalawo") ? "babalawo" : hasRole("user") ? "user" : null;
  switch (view) {
    case "user":
      return <UserDashboard />;
    case "babalawo":
      return <BabalawoDashboard />;
    case "admin":
      return <AdminDashboard />;
    default:
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-cloth">
          <h1 className="text-3xl font-bold mb-4 text-gray-900">Welcome</h1>
          <p className="text-lg text-gray-700">
            You're signed in! Your dashboard is being prepared.
          </p>
        </div>
      );
  }
};

export default Dashboard;
