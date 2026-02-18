import { useParams, useNavigate } from "react-router-dom"
import { useQuery } from "@tanstack/react-query"
import { api } from "../../../lib/api"
import type { Service } from "../../../types"
import { useBuilderStore } from "../../builder/store/builder-store"
import { Button } from "../../../components/ui/button"
import { Badge } from "../../../components/ui/badge"
import { Skeleton } from "../../../components/ui/skeleton"
import { ArrowLeft, ExternalLink, Check } from "lucide-react"

export default function ServiceDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { selectedServices, toggleService } = useBuilderStore()
  
  const { data: service, isLoading, error } = useQuery({
    queryKey: ["service", id],
    queryFn: async () => {
      const res = await api.get<{ data: Service }>(`/api/services/${id}`)
      return res.data
    },
    enabled: !!id
  })

  // Since the API calls return { data: Service }, wait, api.get returns T.
  // Previous usages: `api.get<{ data: Service[] }>("/api/services")` which returned `{ data: ... }` object?
  // If my api.get returns `res.json()`, and the endpoint returns `{ data: ... }`, then yes.
  // But wait, `useAdminServices` returned `response.data`.
  // Here I should probably return `response.data` too.
  
  if (isLoading) {
    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <Button variant="ghost" onClick={() => navigate(-1)}><ArrowLeft className="mr-2 h-4 w-4" /> Back</Button>
            <Skeleton className="h-12 w-2/3" />
            <Skeleton className="h-64 w-full rounded-xl" />
        </div>
    )
  }

  if (error || !service) {
    return (
        <div className="flex flex-col items-center justify-center p-12">
            <h2 className="text-2xl font-bold">Service not found</h2>
            <Button className="mt-4" onClick={() => navigate('/services')}>Return to Catalog</Button>
        </div>
    )
  }

  const isSelected = selectedServices.some(s => s.id === service.id)

  return (
    <div className="space-y-8 max-w-4xl mx-auto">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Catalog
      </Button>

      <div className="grid gap-8 md:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
            <div className="space-y-2">
                <div className="flex items-center gap-3">
                    <h1 className="text-4xl font-bold tracking-tight">{service.name}</h1>
                    <Badge variant="outline" className="text-base px-3 py-1">{service.category}</Badge>
                </div>
                <p className="text-xl text-muted-foreground">{service.description}</p>
            </div>

            <div className="border rounded-xl p-6 bg-card">
                <h3 className="font-semibold mb-4">Hardware Requirements</h3>
                <div className="grid grid-cols-3 gap-8">
                    <div>
                        <div className="text-sm text-muted-foreground">Minimal CPU</div>
                        <div className="text-2xl font-bold">{service.requirements?.min_cpu_cores} vCPU</div>
                    </div>
                    <div>
                        <div className="text-sm text-muted-foreground">Minimal RAM</div>
                        <div className="text-2xl font-bold">{service.requirements?.min_ram_mb} MB</div>
                    </div>
                    <div>
                        <div className="text-sm text-muted-foreground">Storage</div>
                        <div className="text-2xl font-bold">{service.requirements?.min_storage_gb} GB</div>
                    </div>
                </div>
            </div>
            
            {service.official_website && (
                <Button variant="outline" asChild>
                    <a href={service.official_website} target="_blank" rel="noreferrer">
                        Visit Official Website <ExternalLink className="ml-2 h-4 w-4" />
                    </a>
                </Button>
            )}
        </div>

        <div className="space-y-6">
            <div className="border rounded-xl p-6 bg-muted/30 sticky top-24">
                <h3 className="font-semibold mb-4">Add to your Homelab</h3>
                <div className="space-y-4">
                    <div className="flex justify-between text-sm">
                        <span>Docker Support</span>
                        <span className="font-medium">{service.docker_support ? "Yes" : "No"}</span>
                    </div>
                    <div className="flex justify-between text-sm">
                        <span>Maturity</span>
                        <span className="font-medium">Stable</span>
                    </div>
                    <div className="pt-4">
                        <Button 
                            className="w-full" 
                            size="lg" 
                            variant={isSelected ? "secondary" : "default"}
                            onClick={() => toggleService(service)}
                        >
                            {isSelected ? (
                                <>
                                    <Check className="mr-2 h-4 w-4" /> Added to Build
                                </>
                            ) : "Add Service"}
                        </Button>
                    </div>
                </div>
            </div>
        </div>
      </div>
    </div>
  )
}
