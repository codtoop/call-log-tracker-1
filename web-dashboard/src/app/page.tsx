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
  const [loginError, setLoginError] = useState('');
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const [limit, setLimit] = useState<number>(() => parseInt(searchParams.get('limit') || '10', 10));
  const [page, setPage] = useState<number>(() => parseInt(searchParams.get('page') || '1', 10));
  const [totalPages, setTotalPages] = useState<number>(1);

  // Filters State
  const defaultStartDate = useMemo(() => {
    const d = new Date();
    d.setDate(d.getDate() - 1); // default to last 24h
    return d.toISOString().split('T')[0];
  }, []);
  const defaultEndDate = useMemo(() => new Date().toISOString().split('T')[0], []);

  const [selectedAgent, setSelectedAgent] = useState<string>(searchParams.get('agentId') || '');
  const [startDate, setStartDate] = useState<string>(searchParams.get('startDate') || defaultStartDate);
  const [endDate, setEndDate] = useState<string>(searchParams.get('endDate') || defaultEndDate);

  // Storage for accurate graphing & stats (unpaginated)
  const [allFilteredLogs, setAllFilteredLogs] = useState<any[]>([]);

  // Add Agent State
  const [isAddingAgent, setIsAddingAgent] = useState(false);
  const [newAgentUsername, setNewAgentUsername] = useState('');
  const [newAgentPassword, setNewAgentPassword] = useState('');
  const [addAgentStatus, setAddAgentStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [addAgentLoading, setAddAgentLoading] = useState(false);

  // Rename Agent State
  const [isRenamingAgent, setIsRenamingAgent] = useState(false);
  const [renamingAgentId, setRenamingAgentId] = useState('');
  const [newAgentNameForRename, setNewAgentNameForRename] = useState('');
  const [renameAgentStatus, setRenameAgentStatus] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [renameAgentLoading, setRenameAgentLoading] = useState(false);
  const [allAgents, setAllAgents] = useState<any[]>([]);

  // Computed Derived Data for Filters (No longer doing client-side filtering)
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
  useEffect(() => {
    if (role === 'ADMIN' && token) {
      fetch('/api/agents', { headers: { 'Authorization': `Bearer ${token}` } })
        .then(res => res.json())
        .then(data => {
          if (data.success) {
            setAllAgents(data.agents);
          }
        })
        .catch(err => console.error('Failed to load agents', err));
    }
  }, [role, token]);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    const savedRole = localStorage.getItem('role');
    if (savedToken) {
      setToken(savedToken);
      if (savedRole) setRole(savedRole);
      fetchLogs(savedToken);

      // Instantly pull new logs every 3 seconds
      const interval = setInterval(() => {
        fetchLogs(savedToken);
      }, 3000);

      return () => clearInterval(interval);
    }
  }, [limit, page, selectedAgent, startDate, endDate]); // Added filter dependencies

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
        fetchLogs(data.token);
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
              <div>
                <input
                  name="password"
                  type="password"
                  required
                  className="appearance-none rounded-none relative block w-full px-3 py-3 border border-gray-700 bg-gray-800 text-white rounded-b-md focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 focus:z-10 sm:text-sm"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
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
              onClick={() => fetchLogs(token as string)}
              className="bg-gray-800 hover:bg-gray-700 text-white px-4 py-2 rounded-md text-sm transition-colors border border-gray-700"
            >
              Refresh
            </button>
          </div>

          {/* Filters Area */}
          <div className={`grid grid-cols-1 ${role === 'ADMIN' ? 'md:grid-cols-2' : ''} gap-6 mb-6`}>
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
                <input
                  type="password"
                  required
                  className="w-full px-3 py-2 border border-gray-700 bg-gray-800 text-white rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={newAgentPassword}
                  onChange={(e) => setNewAgentPassword(e.target.value)}
                />
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
