"use client"

import { useCallback, useEffect, useState } from "react"
import { getReceptionistHome } from "@/modules/receptionist/services/receptionistHome.api"

type HomeData = {
  totalAppointments: number
  waitingPatients: number
  completedToday: number
}

export function useReceptionistHome() {
  const [data, setData] = useState<HomeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState("")

  const fetchHome = useCallback(async () => {
    try {
      setLoading(true)
      setError("")

      const res = await getReceptionistHome()
      setData(res?.data ?? null)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchHome()
  }, [fetchHome])

  return { data, loading, error, refetch: fetchHome }
}
