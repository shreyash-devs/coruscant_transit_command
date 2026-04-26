import { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  BarChart3,
  Truck,
  FlaskConical,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Radio,
  Map,
  MapPin,
  MessageSquare,
  ShieldCheck,
  BrainCircuit,
  Command,
} from 'lucide-react';
import { useState } from 'react';
import { getSessionRole } from '@/lib/suggestionsApi';

const USER_NAV = [
  { path: '/dashboard', label: 'Command Hub', icon: LayoutDashboard },
  { path: '/analytics', label: 'Analytics', icon: BarChart3 },
  { path: '/suggestions', label: 'Suggestions', icon: MessageSquare },
  { path: '/prediction', label: 'Demand Intelligence', icon: BrainCircuit },
];

const ADMIN_EXTRA_NAV = [
  { path: '/admin/suggestions', label: 'User Reports Panel', icon: ShieldCheck },
  { path: '/fleet', label: 'Fleet Status', icon: Truck },
  { path: '/simulation', label: 'Sim Grid', icon: FlaskConical },
  { path: '/routes-map', label: 'Tactical Map', icon: Map },
  { path: '/stops-map', label: 'Node Map', icon: MapPin },
];

export default function AppLayout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const role = getSessionRole();
  const isAdmin = role === 'admin';

  const navItems = isAdmin 
    ? [...USER_NAV.filter(n => n.path !== '/suggestions'), ...ADMIN_EXTRA_NAV] 
    : USER_NAV;

  const handleLogout = () => {
    sessionStorage.removeItem('ctc_role');
    sessionStorage.removeItem('ctc_user_id');
    navigate('/');
  };

  return (
    <div className="flex min-h-screen bg-background selection:bg-primary/20 selection:text-primary">
      {/* Sidebar - Refined with glass-panel logic */}
      <aside className={`${collapsed ? 'w-20' : 'w-72'} hidden border-r border-border/40 bg-card/40 backdrop-blur-3xl p-4 transition-all duration-500 ease-out md:flex md:flex-col shadow-2xl relative z-20`}>
        
        {/* Brand Header */}
        <div className="mb-8 flex items-center justify-between px-2">
          {!collapsed ? (
            <div className="flex items-center gap-3 animate-fade-in">
              <div className="p-1.5 rounded-lg bg-primary/10 border border-primary/20 shadow-lg shadow-primary/5">
                <Radio className="text-primary" size={20} />
              </div>
              <div className="flex flex-col">
                <span className="text-[13px] font-display font-bold tracking-widest text-foreground uppercase">Coruscant</span>
                <span className="text-[9px] font-mono text-muted-foreground uppercase opacity-60">Transit Protocol</span>
              </div>
            </div>
          ) : (
             <div className="mx-auto p-1.5 rounded-lg bg-primary/10 border border-primary/20">
                <Radio className="text-primary" size={20} />
             </div>
          )}
        </div>

        {/* Admin Badge */}
        {!collapsed && isAdmin && (
          <div className="mb-6 mx-2 px-3 py-1.5 rounded-lg bg-secondary/40 border border-border/50 flex items-center gap-2 animate-fade-in">
            <span className="w-1.5 h-1.5 rounded-full bg-neon-amber animate-pulse shadow-[0_0_8px_hsl(var(--neon-amber))]" />
            <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider font-bold">Authenticated Admin</p>
          </div>
        )}

        {/* Primary Navigation */}
        <nav className="flex-1 space-y-1.5 custom-scrollbar overflow-y-auto px-1">
          {navItems.map(({ path, label, icon: Icon }) => {
            const active = location.pathname === path;
            const isAdminPanel = path === '/admin/suggestions';
            
            return (
              <Link
                key={path}
                to={path}
                className={`group flex items-center gap-3.5 rounded-xl px-3 py-3 text-[13px] font-medium transition-all duration-300 relative border ${
                  active
                    ? 'bg-primary/10 text-primary border-primary/30 shadow-lg shadow-primary/5'
                    : isAdminPanel
                    ? 'text-neon-amber hover:bg-secondary/60 hover:text-foreground border-transparent hover:border-border'
                    : 'text-muted-foreground hover:bg-secondary/60 hover:text-foreground border-transparent hover:border-border'
                }`}
              >
                <div className={`transition-transform duration-300 ${active ? 'scale-110' : 'group-hover:scale-110'}`}>
                   <Icon size={19} strokeWidth={active ? 2.5 : 2} />
                </div>
                {!collapsed && <span className="font-mono tracking-tight uppercase text-[11px] whitespace-nowrap">{label}</span>}
                {active && !collapsed && (
                   <div className="absolute right-3 w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Bottom Utility Actions */}
        <div className="border-t border-border/40 pt-5 mt-4 space-y-2">
          <button
            onClick={() => setCollapsed(!collapsed)}
            className="w-full flex items-center gap-3.5 rounded-xl px-3 py-3 text-[13px] font-mono text-muted-foreground transition-all hover:bg-secondary/60 hover:text-foreground border border-transparent hover:border-border"
          >
            <div className="transition-transform group-hover:rotate-180 duration-500">
               {collapsed ? <PanelLeftOpen size={19} /> : <PanelLeftClose size={19} />}
            </div>
            {!collapsed && <span className="text-[11px] uppercase tracking-wider">Interface Dock</span>}
          </button>
          
          <button
            onClick={handleLogout}
            className="group w-full flex items-center gap-3.5 rounded-xl px-3 py-3 text-[13px] font-mono text-muted-foreground transition-all hover:bg-destructive/10 hover:text-destructive border border-transparent hover:border-destructive/20"
          >
            <LogOut size={19} className="transition-transform group-hover:-translate-x-1 duration-300" />
            {!collapsed && <span className="text-[11px] uppercase tracking-wider">De-Authenticate</span>}
          </button>
        </div>
      </aside>

      {/* Main Command Display */}
      <main className="relative flex-1 overflow-auto bg-background/50 backdrop-blur-sm">
        <div className="pointer-events-none fixed inset-0 opacity-[0.04]">
          <div className="grid-pattern h-full w-full" />
        </div>
        <div className="relative z-10 h-full p-2 lg:p-4">
           <div className="p-4 lg:p-6 bg-card/20 rounded-[2rem] border border-border/20 shadow-inner min-h-full">
            {children}
           </div>
        </div>
      </main>
    </div>
  );
}
