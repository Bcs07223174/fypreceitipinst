"use client"

import { useReceptionistHome } from "@/modules/receptionist/hooks/useReceptionistHome"

export function HomeTab() {
  const { data, loading, error } = useReceptionistHome()

  if (loading) return <p>Loading home data...</p>
  if (error) return <p className="text-red-500">{error}</p>

  return (
    <section>
      <h1 className="text-2xl font-bold">Receptionist Home</h1>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl bg-white p-5 shadow">
          <p>Total Appointments</p>
          <h2 className="text-3xl font-bold">{data?.totalAppointments}</h2>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p>Waiting Patients</p>
          <h2 className="text-3xl font-bold">{data?.waitingPatients}</h2>
        </div>

        <div className="rounded-xl bg-white p-5 shadow">
          <p>Completed Today</p>
          <h2 className="text-3xl font-bold">{data?.completedToday}</h2>
        </div>
      </div>
    </section>
  )
}
