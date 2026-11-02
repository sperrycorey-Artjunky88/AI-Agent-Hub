import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import {
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage,
} from '@/components/ui/form';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import {
  ArrowDownUp, Check, ChevronDown, CircleHelp, Command,
  Edit3, Layers3, LayoutGrid, Plus, Search, Sparkles, Trash2, Users, X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import {
  Route,
  Switch,
  useLocation,
  Router as WouterRouter,
} from 'wouter';

const queryClient = new QueryClient();

type AgentStatus = 'Ready' | 'Working' | 'Away';
type Agent = { id: string; name: string; role: string; status: AgentStatus; color: string };
const STORE_KEY = 'agent-hub-roster-v1';
const seedAgents: Agent[] = [
  { id: 'muse-gemini', name: 'Muse Gemini', role: 'Creative sounding board · ideas, drafts, and fresh angles', status: 'Ready', color: 'lilac' },
  { id: 'chatgpt', name: 'ChatGPT', role: 'Everyday co-pilot · writing, research, and problem solving', status: 'Working', color: 'mint' },
  { id: 'grok-01', name: 'Grok 01', role: 'The curious one · quick takes and unconventional questions', status: 'Away', color: 'coral' },
  { id: 'grok-02', name: 'Grok 02', role: 'Research desk · finding signal in a sea of information', status: 'Ready', color: 'sky' },
  { id: 'grok-03', name: 'Grok 03', role: 'Writing partner · shaping thoughts into clear words', status: 'Ready', color: 'gold' },
  { id: 'grok-04', name: 'Grok 04', role: 'Builder · plans, systems, and practical next steps', status: 'Working', color: 'rose' },
  { id: 'grok-05', name: 'Grok 05', role: 'Creative studio · concepts, names, and what-ifs', status: 'Away', color: 'teal' },
  { id: 'grok-06', name: 'Grok 06', role: 'Quiet focus · thoughtful second opinions', status: 'Ready', color: 'lavender' },
];

const agentSchema = z.object({
  name: z.string().trim().min(1, 'Give this collaborator a name.').max(42, 'Keep the name under 42 characters.'),
  role: z.string().max(120, 'Keep notes under 120 characters.'),
  status: z.enum(['Ready', 'Working', 'Away']),
});
type AgentValues = z.infer<typeof agentSchema>;
const colors = ['lilac', 'mint', 'coral', 'sky', 'gold', 'rose', 'teal', 'lavender'];
const makeId = () => `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function Home() {
  const [agents, setAgents] = useState<Agent[]>(() => {
    try {
      const stored = localStorage.getItem(STORE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch { /* Use the starter roster if local storage is unavailable. */ }
    return seedAgents;
  });
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All agents');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const form = useForm<AgentValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: { name: '', role: '', status: 'Ready' },
  });

  useEffect(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(agents)); } catch { /* Local-only app. */ }
  }, [agents]);

  const counts = useMemo(() => ({
    Ready: agents.filter((agent) => agent.status === 'Ready').length,
    Working: agents.filter((agent) => agent.status === 'Working').length,
    Away: agents.filter((agent) => agent.status === 'Away').length,
  }), [agents]);
  const visibleAgents = useMemo(() => {
    const term = search.trim().toLowerCase();
    return agents.filter((agent) => (
      (filter === 'All agents' || agent.status === filter) &&
      (!term || `${agent.name} ${agent.role}`.toLowerCase().includes(term))
    ));
  }, [agents, filter, search]);

  const openCreate = () => {
    setEditing(null);
    form.reset({ name: '', role: '', status: 'Ready' });
    setDialogOpen(true);
  };
  const openEdit = (agent: Agent) => {
    setEditing(agent);
    form.reset({ name: agent.name, role: agent.role, status: agent.status });
    setDialogOpen(true);
  };
  const saveAgent = (values: AgentValues) => {
    if (editing) {
      setAgents((current) => current.map((agent) => agent.id === editing.id ? { ...agent, ...values } : agent));
    } else {
      setAgents((current) => [...current, { ...values, id: makeId(), color: colors[current.length % colors.length] }]);
    }
    setDialogOpen(false);
  };
  const removeAgent = (agent: Agent) => {
    if (window.confirm(`Remove ${agent.name} from your home base?`)) {
      setAgents((current) => current.filter((item) => item.id !== agent.id));
    }
  };
  const updateStatus = (agent: Agent, status: AgentStatus) => {
    setAgents((current) => current.map((item) => item.id === agent.id ? { ...item, status } : item));
  };

  return (
    <div className="hub-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark"><Layers3 size={20} strokeWidth={1.8} /></div>
          <div><span className="brand-title">commonroom</span><span className="brand-caption">YOUR AI HOME BASE</span></div>
        </div>
        <div className="side-section-label">WORKSPACE</div>
        <div className="side-link active" data-testid="nav-roster"><Users size={17} /><span>My collaborators</span><span className="nav-count">{agents.length}</span></div>
        <div className="sidebar-bottom">
          <div className="capacity-card">
            <div className="capacity-top"><span>ROOM TO GROW</span><span>{agents.length} / 12</span></div>
            <div className="capacity-track"><div style={{ width: `${Math.min(100, agents.length / 12 * 100)}%` }} /></div>
            <p>Your roster has space for more voices.</p>
          </div>
          <div className="privacy-note"><span className="privacy-dot" /><span>Private to this browser</span></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>My collaborators</strong></div>
          <div className="topbar-right"><span className="local-pill"><span /> LOCAL SPACE</span><button className="help-button" aria-label="About this hub" data-testid="button-about" onClick={() => window.alert('Commonroom is your personal roster for AI collaborators. Status and notes are manually managed and saved in this browser.') }><CircleHelp size={18} /></button><div className="profile-avatar">Y</div></div>
        </header>
        <div className="page-content">
          <section className="welcome-row">
            <div className="welcome-copy">
              <div className="eyebrow"><span className="eyebrow-line" /> YOUR LITTLE CORNER OF THE AI UNIVERSE</div>
              <h1>Good to have<br className="mobile-break" /> everyone <em>together.</em></h1>
              <p className="intro">A home for all the minds you work with. Keep your collaborators close, give each one a role, and set the pace for today.</p>
            </div>
            <div className="hero-orbit" aria-hidden="true">
              <div className="orbit orbit-one" /><div className="orbit orbit-two" />
              <div className="orbit-center"><Sparkles size={26} strokeWidth={1.5} /></div>
              <span className="orbit-node node-one" /><span className="orbit-node node-two" /><span className="orbit-node node-three" /><span className="orbit-node node-four" />
              <span className="orbit-label orbit-label-a">ideas</span><span className="orbit-label orbit-label-b">making</span>
            </div>
          </section>
          <section className="summary-strip" aria-label="Roster summary">
            <div className="summary-intro"><div className="summary-icon"><Users size={18} /></div><div><strong>{agents.length} collaborators</strong><span>Your crew, in one place</span></div></div>
            <div className="summary-divider" />
            {(['Ready', 'Working', 'Away'] as AgentStatus[]).map((status) => <div className="summary-stat" key={status} data-testid={`summary-${status.toLowerCase()}`}><span className={`status-pip ${status.toLowerCase()}`} /><strong>{counts[status]}</strong><span>{status}</span></div>)}
            <div className="summary-note"><Sparkles size={14} /> Set each status as your day changes</div>
          </section>
          <section className="roster-section">
            <div className="section-heading">
              <div><div className="eyebrow small-eyebrow">THE ROSTER</div><h2>Meet your collaborators<span className="heading-period">.</span></h2></div>
              <Button className="add-agent-button" onClick={openCreate} data-testid="button-add-agent"><Plus size={17} /> Add collaborator</Button>
            </div>
            <div className="roster-toolbar">
              <label className="search-box"><Search size={17} /><input aria-label="Search collaborators" placeholder="Search your crew..." value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-agents" />{search && <button onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><X size={14} /></button>}<kbd><Command size={11} /> K</kbd></label>
              <div className="filter-group" aria-label="Filter by status">
                {['All agents', 'Ready', 'Working', 'Away'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)} data-testid={`filter-${item.toLowerCase().replace(' ', '-')}`}>{item}{item === 'All agents' && <span>{agents.length}</span>}</button>)}
              </div>
              <div className="view-toggle" aria-label="Roster view">
                <button className={view === 'grid' ? 'chosen' : ''} onClick={() => setView('grid')} aria-label="Grid view" data-testid="button-grid-view"><LayoutGrid size={15} /></button>
                <button className={view === 'list' ? 'chosen' : ''} onClick={() => setView('list')} aria-label="List view" data-testid="button-list-view"><ArrowDownUp size={15} /></button>
              </div>
            </div>
            {visibleAgents.length > 0 ? <div className={`agent-grid ${view === 'list' ? 'list-view' : ''}`} data-testid="agent-roster">
              {visibleAgents.map((agent, index) => <article className={`agent-card ${agent.color}`} key={agent.id} data-testid={`card-agent-${agent.id}`} style={{ animationDelay: `${index * 45}ms` }}>
                <div className="card-topline"><div className={`agent-avatar ${agent.color}`}><span>{agent.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span><Sparkles className="avatar-star" size={12} /></div>
                  <div className="card-actions"><button aria-label={`Edit ${agent.name}`} onClick={() => openEdit(agent)} data-testid={`button-edit-${agent.id}`}><Edit3 size={15} /></button><button aria-label={`Remove ${agent.name}`} onClick={() => removeAgent(agent)} data-testid={`button-remove-${agent.id}`}><Trash2 size={15} /></button></div>
                </div>
                <div className="agent-identity"><div className="agent-name-line"><h3 data-testid={`text-agent-name-${agent.id}`}>{agent.name}</h3><span className="agent-type">AI</span></div><p data-testid={`text-agent-role-${agent.id}`}>{agent.role || 'A collaborator in your room.'}</p></div>
                <div className="card-footer">
                  <label className="status-select-label"><span className={`status-pip ${agent.status.toLowerCase()}`} /><select value={agent.status} onChange={(event) => updateStatus(agent, event.target.value as AgentStatus)} aria-label={`Set ${agent.name} status`} data-testid={`select-status-${agent.id}`}><option>Ready</option><option>Working</option><option>Away</option></select><ChevronDown size={13} /></label>
                  <span className="status-footnote">MANUALLY SET</span>
                </div>
              </article>)}
            </div> : <div className="empty-state" data-testid="empty-roster"><div className="empty-art"><Search size={22} /></div><h3>{agents.length ? 'No collaborators found' : 'Your room is ready'}</h3><p>{agents.length ? 'Try another name or clear your status filter.' : 'Add someone to start shaping your own little AI crew.'}</p>{agents.length ? <Button variant="outline" onClick={() => { setSearch(''); setFilter('All agents'); }} data-testid="button-reset-filters">Clear filters</Button> : <Button className="add-agent-button" onClick={openCreate} data-testid="button-add-first-agent"><Plus size={17} /> Add your first collaborator</Button>}</div>}
            <div className="roster-foot"><div><span className="foot-dot" /> <strong>All here, all yours.</strong> A little order for a lot of possibility.</div><span>{agents.length} of {Math.max(12, agents.length)} shown</span></div>
          </section>
          <footer className="page-footer"><span>COMMONROOM <span>·</span> YOUR PERSONAL AI ROSTER</span><span>Nothing here talks to an AI provider. Your notes stay in this browser.</span></footer>
        </div>
      </main>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="agent-dialog">
          <DialogHeader><div className="dialog-kicker">{editing ? 'MAKE IT YOURS' : 'MAKE ROOM'}</div><DialogTitle>{editing ? 'Edit collaborator' : 'Add a collaborator'}</DialogTitle><DialogDescription>{editing ? 'Update the details you keep for this member of your crew.' : 'Give this new voice a name and a little context.'}</DialogDescription></DialogHeader>
          <Form {...form}><form onSubmit={form.handleSubmit(saveAgent)} className="agent-form">
            <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. Research partner" {...field} data-testid="input-agent-name" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="role" render={({ field }) => <FormItem><FormLabel>Role or notes <span className="optional-label">OPTIONAL</span></FormLabel><FormControl><Textarea placeholder="What do you bring this collaborator in for?" rows={3} {...field} data-testid="input-agent-role" /></FormControl><FormMessage /></FormItem>} />
            <FormField control={form.control} name="status" render={({ field }) => <FormItem><FormLabel>Today’s status</FormLabel><FormControl><select className="form-status" {...field} data-testid="select-agent-status"><option>Ready</option><option>Working</option><option>Away</option></select></FormControl><FormMessage /></FormItem>} />
            <div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-agent">Cancel</Button><Button type="submit" className="add-agent-button" data-testid="button-save-agent"><Check size={16} /> {editing ? 'Save changes' : 'Add to my room'}</Button></div>
          </form></Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Router() {
  return (
    // Keep a shared shell (sidebar, navbar) outside the boundary so it
    // survives a page crash.
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={Home} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, '')}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
