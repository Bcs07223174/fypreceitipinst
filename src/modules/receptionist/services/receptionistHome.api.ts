export async function getReceptionistHome() {
  const res = await fetch("/api/receptionist/home", { cache: "no-store" })

  if (!res.ok) {
    throw new Error("Failed to fetch home data")
  }

  return res.json()
}
