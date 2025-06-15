
import React from "react";
import UserSidebarDrawerContent from "./UserSidebarDrawerContent";

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
  // Wrap content: close drawer on section change
  return (
    <UserSidebarDrawerContent
      activeSection={activeSection}
      onSectionChange={(section) => {
        onSectionChange(section);
        onClose();
      }}
    />
  );
};

export default UserDashboardSidebarDrawer;
