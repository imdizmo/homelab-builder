import { useAdminStats, useAdminServices } from "../api/use-admin"
import { AdminStats } from "../components/admin-stats"
import { ServiceDialog } from "../components/service-dialog"
import { Skeleton } from "../../../components/ui/skeleton"
import { ServicesTable } from "../components/services-table"

export default function AdminPage() {
  const { data: stats, isLoading: statsLoading } = useAdminStats()
  const { data: services, isLoading: servicesLoading } = useAdminServices()

  return (
    <div className="flex flex-col gap-8">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
        <ServiceDialog />
      </div>

      {statsLoading ? (
          <div className="grid gap-4 md:grid-cols-3">
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
            <Skeleton className="h-32" />
          </div>
      ) : (
          <AdminStats stats={stats} />
      )}

      <div className="space-y-4">
        <h2 className="text-xl font-semibold tracking-tight">Service Management</h2>
        {/* Placeholder for table */}
        <div className="border rounded-md">
            <ServicesTable services={services} isLoading={servicesLoading} />
        </div>
      </div>
    </div>
  )
}
