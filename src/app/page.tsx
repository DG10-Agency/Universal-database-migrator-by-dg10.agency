'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowRight, CheckCircle2, Copy, Eye, EyeOff, Loader2, Play, Database, Server, RefreshCw, Key, Shield, ShieldCheck, Info, Filter, Globe, Code2, AlertTriangle, Lock, ExternalLink, Github, Coffee, History as HistoryIcon, Settings, Terminal, Zap } from "lucide-react";
import { Progress } from "@/components/ui/progress"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const SUPABASE_REGIONS = [
  { value: "us-east-1", label: "US East (N. Virginia) [us-east-1]" },
  { value: "us-east-2", label: "US East (Ohio) [us-east-2]" },
  { value: "us-west-1", label: "US West (N. California) [us-west-1]" },
  { value: "us-west-2", label: "US West (Oregon) [us-west-2]" },
  { value: "ap-southeast-1", label: "Asia Pacific (Singapore) [ap-southeast-1]" },
  { value: "ap-southeast-2", label: "Asia Pacific (Sydney) [ap-southeast-2]" },
  { value: "ap-northeast-1", label: "Asia Pacific (Tokyo) [ap-northeast-1]" },
  { value: "ap-northeast-2", label: "Asia Pacific (Seoul) [ap-northeast-2]" },
  { value: "ap-south-1", label: "Asia Pacific (Mumbai) [ap-south-1]" },
  { value: "eu-west-1", label: "Europe (Ireland) [eu-west-1]" },
  { value: "eu-west-2", label: "Europe (London) [eu-west-2]" },
  { value: "eu-west-3", label: "Europe (Paris) [eu-west-3]" },
  { value: "eu-central-1", label: "Europe (Frankfurt) [eu-central-1]" },
  { value: "eu-central-2", label: "Europe (Zurich) [eu-central-2]" },
  { value: "eu-north-1", label: "Europe (Stockholm) [eu-north-1]" },
  { value: "me-central-1", label: "Middle East (UAE) [me-central-1]" },
  { value: "sa-east-1", label: "South America (São Paulo) [sa-east-1]" },
  { value: "ca-central-1", label: "Canada (Central) [ca-central-1]" },
];

export default function MigrationWizard() {
  const [sourcePat, setSourcePat] = useState('');
  const [targetPat, setTargetPat] = useState('');
  const [sourceProject, setSourceProject] = useState('');
  const [sourceRegion, setSourceRegion] = useState('us-east-1');
  const [sourceDbPassword, setSourceDbPassword] = useState('');
  const [sourceServiceRole, setSourceServiceRole] = useState('');
  const [targetProject, setTargetProject] = useState('');
  const [targetRegion, setTargetRegion] = useState('us-east-1');
  const [targetDbPassword, setTargetDbPassword] = useState('');
  const [targetServiceRole, setTargetServiceRole] = useState('');
  const [isMigrating, setIsMigrating] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentStep, setCurrentStep] = useState('');
  const [activeTab, setActiveTab] = useState('setup');
  const [history, setHistory] = useState<any[]>([]);
  const [testingSource, setTestingSource] = useState(false);
  const [testingTarget, setTestingTarget] = useState(false);
  const [deps, setDeps] = useState<{ ready: boolean, dependencies: { psql: boolean, pg_dump: boolean, version?: string } } | null>(null);
  const [terminalLogs, setTerminalLogs] = useState<string[]>([]);
  const terminalEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [terminalLogs]);

  // Load saved credentials from localStorage
  useEffect(() => {
    const savedState = localStorage.getItem('supabase_migration_state');
    if (savedState) {
      try {
        const state = JSON.parse(savedState);
        if (state.sourcePat) setSourcePat(state.sourcePat);
        if (state.targetPat) setTargetPat(state.targetPat);
        if (state.sourceProject) setSourceProject(state.sourceProject);
        if (state.sourceRegion) setSourceRegion(state.sourceRegion);
        if (state.sourceDbPassword) setSourceDbPassword(state.sourceDbPassword);
        if (state.sourceServiceRole) setSourceServiceRole(state.sourceServiceRole);
        if (state.targetProject) setTargetProject(state.targetProject);
        if (state.targetRegion) setTargetRegion(state.targetRegion);
        if (state.targetDbPassword) setTargetDbPassword(state.targetDbPassword);
        if (state.targetServiceRole) setTargetServiceRole(state.targetServiceRole);
      } catch (e) {
        console.error("Failed to parse saved state", e);
      }
    }
  }, []);

  // Save credentials to localStorage
  useEffect(() => {
    const state = {
      sourcePat, targetPat, sourceProject, sourceRegion, sourceDbPassword, sourceServiceRole,
      targetProject, targetRegion, targetDbPassword, targetServiceRole
    };
    localStorage.setItem('supabase_migration_state', JSON.stringify(state));
  }, [sourcePat, targetPat, sourceProject, sourceRegion, sourceDbPassword, sourceServiceRole, targetProject, targetRegion, targetDbPassword, targetServiceRole]);

  // Check system dependencies
  useEffect(() => {
    const checkDeps = async () => {
      try {
        const res = await fetch('/api/check-dependencies');
        const data = await res.json();
        setDeps(data);
      } catch (e) {
        console.error("Failed to check dependencies", e);
      }
    };
    checkDeps();
  }, []);

  // Load history from localStorage on mount
  useEffect(() => {
    const savedHistory = localStorage.getItem('supabase_migration_history');
    if (savedHistory) {
      try {
        setHistory(JSON.parse(savedHistory));
      } catch (e) {
        console.error("Failed to parse history", e);
      }
    }
  }, []);

  // Save history helper
  const saveToHistory = (status: 'success' | 'failed', message: string) => {
    const newItem = {
      id: Date.now(),
      timestamp: new Date().toISOString(),
      source: sourceProject,
      target: targetProject,
      status,
      message
    };
    const updatedHistory = [newItem, ...history].slice(0, 20); // Keep last 20
    setHistory(updatedHistory);
    localStorage.setItem('supabase_migration_history', JSON.stringify(updatedHistory));
  };
  const [showSourcePat, setShowSourcePat] = useState(false);
  const [showTargetPat, setShowTargetPat] = useState(false);
  const [showSourceDbPass, setShowSourceDbPass] = useState(false);
  const [showSourceKey, setShowSourceKey] = useState(false);
  const [showTargetDbPass, setShowTargetDbPass] = useState(false);
  const [showTargetKey, setShowTargetKey] = useState(false);
  const [resumeMigration, setResumeMigration] = useState(true);

  const handleMigration = async () => {
    // Step 10: Validation
    const refRegex = /^[a-z0-9]{20}$/i;
    if (!refRegex.test(sourceProject) || !refRegex.test(targetProject)) {
      toast.error("Invalid Project Reference ID. It should be a 20-character alphanumeric string.");
      return;
    }

    if (sourceProject === targetProject) {
      toast.error("Source and Target projects cannot be the same.");
      return;
    }

    if (!sourcePat || !targetPat || !sourceDbPassword || !sourceServiceRole || !targetDbPassword || !targetServiceRole) {
      toast.error('Please fill in all required fields.');
      return;
    }

    setIsMigrating(true);
    setProgress(0);
    setTerminalLogs([]);
    setCurrentStep('Verifying credentials...');
    setActiveTab('progress');

    // Pre-migration Connection Testing
    try {
      // Test Source
      const sourceTestResp = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRef: sourceProject, region: sourceRegion, password: sourceDbPassword, pat: sourcePat }),
      });
      if (!sourceTestResp.ok) {
        const data = await sourceTestResp.json();
        throw new Error(`Source connection failed: ${data.error}`);
      }

      // Test Target
      const targetTestResp = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRef: targetProject, region: targetRegion, password: targetDbPassword, pat: targetPat }),
      });
      if (!targetTestResp.ok) {
        const data = await targetTestResp.json();
        throw new Error(`Target connection failed: ${data.error}`);
      }

      setCurrentStep('Credentials verified. Initializing migration...');
    } catch (error: any) {
      toast.error(error.message);
      setIsMigrating(false);
      setCurrentStep('Verification Failed');
      setActiveTab('setup');
      return;
    }

    try {
      const response = await fetch('/api/migrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sourcePat,
          targetPat,
          sourceProject,
          sourceRegion,
          sourceDbPassword,
          sourceServiceRole,
          targetProject,
          targetRegion,
          targetDbPassword,
          targetServiceRole,
          resume: resumeMigration
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to start migration');
      }

      const reader = response.body?.getReader();
      if (!reader) throw new Error('ReadableStream not supported');

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          // If stream ends without 100% progress, it might still be a success if all data was sent.
          // Or, if the server explicitly sends a final success message.
          // For now, we'll assume success if the stream completes without error and progress reached 100.
          // If progress didn't reach 100, it means the stream ended prematurely or there was an issue.
          if (progress < 100) { // Check if progress was updated to 100%
            saveToHistory('failed', 'Migration stream ended prematurely or did not reach 100% progress.');
            toast.error('Migration stream ended prematurely.');
          }
          setIsMigrating(false);
          break;
        }

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.substring(5));
              if (data.progress !== undefined) {
                setProgress(data.progress);
              }
              if (data.message) {
                setCurrentStep(data.message);
              }
              if (data.log) {
                setTerminalLogs(prev => {
                  const newLogs = [...prev, data.log];
                  return newLogs.length > 500 ? newLogs.slice(newLogs.length - 500) : newLogs;
                });
              }
              if (data.progress === 100 || data.message === "Migration Completed Successfully") {
                saveToHistory('success', 'Migration completed successfully');
                toast.success('Migration Finished!');
                setIsMigrating(false);
              }
              if (data.error) {
                throw new Error(data.error);
              }
            } catch (parseError: any) {
              if (line.includes('"error"')) {
                throw new Error(parseError.message);
              }
              console.error("Failed to parse SSE data:", parseError, "Line:", line);
            }
          }
        }
      }
    } catch (error: any) {
      saveToHistory('failed', error.message);
      toast.error(`Migration Failed: ${error.message}`);
      setIsMigrating(false);
      setCurrentStep('Migration Failed');
    }
  };

  const testConnection = async (type: 'source' | 'target') => {
    const isSource = type === 'source';
    const setTesting = isSource ? setTestingSource : setTestingTarget;
    const projectRef = isSource ? sourceProject : targetProject;
    const region = isSource ? sourceRegion : targetRegion;
    const password = isSource ? sourceDbPassword : targetDbPassword;
    const pat = isSource ? sourcePat : targetPat;

    if (!projectRef || !region || !password || !pat) {
      toast.error(`Please fill in PAT, Project Ref, Region, and DB Password for the ${type} first.`);
      return;
    }

    setTesting(true);
    try {
      const response = await fetch('/api/test-connection', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectRef, region, password, pat }),
      });

      const data = await response.json();
      if (response.ok) {
        toast.success(`${isSource ? 'Source' : 'Target'} connection verified!`);
      } else {
        const errorMessage = data.error || 'Connection failed';
        const suggestion = data.suggestion ? `\n\nSuggestion: ${data.suggestion}` : '';

        toast.error(`${isSource ? 'Source' : 'Target'} failed: ${errorMessage}${suggestion}`, {
          duration: 6000,
        });

        if (data.debug || data.attempts) {
          console.group(`🔍 Connection Debug [${isSource ? 'Source' : 'Target'}]`);
          console.error("Error Detail:", data.debug || data.error);
          console.info("Attempted Hosts:", data.attempts);
          console.groupEnd();
          toast.info("Detailed debug logs have been printed to the browser console (F12).", {
            icon: "🛠️"
          });
        }
      }
    } catch (error: any) {
      toast.error('Failed to test connection.');
    } finally {
      setTesting(false);
    }
  };

  return (
    <TooltipProvider>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="h-screen w-screen bg-zinc-950 text-zinc-100 flex flex-col overflow-hidden font-sans">
        {/* Header */}
        <header className="h-16 border-b border-white/5 flex items-center px-8 justify-between shrink-0 bg-zinc-950/50 backdrop-blur-xl z-50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center overflow-hidden border border-white/10 shadow-lg bg-zinc-900">
              <img src="/logo.png" alt="Supabase Migrator Logo" className="w-full h-full object-cover scale-110" />
            </div>
            <h1 className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 to-cyan-400">
              Supabase Migrator By DG10.Agency
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <a href="https://github.com/DG10-Agency/Complete-Supabase-One-Click-Migration-by-DG10.Agency" target="_blank" rel="noreferrer" className="text-zinc-400 hover:text-white transition-colors">
              <Github className="w-5 h-5" />
            </a>

            <div className="h-6 w-px bg-white/10 mx-2" />

            <TabsList className="flex bg-zinc-900/50 border border-white/5 p-1 h-9 rounded-lg">
              <TabsTrigger value="setup" className="px-3 text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-emerald-400 transition-all h-full rounded-md font-medium">
                Configuration
              </TabsTrigger>
              <TabsTrigger value="progress" disabled={!isMigrating && progress === 0} className="px-3 text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-cyan-400 transition-all h-full rounded-md font-medium">
                Status
              </TabsTrigger>
              <TabsTrigger value="insights" className="px-3 text-xs data-[state=active]:bg-zinc-800 data-[state=active]:text-amber-400 transition-all h-full rounded-md font-medium">
                Insights
              </TabsTrigger>
            </TabsList>

            <div className="h-6 w-px bg-white/10 mx-2" />

            <Link href="/guide">
              <Button variant="outline" size="sm" className="bg-blue-500/10 border-blue-500/20 text-blue-400 hover:bg-blue-500/20 h-8">
                <Info className="w-4 h-4 mr-2" />
                Help & Guide
              </Button>
            </Link>
            <Button variant="outline" size="sm" className="bg-emerald-500/10 border-emerald-500/20 text-emerald-400 hover:bg-emerald-500/20 h-8">
              <Coffee className="w-4 h-4 mr-2" />
              Support
            </Button>
          </div>
        </header>

        {/* Main Dashboard Layout */}
        <main className="flex-1 flex overflow-hidden">
          {/* Sidebar / Info Panel */}
          <aside className="w-72 border-r border-white/5 bg-zinc-900/20 p-6 flex flex-col justify-between shrink-0">
            <div className="space-y-6">
              <div>
                <h2 className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3">Capabilities</h2>
                <ul className="space-y-3">
                  <li className="flex items-center gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Database Schema & Data
                  </li>
                  <li className="flex items-center gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Storage Buckets & Files
                  </li>
                  <li className="flex items-center gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Auth Users & Settings
                  </li>
                  <li className="flex items-center gap-2 text-sm text-zinc-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-500" /> Edge Functions
                  </li>
                </ul>
              </div>

              <div className="p-4 rounded-xl bg-cyan-500/5 border border-cyan-500/10">
                <h3 className="text-xs font-bold text-cyan-400 mb-2 flex items-center gap-1">
                  <Info className="w-3 h-3" /> Tip
                </h3>
                <p className="text-[11px] leading-relaxed text-zinc-400">
                  Ensure the target project is a fresh instance for the cleanest migration results.
                </p>
              </div>

              {/* History Section */}
              {history.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-xs font-bold text-zinc-500 uppercase tracking-widest flex items-center gap-2">
                      <HistoryIcon className="w-3 h-3" /> Recent Activity
                    </h3>
                    <button
                      onClick={() => { setHistory([]); localStorage.removeItem('supabase_migration_history'); }}
                      className="text-[10px] text-zinc-500 hover:text-rose-400 transition-colors"
                      title="Clear History"
                    >
                      CLEAR
                    </button>
                  </div>
                  <div className="space-y-2 max-h-[300px] overflow-y-auto custom-scrollbar pr-2">
                    {history.map((item, index) => (
                      <div key={item.id} className="p-2.5 rounded-lg bg-white/5 border border-white/5 space-y-1 relative">
                        <div className="absolute -top-1 -right-1 bg-zinc-800 border border-white/10 text-[9px] font-mono text-zinc-400 px-1.5 rounded-full z-10">
                          #{index + 1}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${item.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-rose-500/10 text-rose-400'
                            }`}>
                            {item.status.toUpperCase()}
                          </span>
                          <span className="text-[9px] text-zinc-500">
                            {new Date(item.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p className="text-[10px] text-zinc-400 truncate flex items-center gap-1">
                          <span className="text-zinc-500">{item.source}</span>
                          <span className="text-zinc-700">→</span>
                          <span className="text-zinc-500">{item.target}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-white/5">
              <p className="text-xs text-zinc-500 mb-2 font-medium">Powering Digital Excellence</p>
              <a href="https://dg10.agency" target="_blank" rel="noreferrer" className="group flex items-center justify-between p-3 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/5">
                <span className="text-sm font-semibold text-white">DG10.Agency</span>
                <ExternalLink className="w-3 h-3 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
              </a>
            </div>
          </aside >

          {/* Content Area */}
          < div className="flex-1 flex flex-col p-8 overflow-y-auto custom-scrollbar" >
            <div className="max-w-6xl w-full mx-auto space-y-8">
              <div className="flex flex-col gap-2">
                <h2 className="text-3xl font-bold tracking-tight">Migration Workspace</h2>
                <p className="text-zinc-400">Complete project synchronization across Supabase instances.</p>
              </div>


              <TabsContent value="setup" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300 focus-visible:outline-none">
                <Card className="border-white/5 bg-zinc-900/40 backdrop-blur-sm shadow-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-xl">
                      <Settings className="w-5 h-5 text-emerald-400" />
                      Credentials & Projects
                    </CardTitle>
                    <CardDescription className="text-zinc-500">
                      Map your source and target environments.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-8">
                    {/* Dependency Warning */}
                    {deps && !deps.ready && (
                      <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-start gap-4 animate-in fade-in slide-in-from-top-4 duration-500">
                        <div className="w-10 h-10 rounded-xl bg-red-500 flex items-center justify-center shrink-0">
                          <AlertTriangle className="text-white w-6 h-6" />
                        </div>
                        <div className="space-y-1 flex-1">
                          <h3 className="font-bold text-red-400">Missing System Dependencies</h3>
                          <p className="text-sm text-slate-400 leading-relaxed">
                            The migration engine requires <strong>PostgreSQL Client Tools</strong> (psql and pg_dump) to be installed on this server to perform a complete migration.
                          </p>
                          <div className="pt-2 flex gap-3">
                            <Button asChild variant="outline" size="sm" className="h-8 bg-red-500/10 border-red-500/20 text-red-400 hover:bg-red-500/20">
                              <Link href="/guide#dependencies">
                                <Settings className="w-3 h-3 mr-2" />
                                View Setup Guide
                              </Link>
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Source Project */}
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2 text-sm text-rose-400/90 bg-rose-400/5 px-3 py-1.5 rounded-lg border border-rose-400/10 w-fit">
                          <Database className="w-4 h-4" />
                          Source Environment
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="sourcePat" className="text-xs font-semibold text-zinc-400">Personal Access Token</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-zinc-700 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>Requires access to Source Project</TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="relative">
                              <Input
                                id="sourcePat"
                                type={showSourcePat ? "text" : "password"}
                                placeholder="sbp_..."
                                value={sourcePat}
                                onChange={(e) => setSourcePat(e.target.value)}
                                className="bg-zinc-950/30 border-white/10 pr-10 h-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSourcePat(!showSourcePat)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                              >
                                {showSourcePat ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="sourceProject" className="text-xs font-semibold text-zinc-400">Project Reference ID</Label>
                            <Input
                              id="sourceProject"
                              placeholder="abcdefghijklmnopqrst"
                              value={sourceProject}
                              onChange={(e) => setSourceProject(e.target.value)}
                              className="bg-zinc-950/30 border-white/10 h-10"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="sourceRegionInput" className="text-xs font-semibold text-zinc-400">Project Region</Label>
                            <Input
                              id="sourceRegionInput"
                              list="region-options"
                              placeholder="e.g. ap-northeast-2"
                              value={sourceRegion}
                              onChange={(e) => setSourceRegion(e.target.value)}
                              className="bg-zinc-950/30 border-white/10 h-10"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="sourceDbPassword" className="text-xs font-semibold text-zinc-400">Database Password</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-zinc-700 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>Needed for pg_dump connection</TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="relative">
                              <Input
                                id="sourceDbPassword"
                                type={showSourceDbPass ? "text" : "password"}
                                value={sourceDbPassword}
                                onChange={(e) => setSourceDbPassword(e.target.value)}
                                className="bg-zinc-950/30 border-white/10 pr-10 h-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSourceDbPass(!showSourceDbPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                              >
                                {showSourceDbPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={testingSource}
                              onClick={() => testConnection('source')}
                              className="w-full h-8 text-xs bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5"
                            >
                              {testingSource ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-2 text-emerald-500" />}
                              Test Source Connection
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="sourceServiceRole" className="text-xs font-semibold text-zinc-400">Service Role Key</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-zinc-700 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>Found in Settings {"->"} API</TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="relative">
                              <Input
                                id="sourceServiceRole"
                                type={showSourceKey ? "text" : "password"}
                                value={sourceServiceRole}
                                onChange={(e) => setSourceServiceRole(e.target.value)}
                                className="bg-zinc-950/30 border-white/10 pr-10 h-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowSourceKey(!showSourceKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                              >
                                {showSourceKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Target Project */}
                      <div className="space-y-4">
                        <h3 className="font-semibold flex items-center gap-2 text-sm text-cyan-400 bg-cyan-400/5 px-3 py-1.5 rounded-lg border border-cyan-400/10 w-fit">
                          <Database className="w-4 h-4" />
                          Target Environment
                        </h3>
                        <div className="space-y-4">
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="targetPat" className="text-xs font-semibold text-zinc-400">Personal Access Token</Label>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Info className="w-3.5 h-3.5 text-zinc-700 cursor-help" />
                                </TooltipTrigger>
                                <TooltipContent>Requires access to Target Project</TooltipContent>
                              </Tooltip>
                            </div>
                            <div className="relative">
                              <Input
                                id="targetPat"
                                type={showTargetPat ? "text" : "password"}
                                placeholder="sbp_..."
                                value={targetPat}
                                onChange={(e) => setTargetPat(e.target.value)}
                                className="bg-zinc-950/30 border-white/10 pr-10 h-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowTargetPat(!showTargetPat)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                              >
                                {showTargetPat ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="targetProject" className="text-xs font-semibold text-zinc-400">Project Reference ID</Label>
                            <Input
                              id="targetProject"
                              placeholder="zyxwvutsrqponmlkjihg"
                              value={targetProject}
                              onChange={(e) => setTargetProject(e.target.value)}
                              className="bg-zinc-950/30 border-white/10 h-10"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="targetRegionInput" className="text-xs font-semibold text-zinc-400">Project Region</Label>
                            <Input
                              id="targetRegionInput"
                              list="region-options"
                              placeholder="e.g. us-east-1"
                              value={targetRegion}
                              onChange={(e) => setTargetRegion(e.target.value)}
                              className="bg-zinc-950/30 border-white/10 h-10"
                            />
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="targetDbPassword" className="text-xs font-semibold text-zinc-400">Database Password</Label>
                            <div className="relative">
                              <Input
                                id="targetDbPassword"
                                type={showTargetDbPass ? "text" : "password"}
                                value={targetDbPassword}
                                onChange={(e) => setTargetDbPassword(e.target.value)}
                                className="bg-zinc-950/30 border-white/10 pr-10 h-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowTargetDbPass(!showTargetDbPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                              >
                                {showTargetDbPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={testingTarget}
                              onClick={() => testConnection('target')}
                              className="w-full h-8 text-xs bg-white/5 hover:bg-white/10 text-zinc-400 hover:text-white border border-white/5"
                            >
                              {testingTarget ? <Loader2 className="w-3 h-3 mr-2 animate-spin" /> : <ShieldCheck className="w-3 h-3 mr-2 text-emerald-500" />}
                              Test Target Connection
                            </Button>
                          </div>
                          <div className="space-y-1.5">
                            <Label htmlFor="targetServiceRole" className="text-xs font-semibold text-zinc-400">Service Role Key</Label>
                            <div className="relative">
                              <Input
                                id="targetServiceRole"
                                type={showTargetKey ? "text" : "password"}
                                value={targetServiceRole}
                                onChange={(e) => setTargetServiceRole(e.target.value)}
                                className="bg-zinc-950/30 border-white/10 pr-10 h-10"
                              />
                              <button
                                type="button"
                                onClick={() => setShowTargetKey(!showTargetKey)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-600 hover:text-white transition-colors"
                              >
                                {showTargetKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                  <CardFooter className="bg-white/[0.02] border-t border-white/5 py-6 flex-col items-start px-6 gap-4">
                    <div className="flex items-center space-x-2 w-full bg-zinc-950/40 p-3 rounded-lg border border-white/5">
                      <input
                        type="checkbox"
                        id="resumeCheck"
                        className="accent-emerald-500 w-4 h-4 rounded cursor-pointer mt-0.5"
                        checked={resumeMigration}
                        onChange={(e) => setResumeMigration(e.target.checked)}
                      />
                      <div className="flex flex-col">
                        <label htmlFor="resumeCheck" className="text-sm font-medium text-zinc-200 cursor-pointer">
                          Smart Resume (Recommended)
                        </label>
                        <p className="text-xs text-zinc-500">Skips parts of the migration that already succeeded recently.</p>
                      </div>
                    </div>
                    <Button
                      className="w-full h-12 text-md font-bold bg-gradient-to-r from-emerald-500 to-cyan-500 hover:from-emerald-400 hover:to-cyan-400 shadow-xl shadow-emerald-500/20 transition-all text-white border-none rounded-xl"
                      onClick={handleMigration}
                      disabled={isMigrating}
                    >
                      {isMigrating ? (
                        <>
                          <Loader2 className="w-5 h-5 mr-3 animate-spin" />
                          Initializing Synchronization...
                        </>
                      ) : (
                        <>
                          <Play className="w-5 h-5 mr-3 fill-current" />
                          Execute Automation
                        </>
                      )}
                    </Button>
                  </CardFooter>
                </Card>
              </TabsContent>

              <TabsContent value="insights" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300 focus-visible:outline-none">
                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="border-emerald-500/20 bg-zinc-900/40 backdrop-blur-sm shadow-2xl h-full">
                    <CardHeader className="pb-4 border-b border-white/5">
                      <CardTitle className="flex items-center gap-2 text-lg text-emerald-400">
                        <CheckCircle2 className="w-5 h-5" />
                        Auto-Migrated Data
                      </CardTitle>
                      <CardDescription className="text-zinc-500">
                        These elements are fully synchronized by the tool.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-emerald-500/10 p-1 rounded">
                            <Database className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Database Schema & Data</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Tables, rows, and views across `public`, `auth`, and `storage` schemas.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-emerald-500/10 p-1 rounded">
                            <Key className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Auth Users & Identities</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Full migration of your user base (logins, emails, and linked identities).</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-emerald-500/10 p-1 rounded">
                            <Filter className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Roles & RLS Policies</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Row Level Security policies, custom roles, and database privileges.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-emerald-500/10 p-1 rounded">
                            <Globe className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Storage Buckets & Content</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Full synchronization of all files and bucket configurations.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-emerald-500/10 p-1 rounded">
                            <Code2 className="w-3.5 h-3.5 text-emerald-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Edge Functions</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Automated deployment of all functions via CLI orchestration.</p>
                          </div>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>

                  <Card className="border-amber-500/20 bg-zinc-900/40 backdrop-blur-sm shadow-2xl h-full">
                    <CardHeader className="pb-4 border-b border-white/5">
                      <CardTitle className="flex items-center gap-2 text-lg text-amber-400">
                        <AlertTriangle className="w-5 h-5" />
                        Configuration Sync Required
                      </CardTitle>
                      <CardDescription className="text-zinc-500">
                        Dashboard settings not accessible via standard APIs.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-amber-500/10 p-1 rounded">
                            <Lock className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Vault Secrets & ENV Vars</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Production secrets (like Stripe API keys) must be manually re-entered.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-amber-500/10 p-1 rounded">
                            <Globe className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Custom Domains</p>
                            <p className="text-xs text-zinc-500 mt-0.5">SSL certificates and domain routing are specific to the unique project URL.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-amber-500/10 p-1 rounded">
                            <ExternalLink className="w-3.5 h-3.5 text-amber-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Platform Integrations</p>
                            <p className="text-xs text-zinc-500 mt-0.5">OAuth providers (Google/Apple) and external Webhooks must be repointed.</p>
                          </div>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                  <Card className="border-cyan-500/20 bg-zinc-900/40 backdrop-blur-sm shadow-2xl h-full">
                    <CardHeader className="pb-4 border-b border-white/5">
                      <CardTitle className="flex items-center gap-2 text-lg text-cyan-400">
                        <ShieldCheck className="w-5 h-5" />
                        Smart Connectivity & Intelligence
                      </CardTitle>
                      <CardDescription className="text-zinc-500">
                        Our "Triple-Shield" engine ensures 100% database reachability.
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="pt-6 space-y-4">
                      <div className="bg-cyan-500/5 border border-cyan-500/10 p-3 rounded-xl mb-4 text-[11px] leading-relaxed text-cyan-300">
                        <p><strong>Note:</strong> Your migration might succeed even with an incorrect region. This tool automatically queries the Supabase Management API to find the absolute most reliable connection path.</p>
                      </div>
                      <ul className="space-y-3">
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-cyan-500/10 p-1 rounded">
                            <Zap className="w-3.5 h-3.5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Smart Discovery (Preferred)</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Direct API queries to resolve the official database pooler host.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-cyan-500/10 p-1 rounded">
                            <Globe className="w-3.5 h-3.5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Universal Cluster Routing</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Region-agnostic architecture using the global Supabase pooler network.</p>
                          </div>
                        </li>
                        <li className="flex items-start gap-3 text-sm">
                          <div className="mt-0.5 bg-cyan-500/10 p-1 rounded">
                            <Terminal className="w-3.5 h-3.5 text-cyan-400" />
                          </div>
                          <div>
                            <p className="font-semibold text-zinc-200">Direct Socket Fallback</p>
                            <p className="text-xs text-zinc-500 mt-0.5">Port 5432 direct-to-host bypass for restricted network environments.</p>
                          </div>
                        </li>
                      </ul>
                    </CardContent>
                  </Card>
                </div>
              </TabsContent>

              <TabsContent value="progress" className="mt-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
                <Card className="border-white/5 bg-zinc-900/40 backdrop-blur-sm shadow-2xl overflow-hidden relative min-h-[400px]">
                  <CardHeader>
                    <CardTitle className="text-xl flex items-center gap-2">
                      <Loader2 className={`w-5 h-5 text-cyan-400 ${isMigrating ? 'animate-spin' : ''}`} />
                      Active Stream
                    </CardTitle>
                    <CardDescription className="text-zinc-500">Real-time status updates from the migration engine.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-10 py-10 relative z-10">
                    <div className="relative">
                      <div className="space-y-10">
                        <div className="space-y-3">
                          <div className="flex justify-between text-xs font-bold uppercase tracking-tighter">
                            <span className="text-zinc-500">{currentStep || "Standby"}</span>
                            <span className="text-cyan-400">{progress}%</span>
                          </div>
                          <div className="h-3 bg-zinc-950 rounded-full border border-white/5 overflow-hidden">
                            <div
                              className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 transition-all duration-500 shadow-[0_0_15px_rgba(34,211,238,0.4)]"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-5 gap-2">
                          {[
                            { step: 10, label: "Auth" },
                            { step: 30, label: "Schema" },
                            { step: 60, label: "Data" },
                            { step: 85, label: "Storage" },
                            { step: 100, label: "Functions" }
                          ].map((m, index) => (
                            <div key={m.step} className={`p-3 rounded-xl border transition-all flex flex-col items-center text-center gap-2 ${progress >= m.step ? 'bg-emerald-500/10 border-emerald-500/20' : 'bg-white/5 border-white/5'}`}>
                              <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${progress >= m.step ? 'bg-emerald-500 text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                                {progress >= m.step ? <CheckCircle2 className="w-4 h-4" /> : <span className="text-[10px] font-bold">{index + 1}</span>}
                              </div>
                              <span className={`text-[10px] font-bold uppercase tracking-tight ${progress >= m.step ? 'text-zinc-100' : 'text-zinc-500'}`}>{m.label}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {progress === 100 && (
                        <div className="absolute -inset-6 bg-zinc-950/40 backdrop-blur-xl flex flex-col items-center justify-center text-center p-12 animate-in zoom-in-95 fade-in duration-500 z-50 rounded-[2rem] border border-emerald-500/20 shadow-[0_0_50px_rgba(16,185,129,0.1)]">
                          <div className="relative mb-6">
                            <div className="absolute inset-0 bg-emerald-500 blur-2xl opacity-20 animate-pulse" />
                            <div className="relative w-20 h-20 rounded-2xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-2xl shadow-emerald-500/40 rotate-12">
                              <CheckCircle2 className="w-10 h-10 text-white -rotate-12" />
                            </div>
                          </div>

                          <h3 className="text-4xl font-extrabold mb-3 bg-clip-text text-transparent bg-gradient-to-r from-emerald-400 via-white to-cyan-400 tracking-tight">
                            Sync Completed!
                          </h3>

                          <p className="text-zinc-400 text-sm max-w-md mb-10 leading-relaxed">
                            Your infrastructure has been successfully moved to the target project. Everything is verified and ready for production.
                          </p>

                          <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm">
                            <Button
                              onClick={() => {
                                setProgress(0);
                                setCurrentStep('');
                                setActiveTab('setup');
                              }}
                              className="flex-1 bg-white text-black hover:bg-zinc-100 h-12 rounded-xl font-bold transition-all hover:scale-[1.02] active:scale-95 shadow-xl shadow-white/5"
                            >
                              New Migration
                            </Button>
                            <Button
                              asChild
                              variant="outline"
                              className="flex-1 bg-zinc-900/50 border-white/5 text-white hover:bg-zinc-800 h-12 rounded-xl font-bold transition-all"
                            >
                              <Link href="/guide">
                                System Guide
                              </Link>
                            </Button>
                          </div>

                          <div className="mt-8 pt-8 border-t border-white/5 w-full flex items-center justify-center gap-6">
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Schema</span>
                              <span className="text-emerald-400 text-xs font-mono">OK</span>
                            </div>
                            <div className="w-px h-6 bg-white/5" />
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Storage</span>
                              <span className="text-emerald-400 text-xs font-mono">OK</span>
                            </div>
                            <div className="w-px h-6 bg-white/5" />
                            <div className="flex flex-col items-center gap-1">
                              <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Functions</span>
                              <span className="text-emerald-400 text-xs font-mono">OK</span>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="mt-8 border-t border-white/5 pt-8">
                      <div className="flex items-center gap-2 mb-3">
                        <Terminal className="w-4 h-4 text-emerald-500" />
                        <h3 className="text-sm font-bold text-zinc-300">Live Terminal Output</h3>
                      </div>
                      <div className="bg-zinc-950 border border-white/5 rounded-lg p-4 font-mono text-[10px] text-zinc-400 overflow-y-auto h-[250px] custom-scrollbar shadow-inner">
                        {terminalLogs.length === 0 ? (
                          <div className="text-zinc-600 italic">Waiting for database process output...</div>
                        ) : (
                          terminalLogs.map((log, i) => (
                            <div key={i} className="whitespace-pre-wrap">{log}</div>
                          ))
                        )}
                        <div ref={terminalEndRef} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </div >
        </main >
      </Tabs >
      <datalist id="region-options">
        {SUPABASE_REGIONS.map((region) => (
          <option key={region.value} value={region.value}>
            {region.label}
          </option>
        ))}
      </datalist>
    </TooltipProvider >
  );
}
