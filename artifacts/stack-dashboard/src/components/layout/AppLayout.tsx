import { ReactNode } from "react";
import { useLocation, Link } from "wouter";
import { 
  LayoutDashboard, 
  Ticket, 
  FileText, 
  BarChart, 
  LineChart, 
  Settings, 
  BookOpen, 
  LogOut, 
  Bell, 
  User 
} from "lucide-react";
import { clearToken } from "@/lib/auth";
import { useGetMe } from "@workspace/api-client-react";

export function AppLayout({ children }: { children: ReactNode }) {
  const [location, setLocation] = useLocation();
  const { data: user } = useGetMe({ query: { queryKey: ["me"], enabled: true } });

  const handleLogout = () => {
    clearToken();
    setLocation("/login");
  };

  const navItems = [
    { name: "Dashboard", path: "/dashboard", icon: LayoutDashboard },
    { name: "Tickets", path: "/tickets", icon: Ticket },
    { name: "Logs", path: "/logs", icon: FileText },
    { name: "Reports", path: "/reports", icon: BarChart },
    { name: "ROI Dashboard", path: "/roi", icon: LineChart },
    { name: "Admin", path: "/admin", icon: Settings },
    { name: "SOP Manager", path: "/sop-manager", icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex bg-slate-50 dark:bg-slate-900">
      {/* Sidebar */}
      <aside className="w-60 bg-sidebar text-sidebar-foreground flex flex-col border-r border-sidebar-border shadow-lg z-10 flex-shrink-0">
        <div className="h-16 flex items-center px-6 border-b border-sidebar-border/50 shrink-0">
          <div className="flex items-center gap-2 font-bold text-xl tracking-tight text-white">
            <div className="w-6 h-6 rounded bg-sidebar-primary flex items-center justify-center">
              <span className="text-white text-sm font-black">S</span>
            </div>
            STACK
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => {
            const isActive = location.startsWith(item.path);
            const Icon = item.icon;
            return (
              <Link key={item.path} href={item.path} className={`flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors text-sm font-medium ${isActive ? 'bg-sidebar-primary text-sidebar-primary-foreground' : 'text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground'}`}>
                <Icon size={18} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4 border-t border-sidebar-border/50 shrink-0">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-sm font-semibold">
              {user?.full_name?.charAt(0) || "U"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium truncate">{user?.full_name || "Agent"}</div>
              <div className="text-xs text-sidebar-foreground/60 truncate">{user?.role || "Agent"}</div>
            </div>
          </div>
          <button onClick={handleLogout} className="flex w-full items-center gap-3 px-3 py-2 rounded-md text-sm font-medium text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors">
            <LogOut size={18} />
            Logout
          </button>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Topbar */}
        <header className="h-16 bg-card border-b border-border flex items-center justify-between px-6 shrink-0 z-10 shadow-sm">
          <div className="text-lg font-semibold text-foreground">
            {navItems.find(i => location.startsWith(i.path))?.name || "Dashboard"}
          </div>
          <div className="flex items-center gap-4">
            <button className="text-muted-foreground hover:text-foreground relative">
              <Bell size={20} />
              <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full"></span>
            </button>
            <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center">
              <User size={18} />
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-auto p-6">
          <div className="max-w-[1400px] mx-auto">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
