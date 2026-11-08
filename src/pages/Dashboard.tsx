
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import UserDashboard from "./dashboard/UserDashboard";
import BabalawoDashboard from "./dashboard/BabalawoDashboard";
import AdminDashboard from "./dashboard/AdminDashboard";
import { Loader2 } from "lucide-react";

const Dashboard = () => {
  const { userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 to-pink-50">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  switch (userProfile?.role) {
    case "user":
      return <UserDashboard />;
    case "babalawo":
      return <BabalawoDashboard />;
    case "admin":
      return <AdminDashboard />;
    default:
      return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-pink-50">
          <h1 className="text-3xl font-bold mb-4 text-gray-900">Welcome</h1>
          <p className="text-lg text-gray-700">
            You're signed in! Your dashboard is being prepared.
          </p>
        </div>
      );
  }
};

export default Dashboard;
