import { type ReactNode, useEffect, useMemo, useState } from 'react';
import { ClerkProvider, Show, SignIn, SignUp, useClerk, useUser } from '@clerk/react';
import { publishableKeyFromHost } from '@clerk/react/internal';
import { shadcn } from '@clerk/themes';
import { ui } from '@clerk/ui';
import { QueryClient, QueryClientProvider, useQueryClient } from '@tanstack/react-query';
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
  ArrowDownUp, Check, ChevronDown, CircleHelp, Clock3, Command, Edit3,
  ExternalLink, Layers3, LayoutGrid, LoaderCircle, LockKeyhole, LogOut,
  Plus, Search, ShieldCheck, Sparkles, Trash2, Users, X,
} from 'lucide-react';
import NotFound from '@/pages/not-found';
import {
  Route, Switch, useLocation, Router as WouterRouter, Redirect, Link,
} from 'wouter';
import {
  getGetAgentRosterQueryKey, useGetAgentRoster, useSaveAgentRoster,
  getListTasksQueryKey, getListActivityQueryKey,
  useListTasks, useListActivity, useCreateTask, useUpdateTask, useDeleteTask,
} from '@workspace/api-client-react';
import type {
  AgentRosterAgent, AgentTask, ActivityEvent, TaskInput, TaskStatus, TaskPriority,
} from '@workspace/api-client-react';

const queryClient = new QueryClient();
const basePath = import.meta.env.BASE_URL.replace(/\/$/, '');
const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || '/'
    : path;
}

if (!clerkPubKey) throw new Error('Missing VITE_CLERK_PUBLISHABLE_KEY in .env file');

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: 'clerk',
  options: {
    logoPlacement: 'inside' as const,
    logoLinkUrl: basePath || '/',
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: '#4b7e65',
    colorForeground: '#302d3b',
    colorMutedForeground: '#827d89',
    colorDanger: '#b84e47',
    colorBackground: '#fbf9f3',
    colorInput: '#fffdf8',
    colorInputForeground: '#34313f',
    colorNeutral: '#e0dbd1',
    fontFamily: 'DM Sans, sans-serif',
    borderRadius: '0.65rem',
  },
  elements: {
    rootBox: 'w-full flex justify-center',
    cardBox: 'bg-[#fbf9f3] rounded-2xl w-[440px] max-w-full overflow-hidden shadow-[0_24px_80px_rgba(40,38,55,.12)]',
    card: '!shadow-none !border-0 !bg-transparent !rounded-none',
    footer: '!shadow-none !border-0 !bg-transparent !rounded-none',
    headerTitle: 'text-[#302d3b] font-semibold tracking-[-0.04em]',
    headerSubtitle: 'text-[#827d89]',
    socialButtonsBlockButtonText: 'text-[#454151] font-medium',
    formFieldLabel: 'text-[#514d5a] font-semibold',
    footerActionLink: 'text-[#3d6e56] font-semibold',
    footerActionText: 'text-[#827d89]',
    dividerText: 'text-[#96919d]',
    identityPreviewEditButton: 'text-[#3d6e56]',
    formFieldSuccessText: 'text-[#3d6e56]',
    alertText: 'text-[#8f443d]',
    logoBox: 'mb-3',
    logoImage: 'max-h-10',
    socialButtonsBlockButton: 'border-[#e0dbd1] bg-[#fffdf8] hover:bg-[#f3f0e8]',
    formButtonPrimary: 'bg-[#4b7e65] hover:bg-[#3d6e56] text-[#fffaf1] shadow-none',
    formFieldInput: 'bg-[#fffdf8] border-[#e0dbd1] text-[#34313f]',
    footerAction: 'border-t border-[#e7e1d7]',
    dividerLine: 'bg-[#e6e0d5]',
    alert: 'bg-[#f6e7e3] border-[#edcfc7]',
    otpCodeFieldInput: 'bg-[#fffdf8] border-[#e0dbd1]',
    formFieldRow: 'gap-2',
    main: 'gap-5',
  },
};

type AgentStatus = 'Ready' | 'Working' | 'Away';
type Agent = AgentRosterAgent;
type RosterChoice = 'import' | 'defaults';
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
function isSafeLaunchUrl(value: string): boolean {
  if (!value) return true;
  try {
    const url = new URL(value);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}

const agentSchema = z.object({
  name: z.string().trim().min(1, 'Give this collaborator a name.').max(42, 'Keep the name under 42 characters.'),
  role: z.string().max(120, 'Keep notes under 120 characters.'),
  status: z.enum(['Ready', 'Working', 'Away']),
  launchUrl: z.string().trim().max(2048, 'Keep the link under 2048 characters.').refine(isSafeLaunchUrl, 'Use a full HTTP or HTTPS link.'),
});
type AgentValues = z.infer<typeof agentSchema>;
const colors: Agent['color'][] = ['lilac', 'mint', 'coral', 'sky', 'gold', 'rose', 'teal', 'lavender'];
const taskStatuses: TaskStatus[] = ['Queued', 'In progress', 'Done'];
const taskPriorities: TaskPriority[] = ['Low', 'Normal', 'High'];
const taskSchema = z.object({
  title: z.string().trim().min(1, 'Give this task a name.').max(120, 'Keep the title under 120 characters.'),
  details: z.string().max(1000, 'Keep details under 1000 characters.'),
  assignedAgentId: z.string(),
  status: z.enum(['Queued', 'In progress', 'Done']),
  priority: z.enum(['Low', 'Normal', 'High']),
});
type TaskValues = z.infer<typeof taskSchema>;
const makeId = () => `agent-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

function safeLaunchUrl(value: string | null | undefined): string | null {
  if (!value || !isSafeLaunchUrl(value)) return null;
  return value;
}

function formatActivityTime(event: ActivityEvent): string {
  const date = new Date(event.createdAt);
  const elapsed = Math.max(0, Date.now() - date.getTime());
  if (!Number.isFinite(elapsed)) return 'Recently';
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

function readLocalRoster(): Agent[] | null {
  try {
    const stored = localStorage.getItem(STORE_KEY);
    if (!stored) return null;
    const parsed: unknown = JSON.parse(stored);
    if (!Array.isArray(parsed)) return null;
    return parsed as Agent[];
  } catch {
    return null;
  }
}

function clearMigratedLocalRoster() {
  try { localStorage.removeItem(STORE_KEY); } catch { /* The account roster remains authoritative. */ }
}

function Home() {
  return (
    <main className="public-home">
      <header className="public-nav">
        <Link href="/" className="brand-lockup public-brand" data-testid="link-home-brand">
          <span className="brand-mark"><Layers3 size={20} strokeWidth={1.8} /></span>
          <span><span className="brand-title">commonroom</span><span className="brand-caption">YOUR AI HOME BASE</span></span>
        </Link>
        <nav className="public-nav-actions" aria-label="Account">
          <Link href="/sign-in" className="public-link" data-testid="link-sign-in">Sign in</Link>
          <Link href="/sign-up" className="public-cta" data-testid="link-create-account">Create account</Link>
        </nav>
      </header>
      <section className="public-hero">
        <div className="public-hero-copy">
          <div className="eyebrow"><span className="eyebrow-line" /> A MORE PERSONAL WAY TO WORK WITH AI</div>
          <h1>Your minds,<br />in <em>one room.</em></h1>
          <p>Keep the AI collaborators you work with close. Give each a role, set the pace, and pick up your roster wherever the day takes you.</p>
          <div className="public-hero-actions">
            <Link href="/sign-up" className="public-cta large" data-testid="link-get-started">Create your private room <span>→</span></Link>
            <span className="private-caption"><LockKeyhole size={14} /> Private to your account</span>
          </div>
          <div className="public-proof"><span className="proof-rule" /><span>A quiet home for your many ways of thinking.</span></div>
        </div>
        <div className="public-visual" aria-label="A visual map of your AI collaborators">
          <div className="visual-topline"><span>YOUR ROOM</span><span>PERSONAL · PRIVATE</span></div>
          <div className="visual-orbit orbit-a" /><div className="visual-orbit orbit-b" />
          <div className="visual-core"><Sparkles size={25} /><span>your<br />workspace</span></div>
          <div className="visual-person person-one"><i className="person-dot lilac" /><span>Muse Gemini</span><small>CREATIVE</small></div>
          <div className="visual-person person-two"><i className="person-dot mint" /><span>ChatGPT</span><small>CO-PILOT</small></div>
          <div className="visual-person person-three"><i className="person-dot coral" /><span>Grok 01</span><small>CURIOUS</small></div>
          <div className="visual-person person-four"><i className="person-dot sky" /><span>Research desk</span><small>FIND SIGNAL</small></div>
          <div className="visual-footer"><span>08 collaborators</span><span className="visual-footer-dot" /> synced across devices</div>
        </div>
      </section>
      <section className="public-details">
        <div className="detail-intro"><span className="detail-index">01 / YOUR SPACE</span><h2>One steady place<br />for a changing crew.</h2></div>
        <div className="detail-copy"><p>AI tools come and go. Your working rhythm is yours to keep. Commonroom brings your collaborators, their roles, and your own status notes into one private roster.</p><div className="detail-benefits"><span><ShieldCheck size={17} /> Your roster follows your account</span><span><Layers3 size={17} /> No provider connections, just your notes</span></div></div>
      </section>
      <footer className="public-footer"><span>COMMONROOM <i>·</i> YOUR PERSONAL AI ROSTER</span><span>Your room, wherever you sign in.</span></footer>
    </main>
  );
}

function RosterManager() {
  const queryClient = useQueryClient();
  const rosterQuery = useGetAgentRoster({ query: { queryKey: getGetAgentRosterQueryKey() } });
  const saveRoster = useSaveAgentRoster();
  const roster = rosterQuery.data;
  const [agents, setAgents] = useState<Agent[] | null>(null);
  const [migrationRoster, setMigrationRoster] = useState<Agent[] | null>(null);
  const [selectedChoice, setSelectedChoice] = useState<RosterChoice | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('All agents');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Agent | null>(null);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [saveError, setSaveError] = useState('');
  const form = useForm<AgentValues>({
    resolver: zodResolver(agentSchema),
    defaultValues: { name: '', role: '', status: 'Ready' },
  });

  useEffect(() => {
    if (!roster) return;
    setAgents(roster.agents);
    if (roster.agents === null) setMigrationRoster(readLocalRoster());
    else setMigrationRoster(null);
  }, [roster]);

  const persist = (nextAgents: Agent[]) => {
    setSaveError('');
    saveRoster.mutate({ data: { agents: nextAgents } }, {
      onSuccess: (saved) => {
        const confirmed = saved.agents ?? nextAgents;
        setAgents(confirmed);
        setMigrationRoster(null);
        setSelectedChoice(null);
        if (roster?.agents === null) clearMigratedLocalRoster();
        queryClient.setQueryData(getGetAgentRosterQueryKey(), saved);
      },
      onError: () => setSaveError('Your changes could not sync. Please try again.'),
    });
  };

  const counts = useMemo(() => {
    const list = agents ?? [];
    return {
      Ready: list.filter((agent) => agent.status === 'Ready').length,
      Working: list.filter((agent) => agent.status === 'Working').length,
      Away: list.filter((agent) => agent.status === 'Away').length,
    };
  }, [agents]);
  const visibleAgents = useMemo(() => {
    const list = agents ?? [];
    const term = search.trim().toLowerCase();
    return list.filter((agent) => (
      (filter === 'All agents' || agent.status === filter) &&
      (!term || `${agent.name} ${agent.role}`.toLowerCase().includes(term))
    ));
  }, [agents, filter, search]);
  const isSaving = saveRoster.isPending;

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
    const current = agents ?? [];
    const next = editing
      ? current.map((agent) => agent.id === editing.id ? { ...agent, ...values } : agent)
      : [...current, { ...values, id: makeId(), color: colors[current.length % colors.length] }];
    persist(next);
    setDialogOpen(false);
  };
  const removeAgent = (agent: Agent) => {
    if (window.confirm(`Remove ${agent.name} from your home base?`)) {
      persist((agents ?? []).filter((item) => item.id !== agent.id));
    }
  };
  const updateStatus = (agent: Agent, status: AgentStatus) => {
    persist((agents ?? []).map((item) => item.id === agent.id ? { ...item, status } : item));
  };

  if (rosterQuery.isLoading || !roster) {
    if (rosterQuery.isError) {
      return <div className="roster-state"><div className="state-symbol"><CircleHelp size={21} /></div><h2>We couldn’t open your room.</h2><p>Your roster is safe. Check your connection and try again.</p><Button className="add-agent-button" onClick={() => rosterQuery.refetch()} data-testid="button-retry-roster">Try again</Button></div>;
    }
    return <div className="roster-state" aria-label="Loading your private roster" data-testid="status-roster-loading"><div className="skeleton-title" /><div className="skeleton-line" /><div className="skeleton-cards"><i /><i /><i /></div><span>Opening your private room…</span></div>;
  }

  if (roster.agents === null && agents === null) {
    return (
      <div className="hub-shell">
        <aside className="sidebar"><BrandLockup /><div className="sidebar-bottom"><div className="privacy-note"><span className="privacy-dot" /><span>Private to your account</span></div></div></aside>
        <main className="main-area"><div className="topbar"><div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>First-time setup</strong></div><div className="topbar-right"><span className="sync-pill"><LockKeyhole size={12} /> PRIVATE SYNC</span><SignOutAction /></div></div>
          <section className="choice-panel">
            <div className="choice-icon"><Layers3 size={23} /></div><div className="eyebrow"><span className="eyebrow-line" /> YOUR ROOM IS READY</div>
            <h1>How should we<br /><em>set up your roster?</em></h1>
            {migrationRoster !== null ? <>
              <p>There’s a roster saved on this device with {migrationRoster.length} collaborator{migrationRoster.length === 1 ? '' : 's'}. Choose what belongs in your new private account.</p>
              <div className="choice-actions">
                <Button className={`choice-button ${selectedChoice === 'import' ? 'selected' : ''}`} disabled={isSaving} onClick={() => setSelectedChoice('import')} data-testid="button-choice-import">
                  <span className="choice-radio">{selectedChoice === 'import' && <i />}</span><span><strong>Bring in this roster</strong><small>Import {migrationRoster.length} saved collaborators from this browser.</small></span>
                </Button>
                <Button className={`choice-button ${selectedChoice === 'defaults' ? 'selected' : ''}`} disabled={isSaving} onClick={() => setSelectedChoice('defaults')} data-testid="button-choice-defaults">
                  <span className="choice-radio">{selectedChoice === 'defaults' && <i />}</span><span><strong>Start with the starter roster</strong><small>Use the eight Commonroom examples instead.</small></span>
                </Button>
              </div>
              <Button className="add-agent-button choice-confirm" disabled={!selectedChoice || isSaving} onClick={() => persist(selectedChoice === 'import' ? migrationRoster : seedAgents)} data-testid="button-confirm-roster-choice">
                {isSaving ? <LoaderCircle size={15} className="spin" /> : <Check size={16} />} {isSaving ? 'Saving your choice…' : 'Save my choice'}
              </Button>
            </> : <>
              <p>There isn’t a roster saved on this device. Start with the eight example collaborators, then make the room your own.</p>
              <Button className="add-agent-button choice-confirm" disabled={isSaving} onClick={() => persist(seedAgents)} data-testid="button-start-default-roster">{isSaving ? <LoaderCircle size={15} className="spin" /> : <Plus size={16} />} {isSaving ? 'Setting up…' : 'Start with eight collaborators'}</Button>
            </>}
            {saveError && <p className="save-error" role="alert" data-testid="status-save-error">{saveError}</p>}
            <div className="choice-privacy"><ShieldCheck size={15} /> Nothing is imported until you choose it. Rosters sync to your account only.</div>
          </section>
        </main>
      </div>
    );
  }

  const rosterAgents = agents ?? [];
  return (
    <div className="hub-shell">
      <aside className="sidebar">
        <BrandLockup />
        <div className="side-section-label">WORKSPACE</div>
        <div className="side-link active" data-testid="nav-roster"><Users size={17} /><span>My collaborators</span><span className="nav-count">{rosterAgents.length}</span></div>
        <div className="sidebar-bottom">
          <div className="capacity-card"><div className="capacity-top"><span>ROOM TO GROW</span><span>{rosterAgents.length} / 12</span></div><div className="capacity-track"><div style={{ width: `${Math.min(100, rosterAgents.length / 12 * 100)}%` }} /></div><p>Your roster has space for more voices.</p></div>
          <div className="privacy-note"><span className="privacy-dot" /><span>Private to your account</span></div>
        </div>
      </aside>
      <main className="main-area">
        <header className="topbar">
          <div className="breadcrumb"><span>Workspace</span><span className="crumb-slash">/</span><strong>My collaborators</strong></div>
          <div className="topbar-right"><span className="sync-pill"><LockKeyhole size={12} /> {isSaving ? 'SAVING' : 'PRIVATE SYNC'}</span><button className="help-button" aria-label="About this hub" data-testid="button-about" onClick={() => window.alert('Commonroom is your private roster for AI collaborators. Your names, notes, and statuses sync to your account across devices.') }><CircleHelp size={18} /></button><UserProfile /><SignOutAction /></div>
        </header>
        <div className="page-content">
          <section className="welcome-row">
            <div className="welcome-copy"><div className="eyebrow"><span className="eyebrow-line" /> YOUR LITTLE CORNER OF THE AI UNIVERSE</div><h1>Good to have<br className="mobile-break" /> everyone <em>together.</em></h1><p className="intro">A home for all the minds you work with. Keep your collaborators close, give each one a role, and set the pace for today.</p></div>
            <div className="hero-orbit" aria-hidden="true"><div className="orbit orbit-one" /><div className="orbit orbit-two" /><div className="orbit-center"><Sparkles size={26} strokeWidth={1.5} /></div><span className="orbit-node node-one" /><span className="orbit-node node-two" /><span className="orbit-node node-three" /><span className="orbit-node node-four" /><span className="orbit-label orbit-label-a">ideas</span><span className="orbit-label orbit-label-b">making</span></div>
          </section>
          <section className="summary-strip" aria-label="Roster summary">
            <div className="summary-intro"><div className="summary-icon"><Users size={18} /></div><div><strong>{rosterAgents.length} collaborators</strong><span>Your crew, in one place</span></div></div><div className="summary-divider" />
            {(['Ready', 'Working', 'Away'] as AgentStatus[]).map((status) => <div className="summary-stat" key={status} data-testid={`summary-${status.toLowerCase()}`}><span className={`status-pip ${status.toLowerCase()}`} /><strong>{counts[status]}</strong><span>{status}</span></div>)}
            <div className="summary-note"><Sparkles size={14} /> Set each status as your day changes</div>
          </section>
          <section className="roster-section">
            <div className="section-heading"><div><div className="eyebrow small-eyebrow">THE ROSTER</div><h2>Meet your collaborators<span className="heading-period">.</span></h2></div><Button className="add-agent-button" onClick={openCreate} disabled={isSaving} data-testid="button-add-agent"><Plus size={17} /> Add collaborator</Button></div>
            <div className="roster-toolbar">
              <label className="search-box"><Search size={17} /><input aria-label="Search collaborators" placeholder="Search your crew..." value={search} onChange={(event) => setSearch(event.target.value)} data-testid="input-search-agents" />{search && <button onClick={() => setSearch('')} aria-label="Clear search" data-testid="button-clear-search"><X size={14} /></button>}<kbd><Command size={11} /> K</kbd></label>
              <div className="filter-group" aria-label="Filter by status">{['All agents', 'Ready', 'Working', 'Away'].map((item) => <button key={item} className={`filter-chip ${filter === item ? 'selected' : ''}`} onClick={() => setFilter(item)} data-testid={`filter-${item.toLowerCase().replace(' ', '-')}`}>{item}{item === 'All agents' && <span>{rosterAgents.length}</span>}</button>)}</div>
              <div className="view-toggle" aria-label="Roster view"><button className={view === 'grid' ? 'chosen' : ''} onClick={() => setView('grid')} aria-label="Grid view" data-testid="button-grid-view"><LayoutGrid size={15} /></button><button className={view === 'list' ? 'chosen' : ''} onClick={() => setView('list')} aria-label="List view" data-testid="button-list-view"><ArrowDownUp size={15} /></button></div>
            </div>
            {saveError && <div className="save-banner" role="alert" data-testid="status-save-error">{saveError}<button onClick={() => setSaveError('')} aria-label="Dismiss save error"><X size={14} /></button></div>}
            {rosterQuery.isError && <div className="save-banner" role="alert" data-testid="status-roster-refresh-error">Your saved roster may have changed elsewhere. <button onClick={() => rosterQuery.refetch()} data-testid="button-refresh-roster">Refresh</button></div>}
            {visibleAgents.length > 0 ? <div className={`agent-grid ${view === 'list' ? 'list-view' : ''}`} data-testid="agent-roster">
              {visibleAgents.map((agent, index) => <article className={`agent-card ${agent.color}`} key={agent.id} data-testid={`card-agent-${agent.id}`} style={{ animationDelay: `${index * 45}ms` }}>
                <div className="card-topline"><div className={`agent-avatar ${agent.color}`}><span>{agent.name.split(/\s+/).map((part) => part[0]).join('').slice(0, 2)}</span><Sparkles className="avatar-star" size={12} /></div><div className="card-actions"><button aria-label={`Edit ${agent.name}`} onClick={() => openEdit(agent)} disabled={isSaving} data-testid={`button-edit-${agent.id}`}><Edit3 size={15} /></button><button aria-label={`Remove ${agent.name}`} onClick={() => removeAgent(agent)} disabled={isSaving} data-testid={`button-remove-${agent.id}`}><Trash2 size={15} /></button></div></div>
                <div className="agent-identity"><div className="agent-name-line"><h3 data-testid={`text-agent-name-${agent.id}`}>{agent.name}</h3><span className="agent-type">AI</span></div><p data-testid={`text-agent-role-${agent.id}`}>{agent.role || 'A collaborator in your room.'}</p></div>
                <div className="card-footer"><label className="status-select-label"><span className={`status-pip ${agent.status.toLowerCase()}`} /><select value={agent.status} disabled={isSaving} onChange={(event) => updateStatus(agent, event.target.value as AgentStatus)} aria-label={`Set ${agent.name} status`} data-testid={`select-status-${agent.id}`}><option>Ready</option><option>Working</option><option>Away</option></select><ChevronDown size={13} /></label><span className="status-footnote">{isSaving ? 'SYNCING…' : 'MANUALLY SET'}</span></div>
              </article>)}
            </div> : <div className="empty-state" data-testid="empty-roster"><div className="empty-art"><Search size={22} /></div><h3>{rosterAgents.length ? 'No collaborators found' : 'Your room is ready'}</h3><p>{rosterAgents.length ? 'Try another name or clear your status filter.' : 'Add someone to start shaping your own little AI crew.'}</p>{rosterAgents.length ? <Button variant="outline" onClick={() => { setSearch(''); setFilter('All agents'); }} data-testid="button-reset-filters">Clear filters</Button> : <Button className="add-agent-button" onClick={openCreate} data-testid="button-add-first-agent"><Plus size={17} /> Add your first collaborator</Button>}</div>}
            <div className="roster-foot"><div><span className="foot-dot" /> <strong>{isSaving ? 'Saving your room…' : 'All here, all yours.'}</strong> A little order for a lot of possibility.</div><span>{rosterAgents.length} of {Math.max(12, rosterAgents.length)} shown</span></div>
          </section>
          <footer className="page-footer"><span>COMMONROOM <span>·</span> YOUR PERSONAL AI ROSTER</span><span>Private to your account. Ready on your next device.</span></footer>
        </div>
      </main>
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}><DialogContent className="agent-dialog">
        <DialogHeader><div className="dialog-kicker">{editing ? 'MAKE IT YOURS' : 'MAKE ROOM'}</div><DialogTitle>{editing ? 'Edit collaborator' : 'Add a collaborator'}</DialogTitle><DialogDescription>{editing ? 'Update the details you keep for this member of your crew.' : 'Give this new voice a name and a little context.'}</DialogDescription></DialogHeader>
        <Form {...form}><form onSubmit={form.handleSubmit(saveAgent)} className="agent-form">
          <FormField control={form.control} name="name" render={({ field }) => <FormItem><FormLabel>Name</FormLabel><FormControl><Input placeholder="e.g. Research partner" {...field} data-testid="input-agent-name" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="role" render={({ field }) => <FormItem><FormLabel>Role or notes <span className="optional-label">OPTIONAL</span></FormLabel><FormControl><Textarea placeholder="What do you bring this collaborator in for?" rows={3} {...field} data-testid="input-agent-role" /></FormControl><FormMessage /></FormItem>} />
          <FormField control={form.control} name="status" render={({ field }) => <FormItem><FormLabel>Today’s status</FormLabel><FormControl><select className="form-status" {...field} data-testid="select-agent-status"><option>Ready</option><option>Working</option><option>Away</option></select></FormControl><FormMessage /></FormItem>} />
          <div className="dialog-actions"><Button type="button" variant="outline" onClick={() => setDialogOpen(false)} data-testid="button-cancel-agent">Cancel</Button><Button type="submit" disabled={isSaving} className="add-agent-button" data-testid="button-save-agent">{isSaving ? <LoaderCircle size={15} className="spin" /> : <Check size={16} />} {isSaving ? 'Saving…' : editing ? 'Save changes' : 'Add to my room'}</Button></div>
        </form></Form>
      </DialogContent></Dialog>
    </div>
  );
}

function BrandLockup() {
  return <div className="brand-lockup"><div className="brand-mark"><Layers3 size={20} strokeWidth={1.8} /></div><div><span className="brand-title">commonroom</span><span className="brand-caption">YOUR AI HOME BASE</span></div></div>;
}

function UserProfile() {
  const { user } = useUser();
  const initial = user?.firstName?.slice(0, 1) ?? user?.primaryEmailAddress?.emailAddress?.slice(0, 1) ?? 'Y';
  return <div className="profile-avatar" aria-label={user?.fullName ?? 'Your account'} data-testid="text-user-avatar">{initial.toUpperCase()}</div>;
}

function SignOutAction() {
  const { signOut } = useClerk();
  return <button className="signout-button" type="button" onClick={() => signOut({ redirectUrl: basePath || '/' })} data-testid="button-sign-out"><LogOut size={14} /><span>Sign out</span></button>;
}

function UserPortal() {
  const { isLoaded, user } = useUser();
  if (!isLoaded) return <div className="roster-state" data-testid="status-account-loading">Opening your private room…</div>;
  return <><Show when="signed-in"><RosterManager key={user?.id ?? 'signed-in'} /></Show><Show when="signed-out"><Redirect to="/" /></Show></>;
}

function HomeRedirect() {
  return <><Show when="signed-in"><Redirect to="/user-portal" /></Show><Show when="signed-out"><Home /></Show></>;
}

function SignInPage() {
  return <div className="auth-page"><div className="auth-backdrop" /><div className="auth-panel"><Link href="/" className="auth-brand" data-testid="link-auth-brand"><BrandLockup /></Link><div className="auth-overline"><span className="privacy-dot" /> YOUR ROOM, READY WHEN YOU ARE</div><SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} /></div></div>;
}

function SignUpPage() {
  return <div className="auth-page"><div className="auth-backdrop" /><div className="auth-panel"><Link href="/" className="auth-brand" data-testid="link-auth-brand"><BrandLockup /></Link><div className="auth-overline"><span className="privacy-dot" /> MAKE A LITTLE ROOM FOR IDEAS</div><SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} /></div></div>;
}

function Router() {
  return (
    <RoutedErrorBoundary>
      <Switch>
        <Route path="/" component={HomeRedirect} />
        <Route path="/user-portal" component={UserPortal} />
        <Route path="/sign-in/*?" component={SignInPage} />
        <Route path="/sign-up/*?" component={SignUpPage} />
        <Route component={NotFound} />
      </Switch>
    </RoutedErrorBoundary>
  );
}

function RoutedErrorBoundary({ children }: { children: ReactNode }) {
  const [location] = useLocation();
  return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>;
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const client = useQueryClient();
  useEffect(() => {
    let previousUserId: string | null | undefined;
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (previousUserId !== undefined && previousUserId !== userId) client.clear();
      previousUserId = userId;
    });
    return unsubscribe;
  }, [addListener, client]);
  return null;
}

function ClerkRoutes() {
  const [, setLocation] = useLocation();
  return (
    <ClerkProvider
      ui={ui}
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: { start: { title: 'Welcome back', subtitle: 'Sign in to open your private room.' } },
        signUp: { start: { title: 'Create your Commonroom', subtitle: 'Your collaborators, together in one place.' } },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <Switch>
          <Route path="/" component={HomeRedirect} />
          <Route path="/user-portal" component={UserPortal} />
          <Route path="/sign-in/*?" component={SignInPage} />
          <Route path="/sign-up/*?" component={SignUpPage} />
          <Route component={NotFound} />
        </Switch>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <TooltipProvider>
      <WouterRouter base={basePath}>
        <ClerkRoutes />
      </WouterRouter>
      <Toaster />
    </TooltipProvider>
  );
}

export default App;
