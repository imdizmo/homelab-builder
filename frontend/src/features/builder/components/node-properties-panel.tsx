
import { useEffect, useState } from "react"
import { useBuilderStore } from "../store/builder-store"
import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"
import { Button } from "../../../components/ui/button"
import { Input } from "../../../components/ui/input"
import { Label } from "../../../components/ui/label"
import { X, Trash2, Save } from "lucide-react"

export function NodePropertiesPanel() {
    const { selectedNodeId, hardwareNodes, selectNode, updateHardware, removeHardware } = useBuilderStore()
    const [name, setName] = useState("")
    const [ip, setIp] = useState("")

    const selectedNode = hardwareNodes.find(n => n.id === selectedNodeId)

    useEffect(() => {
        if (selectedNode) {
            setName(selectedNode.name)
            setIp(selectedNode.ip || "")
        }
    }, [selectedNode])

    if (!selectedNode) return null

    const handleSave = () => {
        updateHardware(selectedNode.id, { name, ip })
    }

    const handleDelete = () => {
        removeHardware(selectedNode.id)
        selectNode(null)
    }

    return (
        <Card className="absolute top-4 right-4 w-80 shadow-xl z-10 border-l animate-in slide-in-from-right-10">
            <CardHeader className="flex flex-row items-center justify-between py-3 bg-muted/50">
                <CardTitle className="text-sm font-medium">Node Properties</CardTitle>
                <Button variant="ghost" size="icon" onClick={() => selectNode(null)} className="h-6 w-6">
                    <X className="h-4 w-4" />
                </Button>
            </CardHeader>
            <CardContent className="space-y-4 pt-4">
                <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input 
                        id="name" 
                        value={name} 
                        onChange={(e) => setName(e.target.value)} 
                        placeholder="e.g. Main Router"
                    />
                </div>

                <div className="space-y-2">
                    <Label htmlFor="ip">IP Address</Label>
                    <Input 
                        id="ip" 
                        value={ip} 
                        onChange={(e) => setIp(e.target.value)} 
                        placeholder="e.g. 192.168.1.1"
                    />
                </div>

                <div className="pt-4 flex gap-2">
                    <Button onClick={handleSave} className="flex-1" size="sm">
                        <Save className="h-4 w-4 mr-2" /> Save
                    </Button>
                    <Button onClick={handleDelete} variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" />
                    </Button>
                </div>
                
                <div className="text-xs text-muted-foreground pt-2 border-t mt-2">
                    Type: <span className="font-mono">{selectedNode.type}</span><br/>
                    ID: <span className="font-mono opacity-50">{selectedNode.id}</span>
                </div>
            </CardContent>
        </Card>
    )
}
