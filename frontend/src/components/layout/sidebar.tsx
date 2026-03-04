import { useState, useEffect } from "react"
import { NavLink, useNavigate } from "react-router-dom"
import { LayoutDashboard, ShoppingCart, CheckSquare, Settings, Hammer, HardDrive, FileCode, ChevronsLeft, ChevronsRight, Heart, Globe, X } from "lucide-react"
import { Github } from "../icons/github"
import { cn } from "../../lib/utils"
import { useAuth } from "../../features/admin/hooks/use-auth"
import { useBuilderStore } from "../../features/builder/store/builder-store"
import { GoogleLoginButton } from "../auth/google-login-button"
import { LayoutTemplate } from "lucide-react"

const STORAGE_KEY = "sidebar-collapsed"

const BASE_NAV_ITEMS = [
  { label: "Projects", href: "/", icon: LayoutDashboard },
  { label: "Config Generator", href: "/generate", icon: FileCode },
  { label: "Hardware Catalog", href: "/hardware", icon: HardDrive },
  { label: "Service Library", href: "/services", icon: CheckSquare },
  { label: "Shopping List", href: "/shopping-list", icon: ShoppingCart },
  { label: "Setup Guide", href: "/checklist", icon: CheckSquare },
  { label: "Admin", href: "/admin", icon: Settings },
]

export function Sidebar({ className }: { className?: string }) {
  const { user } = useAuth()
  const { currentBuildId } = useBuilderStore()
  const navigate = useNavigate()

  const [collapsed, setCollapsed] = useState(() => {
    try { return localStorage.getItem(STORAGE_KEY) === "true" } catch { return false }
  })

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, String(collapsed)) } catch {}
  }, [collapsed])

  const navItems = [
    BASE_NAV_ITEMS[0],
    ...(currentBuildId ? [{ label: "Active Project", href: `/builder/${currentBuildId}`, icon: LayoutTemplate }] : []),
    ...BASE_NAV_ITEMS.slice(1)
  ]

  return (
    <aside
      className={cn(
        "hidden md:flex flex-col border-r border-[#27272A] bg-background h-full transition-all duration-300 ease-in-out overflow-hidden",
        collapsed ? "w-16" : "w-64",
        className
      )}
    >
      {/* Logo */}
      <div className="flex h-16 items-center border-b border-[#27272A] px-4 shrink-0">
        <Hammer className="h-6 w-6 text-primary shrink-0" />
        <span
          className={cn(
            "ml-2 text-lg font-bold tracking-tight whitespace-nowrap transition-all duration-300",
            collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
          )}
        >
          Homelab Builder
        </span>
      </div>

      {/* Navigation */}
      <div className="flex-1 overflow-y-auto py-4">
        <nav className="grid gap-1 px-2">
          {navItems.filter(item => item.label !== "Admin" || user?.is_admin).map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              title={collapsed ? item.label : undefined}
              className={({ isActive }) =>
                cn(
                  "group flex items-center rounded-md px-3 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground",
                  isActive ? "bg-accent text-accent-foreground" : "text-muted-foreground",
                  collapsed && "justify-center px-2"
                )
              }
            >
              <item.icon className={cn("h-4 w-4 shrink-0", !collapsed && "mr-2")} />
              <span
                className={cn(
                  "whitespace-nowrap transition-all duration-300",
                  collapsed ? "opacity-0 w-0 overflow-hidden" : "opacity-100"
                )}
              >
                {item.label}
              </span>
            </NavLink>
          ))}
        </nav>
      </div>

      {/* User section */}
      {!collapsed && (
        <div className="border-t p-4 animate-in fade-in duration-200">
          <div
            className="flex items-center gap-3 rounded-lg border bg-muted/50 p-2 min-h-[3.5rem] cursor-pointer hover:bg-accent/50 transition-colors"
            onClick={() => user ? navigate('/profile') : undefined}
            title={user ? 'View profile' : undefined}
          >
            {user ? (
               <>
                 <img
                   src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`}
                   className="h-8 w-8 rounded-full bg-primary/20 shrink-0"
                   alt={user.name}
                   onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}` }}
                 />
                 <div className="flex flex-col overflow-hidden flex-1">
                     <span className="text-sm font-medium truncate" title={user.name}>{user.name}</span>
                     <span className="text-xs text-muted-foreground truncate">{user.email}</span>
                 </div>
               </>
            ) : (
                <div className="w-full">
                     <GoogleLoginButton />
                </div>
            )}
          </div>
        </div>
      )}

      {/* Collapsed: show avatar only */}
      {collapsed && user && (
        <div className="border-t p-2 flex justify-center animate-in fade-in duration-200">
          <img
            src={user.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(user.email)}`}
            className="h-8 w-8 rounded-full bg-primary/20 cursor-pointer hover:ring-2 ring-primary/40 transition-all"
            alt={user.name}
            onClick={() => navigate('/profile')}
            title={user.name}
            onError={(e) => { (e.target as HTMLImageElement).src = `https://api.dicebear.com/7.x/initials/svg?seed=${user.name}` }}
          />
        </div>
      )}

      {/* Social Links */}
      <div className={cn("border-t p-4 flex items-center shrink-0", collapsed ? "flex-col p-2 gap-4" : "justify-center gap-5")}>
        <a href="https://github.com/Butterski/homelab-builder" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="Project Site">
          <Globe className="h-4 w-4" />
        </a>
        <a href="https://github.com/Butterski" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="GitHub">
          <Github className="h-4 w-4" />
        </a>
        <a href="https://github.com/sponsors/Butterski" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-pink-500 transition-colors" title="Sponsor">
          <Heart className="h-4 w-4" />
        </a>
        <a href="https://x.com/sretub" target="_blank" rel="noopener noreferrer" className="text-muted-foreground hover:text-primary transition-colors" title="X (Twitter)">
          <X className="h-4 w-4" />
        </a>
      </div>

      {/* Collapse toggle */}
      <div className="border-t p-2 flex justify-center shrink-0">
        <button
          onClick={() => setCollapsed(c => !c)}
          className="p-2 rounded-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
        </button>
      </div>
    </aside>
  )
}
