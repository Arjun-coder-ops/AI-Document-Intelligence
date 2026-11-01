import React from 'react';
import { getAppConfig } from './index.js';

export function App(): React.JSX.Element {
  const config = getAppConfig();

  return (
    <main className="p-8 max-w-4xl mx-auto">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-sky-400">DocSage</h1>
        <p className="text-slate-400">Enterprise Multi-Tenant Document Intelligence Platform</p>
      </header>
      <section className="bg-slate-800 p-6 rounded-lg border border-slate-700">
        <h2 className="text-xl font-semibold mb-2">System Status</h2>
        <p className="text-slate-300">
          Client Version: <span className="font-mono text-emerald-400">{config.version}</span>
        </p>
        <p className="text-slate-300">
          Target API Endpoint: <span className="font-mono text-emerald-400">{config.apiUrl}</span>
        </p>
      </section>
    </main>
  );
}
