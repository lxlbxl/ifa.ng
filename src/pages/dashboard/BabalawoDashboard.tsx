import React, { useState, useEffect } from "react";
import { Bell, CalendarClock, CalendarDays, Clock, Home, LifeBuoy, Settings as SettingsIcon, Star, Tag, User2, Wallet, Banknote } from "lucide-react";
import { useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { toast } from "@/hooks/use-toast";
import DashboardShell, { type NavGroup } from "@/components/dashboard/shell/DashboardShell";
import { Panel, PanelHeader } from "@/components/dashboard/shell/Panel";
import BabalawoHome from "@/components/dashboard/babalawo/BabalawoHome";
import BabalawoSessions from "@/components/dashboard/babalawo/BabalawoSessions";
import BabalawoAvailabilityManager from "@/components/dashboard/babalawo/BabalawoAvailabilityManager";
import BabalawoPricing from "@/components/dashboard/babalawo/BabalawoPricing";
import BabalawoPayments from "@/components/dashboard/babalawo/BabalawoPayments";
import NetworkStatusBar from "@/components/pwa/NetworkStatusBar";
import InstallButton from "@/components/pwa/InstallButton";
import NotificationSettings from "@/components/pwa/NotificationSettings";
import BabalawoProfileSettings from "@/components/dashboard/babalawo/BabalawoProfileSettings";
import BabalawoEarnings from "@/components/dashboard/babalawo/BabalawoEarnings";
import BabalawoReviews from "@/components/dashboard/babalawo/BabalawoReviews";
import WithdrawalRequestModal from "@/components/dashboard/babalawo/WithdrawalRequestModal";
import BankDetailsModal from "@/components/dashboard/babalawo/BankDetailsModal";
import Settings from "@/components/dashboard/user/Settings";
import Support from "@/components/dashboard/user/Support";
import Notifications from "@/components/dashboard/user/Notifications";
import { PresencePill } from "@/components/dashboard/babalawo/PresenceToggle";
import BabalawoLiveAlerts from "@/components/dashboard/babalawo/BabalawoLiveAlerts";

const GROUPS: NavGroup[] = [
  { label: "Practice", items: [
    { id: "dashboard", label: "Home", icon: Home },
    { id: "consultations", label: "Sessions", icon: CalendarDays },
    { id: "availability", label: "Availability", short: "Hours", icon: CalendarClock },
    { id: "reminders", label: "Reminders", icon: Clock },
    { id: "reviews", label: "Reviews", icon: Star },
  ] },
  { label: "Money", items: [
    { id: "earnings", label: "Earnings & withdrawals", short: "Earnings", icon: Banknote },
    { id: "payments", label: "Payments", icon: Wallet },
    { id: "pricing", label: "Pricing", icon: Tag },
  ] },
  { label: "You", items: [
    { id: "profile", label: "Profile", icon: User2 },
    { id: "notifications", label: "Notifications", icon: Bell },
    { id: "settings", label: "Settings", icon: SettingsIcon },
    { id: "support", label: "Help & support", icon: LifeBuoy },
  ] },
];

const INTROS = {
  consultations: { eyebrow: "Your practice", title: "Sessions", lede: "Consultations, notes to approve and Ebo to perform." },
  availability: { eyebrow: "When clients can book", title: "Availability", lede: "Your weekly hours, one-off exceptions and time off." },
  reminders: { eyebrow: "Stay ready", title: "Reminders", lede: "Choose when we nudge you before a session." },
  reviews: { eyebrow: "What clients say", title: "Reviews" },
  earnings: { eyebrow: "Money", title: "Earnings & withdrawals", lede: "What you have earned, what is held and what you can withdraw." },
  payments: { eyebrow: "Money", title: "Payments", lede: "Every payment and release into your balance." },
  pricing: { eyebrow: "Money", title: "Pricing", lede: "Set what a consultation with you costs." },
  profile: { eyebrow: "How clients see you", title: "Profile" },
  notifications: { eyebrow: "Updates", title: "Notifications" },
  settings: { eyebrow: "Your account", title: "Settings" },
  support: { eyebrow: "We are here", title: "Help & support", lede: "Answers to common questions, or write to us." },
};

const Toggle = ({ title, hint, on }: { title: string; hint: string; on?: boolean }) => (
  <div className="flex items-center justify-between gap-4 py-3">
    <div>
      <p className="font-semibold">{title}</p>
      <p className="text-sm text-muted-foreground">{hint}</p>
    </div>
    <Switch defaultChecked={on} />
  </div>
);

/** Session and ritual reminders. */
const Reminders = () => (
  <div>
    <div className="grid gap-6 lg:grid-cols-2">
      <Panel>
        <PanelHeader eyebrow="Before each session" title="Session reminders" />
        <div className="divide-y divide-line">
          <Toggle title="10 minutes before" hint="Get ready to join" on />
          <Toggle title="30 minutes before" hint="Prepare your space" on />
          <Toggle title="1 hour before" hint="Final preparation" />
        </div>
      </Panel>
      <Panel>
        <PanelHeader eyebrow="For your clients" title="Ebo, Etutu and warnings" />
        <p className="text-muted-foreground">
          Ebo and Etutu you prescribe now live with each consultation, under Sessions, with their ritual date, payment and proof.
        </p>
        <Button className="mt-5" onClick={() => window.dispatchEvent(new CustomEvent("ifa:navigate", { detail: "consultations" }))}>Open sessions</Button>
      </Panel>
    </div>
  </div>
);

const SECTION_MAP: { [key: string]: React.ReactNode } = {
  dashboard: null,
  consultations: <BabalawoSessions />,
  availability: <BabalawoAvailabilityManager />,
  pricing: <BabalawoPricing />,
  payments: <BabalawoPayments />,
  earnings: <BabalawoEarnings />,
  reviews: <BabalawoReviews />,
  notifications: <Notifications />,
  reminders: <Reminders />,
  profile: <BabalawoProfileSettings />,
  settings: (
    <div className="space-y-6">
      <NotificationSettings />
      <Settings />
    </div>
  ),
  support: <Support />,
};

const BabalawoDashboard = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const activeSection = tab && tab in SECTION_MAP ? tab : "dashboard";
  const setActiveSection = (section: string) => setSearchParams(section === "dashboard" ? {} : { tab: section });
  const [withdrawalModalOpen, setWithdrawalModalOpen] = useState(false);
  const [bankDetailsModalOpen, setBankDetailsModalOpen] = useState(false);

  useEffect(() => {
    const openWithdrawalModalHandler = () => setWithdrawalModalOpen(true);
    const openBankDetailsModalHandler = () => setBankDetailsModalOpen(true);

    window.addEventListener("openWithdrawalModal", openWithdrawalModalHandler);
    window.addEventListener("openBankDetailsModal", openBankDetailsModalHandler);

    return () => {
      window.removeEventListener("openWithdrawalModal", openWithdrawalModalHandler);
      window.removeEventListener("openBankDetailsModal", openBankDetailsModalHandler);
    };
  }, []);

  React.useEffect(() => {
    const go = (e: Event) => setActiveSection((e as CustomEvent<string>).detail);
    window.addEventListener("ifa:navigate", go);
    return () => window.removeEventListener("ifa:navigate", go);
  });

  return (
    <DashboardShell
      audience="babalawo"
      groups={GROUPS}
      mobile={["dashboard", "consultations", "availability", "earnings", "profile"]}
      active={activeSection}
      intros={INTROS}
      onNavigate={setActiveSection}
      topBar={<NetworkStatusBar />}
      headerExtra={<><PresencePill /><span className="hidden md:inline-flex"><InstallButton label="Install app" /></span></>}
      persistent={<>
      {/* Consult Now and booking alerts: chime, vibration, and a ringing dialog */}
      <BabalawoLiveAlerts />

      {/* Modals */}
      <WithdrawalRequestModal
        open={withdrawalModalOpen}
        onOpenChange={setWithdrawalModalOpen}
        onSuccess={() => {
          // Refresh earnings data
          if (activeSection === "earnings") {
            window.location.reload();
          }
        }}
      />

      <BankDetailsModal
        open={bankDetailsModalOpen}
        onOpenChange={setBankDetailsModalOpen}
        onSuccess={() => {
          toast({
            title: "Bank details updated",
            description: "Your bank details have been updated successfully"
          });
        }}
      />
      </>}
    >
      {activeSection === "dashboard" ? <BabalawoHome onNavigate={setActiveSection} /> : SECTION_MAP[activeSection]}
    </DashboardShell>
  );
};

export default BabalawoDashboard;
