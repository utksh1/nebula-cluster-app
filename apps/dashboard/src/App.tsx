import React, { useState, useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import axios from 'axios';
import { 
  Server, 
  Activity, 
  Cpu, 
  Terminal as TermIcon, 
  PlusCircle, 
  Layers, 
  LogOut, 
  UserCheck, 
  Wifi, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  Play,
  RotateCcw,
  CloudLightning,
  ChevronRight
} from 'lucide-react';

const API_BASE = 'http://localhost:3001';

interface Worker {
  id: string;
  name: string;
  nodeId: string;
  status: string;
  provider: string;
  cpuCores: number;
  memoryMb: number;
  activeJobs: number;
  lastHeartbeatAt: string | null;
  trustLevel: string;
  capabilitiesJson: string;
}

interface Job {
  id: string;
  type: string;
  status: string;
  priority: number;
  payloadJson: string;
  createdAt: string;
  assignedWorkerId: string | null;
  worker?: Worker | null;
  completedAt?: string | null;
  failedAt?: string | null;
  errorJson?: string | null;
  resultJson?: string | null;
}

interface LogLine {
  id: string;
  jobId?: string;
  level: string;
  message: string;
  timestamp: string;
}

interface ProviderAccount {
  id: string;
  provider: string;
  accountName: string;
  region: string;
  status: string;
  createdAt: string;
}

export default function App() {
  const [token, setToken] = useState<string>(localStorage.getItem('nebula_token') || '');
  const [user, setUser] = useState<any>(null);
  const [org, setOrg] = useState<any>(null);
  
  // Login credentials
  const [email, setEmail] = useState('admin@nebula.local');
  const [password, setPassword] = useState('password123');
  const [loginError, setLoginError] = useState('');

  // Active view: 'overview' | 'workers' | 'jobs' | 'dispatch' | 'providers'
  const [activeTab, setActiveTab] = useState<'overview' | 'workers' | 'jobs' | 'dispatch' | 'providers'>('overview');

  // Cluster State
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [providerAccounts, setProviderAccounts] = useState<ProviderAccount[]>([]);
  const [selectedJobId, setSelectedJobId] = useState<string>('');
  
  // Job Dispatch Form State
  const [dispatchType, setDispatchType] = useState<'sleep' | 'http'>('sleep');
  const [sleepSec, setSleepSec] = useState<number>(10);
  const [httpUrl, setHttpUrl] = useState<string>('https://httpbin.org/get');
  const [httpMethod, setHttpMethod] = useState<string>('GET');
  const [jobPriority, setJobPriority] = useState<number>(0);
  const [dispatching, setDispatching] = useState<boolean>(false);
  const [dispatchMessage, setDispatchMessage] = useState<string>('');

  // Provider Form State
  const [provType, setProvType] = useState<string>('render');
  const [provAcctName, setProvAcctName] = useState<string>('Render Main');
  const [provApiKey, setProvApiKey] = useState<string>('');
  const [provRegion, setProvRegion] = useState<string>('oregon');
  const [provMessage, setProvMessage] = useState<string>('');
  const [provSaving, setProvSaving] = useState<boolean>(false);

  const terminalEndRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<Socket | null>(null);

  // Parse user info on mount or token change
  useEffect(() => {
    if (token) {
      axios.get(`${API_BASE}/api/v1/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      })
      .then(() => {
        const storedUser = localStorage.getItem('nebula_user');
        const storedOrg = localStorage.getItem('nebula_org');
        if (storedUser) setUser(JSON.parse(storedUser));
        if (storedOrg) setOrg(JSON.parse(storedOrg));
      })
      .catch(() => {
        handleLogout();
      });
    }
  }, [token]);

  // Fetch initial cluster data once logged in
  useEffect(() => {
    if (!token) return;

    fetchWorkers();
    fetchJobs();
    fetchProviderAccounts();

    const socket = io(API_BASE);
    socketRef.current = socket;

    socket.on('connect', () => {
      addLog({
        id: `ws-${Date.now()}`,
        level: 'INFO',
        message: 'Socket.IO link active.',
        timestamp: new Date().toISOString()
      });
    });

    socket.on('worker:registered', (worker: Worker) => {
      setWorkers(prev => {
        const exists = prev.some(w => w.id === worker.id);
        if (exists) return prev.map(w => w.id === worker.id ? worker : w);
        return [worker, ...prev];
      });
      addLog({
        id: `reg-${Date.now()}`,
        level: 'INFO',
        message: `Node "${worker.name}" registered.`,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('worker:status_changed', (data: { workerId: string, status: string, message: string }) => {
      setWorkers(prev => prev.map(w => w.id === data.workerId ? { ...w, status: data.status } : w));
      addLog({
        id: `ws-${Date.now()}`,
        level: data.status === 'ERROR' || data.status === 'OFFLINE' ? 'ERROR' : 'INFO',
        message: data.message,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('worker:heartbeat', (data: { workerId: string, status: string, cpuUsage: number, memoryUsage: number, lastHeartbeatAt: string }) => {
      setWorkers(prev => prev.map(w => w.id === data.workerId ? { 
        ...w, 
        status: data.status,
        lastHeartbeatAt: data.lastHeartbeatAt
      } : w));
    });

    socket.on('job:created', (job: Job) => {
      setJobs(prev => [job, ...prev]);
      addLog({
        id: `job-c-${Date.now()}`,
        level: 'INFO',
        message: `Job ${job.id.substring(0, 8)} queued.`,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('job:started', (data: { jobId: string, workerName: string, status: string }) => {
      setJobs(prev => prev.map(j => j.id === data.jobId ? { ...j, status: 'RUNNING', assignedWorkerId: data.workerName } : j));
      addLog({
        id: `job-s-${Date.now()}`,
        level: 'INFO',
        message: `Job ${data.jobId.substring(0,8)} executing on "${data.workerName}".`,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('job:progress', (data: { jobId: string, progress: number, stage: string, message: string }) => {
      addLog({
        id: `job-p-${Date.now()}`,
        level: 'INFO',
        message: `Job ${data.jobId.substring(0,8)} [${data.progress}%]: ${data.message}`,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('job:log', (data: { jobId: string, log: LogLine }) => {
      if (selectedJobId === '' || selectedJobId === data.jobId) {
        addLog(data.log);
      }
    });

    socket.on('job:completed', (data: { jobId: string, result: any }) => {
      setJobs(prev => prev.map(j => j.id === data.jobId ? { ...j, status: 'COMPLETED', completedAt: new Date().toISOString() } : j));
      addLog({
        id: `job-ok-${Date.now()}`,
        level: 'INFO',
        message: `Job ${data.jobId.substring(0,8)} finished.`,
        timestamp: new Date().toISOString()
      });
    });

    socket.on('job:failed', (data: { jobId: string, error?: any, status?: string }) => {
      setJobs(prev => prev.map(j => j.id === data.jobId ? { ...j, status: data.status || 'FAILED', failedAt: new Date().toISOString() } : j));
      addLog({
        id: `job-err-${Date.now()}`,
        level: 'ERROR',
        message: `Job ${data.jobId.substring(0,8)} failed: ${data.error?.message || 'Error'}`,
        timestamp: new Date().toISOString()
      });
    });

    return () => {
      socket.disconnect();
    };
  }, [token, selectedJobId]);

  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const addLog = (log: LogLine) => {
    setLogs(prev => [...prev.slice(-80), log]);
  };

  const fetchWorkers = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/workers`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setWorkers(res.data);
    } catch (e) {
      console.error('Error fetching workers', e);
    }
  };

  const fetchJobs = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/jobs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setJobs(res.data);
    } catch (e) {
      console.error('Error fetching jobs', e);
    }
  };

  const fetchProviderAccounts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/provider-accounts`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      setProviderAccounts(res.data);
    } catch (e) {
      console.error('Error fetching provider accounts', e);
    }
  };

  const fetchJobLogs = async (jobId: string) => {
    try {
      const res = await axios.get(`${API_BASE}/api/v1/jobs/${jobId}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const lines = res.data.map((l: any) => ({
        id: l.id,
        jobId: l.jobId,
        level: l.level,
        message: l.message,
        timestamp: l.timestamp
      }));
      setLogs(lines);
    } catch (e) {
      console.error('Error fetching job logs', e);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    try {
      const res = await axios.post(`${API_BASE}/api/v1/auth/login`, { email, password });
      const { token: receivedToken, user: loggedUser, organization: loggedOrg } = res.data;

      localStorage.setItem('nebula_token', receivedToken);
      localStorage.setItem('nebula_user', JSON.stringify(loggedUser));
      localStorage.setItem('nebula_org', JSON.stringify(loggedOrg));

      setToken(receivedToken);
      setUser(loggedUser);
      setOrg(loggedOrg);
    } catch (err: any) {
      setLoginError(err.response?.data?.error || 'Authentication failed');
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('nebula_token');
    localStorage.removeItem('nebula_user');
    localStorage.removeItem('nebula_org');
    setToken('');
    setUser(null);
    setOrg(null);
    setWorkers([]);
    setJobs([]);
    setLogs([]);
    setProviderAccounts([]);
  };

  const handleDispatchJob = async (e: React.FormEvent) => {
    e.preventDefault();
    setDispatching(true);
    setDispatchMessage('');

    try {
      if (!org?.id) throw new Error('No organization workspace loaded.');

      // Find target project (default-project or first project)
      const projectsRes = await axios.get(`${API_BASE}/api/v1/projects`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const targetProject = projectsRes.data[0];
      if (!targetProject) throw new Error('No project found to dispatch tasks.');

      const payload = dispatchType === 'sleep' 
        ? { durationSec: sleepSec }
        : { url: httpUrl, method: httpMethod };

      await axios.post(`${API_BASE}/api/v1/jobs`, {
        projectId: targetProject.id,
        type: dispatchType,
        priority: jobPriority,
        payload,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setDispatchMessage('Task frame successfully queued.');
      fetchJobs();
    } catch (err: any) {
      setDispatchMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setDispatching(false);
    }
  };

  const handleAddProviderAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setProvSaving(true);
    setProvMessage('');

    try {
      if (!org?.id) throw new Error('No organization workspace loaded.');

      await axios.post(`${API_BASE}/api/v1/provider-accounts`, {
        organizationId: org.id,
        provider: provType,
        accountName: provAcctName,
        credentials: { apiKey: provApiKey },
        region: provRegion,
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setProvMessage('Account linked.');
      setProvApiKey('');
      fetchProviderAccounts();
    } catch (err: any) {
      setProvMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setProvSaving(false);
    }
  };

  const handleAutoLinkCli = async () => {
    setProvSaving(true);
    setProvMessage('');

    try {
      if (!org?.id) throw new Error('No organization workspace loaded.');

      await axios.post(`${API_BASE}/api/v1/provider-accounts/link-cli`, {
        organizationId: org.id
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      setProvMessage('Render CLI config imported.');
      fetchProviderAccounts();
    } catch (err: any) {
      setProvMessage(`Error: ${err.response?.data?.error || err.message}`);
    } finally {
      setProvSaving(false);
    }
  };

  const handleCancelJob = async (jobId: string) => {
    try {
      await axios.post(`${API_BASE}/api/v1/jobs/${jobId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` }
      });
      fetchJobs();
    } catch (e) {
      console.error(e);
    }
  };

  const onlineCount = workers.filter(w => w.status === 'ONLINE' || w.status === 'BUSY').length;
  const runningJobs = jobs.filter(j => j.status === 'RUNNING').length;
  const queuedJobs = jobs.filter(j => j.status === 'QUEUED' || j.status === 'RETRYING').length;

  if (!token) {
    return (
      <div className="login-wrapper">
        <div className="login-card">
          <div className="login-header">
            <div className="brand" style={{ justifyContent: 'center', marginBottom: '16px', paddingLeft: 0 }}>
              <div className="brand-icon">N</div>
              <span>NEBULA</span>
            </div>
            <h2 className="login-title">Control Access</h2>
            <p className="login-subtitle">Distributed Compute Orchestrator</p>
          </div>

          {loginError && (
            <div style={{ color: 'var(--err)', fontSize: '13px', background: 'rgba(239, 68, 68, 0.05)', padding: '12px', borderRadius: '4px', border: '1px solid rgba(239, 68, 68, 0.15)', textAlign: 'center' }}>
              {loginError}
            </div>
          )}

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div className="input-group">
              <label className="input-label">Identity Email</label>
              <input 
                type="email" 
                className="input-field" 
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="input-group">
              <label className="input-label">Access Token / Password</label>
              <input 
                type="password" 
                className="input-field" 
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
              />
            </div>
            <button type="submit" className="btn" style={{ marginTop: '8px' }}>
              <UserCheck size={18} /> Access Cluster
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="dashboard-layout">
      {/* Sidebar Navigation */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-icon">N</div>
          <span>NEBULA</span>
        </div>

        <nav style={{ flex: 1 }}>
          <ul className="nav-links">
            <li>
              <div 
                className={`nav-item ${activeTab === 'overview' ? 'active' : ''}`}
                onClick={() => setActiveTab('overview')}
              >
                <Activity size={18} /> Overview
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${activeTab === 'workers' ? 'active' : ''}`}
                onClick={() => setActiveTab('workers')}
              >
                <Server size={18} /> Workers
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${activeTab === 'jobs' ? 'active' : ''}`}
                onClick={() => setActiveTab('jobs')}
              >
                <Layers size={18} /> Tasks
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${activeTab === 'providers' ? 'active' : ''}`}
                onClick={() => setActiveTab('providers')}
              >
                <CloudLightning size={18} /> Providers
              </div>
            </li>
            <li>
              <div 
                className={`nav-item ${activeTab === 'dispatch' ? 'active' : ''}`}
                onClick={() => setActiveTab('dispatch')}
              >
                <PlusCircle size={18} /> Dispatcher
              </div>
            </li>
          </ul>
        </nav>

        {/* User Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border)', paddingTop: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '4px', background: 'rgba(148, 163, 184, 0.08)', border: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 'bold' }}>
              SA
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '13.5px', fontWeight: 600 }}>{user?.name || 'System Admin'}</span>
              <span style={{ fontSize: '11px', color: 'var(--text-2)' }}>{org?.name || 'Workspace'}</span>
            </div>
          </div>
          <button className="btn btn-secondary" onClick={handleLogout} style={{ padding: '8px 12px', fontSize: '12px' }}>
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      </aside>

      {/* Main Dashboard Section */}
      <main className="main-content">
        <header className="page-header">
          <div>
            <h1 className="page-title">
              {activeTab === 'overview' && 'Overview'}
              {activeTab === 'workers' && 'Workers'}
              {activeTab === 'jobs' && 'Tasks Queue'}
              {activeTab === 'providers' && 'Cloud Providers'}
              {activeTab === 'dispatch' && 'Task Dispatcher'}
            </h1>
            <p style={{ margin: '4px 0 0 0', color: 'var(--text-3)', fontSize: '13px' }}>
              Cluster Management System
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '12px' }} onClick={() => { fetchWorkers(); fetchJobs(); fetchProviderAccounts(); }}>
              <RotateCcw size={14} /> Sync Telemetry
            </button>
          </div>
        </header>

        {/* 1. Stats Counter Strip (Common) */}
        <section className="stats-grid">
          <div className="glass-card stat-card">
            <span className="stat-label">Total Workers</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span className="stat-value">{workers.length}</span>
              <Server size={28} color="var(--text-2)" />
            </div>
            <span className="stat-desc">{onlineCount} online node agents</span>
          </div>

          <div className="glass-card stat-card">
            <span className="stat-label">Active Runners</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span className="stat-value">{runningJobs}</span>
              <Activity size={28} color="var(--ok)" />
            </div>
            <span className="stat-desc">Executing threads on workers</span>
          </div>

          <div className="glass-card stat-card">
            <span className="stat-label">Queued Tasks</span>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '4px' }}>
              <span className="stat-value">{queuedJobs}</span>
              <Layers size={28} color="var(--status-queued)" />
            </div>
            <span className="stat-desc">Awaiting executor pickup</span>
          </div>
        </section>

        {/* 2. TAB CONTENT: OVERVIEW */}
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            
            {/* Live Terminal Log Streams */}
            <div className="glass-card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TermIcon size={18} color="var(--text-2)" /> Live Log telemetry
              </h3>
              <div className="terminal-panel">
                <div className="terminal-header">
                  <span>nebula-control-plane@master ~ socket-feed</span>
                  <div className="terminal-actions">
                    <span className="terminal-dot red"></span>
                    <span className="terminal-dot yellow"></span>
                    <span className="terminal-dot green"></span>
                  </div>
                </div>
                <div className="terminal-body">
                  {logs.length === 0 ? (
                    <div style={{ color: 'var(--text-3)', textAlign: 'center', marginTop: '120px', fontFamily: 'var(--font-sans)', fontSize: '13px' }}>
                      Monitoring socket.io link. Trigger cluster tasks to capture logs.
                    </div>
                  ) : (
                    logs.map((log) => (
                      <div key={log.id} className={`terminal-line ${log.level.toLowerCase()}`}>
                        [{new Date(log.timestamp).toLocaleTimeString()}] [{log.level}] {log.message}
                      </div>
                    ))
                  )}
                  <div ref={terminalEndRef} />
                </div>
              </div>
            </div>

            {/* Quick overview grids */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
              
              {/* Connected Workers brief list */}
              <div className="glass-card">
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600 }}>Active Nodes Registry</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {workers.length === 0 ? (
                    <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>No nodes registered.</div>
                  ) : (
                    workers.slice(0, 4).map(w => (
                      <div key={w.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span style={{ display: 'inline-block', width: '6px', height: '6px', borderRadius: '50%', background: w.status === 'ONLINE' ? 'var(--status-online)' : w.status === 'BUSY' ? 'var(--status-busy)' : 'var(--status-offline)' }}></span>
                          <span style={{ fontSize: '13px', fontWeight: 'bold' }}>{w.name}</span>
                        </div>
                        <span className="worker-node-id" style={{ fontSize: '10.5px' }}>{w.nodeId.substring(0, 16)}...</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Recent Tasks List */}
              <div className="glass-card">
                <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600 }}>Recent Executions</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {jobs.length === 0 ? (
                    <div style={{ color: 'var(--text-3)', fontSize: '13px' }}>No task logs found.</div>
                  ) : (
                    jobs.slice(0, 4).map(j => (
                      <div key={j.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <span style={{ fontSize: '12.5px', fontWeight: 'bold', fontFamily: 'var(--font-mono)' }}>job-{j.id.substring(0, 6)}</span>
                          <span style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '2px' }}>Type: {j.type}</span>
                        </div>
                        <span style={{ 
                          fontSize: '11px', 
                          fontWeight: 'bold', 
                          color: j.status === 'COMPLETED' ? 'var(--status-online)' : j.status === 'FAILED' ? 'var(--status-error)' : 'var(--status-queued)'
                        }}>{j.status}</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. TAB CONTENT: WORKERS GRID */}
        {activeTab === 'workers' && (
          <div>
            {workers.length === 0 ? (
              <div className="glass-card" style={{ textAlign: 'center', padding: '60px' }}>
                <Wifi size={40} color="var(--text-3)" style={{ marginBottom: '16px' }} />
                <h3 style={{ fontSize: '16px', fontWeight: 600 }}>No online cluster nodes found</h3>
                <p style={{ color: 'var(--text-3)', fontSize: '13px', maxWidth: '360px', margin: '8px auto' }}>
                  Verify your worker configurations and run `npm run dev:worker` to spawn executors.
                </p>
              </div>
            ) : (
              <div className="workers-grid">
                {workers.map((worker) => {
                  let capabilities: any = {};
                  try {
                    capabilities = JSON.parse(worker.capabilitiesJson);
                  } catch(e) {}
                  
                  return (
                    <div key={worker.id} className="glass-card worker-card">
                      <div className="worker-card-header">
                        <div className="worker-title-wrapper">
                          <span className="worker-name">{worker.name}</span>
                          <span className="worker-node-id">ID: {worker.id.substring(0, 10)}...</span>
                        </div>
                        <span className={`status-badge ${worker.status.toLowerCase()}`}>
                          {worker.status}
                        </span>
                      </div>

                      <div className="worker-stats">
                        <div className="worker-stat-row">
                          <span>Runtime Provider</span>
                          <span style={{ fontWeight: 600, textTransform: 'uppercase', fontSize: '11px' }}>{worker.provider}</span>
                        </div>
                        <div className="worker-stat-row">
                          <span>Compute Capacity</span>
                          <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontWeight: 500 }}>
                            <Cpu size={12} /> {worker.cpuCores} Cores | {worker.memoryMb}MB
                          </span>
                        </div>
                        <div className="worker-stat-row">
                          <span>Concurrency Slots</span>
                          <span>{worker.activeJobs} / {worker.maxConcurrentJobs} slot</span>
                        </div>
                        <div className="worker-stat-row">
                          <span>Capabilities</span>
                          <span style={{ fontSize: '11px', fontFamily: 'var(--font-mono)' }}>
                            {capabilities.jobTypes?.join(', ') || 'http'}
                          </span>
                        </div>
                        <div className="worker-stat-row" style={{ borderTop: '1px dashed var(--border)', paddingTop: '12px' }}>
                          <span>Uptime Ping</span>
                          <span style={{ color: 'var(--text-3)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <Clock size={12} /> {worker.lastHeartbeatAt ? new Date(worker.lastHeartbeatAt).toLocaleTimeString() : 'Never'}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* 4. TAB CONTENT: JOBS LIST */}
        {activeTab === 'jobs' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div className="table-container">
              <div className="table-controls">
                <input type="text" className="search-input" placeholder="Search jobs by ID, type, or status..." />
                <select className="filter-select">
                  <option value="">Status</option>
                  <option value="running">Running</option>
                  <option value="queued">Queued</option>
                </select>
                <select className="filter-select">
                  <option value="">Priority</option>
                  <option value="high">High</option>
                  <option value="low">Low</option>
                </select>
                <select className="filter-select">
                  <option value="">Cluster</option>
                  <option value="all">All</option>
                </select>
              </div>

              {jobs.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-3)', fontSize: '13px' }}>
                  No tasks queued.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr>
                        <th>JOB ID</th>
                        <th>TYPE</th>
                        <th>PRIORITY</th>
                        <th>STATUS</th>
                        <th>CREATED</th>
                        <th>ACTIONS</th>
                      </tr>
                    </thead>
                    <tbody>
                      {jobs.map((job) => {
                        // Map status to pill class
                        const s = job.status.toLowerCase();
                        let pillClass = 'status-pill ';
                        if (s === 'running') pillClass += 'pill-running';
                        else if (s === 'queued') pillClass += 'pill-queued';
                        else if (s === 'completed') pillClass += 'pill-completed';
                        else if (s === 'retrying') pillClass += 'pill-retrying';
                        else if (s === 'failed') pillClass += 'pill-failed';
                        else pillClass += 'pill-queued';

                        // Priority string
                        const priorityStr = job.priority > 5 ? 'High' : job.priority < 0 ? 'Low' : 'Medium';
                        
                        // Created time relative
                        const createdRel = Math.round((Date.now() - new Date(job.createdAt).getTime()) / 60000);
                        const createdStr = createdRel < 1 ? 'Just now' : createdRel < 60 ? `${createdRel} minutes ago` : `${Math.floor(createdRel/60)} hours ago`;

                        return (
                          <tr key={job.id} onClick={() => { setSelectedJobId(job.id); fetchJobLogs(job.id); }}>
                            <td style={{ fontFamily: 'var(--font-mono)', fontWeight: 'bold' }}>
                              nebula-job-{job.id.substring(0, 4)}
                            </td>
                            <td>{job.type}</td>
                            <td>{priorityStr}</td>
                            <td>
                              <span className={pillClass}>
                                {job.status.charAt(0).toUpperCase() + job.status.slice(1).toLowerCase()}
                              </span>
                            </td>
                            <td style={{ color: 'var(--text-3)' }}>{createdStr}</td>
                            <td onClick={e => e.stopPropagation()}>
                              {['QUEUED', 'RUNNING'].includes(job.status) ? (
                                <button className="btn-terminate" onClick={() => handleCancelJob(job.id)}>
                                  <AlertTriangle size={12} /> Terminate
                                </button>
                              ) : (
                                <button className="btn-terminate" disabled style={{ opacity: 0.5 }}>
                                  <AlertTriangle size={12} /> Terminate
                                </button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. TAB CONTENT: CLOUD PROVIDERS */}
        {activeTab === 'providers' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            
            {/* Connected Providers List */}
            <div className="glass-card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '16px', fontWeight: 600 }}>Connected Accounts</h3>
              {providerAccounts.length === 0 ? (
                <div style={{ padding: '40px', color: 'var(--text-3)', textAlign: 'center', fontSize: '13px' }}>
                  No cloud credential frames linked. Auto-link or connect on the right.
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-3)' }}>
                        <th style={{ padding: '12px 8px' }}>Workspace</th>
                        <th style={{ padding: '12px 8px' }}>Provider</th>
                        <th style={{ padding: '12px 8px' }}>Region</th>
                        <th style={{ padding: '12px 8px' }}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {providerAccounts.map((account) => (
                        <tr key={account.id} style={{ borderBottom: '1px solid var(--border)' }}>
                          <td style={{ padding: '14px 8px', fontWeight: 'bold' }}>{account.accountName}</td>
                          <td style={{ padding: '14px 8px', textTransform: 'uppercase', fontSize: '10.5px', color: 'var(--text-3)', fontWeight: 600 }}>
                            {account.provider}
                          </td>
                          <td style={{ padding: '14px 8px', textTransform: 'capitalize' }}>{account.region}</td>
                          <td style={{ padding: '14px 8px' }}>
                            <span className="status-badge online" style={{ padding: '2px 6px' }}>
                              {account.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Connect Provider Form */}
            <div className="glass-card">
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600 }}>Secure Key Link</h3>
              <form onSubmit={handleAddProviderAccount}>
                <div className="input-group">
                  <label className="input-label">Provider type</label>
                  <select 
                    className="input-field"
                    value={provType}
                    onChange={e => setProvType(e.target.value)}
                  >
                    <option value="render">Render Cloud (API)</option>
                    <option value="railway">Railway (API)</option>
                    <option value="oracle">Oracle Cloud Infrastructure</option>
                    <option value="local">Docker VPS Group</option>
                  </select>
                </div>

                <div className="input-group">
                  <label className="input-label">Workspace Alias</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. Render Prod"
                    value={provAcctName}
                    onChange={e => setProvAcctName(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">Region</label>
                  <input 
                    type="text" 
                    className="input-field"
                    placeholder="e.g. oregon"
                    value={provRegion}
                    onChange={e => setProvRegion(e.target.value)}
                    required
                  />
                </div>

                <div className="input-group">
                  <label className="input-label">User API Key (rnd_...)</label>
                  <input 
                    type="password" 
                    className="input-field"
                    placeholder="Enter Key credentials"
                    value={provApiKey}
                    onChange={e => setProvApiKey(e.target.value)}
                    required
                  />
                  <span style={{ fontSize: '11px', color: 'var(--text-3)', marginTop: '4px' }}>
                    Linked credentials are encrypted at rest.
                  </span>
                </div>

                <button 
                  type="submit" 
                  className="btn" 
                  disabled={provSaving}
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  <CloudLightning size={16} /> {provSaving ? 'Linking...' : 'Connect Cloud Credentials'}
                </button>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '16px 0' }}>
                  <hr style={{ flex: 1, border: 'none', borderTop: '1px dashed var(--border)' }} />
                  <span style={{ fontSize: '9.5px', color: 'var(--text-3)', fontWeight: 600 }}>OR</span>
                  <hr style={{ flex: 1, border: 'none', borderTop: '1px dashed var(--border)' }} />
                </div>

                <button 
                  type="button"
                  className="btn btn-secondary"
                  disabled={provSaving}
                  style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
                  onClick={handleAutoLinkCli}
                >
                  ⚡ Auto-Link Local Render CLI Config
                </button>

                {provMessage && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-2)', textAlign: 'center' }}>
                    {provMessage}
                  </div>
                )}
              </form>
            </div>

          </div>
        )}

        {/* 6. TAB CONTENT: DISPATCH PORTAL */}
        {activeTab === 'dispatch' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
            
            {/* Create Job Form */}
            <div className="glass-card">
              <h3 style={{ margin: '0 0 20px 0', fontSize: '16px', fontWeight: 600 }}>Dispatch Cluster Task</h3>
              <form onSubmit={handleDispatchJob}>
                
                <div className="input-group">
                  <label className="input-label">Task Type</label>
                  <select 
                    className="input-field" 
                    value={dispatchType}
                    onChange={e => setDispatchType(e.target.value as 'sleep' | 'http')}
                  >
                    <option value="sleep">Test Latency Function (sleep)</option>
                    <option value="http">Secure HTTP Web Scanner (http)</option>
                  </select>
                </div>

                {dispatchType === 'sleep' ? (
                  <div className="input-group">
                    <label className="input-label">Duration (Seconds)</label>
                    <input 
                      type="number" 
                      className="input-field" 
                      min="1" 
                      max="60"
                      value={sleepSec}
                      onChange={e => setSleepSec(parseInt(e.target.value, 10))}
                    />
                    <span style={{ fontSize: '11px', color: 'var(--text-3)' }}>Simulates execution latency</span>
                  </div>
                ) : (
                  <>
                    <div className="input-group">
                      <label className="input-label">Target URL</label>
                      <input 
                        type="url" 
                        className="input-field" 
                        value={httpUrl}
                        onChange={e => setHttpUrl(e.target.value)}
                        required
                      />
                    </div>
                    <div className="input-group">
                      <label className="input-label">Method</label>
                      <select 
                        className="input-field" 
                        value={httpMethod}
                        onChange={e => setHttpMethod(e.target.value)}
                      >
                        <option value="GET">GET</option>
                        <option value="POST">POST</option>
                        <option value="PUT">PUT</option>
                      </select>
                    </div>
                  </>
                )}

                <div className="input-group">
                  <label className="input-label">Execution Priority (0 = Default)</label>
                  <input 
                    type="number" 
                    className="input-field" 
                    value={jobPriority}
                    onChange={e => setJobPriority(parseInt(e.target.value, 10))}
                  />
                </div>

                <button 
                  type="submit" 
                  className="btn" 
                  disabled={dispatching} 
                  style={{ width: '100%', marginTop: '12px' }}
                >
                  <Play size={16} /> {dispatching ? 'Scheduling...' : 'Queue Task Frame'}
                </button>

                {dispatchMessage && (
                  <div style={{ marginTop: '12px', fontSize: '12px', color: 'var(--text-2)', textAlign: 'center' }}>
                    {dispatchMessage}
                  </div>
                )}
              </form>
            </div>

            {/* Instruction Guide */}
            <div className="glass-card">
              <h3 style={{ margin: '0 0 16px 0', fontSize: '15px', fontWeight: 600 }}>Dispatch Specifications</h3>
              <p style={{ fontSize: '13px', lineHeight: '1.6', color: 'var(--text-2)' }}>
                Upon launching cluster task frames:
              </p>
              <ul style={{ fontSize: '12px', lineHeight: '1.8', color: 'var(--text-2)', paddingLeft: '16px' }}>
                <li>The payload is parsed and saved inside the PostgreSQL store.</li>
                <li>An active ticket is queued in Redis utilizing BullMQ frameworks.</li>
                <li>Eligible worker nodes matching capability matrices pull, lock, and execute the job.</li>
                <li>WebSocket listeners output live log sequences directly to the console frame.</li>
              </ul>
              <div style={{ marginTop: '20px', background: 'rgba(255, 255, 255, 0.02)', padding: '16px', borderRadius: '4px', border: '1px solid var(--border)' }}>
                <span style={{ fontSize: '12px', fontWeight: 'bold', color: 'var(--text)', display: 'block', marginBottom: '4px' }}>Quick Demo</span>
                <span style={{ fontSize: '11.5px', color: 'var(--text-2)', lineHeight: '1.5' }}>
                  Submit a 10-second sleep latency task and immediately monitor the terminal console under the Overview tab to view progress sequences in real-time.
                </span>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
