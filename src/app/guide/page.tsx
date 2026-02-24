'use client';

import React from 'react';
import Link from 'next/link';
import {
    ArrowLeft,
    Key,
    Database,
    ShieldCheck,
    Globe,
    CreditCard,
    ExternalLink,
    ChevronRight,
    Info,
    Terminal,
    Settings
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function GuidePage() {
    return (
        <div className="min-h-screen bg-zinc-950 text-zinc-50 font-sans selection:bg-emerald-500/30">
            <div className="max-w-4xl mx-auto py-12 px-6">

                {/* Header */}
                <div className="flex flex-col gap-4 mb-12">
                    <Link href="/">
                        <Button variant="ghost" className="w-fit text-zinc-400 hover:text-white hover:bg-white/5 -ml-4">
                            <ArrowLeft className="w-4 h-4 mr-2" />
                            Back to Migrator
                        </Button>
                    </Link>
                    <div>
                        <h1 className="text-4xl font-bold tracking-tight bg-gradient-to-br from-white to-zinc-500 bg-clip-text text-transparent">
                            Credentials Guide
                        </h1>
                        <p className="text-zinc-400 mt-2 text-lg">
                            Everything you need to successfully link your Supabase projects.
                        </p>
                    </div>
                </div>

                {/* Introduction */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-2">
                                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                            </div>
                            <CardTitle className="text-sm font-medium">Security First</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-zinc-400">
                                Your keys are used locally and never stored on any server.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                            <div className="w-8 h-8 rounded-lg bg-orange-500/20 flex items-center justify-center mb-2">
                                <Database className="w-4 h-4 text-orange-400" />
                            </div>
                            <CardTitle className="text-sm font-medium">Cross-Account</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-zinc-400">
                                You can now use separate PATs for source and target accounts.
                            </p>
                        </CardContent>
                    </Card>
                    <Card className="bg-white/5 border-white/10">
                        <CardHeader className="pb-2">
                            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mb-2">
                                <Globe className="w-4 h-4 text-emerald-400" />
                            </div>
                            <CardTitle className="text-sm font-medium">Region Aware</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-xs text-zinc-400">
                                Native support for Supabase's global pooler infrastructure.
                            </p>
                        </CardContent>
                    </Card>
                </div>

                {/* Tabs Guide */}
                <Tabs defaultValue="pat" className="w-full">
                    <TabsList className="bg-white/5 border border-white/10 p-1 rounded-xl w-full flex overflow-x-auto custom-scrollbar no-scrollbar">
                        <TabsTrigger value="pat" className="flex-1 data-[state=active]:bg-white/10 rounded-lg py-2.5">
                            <Key className="w-4 h-4 mr-2" />
                            Access Token
                        </TabsTrigger>
                        <TabsTrigger value="project" className="flex-1 data-[state=active]:bg-white/10 rounded-lg py-2.5">
                            <CreditCard className="w-4 h-4 mr-2" />
                            Project ID
                        </TabsTrigger>
                        <TabsTrigger value="database" className="flex-1 data-[state=active]:bg-white/10 rounded-lg py-2.5">
                            <Database className="w-4 h-4 mr-2" />
                            DB Password
                        </TabsTrigger>
                        <TabsTrigger value="region" className="flex-1 data-[state=active]:bg-white/10 rounded-lg py-2.5">
                            <Globe className="w-4 h-4 mr-2" />
                            Region
                        </TabsTrigger>
                        <TabsTrigger id="dependencies" value="psql" className="flex-1 data-[state=active]:bg-white/10 rounded-lg py-2.5">
                            <Terminal className="w-4 h-4 mr-2" />
                            Postgres Tools
                        </TabsTrigger>
                    </TabsList>

                    {/* PAT Content */}
                    <TabsContent value="pat" className="mt-8 space-y-6">
                        <Card className="bg-white/5 border-white/10 overflow-hidden outline-none ring-0">
                            <CardHeader>
                                <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-xl bg-blue-500 flex items-center justify-center shadow-lg shadow-blue-500/20">
                                            <Key className="text-white w-5 h-5" />
                                        </div>
                                        <div>
                                            <CardTitle>Personal Access Token (PAT)</CardTitle>
                                            <CardDescription>Required for managing Edge Functions and Settings</CardDescription>
                                        </div>
                                    </div>
                                    <Link href="https://supabase.com/dashboard/account/tokens" target="_blank">
                                        <Button size="sm" variant="outline" className="border-white/10 hover:bg-white/10">
                                            Open Dashboard <ExternalLink className="w-3 h-3 ml-2" />
                                        </Button>
                                    </Link>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-emerald-500/10 border border-emerald-500/20 p-4 rounded-xl flex gap-3 italic text-emerald-300">
                                    <Info className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm">
                                        <strong>New Feature:</strong> If your projects are on different Supabase accounts (e.g. separate Free Tier accounts),
                                        create a PAT on <strong>each</strong> account and enter them in the respective fields.
                                    </p>
                                </div>

                                <div className="space-y-4 text-zinc-300">
                                    <h3 className="text-lg font-semibold text-white">How to get your PAT:</h3>
                                    <ol className="space-y-4 list-decimal list-inside marker:text-emerald-500 marker:font-bold">
                                        <li>Go to your <Link href="https://supabase.com/dashboard/account/tokens" className="text-emerald-400 hover:underline">Supabase Account Settings</Link>.</li>
                                        <li>Click on **Access Tokens** in the left sidebar.</li>
                                        <li>Click the **Generate new token** button.</li>
                                        <li>Give it a name (e.g., "Migrator") and click **Generate**.</li>
                                        <li><strong className="text-white underline decoration-emerald-500/50 underline-offset-4">Copy the token immediately!</strong> You won't be able to see it again.</li>
                                    </ol>
                                </div>

                                <div className="p-4 bg-white/5 rounded-xl border border-dashed border-white/10">
                                    <h4 className="text-sm font-medium text-white mb-2">Wait, which PAT do I use?</h4>
                                    <ul className="text-sm space-y-2 text-zinc-400">
                                        <li className="flex items-start gap-2 italic">
                                            <ChevronRight className="w-4 h-4 mt-0.5 text-emerald-500" />
                                            <span>If accounts are different: Use PAT from Account A for Source, PAT from Account B for Target.</span>
                                        </li>
                                        <li className="flex items-start gap-2 italic">
                                            <ChevronRight className="w-4 h-4 mt-0.5 text-emerald-500" />
                                            <span>If same account: Use the same PAT for both fields.</span>
                                        </li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Project ID Content */}
                    <TabsContent value="project" className="mt-8">
                        <Card className="bg-white/5 border-white/10 outline-none ring-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-orange-500 flex items-center justify-center shadow-lg shadow-orange-500/20">
                                        <CreditCard className="text-white w-5 h-5" />
                                    </div>
                                    <div>
                                        <CardTitle>Project Reference ID</CardTitle>
                                        <CardDescription>The unique alphanumeric identifier for your project</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4 text-zinc-300">
                                    <h3 className="text-lg font-semibold text-white">Location:</h3>
                                    <p>You can find this in two places:</p>
                                    <ul className="space-y-4">
                                        <li className="flex gap-3">
                                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white shrink-0">1</div>
                                            <div>
                                                <strong>Dashboard URL:</strong> Look at your browser address bar when viewing the project. It's the 20-character string after <code>/project/</code>.
                                                <div className="mt-2 text-xs text-zinc-500 bg-black/30 p-2 rounded rounded-mono border border-white/5">
                                                    https://supabase.com/dashboard/project/<span className="text-orange-400 font-bold">abcdefghijklmnopqrst</span>
                                                </div>
                                            </div>
                                        </li>
                                        <li className="flex gap-3">
                                            <div className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center text-xs text-white shrink-0">2</div>
                                            <div>
                                                <strong>Project Settings:</strong> Go to **Project Settings** (gear icon) {`->`} **General**. It is listed as the **Reference ID**.
                                            </div>
                                        </li>
                                    </ul>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Database Password Content */}
                    <TabsContent value="database" className="mt-8">
                        <Card className="bg-white/5 border-white/10 outline-none ring-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                                        <Database className="text-white w-5 h-5" />
                                    </div>
                                    <div>
                                        <CardTitle>Database Password</CardTitle>
                                        <CardDescription>Required for secure schema and data transfer (PostgreSQL)</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl text-amber-300">
                                    <div className="flex items-center gap-2 mb-1">
                                        <Info className="w-4 h-4" />
                                        <strong>Note:</strong>
                                    </div>
                                    <p className="text-sm italic">
                                        This is the password you set when you <strong>first created the project</strong>. Supabase does not store this password in plain text, so you cannot retrieve it once set.
                                    </p>
                                </div>

                                <div className="space-y-4 text-zinc-300">
                                    <h3 className="text-lg font-semibold text-white">If you forgot it:</h3>
                                    <ol className="space-y-4 list-decimal list-inside marker:text-emerald-500 marker:font-bold">
                                        <li>Navigate to **Project Settings** {`->`} **Database**.</li>
                                        <li>Scroll down to the **Database Password** section.</li>
                                        <li>Click **Reset database password**.</li>
                                        <li>Set a new password and click **Reset**.</li>
                                    </ol>
                                    <p className="text-sm text-zinc-400 italic mt-4">
                                        *Changing the password for the Source project is usually not necessary unless you need it for the migration tool.*
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>

                    {/* Service Role Key Content */}
                    <TabsContent value="servicerole" className="mt-8">
                        <Card className="bg-white/5 border-white/10 outline-none ring-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-purple-500 flex items-center justify-center shadow-lg shadow-purple-500/20">
                                        <ShieldCheck className="text-white w-5 h-5" />
                                    </div>
                                    <div>
                                        <CardTitle>Service Role Key</CardTitle>
                                        <CardDescription>Bypasses RLS to ensure 100% data integrity during migration</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4 text-zinc-300">
                                    <h3 className="text-lg font-semibold text-white">How to find it:</h3>
                                    <ol className="space-y-4 list-decimal list-inside marker:text-purple-500 marker:font-bold">
                                        <li>Go to **Project Settings** {`->`} **API**.</li>
                                        <li>Look for the section labeled **Project API keys**.</li>
                                        <li>Find the key named <strong className="text-white">service_role</strong> (it is usually marked as "secret").</li>
                                        <li>Click the **Reveal** button and **Copy** the key.</li>
                                    </ol>
                                </div>

                                <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-xl text-red-300">
                                    <p className="text-sm font-bold flex items-center gap-2 mb-1 uppercase tracking-wider">
                                        <ShieldCheck className="w-4 h-4" /> Security Warning
                                    </p>
                                    <p className="text-xs italic leading-relaxed">
                                        The Service Role key has full administrative access to your database. **Never share it publicly** and only use it in trusted migration tools like this one.
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    {/* Project Region Content */}
                    <TabsContent value="region" className="mt-8">
                        <Card className="bg-white/5 border-white/10 outline-none ring-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-indigo-500 flex items-center justify-center shadow-lg shadow-indigo-500/20">
                                        <Globe className="text-white w-5 h-5" />
                                    </div>
                                    <div>
                                        <CardTitle>Project Region</CardTitle>
                                        <CardDescription>The physical data center location where your project lives</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="space-y-4 text-slate-300">
                                    <h3 className="text-lg font-semibold text-white">Where to find it:</h3>
                                    <ol className="space-y-4 list-decimal list-inside marker:text-indigo-500 marker:font-bold">
                                        <li>Open your **Supabase Dashboard**.</li>
                                        <li>Click on the **Project Settings** (gear icon) in the bottom of the left sidebar.</li>
                                        <li>Ensure you are in the **General** category.</li>
                                        <li>Find the **Infrastructure** section.</li>
                                        <li>Look for the **Region** field (e.g., "North Asia (Seoul)").</li>
                                        <li><strong className="text-white underline decoration-indigo-500/50 underline-offset-4">Important:</strong> Use the technical shortcode (e.g., <code>ap-northeast-2</code>) in the migrator.</li>
                                    </ol>
                                </div>

                                <div className="p-4 bg-indigo-500/10 border border-indigo-500/20 rounded-xl">
                                    <p className="text-sm font-semibold flex items-center gap-2 mb-2 text-indigo-300">
                                        <Info className="w-4 h-4" /> Common Region Codes:
                                    </p>
                                    <div className="grid grid-cols-2 gap-2 text-[11px] font-mono text-slate-400">
                                        <div className="bg-black/20 p-1.5 rounded">ap-northeast-2 (Seoul)</div>
                                        <div className="bg-black/20 p-1.5 rounded">us-east-1 (N. Virginia)</div>
                                        <div className="bg-black/20 p-1.5 rounded">eu-west-1 (Ireland)</div>
                                        <div className="bg-black/20 p-1.5 rounded">ap-southeast-1 (Singapore)</div>
                                    </div>
                                </div>

                                <div className="p-6 bg-blue-500/10 border border-blue-500/20 rounded-2xl relative overflow-hidden group">
                                    <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
                                        <ShieldCheck className="w-32 h-32 text-blue-400" />
                                    </div>
                                    <h4 className="text-lg font-bold text-white mb-2 flex items-center gap-2">
                                        <ShieldCheck className="w-5 h-5 text-blue-400" />
                                        Triple-Shield Connectivity Strategy
                                    </h4>
                                    <p className="text-sm text-slate-300 mb-4 leading-relaxed">
                                        This migrator uses a multi-layered host resolution engine. If your migration succeeded even though you think you entered the "wrong" region, here's why:
                                    </p>
                                    <div className="space-y-4">
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0 text-blue-400 font-bold text-xs ring-4 ring-blue-500/5">1</div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">Smart Discovery (API-Driven)</p>
                                                <p className="text-xs text-slate-400 mt-0.5">The engine uses your Access Token to query Supabase directly for your project’s official database configuration. This bypasses manual region errors entirely.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-slate-500/20 flex items-center justify-center shrink-0 text-slate-400 font-bold text-xs ring-4 ring-slate-500/5">2</div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">Universal Cluster Routing</p>
                                                <p className="text-xs text-zinc-400 mt-0.5">We attempt to connect via <code>pooler.supabase.com</code>. This is a region-agnostic global proxy that handles routing on Supabase's side.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-3">
                                            <div className="w-8 h-8 rounded-full bg-zinc-500/20 flex items-center justify-center shrink-0 text-zinc-400 font-bold text-xs ring-4 ring-zinc-500/5">3</div>
                                            <div>
                                                <p className="text-sm font-semibold text-white">Regional Direct Fallback</p>
                                                <p className="text-xs text-zinc-400 mt-0.5">Only as a final resort do we use the provided Region shortcode to manually construct AWS-0 and AWS-1 pooler endpoints.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                    {/* PostgreSQL Tools Content */}
                    <TabsContent value="psql" className="mt-8">
                        <Card className="bg-white/5 border-white/10 outline-none ring-0">
                            <CardHeader>
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl bg-zinc-500 flex items-center justify-center shadow-lg shadow-zinc-500/20">
                                        <Terminal className="text-white w-5 h-5" />
                                    </div>
                                    <div>
                                        <CardTitle>PostgreSQL Client Tools</CardTitle>
                                        <CardDescription>Required for Schema and Data migration</CardDescription>
                                    </div>
                                </div>
                            </CardHeader>
                            <CardContent className="space-y-8">
                                <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-xl flex gap-3 text-amber-300">
                                    <Info className="w-5 h-5 flex-shrink-0" />
                                    <p className="text-sm">
                                        These tools (psql and pg_dump) must be installed on the <strong>server running this migrator</strong>.
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    {/* Windows */}
                                    <div className="space-y-3">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" /> Windows
                                        </h3>
                                        <ol className="text-sm text-zinc-400 space-y-2 list-decimal list-inside">
                                            <li>Download the <Link href="https://www.postgresql.org/download/windows/" target="_blank" className="text-emerald-400 hover:underline inline-flex items-center gap-1">Installer <ExternalLink className="w-3 h-3" /></Link></li>
                                            <li>Run it and select <strong>only</strong> "Command Line Tools"</li>
                                            <li>Complete the wizard and <strong>restart your terminal</strong></li>
                                        </ol>
                                    </div>

                                    {/* MacOS */}
                                    <div className="space-y-3">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-zinc-200" /> MacOS
                                        </h3>
                                        <div className="space-y-4">
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Using Homebrew</p>
                                                <code className="block bg-black/40 p-2 rounded text-[11px] font-mono text-emerald-400 border border-white/5">
                                                    brew install libpq
                                                </code>
                                            </div>
                                            <div className="space-y-1">
                                                <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Using Postgres.app</p>
                                                <p className="text-xs text-zinc-400">Included automatically in Postgres.app</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Linux */}
                                    <div className="space-y-3">
                                        <h3 className="font-bold flex items-center gap-2">
                                            <div className="w-1.5 h-1.5 rounded-full bg-orange-500" /> Linux (Ubuntu)
                                        </h3>
                                        <code className="block bg-black/40 p-2 rounded text-[11px] font-mono text-emerald-400 border border-white/5">
                                            sudo apt install postgresql-client
                                        </code>
                                    </div>
                                </div>

                                <div className="p-4 bg-white/5 rounded-xl border border-white/10 space-y-3">
                                    <h4 className="text-sm font-semibold text-white">How to verify installation:</h4>
                                    <p className="text-xs text-zinc-400">Run this command in your terminal. If you see a version number, you are ready!</p>
                                    <code className="block bg-black/40 p-3 rounded text-sm font-mono text-emerald-400 border border-white/5">
                                        psql --version
                                    </code>
                                </div>
                            </CardContent>
                        </Card>
                    </TabsContent>
                </Tabs>

                {/* Footer Link */}
                <div className="mt-16 flex flex-col items-center gap-6 border-t border-white/5 pt-12">
                    <p className="text-zinc-500 text-sm text-center">
                        Still having trouble? Check the official <Link href="https://supabase.com/docs" target="_blank" className="text-emerald-400 hover:underline">Supabase Documentation</Link>.
                    </p>
                    <Link href="/">
                        <Button size="lg" className="bg-emerald-600 hover:bg-emerald-500 text-white rounded-full px-8 h-12 shadow-xl shadow-emerald-600/20 border-t border-white/10">
                            Get Started with Migration
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
