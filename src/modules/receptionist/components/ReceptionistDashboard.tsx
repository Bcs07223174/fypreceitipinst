"use client"

import { useState } from "react"
import { ReceptionistTabs } from "./ReceptionistTabs"
import { HomeTab } from "@/modules/receptionist/tabs/home/HomeTab"
import { AppointmentsTab } from "@/modules/receptionist/tabs/appointments/AppointmentsTab"
import { LiveQueueTab } from "@/modules/receptionist/tabs/live-queue/LiveQueueTab"
import { ProfileTab } from "@/modules/receptionist/tabs/profile/ProfileTab"

type ReceptionistTab = "home" | "appointments" | "liveQueue" | "profile"

export function ReceptionistDashboard() {
  const [activeTab, setActiveTab] = useState<ReceptionistTab>("home")

  return (
    <div className="min-h-screen bg-slate-50">
      <ReceptionistTabs activeTab={activeTab} onTabChange={setActiveTab} />

      <main className="p-6">
        {activeTab === "home" && <HomeTab />}
        {activeTab === "appointments" && <AppointmentsTab />}
        {activeTab === "liveQueue" && <LiveQueueTab />}
        {activeTab === "profile" && <ProfileTab />}
      </main>
    </div>
  )
}
