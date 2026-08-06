import React, { useState, useContext } from 'react';
import { X, Send, Copy, Check, Clock, UserX, RefreshCw, Mail, AlertCircle, Shield, Star, ChevronDown, ChevronUp, Info } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast } from '../context/UIContext';
import { EMPLOYEE_LEVELS } from '../data';
import { STATUS_LABELS, formatTimeRemaining } from '../utils/inviteUtils';

const EMAILJS_GUIDE = `Hướng dẫn cài EmailJS (miễn phí, 200 email/tháng):
1. Truy cập https://emailjs.com → Đăng ký tài khoản miễn phí
2. Dashboard → "Add New Service" → Chọn Gmail / Outlook
3. Tạo Email Template với các biến: {{to_name}}, {{invite_link}}, {{expires_at}}
4. Lấy Service ID, Template ID, Public Key
5. Thêm vào file .env:
   VITE_EMAILJS_SERVICE_ID=your_service_id
   VITE_EMAILJS_TEMPLATE_ID=your_template_id
   VITE_EMAILJS_PUBLIC_KEY=your_public_key`;

const InviteUserModal = ({ onClose }) => {
  const { invitations, sendInvitation, revokeInvitation, resendInvitation } = useContext(DocumentContext);
  const toast = useToast();

  const [activeTab, setActiveTab] = useState('send');
  const [form, setForm] = useState({ email: '', name: '', role: 'User', level: 1 });
  const [state, setState] = useState('idle'); // idle | loading | success | error
  const [errorMsg, setErrorMsg] = useState('');
  const [inviteLink, setInviteLink] = useState('');
  const [copied, setCopied] = useState(false);
  const [showEmailGuide, setShowEmailGuide] = useState(false);
  const [revokeConfirm, setRevokeConfirm] = useState(null);
  const [resendLinks, setResendLinks] = useState({}); // id → link
  const [resendCopied, setResendCopied] = useState({});

  const pendingCount = invitations.filter(i => i.status === 'pending').length;

  const handleSend = async () => {
    if (!form.email || !form.name) {
      setErrorMsg('Vui lòng điền đầy đủ Email và Họ tên.'); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setErrorMsg('Định dạng email không hợp lệ.'); return;
    }
    setState('loading');
    setErrorMsg('');
    try {
      const link = await sendInvitation(form);
      setInviteLink(link);
      setState('success');
    } catch (err) {
      if (err.message === 'RATE_LIMITED') {
        setErrorMsg('⏱ Bạn đã gửi quá 5 lời mời trong 60 giây. Vui lòng chờ thêm.');
      } else if (err.message === 'ALREADY_INVITED') {
        setErrorMsg(`📬 Email "${form.email}" đã có lời mời đang chờ xử lý.`);
      } else {
        setErrorMsg('Đã có lỗi xảy ra: ' + err.message);
      }
      setState('error');
    }
  };

  const copyLink = async (link, key = 'main') => {
    await navigator.clipboard.writeText(link);
    if (key === 'main') {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } else {
      setResendCopied(p => ({ ...p, [key]: true }));
      setTimeout(() => setResendCopied(p => ({ ...p, [key]: false })), 2500);
    }
  };

  const handleRevoke = async (id) => {
    await revokeInvitation(id);
    setRevokeConfirm(null);
  };

  const handleResend = async (id) => {
    try {
      const link = await resendInvitation(id);
      setResendLinks(p => ({ ...p, [id]: link }));
    } catch (err) {
      toast.error(err.message === 'RATE_LIMITED'
        ? 'Quá giới hạn gửi. Vui lòng chờ 60 giây.'
        : err.message);
    }
  };

  const resetForm = () => {
    setForm({ email: '', name: '', role: 'User', level: 1 });
    setState('idle');
    setInviteLink('');
    setErrorMsg('');
  };

  const TAB_STYLE = (active) => ({
    padding: '0.6rem 1.25rem',
    background: active ? 'var(--color-primary)' : 'transparent',
    color: active ? 'white' : 'var(--color-text-muted)',
    border: 'none', borderRadius: '999px',
    cursor: 'pointer', fontWeight: '600', fontSize: '0.85rem',
    transition: 'all 0.2s',
  });

  return (
    <div className="modal-overlay" onClick={onClose} style={{ zIndex: 200 }}>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: '520px',
          background: 'var(--color-bg-surface)',
          border: '1px solid var(--color-border)',
          borderRadius: '20px', overflow: 'hidden',
          boxShadow: '0 32px 80px rgba(0,0,0,0.5)',
          display: 'flex', flexDirection: 'column',
          maxHeight: '90vh',
        }}
      >
        {/* Header */}
        <div style={{ padding: '1.5rem 1.75rem 1rem', borderBottom: '1px solid var(--color-border)', flexShrink: 0 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: '700', color: 'var(--color-text-main)' }}>
                📨 Mời Thành Viên
              </h2>
              <p style={{ margin: '2px 0 0', fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>
                Hệ thống mời bảo mật — Admin không biết mật khẩu người dùng
              </p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          {/* Tabs */}
          <div style={{ display: 'flex', gap: '0.25rem', background: 'var(--color-bg-surface-hover)', padding: '4px', borderRadius: '999px', width: 'fit-content' }}>
            <button style={TAB_STYLE(activeTab === 'send')} onClick={() => setActiveTab('send')}>Gửi lời mời</button>
            <button style={TAB_STYLE(activeTab === 'pending')} onClick={() => setActiveTab('pending')}>
              Đang chờ {pendingCount > 0 && (
                <span style={{ background: '#ef4444', color: 'white', borderRadius: '999px', padding: '1px 6px', fontSize: '0.7rem', marginLeft: '4px' }}>
                  {pendingCount}
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Body */}
        <div style={{ overflowY: 'auto', flex: 1 }}>

          {/* ── TAB: GỬI LỜI MỜI ── */}
          {activeTab === 'send' && (
            <div style={{ padding: '1.5rem 1.75rem' }}>
              {state !== 'success' ? (
                <>
                  {/* Form */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1.25rem' }}>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>Email *</label>
                      <div style={{ position: 'relative' }}>
                        <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-muted)' }} />
                        <input
                          type="email" value={form.email}
                          onChange={e => { setForm(p => ({ ...p, email: e.target.value })); setErrorMsg(''); }}
                          placeholder="nguoidung@congty.vn"
                          className="input-field"
                          style={{ paddingLeft: '2.2rem' }}
                        />
                      </div>
                    </div>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>Họ và tên *</label>
                      <input
                        type="text" value={form.name}
                        onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                        placeholder="Nguyễn Văn A"
                        className="input-field"
                      />
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>Vai trò</label>
                        <select className="input-field" value={form.role} onChange={e => setForm(p => ({ ...p, role: e.target.value }))}>
                          <option value="User">User</option>
                          <option value="Admin">Admin</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ fontSize: '0.8rem', fontWeight: '600', color: 'var(--color-text-muted)', display: 'block', marginBottom: '0.4rem' }}>Cấp bậc</label>
                        <select className="input-field" value={form.level} onChange={e => setForm(p => ({ ...p, level: Number(e.target.value) }))}>
                          {EMPLOYEE_LEVELS.map(l => <option key={l.id} value={l.id}>{l.shortName}</option>)}
                        </select>
                      </div>
                    </div>
                  </div>

                  {/* Error */}
                  {errorMsg && (
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.7rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#f87171', fontSize: '0.82rem', marginBottom: '1rem' }}>
                      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                      {errorMsg}
                    </div>
                  )}

                  {/* Security note */}
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.65rem 0.875rem', background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '10px', fontSize: '0.78rem', color: 'var(--color-text-muted)', marginBottom: '1.25rem' }}>
                    <Shield size={13} style={{ flexShrink: 0, color: '#3b82f6', marginTop: '1px' }} />
                    <span>Token 288-bit được băm SHA-256. Admin không thể biết mật khẩu. Link tự hết hạn sau <strong>48 giờ</strong> và chỉ dùng được <strong>1 lần</strong>.</span>
                  </div>

                  {/* Submit */}
                  <button
                    onClick={handleSend}
                    disabled={state === 'loading'}
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
                  >
                    {state === 'loading' ? (
                      <><span style={{ width: '14px', height: '14px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Đang tạo link...</>
                    ) : <><Send size={15} /> Tạo link mời</>}
                  </button>
                </>
              ) : (
                /* ── SUCCESS: show invite link ── */
                <div>
                  <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
                    <div style={{ width: '56px', height: '56px', borderRadius: '50%', background: 'rgba(16,185,129,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '1.5rem' }}>✅</div>
                    <h3 style={{ margin: '0 0 0.25rem', color: 'var(--color-text-main)' }}>Link mời đã tạo thành công!</h3>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>Gửi link này cho <strong>{form.name}</strong>. Link có hiệu lực <strong>48 giờ</strong>.</p>
                  </div>

                  {/* Link box */}
                  <div style={{ background: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '12px', padding: '0.875rem', marginBottom: '0.75rem' }}>
                    <p style={{ margin: '0 0 0.5rem', fontSize: '0.75rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>LINK MỜI (chỉ dùng 1 lần)</p>
                    <code style={{ fontSize: '0.72rem', color: 'var(--color-primary)', wordBreak: 'break-all', display: 'block', lineHeight: '1.5' }}>{inviteLink}</code>
                  </div>

                  <button
                    onClick={() => copyLink(inviteLink)}
                    className="btn btn-primary"
                    style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}
                  >
                    {copied ? <><Check size={15} /> Đã sao chép!</> : <><Copy size={15} /> Sao chép link mời</>}
                  </button>

                  {/* EmailJS optional */}
                  <button
                    onClick={() => setShowEmailGuide(!showEmailGuide)}
                    style={{ width: '100%', background: 'none', border: '1px dashed var(--color-border)', borderRadius: '10px', padding: '0.6rem', color: 'var(--color-text-muted)', cursor: 'pointer', fontSize: '0.8rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.4rem', marginBottom: '0.75rem' }}
                  >
                    <Info size={13} />
                    {showEmailGuide ? 'Ẩn' : 'Muốn gửi email tự động?'} {showEmailGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  {showEmailGuide && (
                    <pre style={{ background: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '10px', padding: '0.875rem', fontSize: '0.72rem', color: 'var(--color-text-muted)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', marginBottom: '0.75rem', lineHeight: '1.7' }}>
                      {EMAILJS_GUIDE}
                    </pre>
                  )}

                  <button onClick={resetForm} className="btn btn-outline" style={{ width: '100%', fontSize: '0.85rem' }}>
                    Mời thêm người khác
                  </button>
                </div>
              )}
            </div>
          )}

          {/* ── TAB: ĐANG CHỜ ── */}
          {activeTab === 'pending' && (
            <div style={{ padding: '1.25rem 1.75rem' }}>
              {invitations.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem 0', color: 'var(--color-text-muted)' }}>
                  <p>📭 Chưa có lời mời nào.</p>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {invitations.map(inv => {
                    const statusInfo = STATUS_LABELS[inv.status] || STATUS_LABELS.pending;
                    const timeLeft = formatTimeRemaining(inv.expiresAt);
                    const isActive = inv.status === 'pending';
                    const shownLink = resendLinks[inv.id];

                    return (
                      <div key={inv.id} style={{ background: 'var(--color-bg-surface-hover)', border: '1px solid var(--color-border)', borderRadius: '14px', padding: '1rem', transition: 'all 0.2s' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.75rem' }}>
                          {/* Avatar */}
                          <div style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'linear-gradient(135deg, var(--color-primary), var(--color-secondary))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: '700', fontSize: '1rem', flexShrink: 0 }}>
                            {inv.name?.charAt(0).toUpperCase()}
                          </div>
                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontWeight: '600', fontSize: '0.9rem', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.name}</div>
                            <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{inv.email}</div>
                            <div style={{ display: 'flex', gap: '0.4rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                              <span style={{ padding: '2px 8px', background: statusInfo.bg, color: statusInfo.color, borderRadius: '999px', fontSize: '0.7rem', fontWeight: '600' }}>
                                {statusInfo.label}
                              </span>
                              <span style={{ padding: '2px 8px', background: 'rgba(59,130,246,0.1)', color: '#60a5fa', borderRadius: '999px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                <Shield size={9} />{inv.role}
                              </span>
                              {isActive && (
                                <span style={{ padding: '2px 8px', background: 'rgba(107,114,128,0.15)', color: 'var(--color-text-muted)', borderRadius: '999px', fontSize: '0.7rem', display: 'flex', alignItems: 'center', gap: '2px' }}>
                                  <Clock size={9} />{timeLeft}
                                </span>
                              )}
                            </div>
                          </div>
                          {/* Actions */}
                          {isActive && (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', flexShrink: 0 }}>
                              <button
                                onClick={() => handleResend(inv.id)}
                                style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', color: '#60a5fa', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                              >
                                <RefreshCw size={11} /> Gửi lại
                              </button>
                              {revokeConfirm === inv.id ? (
                                <div style={{ display: 'flex', gap: '4px' }}>
                                  <button onClick={() => handleRevoke(inv.id)} style={{ background: '#ef4444', border: 'none', color: 'white', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer', fontSize: '0.7rem', fontWeight: '600' }}>Xác nhận</button>
                                  <button onClick={() => setRevokeConfirm(null)} style={{ background: 'none', border: '1px solid var(--color-border)', color: 'var(--color-text-muted)', borderRadius: '6px', padding: '3px 7px', cursor: 'pointer', fontSize: '0.7rem' }}>Huỷ</button>
                                </div>
                              ) : (
                                <button
                                  onClick={() => setRevokeConfirm(inv.id)}
                                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171', borderRadius: '8px', padding: '4px 8px', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px', whiteSpace: 'nowrap' }}
                                >
                                  <UserX size={11} /> Thu hồi
                                </button>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Show resent link */}
                        {shownLink && (
                          <div style={{ marginTop: '0.75rem', background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)', borderRadius: '8px', padding: '0.6rem' }}>
                            <p style={{ margin: '0 0 0.35rem', fontSize: '0.7rem', color: 'var(--color-text-muted)', fontWeight: '600' }}>LINK MỚI (copy và gửi cho người dùng)</p>
                            <code style={{ fontSize: '0.67rem', color: 'var(--color-primary)', wordBreak: 'break-all', display: 'block', marginBottom: '0.4rem' }}>{shownLink}</code>
                            <button
                              onClick={() => copyLink(shownLink, inv.id)}
                              style={{ background: 'var(--color-primary)', border: 'none', color: 'white', borderRadius: '6px', padding: '3px 10px', cursor: 'pointer', fontSize: '0.72rem', display: 'flex', alignItems: 'center', gap: '3px' }}
                            >
                              {resendCopied[inv.id] ? <><Check size={11} /> Đã sao chép</> : <><Copy size={11} /> Copy link</>}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
};

export default InviteUserModal;
