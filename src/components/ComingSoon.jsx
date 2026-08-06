import React from 'react';

/**
 * Generic placeholder for pages under development.
 * Usage: <ComingSoon title="Pháp lý" icon="⚖️" description="..." />
 */
const ComingSoon = ({ title, icon = '🚧', description = 'Chức năng này đang được phát triển. Vui lòng quay lại sau.' }) => {
  return (
    <div className="fade-in" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '80%', textAlign: 'center' }}>
      <div style={{ fontSize: '4rem', marginBottom: '1.5rem', lineHeight: 1 }}>{icon}</div>
      <h2 style={{ fontSize: '1.75rem', fontWeight: '700', marginBottom: '0.75rem', color: 'var(--color-text-main)' }}>{title}</h2>
      <p style={{ color: 'var(--color-text-muted)', maxWidth: '400px', lineHeight: '1.6' }}>{description}</p>
      <div style={{ marginTop: '2rem', padding: '0.5rem 1.25rem', borderRadius: '20px', backgroundColor: 'var(--color-bg-surface)', border: '1px dashed var(--color-border)', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
        🔧 Đang phát triển
      </div>
    </div>
  );
};

export default ComingSoon;
