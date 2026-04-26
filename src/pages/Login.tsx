import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Radio, Shield, Eye, EyeOff, Lock, User, Terminal } from 'lucide-react';

export default function Login() {
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<'user' | 'admin'>('user');
  const [showPw, setShowPw] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    // Simulate authentication lag
    setTimeout(() => {
      const userByRole: Record<string, string> = {
        user: 'USR_001',
        admin: 'ADM_001',
      };
      sessionStorage.setItem('ctc_role', role);
      sessionStorage.setItem('ctc_user_id', userByRole[role] ?? 'USR_001');
      navigate('/dashboard');
    }, 1500);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background relative overflow-hidden font-calibri selection:bg-primary/30 selection:text-primary">
      {/* Dynamic Background Elements */}
      <div className="absolute inset-0 grid-pattern pointer-events-none opacity-40" />
      <div className="absolute inset-0 scanline animate-scan opacity-[0.03] pointer-events-none" />
      
      {/* Organic Glow Orbs */}
      <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] rounded-full bg-primary/5 blur-[120px] animate-pulse-slow" />
      <div className="absolute -bottom-[15%] -right-[5%] w-[50%] h-[50%] rounded-full bg-accent/5 blur-[150px] animate-pulse-slow" style={{ animationDelay: '2s' }} />

      <div className="relative z-10 w-full max-w-lg px-6 py-12">
        {/* Header Branding */}
        <div className="text-center mb-10 space-y-4">
          <div className="inline-flex relative group">
            <div className="absolute inset-0 bg-primary/20 blur-xl group-hover:bg-primary/30 transition-all rounded-full scale-150" />
            <div className="relative w-20 h-20 rounded-[2rem] bg-secondary/80 backdrop-blur-md border border-primary/20 flex items-center justify-center shadow-2xl">
              <Radio className="text-primary animate-pulse" size={40} />
            </div>
          </div>
          <div className="space-y-1">
            <h1 className="font-display font-bold text-4xl tracking-[0.15em] text-foreground mix-blend-plus-lighter">
              CORUSCANT
            </h1>
            <div className="flex items-center justify-center gap-2">
              <div className="h-px w-8 bg-border/50" />
              <p className="text-[10px] text-muted-foreground font-mono uppercase tracking-[0.4em]">
                Transit Command Initiative
              </p>
              <div className="h-px w-8 bg-border/50" />
            </div>
          </div>
        </div>

        {/* Modular Authentication Card */}
        <div className="glass-panel-strong overflow-hidden relative border-t-primary/20">
          {/* Accent line */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          
          <form onSubmit={handleLogin} className="p-8 lg:p-10 space-y-8">
            <div className="flex items-center justify-between border-b border-border/40 pb-6 mb-2">
              <div className="flex items-center gap-2.5">
                <Shield size={16} className="text-primary" />
                <span className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
                  Encrypted Session Required
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-neon-green animate-pulse" />
                <span className="text-[10px] font-mono text-neon-green uppercase tracking-tighter">Gateway Secured</span>
              </div>
            </div>

            {/* Inputs Container */}
            <div className="space-y-6">
              <div className="space-y-2 group">
                <label className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest pl-1 group-focus-within:text-primary transition-colors">
                  Operator Identifier
                </label>
                <div className="relative">
                  <User size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                  <input
                    type="email"
                    value={email}
                    autoComplete="off"
                    onChange={e => setEmail(e.target.value)}
                    className="w-full h-14 bg-secondary/30 border border-border/60 hover:border-primary/30 rounded-xl pl-12 pr-4 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all placeholder:text-muted-foreground/10"
                    placeholder=""
                  />
                </div>
              </div>

              <div className="space-y-2 group">
                <label className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest pl-1 group-focus-within:text-primary transition-colors">
                  Secure Passkey
                </label>
                <div className="relative">
                  <Lock size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground/60 transition-colors group-focus-within:text-primary" />
                  <input
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    autoComplete="new-password"
                    onChange={e => setPassword(e.target.value)}
                    className="w-full h-14 bg-secondary/30 border border-border/60 hover:border-primary/30 rounded-xl pl-12 pr-12 text-sm font-mono text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                  <button 
                    type="button" 
                    onClick={() => setShowPw(!showPw)} 
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground/50 hover:text-primary transition-colors p-1"
                  >
                    {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Role/Access Matrix Selector */}
            <div className="space-y-3">
              <label className="text-[11px] text-muted-foreground font-mono uppercase tracking-widest pl-1">
                Authorization Tier
              </label>
              <div className="flex bg-secondary/50 p-1 rounded-xl border border-border/40 relative">
                {(['user', 'admin'] as const).map(tier => (
                  <button
                    key={tier}
                    type="button"
                    onClick={() => setRole(tier)}
                    className={`relative z-10 flex-1 py-3 rounded-lg text-xs font-mono uppercase transition-all duration-300 ${
                      role === tier 
                        ? 'text-primary-foreground font-bold' 
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {tier === 'user' ? (
                      <span className="flex items-center justify-center gap-2"><User size={14} /> USER</span>
                    ) : (
                      <span className="flex items-center justify-center gap-2"><Shield size={14} /> ADMIN</span>
                    )}
                  </button>
                ))}
                {/* Sliding indicator */}
                <div 
                  className={`absolute top-1 bottom-1 w-[calc(50%-4px)] bg-primary rounded-lg shadow-lg shadow-primary/20 transition-all duration-300 ease-in-out ${
                    role === 'admin' ? 'translate-x-[calc(100%+4px)]' : 'translate-x-0'
                  }`}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="group relative w-full h-14 mt-4 rounded-xl bg-primary text-primary-foreground font-display font-bold text-sm uppercase tracking-widest overflow-hidden transition-all hover:scale-[1.02] active:scale-[0.98] disabled:opacity-70 disabled:hover:scale-100 shadow-xl shadow-primary/10"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:animate-shimmer" />
              {loading ? (
                <div className="flex items-center justify-center gap-3">
                  <div className="w-5 h-5 border-2 border-primary-foreground/30 border-t-primary-foreground rounded-full animate-spin" />
                  <span>Synchronizing...</span>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2">
                  <span>Enter Command Center</span>
                </div>
              )}
            </button>
          </form>

          {/* System Footer info */}
          <div className="px-10 py-5 bg-secondary/20 border-t border-border/40 flex items-center justify-between">
             <div className="flex items-center gap-2 text-[9px] font-mono text-muted-foreground/60 uppercase">
                <Terminal size={10} /> SYS_V3.8.2_BUILD_RE7
             </div>
             <div className="flex items-center gap-1 text-[9px] font-mono text-muted-foreground/40 uppercase">
                NODE_ALPHA_PUNE_1
             </div>
          </div>
        </div>

        {/* Footer legalities */}
        <div className="mt-8 text-center space-y-4">
          <p className="text-[9px] text-muted-foreground/30 uppercase tracking-[0.3em] font-mono max-w-sm mx-auto leading-relaxed">
            Proprietary architecture of Coruscant Transit systems. Unauthorized access triggers full network lockdown and node blacklisting.
          </p>
          <div className="flex items-center justify-center gap-4 text-[10px] font-mono text-muted-foreground/20">
            <span>TC_ISO_14001</span>
            <span>SEC_LVL_9</span>
            <span>2FA_AUTO_ENALBED</span>
          </div>
        </div>
      </div>
    </div>
  );
}
