import React, { createContext, useContext, useState, useCallback, useRef } from 'react';

// ─── Toast Context ────────────────────────────────────────────────────────────
const ToastContext = createContext(null);

// ─── Confirm Context ──────────────────────────────────────────────────────────
const ConfirmContext = createContext(null);

// ─── Toast Provider ───────────────────────────────────────────────────────────
export const UIProvider = ({ children }) => {
  const [toasts, setToasts]     = useState([]);
  const [confirm, setConfirm]   = useState(null); // { message, title, dangerous, resolve }
  const toastIdRef = useRef(0);

  /* ── Toast API ── */
  const addToast = useCallback((message, type = 'info', duration = 3500) => {
    const id = ++toastIdRef.current;
    setToasts(prev => [...prev, { id, message, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration);
  }, []);

  const toast = {
    success: (msg, dur) => addToast(msg, 'success', dur),
    error:   (msg, dur) => addToast(msg, 'error',   dur ?? 5000),
    warning: (msg, dur) => addToast(msg, 'warning', dur),
    info:    (msg, dur) => addToast(msg, 'info',    dur),
  };

  const removeToast = (id) => setToasts(prev => prev.filter(t => t.id !== id));

  /* ── Confirm API ── */
  const showConfirm = useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      setConfirm({ message, title: options.title || 'Xác nhận', dangerous: options.dangerous ?? true, resolve });
    });
  }, []);

  const handleConfirm = (result) => {
    if (confirm?.resolve) confirm.resolve(result);
    setConfirm(null);
  };

  return (
    <ToastContext.Provider value={toast}>
      <ConfirmContext.Provider value={showConfirm}>
        {children}
        <ToastContainer toasts={toasts} onRemove={removeToast} />
        {confirm && <ConfirmModal {...confirm} onConfirm={handleConfirm} />}
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
};

// ─── Hooks ────────────────────────────────────────────────────────────────────
export const useToast   = () => useContext(ToastContext);
export const useConfirm = () => useContext(ConfirmContext);

// ─── Toast Container ──────────────────────────────────────────────────────────
const TOAST_STYLES = {
  success: { border: '#34d399', icon: '✓', bg: 'rgba(16,185,129,0.12)', color: '#34d399' },
  error:   { border: '#f87171', icon: '✕', bg: 'rgba(248,113,113,0.12)', color: '#f87171' },
  warning: { border: '#fbbf24', icon: '⚠', bg: 'rgba(251,191,36,0.12)',  color: '#fbbf24' },
  info:    { border: '#60a5fa', icon: 'ℹ', bg: 'rgba(96,165,250,0.12)',  color: '#60a5fa' },
};

const ToastContainer = ({ toasts, onRemove }) => (
  <div style={{
    position: 'fixed', bottom: '1.5rem', right: '1.5rem',
    display: 'flex', flexDirection: 'column', gap: '0.5rem',
    zIndex: 99999, maxWidth: '380px',
  }}>
    {toasts.map(t => {
      const s = TOAST_STYLES[t.type] || TOAST_STYLES.info;
      return (
        <div key={t.id} style={{
          display: 'flex', alignItems: 'flex-start', gap: '10px',
          padding: '12px 14px',
          background: 'rgba(15,23,42,0.95)',
          border: `1px solid ${s.border}`,
          borderLeft: `4px solid ${s.border}`,
          borderRadius: '10px',
          boxShadow: '0 8px 32px rgba(0,0,0,0.4)',
          backdropFilter: 'blur(16px)',
          animation: 'toastIn 0.25s ease',
          color: 'var(--color-text-main)',
          fontSize: '0.875rem',
          lineHeight: '1.4',
          minWidth: '260px',
        }}>
          <span style={{
            flexShrink: 0, width: '20px', height: '20px', borderRadius: '50%',
            backgroundColor: s.bg, color: s.color,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '0.7rem', fontWeight: '700', marginTop: '1px',
          }}>{s.icon}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => onRemove(t.id)} style={{
            background: 'none', border: 'none', cursor: 'pointer',
            color: 'var(--color-text-muted)', fontSize: '1rem', lineHeight: 1,
            padding: '0 2px', flexShrink: 0, marginTop: '-1px',
          }}>×</button>
        </div>
      );
    })}
    <style>{`@keyframes toastIn { from { opacity:0; transform:translateX(20px); } to { opacity:1; transform:none; } }`}</style>
  </div>
);

// ─── Confirm Modal ────────────────────────────────────────────────────────────
const ConfirmModal = ({ title, message, dangerous, onConfirm }) => (
  <div style={{
    position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    zIndex: 99998, backdropFilter: 'blur(4px)',
    animation: 'fadeIn 0.15s ease',
  }}
    onClick={(e) => { if (e.target === e.currentTarget) onConfirm(false); }}
  >
    <div style={{
      background: 'var(--color-bg-card)',
      border: '1px solid var(--color-border)',
      borderRadius: '16px',
      padding: '1.75rem',
      maxWidth: '420px', width: '90%',
      boxShadow: '0 24px 64px rgba(0,0,0,0.5)',
      animation: 'slideUp 0.2s ease',
    }}>
      {/* Icon */}
      <div style={{
        width: '48px', height: '48px', borderRadius: '12px',
        backgroundColor: dangerous ? 'rgba(248,113,113,0.12)' : 'rgba(96,165,250,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: '1.4rem', marginBottom: '1rem',
      }}>
        {dangerous ? '🗑️' : '❓'}
      </div>

      <h3 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>
        {title}
      </h3>
      <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', lineHeight: '1.5', marginBottom: '1.5rem' }}>
        {message}
      </p>

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        <button
          className="btn btn-outline"
          onClick={() => onConfirm(false)}
          style={{ minWidth: '80px' }}
        >
          Hủy
        </button>
        <button
          className="btn"
          onClick={() => onConfirm(true)}
          style={{
            minWidth: '100px',
            backgroundColor: dangerous ? '#ef4444' : 'var(--color-primary)',
            color: 'white', border: 'none',
          }}
          autoFocus
        >
          {dangerous ? 'Xóa' : 'Xác nhận'}
        </button>
      </div>
    </div>
    <style>{`
      @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
      @keyframes slideUp { from { opacity:0; transform:translateY(16px) } to { opacity:1; transform:none } }
    `}</style>
  </div>
);
