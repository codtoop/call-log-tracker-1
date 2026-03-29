"use client";

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import CallStatistics from '../components/CallStatistics';
import CallActivityGraph from '../components/CallActivityGraph';

function DashboardContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<string>('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loginError, setLoginError] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [limit, setLimit] = useState<number>(() => parseInt(searchParams.get('limit') || '10', 10));
  const [page, setPage] = useState<number>(() => parseInt(searchParams.get('page') || '1', 10));
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters State
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    return d.toISOString().split('T')[0];
  }, []);
  const defaultEndDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1); // default to tomorrow
    return d.toISOString().split('T')[0];
  }, []);

  const [selectedAgent, setSelectedAgent] = useState<string>(searchParams.get('agentId') || '');
  const [phoneNumber, setPhoneNumber] = useState<string>(searchParams.get('phoneNumber') || '');
  const [startDate, setStartDate] = useState<string>(searchParams.get('startDate') || defaultStartDate);
  const [endDate, setEndDate] = useState<string>(searchParams.get('endDate') || defaultEndDate);

  // Storage for accurate graphing & stats (unpaginated)
  const [allFilteredLogs, setAllFilteredLogs] = useState<any[]>([]);

  // Add Agent State
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [showNewAgentPassword, setShowNewAgentPassword] = useState(false);
  const [addAgentStatus, setAddAgentStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [addAgentLoading, setAddAgentLoading] = useState(false);

  // Agent Status Filter State
  const [agentStatusFilter, setAgentStatusFilter] = useState<'ALL' | 'ONLINE' | 'OFFLINE'>('ALL');

  // Rename Agent State
  const [isRenamingAgent, setIsRenamingAgent] = useState(false);
  const [renamingAgentId, setRenamingAgentId] = useState('');
  const [newAgentNameForRename, setNewAgentNameForRename] = useState('');
  const [renameAgentStatus, setRenameAgentStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [renameAgentLoading, setRenameAgentLoading] = useState(false);
  const [allAgents, setAllAgents] = useState<any[]>([]);

  // Agent History Modal State
  const [isViewingHistory, setIsViewingHistory] = useState(false);
  const [historyAgent, setHistoryAgent] = useState<{ id: string, username: string } | null>(null);
  const [historySessions, setHistorySessions] = useState<any[]>([]);
  const [historyLoginSessions, setHistoryLoginSessions] = useState<any[]>([]);
  const [historyTab, setHistoryTab] = useState<'activity' | 'login'>('activity');
  const [historyLoading, setHistoryLoading] = useState(false);
  const [selectedLogForView, setSelectedLogForView] = useState<any | null>(null);
  const [isViewingLog, setIsViewingLog] = useState(false);

  // Rename Agent State
  const filteredLogs = logs; // Keeping the name to minimize diff, but it's server-filtered now.

  const updateUrlParams = (newParams: Record<string, string>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(newParams).forEach(([key, value]) => {
      if (value) {
        params.set(key, value);
      } else {
        params.delete(key);
      }
    });
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  // Fetch all agents for the dropdown
  const fetchAgents = async (authToken: string) => {
    try {
      const res = await fetch('/api/agents', { headers: { 'Authorization': `Bearer ${authToken}` } });
      const data = await res.json();
      if (data.success) {
        setAllAgents(data.agents);
      }
    } catch (err) {
      console.error('Failed to load agents', err);
    }
  };

  // 1. Session Restoration on Mount
  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedRole = localStorage.getItem('role');
    if (savedToken) {
      setToken(savedToken);
      if (savedRole) setRole(savedRole);
    }
  }, []);

  // 2. Data Fetching and Polling
  useEffect(() => {
    if (!token) return;

    fetchLogs(token);
    if (role === 'ADMIN') fetchAgents(token);

    // Instantly pull new logs every 3 seconds
    const interval = setInterval(() => {
      fetchLogs(token);
      if (role === 'ADMIN') fetchAgents(token);
    }, 3000);

    return () => clearInterval(interval);
  }, [token, role, limit, page, selectedAgent, startDate, endDate, phoneNumber]); // Added token to dependencies

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username, password }),
      });

      const data = await res.json();
      if (data.success) {
        localStorage.setItem('token', data.token);
        localStorage.setItem('role', data.role);
        setToken(data.token);
        setRole(data.role);
      } else {
        setLoginError(data.error || 'Login failed');
      }
    } catch (err) {
      setLoginError('An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (authToken: string) => {
    try {
      const params = new URLSearchParams();
      params.set('limit', limit.toString());
      params.set('page', page.toString());
      if (selectedAgent) params.set('agentId', selectedAgent);
      if (phoneNumber) params.set('phoneNumber', phoneNumber);
      if (startDate) params.set('startDate', startDate);
      if (endDate) params.set('endDate', endDate);
      params.set('t', Date.now().toString());

      const res = await fetch(`/api/logs?${params.toString()}`, {
        cache: 'no-store',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Cache-Control': 'no-store'
        }
      });
      const data = await res.json();
      if (data.success) {
        setTotalPages(data.totalPages || 1);
        if (data.allFilteredLogs) {
          setAllFilteredLogs(data.allFilteredLogs);
        }
        setLogs(prevLogs => {
          // Check if the IDs of the returned logs perfectly match the existing logs
          // Sort them first to avoid non-deterministic database ordering forcing a false update
          if (prevLogs.length === data.logs.length) {
            const prevIds = prevLogs.map((l: any) => String(l.id)).sort().join(',');
            const newIds = data.logs.map((l: any) => String(l.id)).sort().join(',');

            if (prevIds === newIds) {
              return prevLogs; // Bail out! No unneeded React re-renders!
            }
          }
          return data.logs;
        });
      } else if (res.status === 401) {
        handleLogout();
      }
    } catch (err) {
      console.error('Failed to fetch logs', err);
    }
  };

  const handleAddAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddAgentLoading(true);
    setAddAgentStatus(null);

    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newAgentUsername,
          password: newAgentPassword
        })
      });

      const data = await res.json();

      if (res.ok) {
        setAddAgentStatus({ type: 'success', message: `Agent ${data.username} created successfully!` });
        setNewAgentUsername('');
        setNewAgentPassword('');
        // Hide modal after a short delay
        setTimeout(() => {
          setIsAddingAgent(false);
          setAddAgentStatus(null);
        }, 2000);
      } else {
        setAddAgentStatus({ type: 'error', message: data.error || 'Failed to add agent' });
      }
    } catch (err) {
      setAddAgentStatus({ type: 'error', message: 'An unexpectedly occurred' });
    } finally {
      setAddAgentLoading(false);
    }
  };

  const handleOpenRenameModal = async () => {
    setIsRenamingAgent(true);
    setRenameAgentStatus(null);
    setNewAgentNameForRename('');
    try {
      const res = await fetch('/api/agents', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setAllAgents(data.agents);
        if (data.agents.length > 0) {
          setRenamingAgentId(data.agents[0].id);
        }
      }
    } catch (err) {
      console.error('Failed to load agents for renaming', err);
    }
  };

  const handleRenameAgent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!renamingAgentId || !newAgentNameForRename) return;

    setRenameAgentLoading(true);
    setRenameAgentStatus(null);

    try {
      const res = await fetch(`/api/agents/${renamingAgentId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          username: newAgentNameForRename
        })
      });

      const data = await res.json();

      if (res.ok) {
        setRenameAgentStatus({ type: 'success', message: `Agent renamed to ${data.agent.username}!` });
        // Force update the local logs array to immediately show the new name
        setLogs(prevLogs => prevLogs.map(log => {
          if (log.agentId === renamingAgentId) {
            return { ...log, agent: { username: data.agent.username } };
          }
          return log;
        }));

        // Hide modal after a short delay
        setTimeout(() => {
          setIsRenamingAgent(false);
          setRenameAgentStatus(null);
          setNewAgentNameForRename('');
        }, 1500);
      } else {
        setRenameAgentStatus({ type: 'error', message: data.error || 'Failed to rename agent' });
      }
    } catch (err) {
      setRenameAgentStatus({ type: 'error', message: 'An unexpectedly occurred' });
    } finally {
      setRenameAgentLoading(false);
    }
  };

  const handleOpenHistory = async (agentId: string, username: string) => {
    setHistoryAgent({ id: agentId, username });
    setIsViewingHistory(true);
    setHistoryLoading(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/sessions`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setHistorySessions(data.sessions || []);
        setHistoryLoginSessions(data.loginSessions || []);
        setHistoryTab('activity');
      } else {
        setHistorySessions([]);
        setHistoryLoginSessions([]);
      }
    } catch (err) {
      console.error('Failed to load history', err);
      setHistorySessions([]);
      setHistoryLoginSessions([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const calculateDuration = (start: string, end: string) => {
    const diff = Math.max(0, new Date(end).getTime() - new Date(start).getTime());
    const m = Math.floor(diff / 60000);
    const h = Math.floor(m / 60);
    if (h > 0) return `${h}h ${m % 60}m`;
    return `${m}m`;
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('role');
    setToken(null);
    setRole('');
    setLogs([]);
  };

  const formatDuration = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}m ${s}s`;
  };

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <div className="max-w-md w-full space-y-8 p-10 bg-gray-900 rounded-xl shadow-2xl border border-gray-800">
          <div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-white">Call Center Monitor</h2>
            <p className="mt-2 text-center text-sm text-gray-400">Sign in to your account</p>
          </div>
          <form className="mt-8 space-y-6" onSubmit={handleLogin}>
            <div className="rounded-md shadow-sm -space-y-px">
              <div>
                <input
                  name="username"
                  type="text"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-800 text-white rounded-t-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                />
              </div>
              <div className="relative">
                <input
                  name="password"
                  type={showPassword ? "text" : "password"}
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-800 text-white rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm pr-10"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white z-20"
                >
                  {showPassword ? (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                  ) : (
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                  )}
                </button>
              </div>
            </div>

            {loginError && <p className="text-red-500 text-sm">{loginError}</p>}

            <div>
              <button
                type="submit"
                disabled={loading}
                className="group relative w-full flex justify-center py-3 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors"
              >
                {loading ? 'Signing in...' : 'Sign in'}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 text-white">
      <nav className="bg-gray-900 border-b border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center">
              <span className="font-bold text-xl text-indigo-500">Call Center Monitor</span>
            </div>
            <div>
              {role === 'ADMIN' && (
                <>
                  <button
                    onClick={handleOpenRenameModal}
                    className="bg-gray-800 hover:bg-gray-700 text-white px-3 py-2 mr-3 rounded-md text-sm font-medium transition-colors border border-gray-700"
                  >
                    Rename Agent
                  </button>
                  <button
                    onClick={() => setIsAddingAgent(true)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 mr-4 rounded-md text-sm font-medium transition-colors"
                  >
                    Add Agent
                  </button>
                </>
              )}
              <button
                onClick={handleLogout}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="flex justify-between items-center mb-6">
            <h1 className="text-2xl font-semibold">Recent Call Logs</h1>
            <button
              onClick={() => {
                fetchLogs(token as string);
                if (role === 'ADMIN') fetchAgents(token as string);
              }}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm transition-colors border border-gray-700"
            >
              Refresh
            </button>
          </div>

          {/* Agent Status Area */}
          {role === 'ADMIN' && allAgents.length > 0 && (
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-sm mb-6">
              <div className="flex justify-between items-center mb-4">
                <label className="flex items-center text-sm font-medium text-green-400">
                  <span className="mr-2">🟢</span> Agent Status Insights
                </label>
                <div className="flex items-center space-x-2">
                  <span className="text-sm text-gray-400">Filter:</span>
                  <select
                    value={agentStatusFilter}
                    onChange={(e) => setAgentStatusFilter(e.target.value as 'ALL' | 'ONLINE' | 'OFFLINE')}
                    className="bg-gray-800 border border-gray-700 text-white text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-1.5"
                  >
                    <option value="ALL">All Agents</option>
                    <option value="ONLINE">Online 🟢</option>
                    <option value="OFFLINE">Offline 🔘</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap gap-4">
                {allAgents.filter(agent => {
                  if (agentStatusFilter === 'ALL') return true;
                  const isOnline = agent.lastSeen && (new Date().getTime() - new Date(agent.lastSeen).getTime()) < 120000;
                  if (agentStatusFilter === 'ONLINE') return isOnline;
                  if (agentStatusFilter === 'OFFLINE') return !isOnline;
                  return true;
                }).map(agent => {
                  const isOnline = agent.lastSeen && (new Date().getTime() - new Date(agent.lastSeen).getTime()) < 120000;
                  return (
                    <div key={agent.id} className="flex items-center bg-gray-800 px-4 py-3 rounded-lg border border-gray-700 w-auto shadow-inner">
                      <span className={`h-3 w-3 rounded-full mr-3 shadow-sm ${isOnline ? 'bg-green-500 shadow-green-500/50' : 'bg-gray-500'}`}></span>
                      <div className="flex flex-col flex-1">
                        <span className="text-sm font-semibold text-gray-200">{agent.username}</span>
                        <span className="text-xs text-gray-500">
                          {isOnline ? 'Online' : 'Offline'}
                        </span>
                      </div>
                      <button
                        onClick={() => handleOpenHistory(agent.id, agent.username)}
                        className="ml-3 p-1 text-gray-400 hover:text-indigo-400 hover:bg-gray-700 rounded-md transition-colors"
                        title="View Session History"
                      >
                        🕒
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Filters Area */}
          <div className={`grid grid-cols-1 ${role === 'ADMIN' ? 'md:grid-cols-3' : 'md:grid-cols-2'} gap-6 mb-6`}>
            {/* Agent Filter */}
            {role === 'ADMIN' && (
              <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-sm">
                <label className="flex items-center text-sm font-medium text-amber-500 mb-2">
                  <span className="mr-2">📁</span> Select Agent to Analyze:
                </label>
                <select
                  value={selectedAgent}
                  onChange={(e) => {
                    const val = e.target.value;
                    setSelectedAgent(val);
                    setPage(1);
                    updateUrlParams({ agentId: val, page: '1' });
                  }}
                  className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2.5 appearance-none"
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 1rem center',
                    backgroundSize: '1em'
                  }}
                >
                  <option value="">All Agents</option>
                  {allAgents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.username}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Phone Number Filter */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-sm">
              <label className="flex items-center text-sm font-medium text-blue-400 mb-2">
                <span className="mr-2">📱</span> Filter by Phone Number:
              </label>
              <input
                type="text"
                value={phoneNumber}
                onChange={(e) => {
                  setPhoneNumber(e.target.value);
                  setPage(1);
                  updateUrlParams({ phoneNumber: e.target.value, page: '1' });
                }}
                placeholder="Enter phone number..."
                className="w-full bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
              />
            </div>

            {/* Date Range Filter */}
            <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 shadow-sm">
              <label className="flex items-center text-sm font-medium text-gray-300 mb-2">
                <span className="mr-2">📅</span> Select Date Range to View:
              </label>
              <div className="flex space-x-2">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => {
                    setStartDate(e.target.value);
                    setPage(1);
                    updateUrlParams({ startDate: e.target.value, page: '1' });
                  }}
                  className="w-1/2 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                />
                <span className="text-gray-500 self-center">to</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => {
                    setEndDate(e.target.value);
                    setPage(1);
                    updateUrlParams({ endDate: e.target.value, page: '1' });
                  }}
                  className="w-1/2 bg-gray-800 border border-gray-700 text-gray-200 text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 block p-2.5"
                />
              </div>
            </div>
          </div>

          {/* Pagination Controls */}
          {filteredLogs.length > 0 && (
            <div className="flex justify-between items-center bg-gray-900 border border-gray-800 rounded-lg p-4 mb-6 shadow-sm">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-400">Show:</span>
                <select
                  value={limit}
                  onChange={(e) => {
                    const newLimit = Number(e.target.value);
                    setLimit(newLimit);
                    setPage(1);
                    updateUrlParams({ limit: newLimit.toString(), page: '1' });
                  }}
                  className="bg-gray-800 border border-gray-700 text-white text-sm rounded-md focus:ring-indigo-500 focus:border-indigo-500 p-1.5"
                >
                  <option value="10">10</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                </select>
                <span className="text-sm text-gray-400">entries</span>
              </div>

              <div className="flex items-center space-x-4">
                <button
                  onClick={() => {
                    const p = Math.max(1, page - 1);
                    setPage(p);
                    updateUrlParams({ page: p.toString() });
                  }}
                  disabled={page === 1}
                  className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-700 transition-colors"
                >
                  Previous
                </button>
                <span className="text-sm text-gray-400">
                  Page {page} of {totalPages}
                </span>
                <button
                  onClick={() => {
                    const p = Math.min(totalPages, page + 1);
                    setPage(p);
                    updateUrlParams({ page: p.toString() });
                  }}
                  disabled={page === totalPages}
                  className="px-3 py-1 bg-gray-800 text-gray-300 rounded-md disabled:opacity-50 hover:bg-gray-700 transition-colors"
                >
                  Next
                </button>
              </div>
            </div>
          )}

          {/* Recent Call Logs Table */}
          <div className="bg-gray-900 shadow-xl rounded-lg overflow-hidden border border-gray-800 mb-6">
            <table className="min-w-full divide-y divide-gray-800">
              <thead className="bg-gray-950">
                <tr>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Time</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Agent</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Phone Number</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Type</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Durations</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Hangup By</th>
                  <th scope="col" className="px-6 py-4 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">Diagnostics</th>
                </tr>
              </thead>
              <tbody className="bg-gray-900 divide-y divide-gray-800">
                {filteredLogs.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No call logs found matching your filters.
                    </td>
                  </tr>
                ) : (
                  filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-800/50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-400">
                        {log.agent?.username || log.agentId || 'Unknown'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-300">
                        {log.phoneNumber}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${log.type === 'INCOMING' ? 'bg-green-900/50 text-green-400 border border-green-800' :
                            log.type === 'OUTGOING' ? 'bg-blue-900/50 text-blue-400 border border-blue-800' :
                              'bg-red-900/50 text-red-400 border border-red-800'}`}>
                          {log.type}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <div className="flex flex-col gap-1">
                          <span className="text-purple-400">🔔 Ringing: {formatDuration(log.ringingDuration ?? 0)}</span>
                          <span className="text-green-400">📞 Call: {formatDuration(log.duration)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.disconnectedBy === 'AGENT' ? (
                          <span className="flex items-center text-amber-400 bg-amber-900/20 px-2 py-1 rounded border border-amber-800/50 w-fit">
                            <span className="mr-1.5">👤</span> Agent
                          </span>
                        ) : log.disconnectedBy === 'CLIENT' ? (
                          <span className="flex items-center text-emerald-400 bg-emerald-900/20 px-2 py-1 rounded border border-emerald-800/50 w-fit">
                            <span className="mr-1.5">📱</span> Client
                          </span>
                        ) : (
                          <span className="text-gray-500 italic text-xs">Unknown</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        {log.metadata ? (
                          <button
                            onClick={() => {
                              setSelectedLogForView(log);
                              setIsViewingLog(true);
                            }}
                            className="text-indigo-400 hover:text-indigo-300 bg-indigo-900/20 px-2 py-1 rounded border border-indigo-800/50 transition-colors"
                          >
                            📋 View Logs
                          </button>
                        ) : (
                          <span className="text-gray-600">-</span>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Call Statistics Overview - Using allFilteredLogs for accurately plotted charts */}
          <div className="mb-6">
            <CallStatistics logs={allFilteredLogs} />
          </div>

          {/* Call Activity Graph - Using allFilteredLogs */}
          <CallActivityGraph logs={allFilteredLogs} currentDateLimit={startDate || undefined} />
        </div>
      </main>

      {/* Add Agent Modal */}
      {isAddingAgent && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Add New Agent</h2>
              <button
                onClick={() => {
                  setIsAddingAgent(false);
                  setAddAgentStatus(null);
                  setNewAgentUsername('');
                  setNewAgentPassword('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleAddAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Username</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newAgentUsername}
                  onChange={(e) => setNewAgentUsername(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Password</label>
                <div className="relative">
                  <input
                    type={showNewAgentPassword ? "text" : "password"}
                    required
                    className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 pr-10"
                    value={newAgentPassword}
                    onChange={(e) => setNewAgentPassword(e.target.value)}
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewAgentPassword(!showNewAgentPassword)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-gray-400 hover:text-white"
                  >
                    {showNewAgentPassword ? (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" /></svg>
                    ) : (
                      <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    )}
                  </button>
                </div>
              </div>

              {addAgentStatus && (
                <div className={`p-3 rounded-md text-sm ${addAgentStatus.type === 'success' ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'
                  }`}>
                  {addAgentStatus.message}
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsAddingAgent(false)}
                  className="px-4 py-2 border border-gray-700 rounded-md text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addAgentLoading}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                >
                  {addAgentLoading ? 'Creating...' : 'Create Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Rename Agent Modal */}
      {isRenamingAgent && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-8 max-w-md w-full relative">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white">Rename Agent</h2>
              <button
                onClick={() => {
                  setIsRenamingAgent(false);
                  setRenameAgentStatus(null);
                  setNewAgentNameForRename('');
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleRenameAgent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">Select Agent</label>
                <select
                  required
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                  value={renamingAgentId}
                  onChange={(e) => setRenamingAgentId(e.target.value)}
                  style={{
                    backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='white' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                    backgroundRepeat: 'no-repeat',
                    backgroundPosition: 'right 0.75rem center',
                    backgroundSize: '1em'
                  }}
                >
                  {allAgents.length === 0 && <option value="" disabled>Loading agents...</option>}
                  {allAgents.map(agent => (
                    <option key={agent.id} value={agent.id}>{agent.username}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-1">New Username</label>
                <input
                  type="text"
                  required
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newAgentNameForRename}
                  onChange={(e) => setNewAgentNameForRename(e.target.value)}
                  placeholder="Enter new name"
                />
              </div>

              {renameAgentStatus && (
                <div className={`p-3 rounded-md text-sm ${renameAgentStatus.type === 'success' ? 'bg-green-900/50 text-green-400 border border-green-800' : 'bg-red-900/50 text-red-400 border border-red-800'
                  }`}>
                  {renameAgentStatus.message}
                </div>
              )}

              <div className="pt-4 flex justify-end space-x-3">
                <button
                  type="button"
                  onClick={() => setIsRenamingAgent(false)}
                  className="px-4 py-2 border border-gray-700 rounded-md text-gray-300 hover:bg-gray-800 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={renameAgentLoading || !renamingAgentId || !newAgentNameForRename}
                  className="px-4 py-2 bg-indigo-600 border border-transparent rounded-md text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors disabled:opacity-50"
                >
                  {renameAgentLoading ? 'Saving...' : 'Rename Agent'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* History Modal */}
      {isViewingHistory && historyAgent && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-8 max-w-2xl w-full relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-bold text-white flex items-center">
                <span className="mr-2">🕒</span> Agent Activity History: <span className="text-indigo-400 ml-2">{historyAgent.username}</span>
              </h2>
              <button
                onClick={() => {
                  setIsViewingHistory(false);
                  setHistoryAgent(null);
                }}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tabs */}
            <div className="flex border-b border-gray-800 mb-6">
              <button
                onClick={() => setHistoryTab('activity')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  historyTab === 'activity' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Activity (Availability)
              </button>
              <button
                onClick={() => setHistoryTab('login')}
                className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 ${
                  historyTab === 'login' 
                    ? 'border-indigo-500 text-indigo-400' 
                    : 'border-transparent text-gray-400 hover:text-gray-200'
                }`}
              >
                Login History
              </button>
            </div>

            <div className="flex-1 overflow-y-auto pr-2">
              {historyLoading ? (
                <div className="text-center py-12 text-gray-400">Loading history...</div>
              ) : historyTab === 'activity' ? (
                historySessions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No activity history found for this agent.</div>
                ) : (
                  <div className="space-y-3">
                    {historySessions.map((session) => (
                      <div key={session.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row justify-between sm:items-center">
                        <div className="flex flex-col mb-2 sm:mb-0">
                          <span className="text-sm font-medium text-gray-300">
                            {new Date(session.startTime).toLocaleDateString()}
                          </span>
                          <div className="text-sm text-gray-400 mt-1">
                            <span className="text-green-400">{new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                            <span className="mx-2">➔</span>
                            <span className="text-amber-500">{new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                          </div>
                        </div>
                        <div className="bg-gray-900 px-3 py-1.5 rounded text-indigo-300 font-mono text-sm border border-gray-800">
                          Duration: {calculateDuration(session.startTime, session.endTime)}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              ) : (
                historyLoginSessions.length === 0 ? (
                  <div className="text-center py-12 text-gray-500">No login history found for this agent.</div>
                ) : (
                  <div className="space-y-3">
                    {historyLoginSessions.map((session) => (
                      <div key={session.id} className="bg-gray-800 border border-gray-700 rounded-lg p-4 flex flex-col sm:flex-row justify-between sm:items-center">
                        <div className="flex flex-col mb-2 sm:mb-0">
                          <span className="text-sm font-medium text-gray-300">
                            {new Date(session.startTime).toLocaleDateString()}
                          </span>
                          <div className="text-sm text-gray-400 mt-1">
                            <span className="text-green-400">
                              Logged in: {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                            {session.endTime ? (
                              <span className="text-amber-500 ml-4">
                                Logged out: {new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            ) : (
                              <span className="text-blue-400 ml-4 italic">Currently logged in</span>
                            )}
                          </div>
                        </div>
                        {session.endTime && (
                          <div className="bg-gray-900 px-3 py-1.5 rounded text-indigo-300 font-mono text-sm border border-gray-800">
                            Session: {calculateDuration(session.startTime, session.endTime)}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
            
            <div className="pt-6 mt-2 border-t border-gray-800 flex justify-end">
              <button
                onClick={() => {
                  setIsViewingHistory(false);
                  setHistoryAgent(null);
                }}
                className="px-4 py-2 bg-gray-800 border border-gray-700 rounded-md text-white hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      {/* Log Detail Modal */}
      {isViewingLog && selectedLogForView && (
        <div className="fixed inset-0 bg-black/50 overflow-y-auto h-full w-full flex items-center justify-center p-4 z-50 backdrop-blur-sm">
          <div className="bg-gray-900 border border-gray-800 rounded-xl shadow-2xl p-8 max-w-2xl w-full relative max-h-[90vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-bold text-white">Call Diagnostic Logs</h2>
                <p className="text-sm text-gray-400">{selectedLogForView.phoneNumber} - {new Date(selectedLogForView.timestamp).toLocaleString()}</p>
              </div>
              <button
                onClick={() => setIsViewingLog(false)}
                className="text-gray-400 hover:text-white transition-colors p-2"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto bg-black rounded-lg p-4 border border-gray-700 font-mono text-sm text-green-400 whitespace-pre-wrap">
              {selectedLogForView.metadata || "No detailed logs available for this call."}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setIsViewingLog(false)}
                className="px-6 py-2 bg-gray-800 text-white rounded-md hover:bg-gray-700 transition-colors border border-gray-700 font-medium"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center text-white">Loading...</div>}>
      <DashboardContent />
    </Suspense>
  );
}
