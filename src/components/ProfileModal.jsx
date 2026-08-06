import React, { useContext } from 'react';
import { ROLES } from '../constants';
import { X, Mail, Phone, Shield, Star, Edit2, Share2 } from 'lucide-react';
import { EMPLOYEE_LEVELS } from '../data';
import { DocumentContext } from '../context/DocumentContext';


const ROLE_COLORS = {
  Admin: { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)' },
  User:  { bg: 'rgba(59, 130, 246, 0.15)',  color: '#3b82f6', border: 'rgba(59, 130, 246, 0.3)' },
};

const LEVEL_GRADIENT = [
  'linear-gradient(135deg, #6366f1, #8b5cf6)',
  'linear-gradient(135deg, #3b82f6, #0ea5e9)',
  'linear-gradient(135deg, #10b981, #06b6d4)',
  'linear-gradient(135deg, #f59e0b, #f97316)',
  'linear-gradient(135deg, #ef4444, #ec4899)',
  'linear-gradient(135deg, #8b5cf6, #ec4899)',
  'linear-gradient(135deg, #0ea5e9, #6366f1)',
];

const ProfileModal = ({ member, onClose, onEdit }) => {
  if (!member) return null;

  const { userRole } = useContext(DocumentContext);
  const levelInfo = EMPLOYEE_LEVELS.find(l => l.id === member.level);
  const roleStyle = ROLE_COLORS[member.role] || ROLE_COLORS.User;
  const gradient = LEVEL_GRADIENT[(member.level - 1) % LEVEL_GRADIENT.length];

  const handleExportPDF = async () => {
    const el = document.getElementById('profile-printable');
    if (!el) return;
    const html2pdf = (await import('html2pdf.js')).default;
    html2pdf().set({
      margin: 10,
      filename: `profile_${member.name}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { scale: 2, useCORS: true },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
    }).from(el).save();
  };

  return (
    <div
      className="modal-overlay"
      onClick={onClose}
      style={{ zIndex: 200, alignItems: 'center', justifyContent: 'center' }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '480px',
          background: 'var(--color-bg-surface)',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.45)',
          border: '1px solid var(--color-border)',
          display: 'flex', flexDirection: 'column',
          fontFamily: "'Inter', sans-serif",
        }}
      >
        {/* Banner + Close */}
        <div style={{
          height: '110px',
          background: gradient,
          position: 'relative',
          flexShrink: 0,
        }}>
          {/* Pattern overlay */}
          <div style={{
            position: 'absolute', inset: 0,
            backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(255,255,255,0.08) 0%, transparent 40%)',
          }} />
          <button
            data-html2canvas-ignore="true"
            onClick={onClose}
            style={{
              position: 'absolute', top: '12px', right: '12px',
              background: 'rgba(0,0,0,0.25)', border: 'none',
              color: 'white', cursor: 'pointer', borderRadius: '50%',
              width: '32px', height: '32px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Printable body */}
        <div id="profile-printable" style={{ padding: '0 1.75rem 1.75rem' }}>

          {/* Avatar row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: '-44px', marginBottom: '1rem' }}>
            <div style={{
              width: '88px', height: '88px', borderRadius: '50%',
              backgroundImage: `url(${member.avatar})`,
              backgroundSize: 'cover', backgroundPosition: 'center',
              border: '4px solid var(--color-bg-surface)',
              boxShadow: '0 4px 20px rgba(0,0,0,0.3)',
              flexShrink: 0,
            }} />
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              <span style={{
                padding: '0.3rem 0.8rem',
                background: roleStyle.bg, color: roleStyle.color,
                border: `1px solid ${roleStyle.border}`,
                borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '4px',
              }}>
                <Shield size={11} /> {member.role}
              </span>
              <span style={{
                padding: '0.3rem 0.8rem',
                background: 'rgba(245, 158, 11, 0.15)', color: '#d97706',
                border: '1px solid rgba(245, 158, 11, 0.3)',
                borderRadius: '999px', fontSize: '0.75rem', fontWeight: '600',
                display: 'flex', alignItems: 'center', gap: '4px',
              }} title={levelInfo?.fullName}>
                <Star size={11} /> Cấp {member.level}
              </span>
            </div>
          </div>

          {/* Name + title */}
          <div style={{ marginBottom: '1.25rem' }}>
            <h2 style={{
              fontSize: '1.4rem', fontWeight: '700',
              color: 'var(--color-text-main)', margin: '0 0 0.2rem',
            }}>
              {member.name}
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--color-text-muted)', margin: 0 }}>
              {levelInfo?.fullName || `Cấp ${member.level}`}
            </p>
          </div>

          {/* Info cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', marginBottom: '1.5rem' }}>
            <InfoRow icon={<Mail size={15} />} label="Email" value={member.email} link={`mailto:${member.email}`} />
            <InfoRow icon={<Phone size={15} />} label="Điện thoại" value={formatPhone(member.phone)} link={`tel:${member.phone}`} />
          </div>

          {/* Status */}
          {member.locked && (
            <div style={{
              padding: '0.6rem 1rem', background: 'rgba(239,68,68,0.1)',
              border: '1px solid rgba(239,68,68,0.3)', borderRadius: '10px',
              color: '#ef4444', fontSize: '0.82rem', fontWeight: '600',
              display: 'flex', alignItems: 'center', gap: '0.5rem',
              marginBottom: '1.25rem',
            }}>
              🔒 Tài khoản này đang bị khóa
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div
          data-html2canvas-ignore="true"
          style={{
            borderTop: '1px solid var(--color-border)',
            padding: '1rem 1.75rem',
            display: 'flex', gap: '0.75rem', justifyContent: 'space-between',
            backgroundColor: 'var(--color-bg-surface-hover)',
          }}
        >
          <button
            onClick={handleExportPDF}
            className="btn btn-outline"
            style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
          >
            <Share2 size={14} /> Xuất PDF
          </button>
          {userRole === ROLES.ADMIN && onEdit && (
            <button
              onClick={() => { onEdit(member); onClose(); }}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', fontSize: '0.85rem' }}
            >
              <Edit2 size={14} /> Chỉnh sửa
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// ── Helpers ──────────────────────────────────────────────────────────────────
const formatPhone = (phone) => {
  if (!phone) return '—';
  const c = ('' + phone).replace(/\D/g, '');
  if (c.length <= 4) return c;
  if (c.length <= 7) return `${c.slice(0, 4)} ${c.slice(4)}`;
  return `${c.slice(0, 4)} ${c.slice(4, 7)} ${c.slice(7)}`;
};

const InfoRow = ({ icon, label, value, link }) => (
  <div style={{
    display: 'flex', alignItems: 'center', gap: '0.85rem',
    padding: '0.7rem 1rem',
    background: 'var(--color-bg-surface-hover)',
    borderRadius: '12px',
    border: '1px solid var(--color-border)',
  }}>
    <span style={{ color: 'var(--color-primary)', flexShrink: 0 }}>{icon}</span>
    <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.04em' }}>
        {label}
      </span>
      {link ? (
        <a href={link} style={{ fontSize: '0.9rem', color: 'var(--color-text-main)', textDecoration: 'none', fontWeight: '500', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}
          onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary)'}
          onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-main)'}
        >
          {value || '—'}
        </a>
      ) : (
        <span style={{ fontSize: '0.9rem', color: 'var(--color-text-main)', fontWeight: '500' }}>{value || '—'}</span>
      )}
    </div>
  </div>
);

export default ProfileModal;
