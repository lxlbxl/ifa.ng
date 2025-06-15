
import React from "react";
import { useAuth } from "@/hooks/useAuth";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Bell, Search } from "lucide-react";

const AdminHeader: React.FC = () => {
  const { userProfile } = useAuth();
  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-8 gap-4">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-1 font-playfair tracking-tight">
          Admin Dashboard
        </h1>
        <p className="text-gray-500 text-sm">
          Welcome back, {userProfile?.full_name || "Admin"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        {/* Search Box */}
        <div className="relative">
          <input
            type="text"
            placeholder="Search"
            className="pl-10 pr-3 py-2 rounded-full bg-white/90 shadow border border-gray-200 text-sm outline-none focus:ring-2 focus:ring-indigo-200 min-w-[170px]"
            style={{ fontFamily: "inherit" }}
          />
          <Search className="absolute left-3 top-[9px] text-gray-400" size={18} />
        </div>
        {/* Notification Bell */}
        <button className="rounded-full bg-white p-2 shadow border border-gray-200 hover:bg-gray-100 transition">
          <Bell className="text-gray-500" size={20} />
        </button>
        {/* Profile */}
        <div className="flex items-center gap-2 bg-white/90 shadow px-3 py-1 rounded-full">
          <Avatar>
            <AvatarImage src={userProfile?.avatar_url || ""} />
            <AvatarFallback>
              {userProfile?.full_name?.[0]?.toUpperCase() || "A"}
            </AvatarFallback>
          </Avatar>
          <div className="ml-2">
            <span className="font-semibold text-xs">{userProfile?.full_name || "Admin User"}</span>
            <span className="block text-[11px] text-gray-400 capitalize">
              {userProfile?.role || "Admin"} Account
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminHeader;
