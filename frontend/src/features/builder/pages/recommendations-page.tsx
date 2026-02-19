import { useState } from "react"
import { useBuilderStore } from "../store/builder-store"
import { Button } from "../../../components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Cpu, HardDrive, MemoryStick, ShoppingCart, CheckCircle2, ChevronDown, ChevronUp } from "lucide-react"
import { useNavigate } from "react-router-dom"
import VisualBuilder from "../components/visual-builder"
import { cn } from "../../../lib/utils"

export default function RecommendationsPage() {
  const { hardwareNodes, totalCpu, totalRam, totalStorage } = useBuilderStore()
  const navigate = useNavigate()
  const [showInsights, setShowInsights] = useState(false)

  if (hardwareNodes.length === 0) {
    return (
        <div className="flex flex-col items-center justify-center p-12 text-center h-[calc(100vh-4rem)]">
            <h2 className="text-2xl font-bold mb-4">No Hardware Configured</h2>
            <p className="text-muted-foreground mb-8">Please add some hardware in the Visual Builder first.</p>
            <Button onClick={() => navigate('/builder')}>Go to Builder</Button>
        </div>
    )
  }

  const cpu = totalCpu()
  const ram = totalRam()
  const storage = totalStorage()

  let tier = "Entry Level"
  let description = "A simple Mini PC or Raspberry Pi 5 cluster will suffice."
  if (cpu > 8 || ram > 32768) {
    tier = "Pro / Enterprise"
    description = "You need a dedicated server or high-end workstation (Threadripper/Epyc/Xeon)."
  } else if (cpu > 4 || ram > 8192) {
    tier = "Mid-Range / Enthusiast"
    description = "Look for a powerful Mini PC (NUC/Ryzen) or a used SFF workstation."
  }

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden">
      {/* Header / Insights Toggle */}
      <div className="border-b bg-background/95 backdrop-blur z-10 shrink-0">
          <div className="flex items-center justify-between p-4 max-w-7xl mx-auto w-full">
            <div>
                <h1 className="text-lg font-bold tracking-tight flex items-center gap-2">
                    System Topology
                    <span className="text-muted-foreground font-normal text-sm">
                        ({hardwareNodes.length} nodes)
                    </span>
                </h1>
            </div>
            <div className="flex gap-2">
                 <Button variant="outline" size="sm" onClick={() => setShowInsights(!showInsights)}>
                    {showInsights ? <ChevronUp className="h-4 w-4 mr-2" /> : <ChevronDown className="h-4 w-4 mr-2" />}
                    {showInsights ? "Hide Insights" : "Show Recommendations"}
                </Button>
                <Button size="sm" onClick={() => navigate('/shopping-list')}>
                    Shopping List <ShoppingCart className="ml-2 h-4 w-4" />
                </Button>
            </div>
          </div>

          {/* Collapsible Insights Panel */}
          <div className={cn(
              "grid md:grid-cols-2 gap-4 p-4 bg-muted/20 border-t transition-all duration-300 ease-in-out px-4 max-w-7xl mx-auto w-full",
              showInsights ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0 overflow-hidden py-0 border-none"
          )}>
               <Card>
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm">Resource Usage</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-3">
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2"><Cpu className="h-4 w-4"/> CPU</span>
                            <span className="font-bold">{cpu} vCPU</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2"><MemoryStick className="h-4 w-4"/> RAM</span>
                            <span className="font-bold">{Math.ceil(ram / 1024)} GB</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="flex items-center gap-2"><HardDrive className="h-4 w-4"/> Storage</span>
                             <span className="font-bold">{storage} GB</span>
                        </div>
                    </CardContent>
               </Card>

               <Card className="bg-primary/5 border-primary/20">
                    <CardHeader className="py-3">
                        <CardTitle className="text-sm text-primary">Recommended Tier: {tier}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 pb-3 text-sm">
                        <p className="text-muted-foreground">{description}</p>
                        <div className="flex gap-2 text-primary font-medium text-xs items-center">
                            <CheckCircle2 className="h-3 w-3" /> Dedicated CPU
                            <CheckCircle2 className="h-3 w-3" /> Proxmox/Unraid
                        </div>
                    </CardContent>
               </Card>
          </div>
      </div>

      {/* Main Builder Area - Takes remaining space */}
      <div className="flex-1 bg-slate-50 dark:bg-slate-900 overflow-hidden relative">
        <VisualBuilder />
      </div>

    </div>
  )
}
