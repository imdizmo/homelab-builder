import { Card, CardContent, CardHeader, CardTitle } from "../../../components/ui/card"

// Simplified version without Accordion if I don't want to install it yet, 
// using generic details/summary or simple cards.
// But Accordion is standard for checklists.
// I'll install @radix-ui/react-accordion if needed, or build simple one.
// For now, I'll use simple cards stack.

export default function ChecklistPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">Setup Checklist</h1>
        <p className="text-muted-foreground">Follow these steps to set up your homelab securely and efficiently used industry best practices.</p>
      </div>

      <div className="space-y-4">
        <Card>
            <CardHeader>
                <CardTitle>1. Hardware Preparation</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Assemble your server or Mini PC.</p>
                <p>• Connect to router via Ethernet (Wi-Fi is not recommended for servers).</p>
                <p>• Update BIOS/UEFI to latest version.</p>
                <p>• Configure BIOS: Enable Virtualization (VT-x/AMD-V), set Power On After Power Loss to "On".</p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>2. Operating System (Proxmox VE Recommended)</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Download Proxmox VE ISO from official site.</p>
                <p>• Flash to USB using Etcher or Rufus.</p>
                <p>• Install on the target drive (Select ZFS if you have ECC RAM, otherwise ext4/xfs is fine).</p>
                <p>• Set a static IP for the management interface.</p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>3. Basic Security</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Create a non-root user for daily operations.</p>
                <p>• Disable password authentication for SSH, use SSH Keys only.</p>
                <p>• Set up a firewall (UFW or pfsense/OPNsense).</p>
                <p>• Regular backups (configure Proxmox Backup Server if possible).</p>
            </CardContent>
        </Card>

        <Card>
            <CardHeader>
                <CardTitle>4. Helper Tools</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-muted-foreground">
                <p>• Install <strong>t(e)yte's scripts</strong> for easy VM/LXC creation in Proxmox.</p>
                <p>• Set up Portainer or Dockge for managing Docker containers.</p>
                <p>• Set up Nginx Proxy Manager for easy SSL termination.</p>
            </CardContent>
        </Card>
      </div>
    </div>
  )
}
