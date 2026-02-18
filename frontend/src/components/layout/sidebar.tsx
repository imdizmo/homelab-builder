import { NavLink } from "react-router-dom"
import { LayoutDashboard, Server, ShoppingCart, CheckSquare, Settings, Hammer } from "lucide-react"
import { cn } from "../../lib/utils"
import { api } from "../../lib/api"
// import { Button } from "../ui/button" // Might be used for logout/collapse

const NAV_ITEMS = [
  { label: "Dashboard", href: "/", icon: LayoutDashboard },
  { label: "Services", href: "/services", icon: Server },
  { label: "Shopping List", href: "/shopping-list", icon: ShoppingCart },
  { label: "Setup Guide", href: "/checklist", icon: CheckSquare },
  { label: "Admin", href: "/admin", icon: Settings },
]

export function Sidebar({ className }: { className?: string }) {
  return (
    <aside className={cn("fixed left-0 top-0 z-30 h-screen w-64 border-r bg-card hidden md:flex flex-col", className)}>
      <div className="flex h-16 items-center border-b px-6">
        <Hammer className="mr-2 h-6 w-6 text-primary" />
        <span className="text-lg font-bold tracking-tight">Homelab Builder</span>
      </div>
      
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {NAV_ITEMS.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={({ isActive }) =>
                cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground"
                )
              }
            >
              <item.icon className="mr-2 h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </div>

      <div className="border-t p-4 flex gap-2">
        <div className="flex-1 flex items-center gap-3 rounded-lg border bg-muted/50 p-3">
             {/* Simple Auth Placeholder */}
            <div className="h-8 w-8 rounded-full bg-primary/20 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">?</span>
            </div>
             <div className="flex flex-col overflow-hidden">
                <span className="text-sm font-medium truncate">Guest</span>
                <button 
                  onClick={() => {
                    api.devLogin("demo@homelab.com").then(() => window.location.reload())
                  }}
                  className="text-xs text-primary hover:underline text-left"
                >
                    Login (Dev Mode)
                </button>
            </div>
        </div>
        <ThemeToggle />
      </div>
    </aside>
  )
}

function ThemeToggle() {
    const { theme, setTheme } = useTheme()
    return (
        <button 
            onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
            className="p-3 rounded-lg border hover:bg-muted bg-background"
            title="Toggle Theme"
        >
            {theme === 'dark' ? '🌙' : '☀️'}
        </button>
    )
}
import { useTheme } from "../theme-provider"
