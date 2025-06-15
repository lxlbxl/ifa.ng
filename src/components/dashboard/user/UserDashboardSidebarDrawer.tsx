
import React from "react";
import Sidebar from "./Sidebar";

interface UserDashboardSidebarDrawerProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  onClose: () => void;
}

const UserDashboardSidebarDrawer: React.FC<UserDashboardSidebarDrawerProps> = ({
  activeSection,
  onSectionChange,
  onClose
}) => {
  // Wrap Sidebar to allow closing on section change
  return (
    <Sidebar
      activeSection={activeSection}
      onSectionChange={(section) => {
        onSectionChange(section);
        onClose();
      }}
    />
  );
};

export default UserDashboardSidebarDrawer;
