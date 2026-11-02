import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.js';
import {
  MessageSquare,
  FileText,
  BarChart3,
  LogOut,
  Shield,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export const Layout: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    void navigate('/auth');
  };

  const navItems = [
    { to: '/chat', label: 'Streaming Chat', icon: MessageSquare },
    { to: '/documents', label: 'Document Library', icon: FileText },
    { to: '/admin', label: 'Admin & Analytics', icon: BarChart3, requireAdmin: true },
  ];

  return (
    <div className="app-container">
      {/* Sidebar Navigation Shell */}
      <aside className="sidebar" aria-label="Main Navigation">
        {/* Brand Header */}
        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-subtle)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: 'var(--radius-md)',
                backgroundColor: 'var(--accent)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                boxShadow: 'var(--shadow-glow)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem', letterSpacing: '-0.02em' }}>DocSage</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>Enterprise RAG v1.0</div>
            </div>
          </div>

          {/* Tenant Badge */}
          {user && (
            <div
              style={{
                marginTop: '14px',
                padding: '6px 10px',
                backgroundColor: 'var(--bg-card)',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border-subtle)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.75rem',
              }}
            >
              <Layers size={13} color="var(--accent)" />
              <span style={{ color: 'var(--text-secondary)' }}>Workspace:</span>
              <span style={{ color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {user.tenantId.slice(0, 8)}...
              </span>
            </div>
          )}
        </div>

        {/* Navigation Links */}
        <nav style={{ padding: '14px 10px', flex: 1, display: 'flex', flexDirection: 'column', gap: '4px' }}>
          {navItems.map((item) => {
            if (item.requireAdmin && user?.role !== 'admin') {
              return null;
            }
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: '12px',
                  padding: '10px 14px',
                  borderRadius: 'var(--radius-md)',
                  textDecoration: 'none',
                  fontSize: '0.875rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isActive ? '#ffffff' : 'var(--text-secondary)',
                  backgroundColor: isActive ? 'var(--accent-light)' : 'transparent',
                  border: isActive ? '1px solid var(--border-strong)' : '1px solid transparent',
                  transition: 'all 0.15s ease',
                })}
              >
                <Icon size={18} />
                <span style={{ flex: 1 }}>{item.label}</span>
                <ChevronRight size={14} style={{ opacity: 0.4 }} />
              </NavLink>
            );
          })}
        </nav>

        {/* User Profile & Sign Out Footer */}
        {user && (
          <div
            style={{
              padding: '16px',
              borderTop: '1px solid var(--border-subtle)',
              backgroundColor: 'var(--bg-app)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden' }}>
                <div
                  style={{
                    width: '28px',
                    height: '28px',
                    borderRadius: 'var(--radius-full)',
                    backgroundColor: 'var(--bg-surface)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                  }}
                >
                  {user.email.slice(0, 2).toUpperCase()}
                </div>
                <div style={{ overflow: 'hidden' }}>
                  <div style={{ fontSize: '0.8rem', fontWeight: 600, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
                    {user.email}
                  </div>
                </div>
              </div>

              {/* Role badge */}
              <span
                className={`badge ${
                  user.role === 'admin'
                    ? 'badge-emerald'
                    : user.role === 'editor'
                      ? 'badge-cyan'
                      : 'badge-neutral'
                }`}
              >
                <Shield size={10} />
                {user.role}
              </span>
            </div>

            <button
              onClick={() => {
                void handleLogout();
              }}
              className="btn btn-ghost"
              style={{ width: '100%', fontSize: '0.8rem', padding: '6px 10px', justifyContent: 'flex-start' }}
            >
              <LogOut size={14} />
              Sign Out
            </button>
          </div>
        )}
      </aside>

      {/* Main Content Area */}
      <main className="main-content" id="main-content">
        <Outlet />
      </main>
    </div>
  );
};
