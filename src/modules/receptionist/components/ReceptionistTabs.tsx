type ReceptionistTab = "home" | "appointments" | "liveQueue" | "profile"

type Props = {
  activeTab: ReceptionistTab
  onTabChange: (tab: ReceptionistTab) => void
}

export function ReceptionistTabs({ activeTab, onTabChange }: Props) {
  const tabs = [
    { key: "home", label: "Home" },
    { key: "appointments", label: "Appointments" },
    { key: "liveQueue", label: "Live Queue" },
    { key: "profile", label: "Profile" },
  ] as const

  return (
    <div className="flex gap-3 border-b bg-white p-4">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onTabChange(tab.key)}
          className={
            activeTab === tab.key
              ? "rounded-lg bg-blue-600 px-4 py-2 text-white"
              : "rounded-lg px-4 py-2 text-slate-700 hover:bg-slate-100"
          }
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
