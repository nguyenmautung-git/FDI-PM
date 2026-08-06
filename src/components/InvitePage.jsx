import React, { useState, useEffect, useContext } from 'react';
import { Eye, EyeOff, Check, X, AlertCircle, Lock, ShieldCheck, Smartphone, ChevronRight } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { checkPasswordStrength } from '../utils/inviteUtils';

// ── Step Indicator ─────────────────────────────────────────────────────────
const Steps = ({ current }) => {
  const steps = [
    { n: 1, label: 'Xác nhận' },
    { n: 2, label: 'Mật khẩu' },
    { n: 3, label: 'Bảo mật' },
    { n: 4, label: 'Hoàn tất' },
  ];
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0, marginBottom: '2rem' }}>
      {steps.map((s, i) => (
        <React.Fragment key={s.n}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.35rem' }}>
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%',
              background: s.n < current ? '#10b981' : s.n === current ? 'linear-gradient(135deg,#3b82f6,#8b5cf6)' : 'rgba(255,255,255,0.1)',
              border: s.n === current ? 'none' : '1px solid rgba(255,255,255,0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: s.n <= current ? 'white' : '#475569',
              fontWeight: '700', fontSize: '0.9rem',
              transition: 'all 0.3s',
              boxShadow: s.n === current ? '0 0 0 3px rgba(59,130,246,0.3)' : 'none',
            }}>
              {s.n < current ? <Check size={16} /> : s.n}
            </div>
            <span style={{ fontSize: '0.68rem', color: s.n === current ? '#93c5fd' : '#475569', fontWeight: s.n === current ? '600' : '400', whiteSpace: 'nowrap' }}>
              {s.label}
            </span>
          </div>
          {i < steps.length - 1 && (
            <div style={{ width: '48px', height: '2px', background: i < current - 1 ? '#10b981' : 'rgba(255,255,255,0.1)', margin: '0 4px 20px', transition: 'background 0.3s' }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

// ── Password strength bar ──────────────────────────────────────────────────
const StrengthBar = ({ score }) => {
  const colors = ['#ef4444', '#f97316', '#eab308', '#10b981'];
  const labels = ['Rất yếu', 'Yếu', 'Trung bình', 'Mạnh'];
  const w = score === 0 ? 0 : (score / 4) * 100;
  return (
    <div style={{ marginTop: '0.5rem' }}>
      <div style={{ height: '4px', background: 'rgba(255,255,255,0.1)', borderRadius: '999px', overflow: 'hidden' }}>
        <div style={{ width: `${w}%`, height: '100%', background: colors[score - 1] || '#ef4444', borderRadius: '999px', transition: 'width 0.3s, background 0.3s' }} />
      </div>
      {score > 0 && <span style={{ fontSize: '0.7rem', color: colors[score - 1], fontWeight: '600' }}>{labels[score - 1]}</span>}
    </div>
  );
};

// ── Check item ─────────────────────────────────────────────────────────────
const CheckItem = ({ ok, label }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8rem', color: ok ? '#10b981' : '#475569' }}>
    {ok ? <Check size={13} /> : <X size={13} />}
    {label}
  </div>
);

// ────────────────────────────────────────────────────────────────────────────

const InvitePage = ({ token, onDone }) => {
  const { verifyInviteToken, activateAccount } = useContext(DocumentContext);

  const [step, setStep] = useState(1);
  const [invitation, setInvitation] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  // Step 2 — password
  const [password, setPassword] = useState('');
  const [confirmPwd, setConfirmPwd] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [pwdError, setPwdError] = useState('');
  const [activating, setActivating] = useState(false);

  // Step 3 — 2FA
  const [skip2FA, setSkip2FA] = useState(false);

  const strength = checkPasswordStrength(password);

  // Verify token on mount
  useEffect(() => {
    if (!token) { setVerifyError('Không tìm thấy token mời trong URL.'); return; }
    verifyInviteToken(token).then(({ valid, invitation: inv, error }) => {
      if (valid) { setInvitation(inv); setStep(1); }
      else { setVerifyError(error); }
    });
  }, [token]);

  // ── Step 2: Set password & activate ─────────────────────────────────────
  const handleActivate = async () => {
    if (!strength.isStrong) { setPwdError('Mật khẩu chưa đủ mạnh theo yêu cầu.'); return; }
    if (password !== confirmPwd) { setPwdError('Hai mật khẩu không khớp nhau.'); return; }
    setActivating(true);
    setPwdError('');
    try {
      await activateAccount(token, password);
      setStep(3);
    } catch (err) {
      const msg = err.code === 'auth/email-already-in-use'
        ? 'Email này đã có tài khoản Firebase. Vui lòng liên hệ Admin.'
        : err.code === 'auth/weak-password'
        ? 'Mật khẩu quá yếu theo Firebase. Thêm ký tự đặc biệt.'
        : err.message || 'Đã xảy ra lỗi. Thử lại sau.';
      setPwdError(msg);
    } finally {
      setActivating(false);
    }
  };

  // ── Common styles ────────────────────────────────────────────────────────
  const inputStyle = {
    width: '100%', boxSizing: 'border-box',
    padding: '0.75rem 1rem',
    background: 'rgba(15,23,42,0.6)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: '12px', color: '#f8fafc',
    fontSize: '0.9rem', outline: 'none',
    transition: 'border-color 0.2s',
  };

  const renderContent = () => {
    // ── Error state ─────────────────────────────────────────────────────────
    if (verifyError) return (
      <div style={{ textAlign: 'center', padding: '1rem 0' }}>
        <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>🚫</div>
        <h2 style={{ color: '#f8fafc', marginBottom: '0.75rem', fontSize: '1.3rem' }}>Link không hợp lệ</h2>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.75rem 1rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '12px', color: '#fca5a5', fontSize: '0.85rem', textAlign: 'left', marginBottom: '1.5rem' }}>
          <AlertCircle size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
          {verifyError}
        </div>
        <p style={{ color: '#475569', fontSize: '0.82rem' }}>Liên hệ quản trị viên để được cấp lại link mời.</p>
      </div>
    );

    // ── Step 1: Confirm identity ─────────────────────────────────────────────
    if (step === 1 && invitation) return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem', fontSize: '2rem', fontWeight: '800', color: 'white' }}>
            {invitation.name?.charAt(0).toUpperCase()}
          </div>
          <h2 style={{ color: '#f8fafc', marginBottom: '0.25rem', fontSize: '1.4rem' }}>
            Xin chào, {invitation.name}!
          </h2>
          <p style={{ color: '#64748b', fontSize: '0.875rem' }}>Bạn đã được mời tham gia hệ thống FDI PM</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1.75rem' }}>
          <div style={{ background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem' }}>
            <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Email tài khoản</p>
            <p style={{ margin: 0, color: '#f8fafc', fontWeight: '500', fontSize: '0.95rem' }}>{invitation.email}</p>
          </div>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <div style={{ flex: 1, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Vai trò</p>
              <p style={{ margin: 0, color: invitation.role === 'Admin' ? '#10b981' : '#3b82f6', fontWeight: '600' }}>{invitation.role}</p>
            </div>
            <div style={{ flex: 1, background: 'rgba(30,41,59,0.8)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '12px', padding: '1rem' }}>
              <p style={{ margin: '0 0 0.2rem', fontSize: '0.7rem', color: '#64748b', textTransform: 'uppercase', fontWeight: '600', letterSpacing: '0.05em' }}>Cấp bậc</p>
              <p style={{ margin: 0, color: '#f59e0b', fontWeight: '600' }}>Cấp {invitation.level}</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => setStep(2)}
          className="btn btn-primary"
          style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
        >
          Tiếp tục — Đặt mật khẩu <ChevronRight size={16} />
        </button>
      </div>
    );

    // ── Step 2: Set password ─────────────────────────────────────────────────
    if (step === 2) return (
      <div>
        <div style={{ marginBottom: '1.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem' }}>
            <Lock size={18} style={{ color: '#3b82f6' }} />
            <h3 style={{ margin: 0, color: '#f8fafc', fontSize: '1.1rem' }}>Tạo mật khẩu</h3>
          </div>
          <p style={{ margin: 0, color: '#64748b', fontSize: '0.82rem' }}>Chỉ bạn mới biết mật khẩu này. Hệ thống không lưu trữ.</p>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginBottom: '1rem' }}>
          {/* Password */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Mật khẩu mới</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showPwd ? 'text' : 'password'}
                value={password}
                onChange={e => { setPassword(e.target.value); setPwdError(''); }}
                placeholder="Tối thiểu 8 ký tự..."
                style={{ ...inputStyle, paddingRight: '2.5rem' }}
                onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.12)'}
              />
              <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <StrengthBar score={strength.score} />
          </div>

          {/* Requirements */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.35rem' }}>
            <CheckItem ok={strength.checks.length}    label="Ít nhất 8 ký tự" />
            <CheckItem ok={strength.checks.uppercase} label="Chữ hoa (A-Z)" />
            <CheckItem ok={strength.checks.number}    label="Có số (0-9)" />
            <CheckItem ok={strength.checks.special}   label="Ký tự đặc biệt" />
          </div>

          {/* Confirm */}
          <div>
            <label style={{ fontSize: '0.8rem', fontWeight: '600', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Xác nhận mật khẩu</label>
            <div style={{ position: 'relative' }}>
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPwd}
                onChange={e => { setConfirmPwd(e.target.value); setPwdError(''); }}
                placeholder="Nhập lại mật khẩu..."
                style={{
                  ...inputStyle, paddingRight: '2.5rem',
                  borderColor: confirmPwd && password !== confirmPwd ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                onBlur={e => e.target.style.borderColor = confirmPwd && password !== confirmPwd ? 'rgba(239,68,68,0.5)' : 'rgba(255,255,255,0.12)'}
              />
              <button type="button" onClick={() => setShowConfirm(!showConfirm)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer' }}>
                {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            {confirmPwd && password !== confirmPwd && (
              <p style={{ margin: '0.3rem 0 0', fontSize: '0.75rem', color: '#f87171' }}>Mật khẩu không khớp</p>
            )}
          </div>
        </div>

        {pwdError && (
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.65rem 0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#fca5a5', fontSize: '0.82rem', marginBottom: '1rem' }}>
            <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
            {pwdError}
          </div>
        )}

        <button
          onClick={handleActivate}
          disabled={activating || !strength.isStrong || password !== confirmPwd}
          style={{
            width: '100%', padding: '0.8rem', border: 'none', borderRadius: '12px',
            background: activating || !strength.isStrong || password !== confirmPwd
              ? 'rgba(59,130,246,0.3)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
            color: 'white', fontSize: '0.95rem', fontWeight: '600',
            cursor: activating ? 'wait' : 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
          }}
        >
          {activating ? (
            <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Đang kích hoạt...</>
          ) : <>Kích hoạt tài khoản <ChevronRight size={16} /></>}
        </button>
      </div>
    );

    // ── Step 3: 2FA ──────────────────────────────────────────────────────────
    if (step === 3) return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: 'linear-gradient(135deg,#10b981,#0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 1rem' }}>
            <ShieldCheck size={28} color="white" />
          </div>
          <h3 style={{ color: '#f8fafc', marginBottom: '0.25rem' }}>Bảo mật 2 lớp (2FA)</h3>
          <p style={{ color: '#64748b', fontSize: '0.82rem' }}>Bảo vệ tài khoản khỏi truy cập trái phép</p>
        </div>

        <div style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '14px', padding: '1.25rem', marginBottom: '1.25rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.75rem' }}>
            <Smartphone size={16} style={{ color: '#10b981' }} />
            <strong style={{ color: '#f8fafc', fontSize: '0.9rem' }}>Cài Google Authenticator</strong>
          </div>
          <ol style={{ margin: 0, paddingLeft: '1.25rem', display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            {[
              'Tải app "Google Authenticator" hoặc "Authy" trên điện thoại',
              'Mở app → Bấm dấu "+" để thêm tài khoản',
              'Chọn "Nhập khóa thiết lập" và nhập thủ công, hoặc bấm "Quét mã QR"',
              'Liên hệ Admin để nhận mã QR hoặc khóa bí mật của bạn',
            ].map((step, i) => (
              <li key={i} style={{ color: '#94a3b8', fontSize: '0.82rem' }}>{step}</li>
            ))}
          </ol>
        </div>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          <button
            onClick={() => setStep(4)}
            style={{ flex: 1, padding: '0.7rem', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#94a3b8', cursor: 'pointer', fontSize: '0.85rem', fontWeight: '500' }}
          >
            Bỏ qua
          </button>
          <button
            onClick={() => setStep(4)}
            style={{ flex: 2, padding: '0.7rem', background: 'linear-gradient(135deg,#10b981,#0ea5e9)', border: 'none', borderRadius: '12px', color: 'white', cursor: 'pointer', fontSize: '0.9rem', fontWeight: '600', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem' }}
          >
            Đã hiểu — Tiếp tục <ChevronRight size={16} />
          </button>
        </div>
      </div>
    );

    // ── Step 4: Welcome ──────────────────────────────────────────────────────
    if (step === 4) return (
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '4rem', marginBottom: '1rem', animation: 'bounceIn 0.6s ease' }}>🎉</div>
        <h2 style={{ color: '#f8fafc', marginBottom: '0.5rem', fontSize: '1.5rem' }}>Chào mừng {invitation?.name}!</h2>
        <p style={{ color: '#64748b', fontSize: '0.875rem', marginBottom: '2rem', lineHeight: '1.6' }}>
          Tài khoản của bạn đã được kích hoạt thành công.<br />
          Bạn có thể đăng nhập vào hệ thống ngay bây giờ.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: '12px', padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Check size={18} style={{ color: '#10b981', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: '0 0 2px', fontSize: '0.82rem', fontWeight: '600', color: '#f8fafc' }}>Tài khoản đã kích hoạt</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>{invitation?.email}</p>
            </div>
          </div>
          <div style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.2)', borderRadius: '12px', padding: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Check size={18} style={{ color: '#3b82f6', flexShrink: 0 }} />
            <div style={{ textAlign: 'left' }}>
              <p style={{ margin: '0 0 2px', fontSize: '0.82rem', fontWeight: '600', color: '#f8fafc' }}>Phân quyền: {invitation?.role} · Cấp {invitation?.level}</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Đã được Admin cấu hình sẵn</p>
            </div>
          </div>
        </div>

        <button
          onClick={onDone}
          style={{ marginTop: '1.75rem', width: '100%', padding: '0.875rem', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', border: 'none', borderRadius: '12px', color: 'white', fontSize: '1rem', fontWeight: '700', cursor: 'pointer', boxShadow: '0 4px 20px rgba(59,130,246,0.35)' }}
        >
          Vào hệ thống ngay →
        </button>
      </div>
    );
  };

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0f172a',
      backgroundImage: 'radial-gradient(at 0% 0%, rgba(59,130,246,0.18) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(139,92,246,0.18) 0px, transparent 50%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '440px' }}>
        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '1.75rem' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', boxShadow: '0 6px 24px rgba(59,130,246,0.35)', marginBottom: '0.75rem' }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 style={{ fontSize: '1.15rem', fontWeight: '700', background: 'linear-gradient(135deg,#f8fafc,#94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', margin: 0 }}>
            FDI PM
          </h1>
        </div>

        {/* Step card */}
        <div style={{ background: 'rgba(30,41,59,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '2rem', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
          {/* Steps indicator (skip if error) */}
          {!verifyError && invitation && <Steps current={step} />}

          {renderContent()}
        </div>

        <p style={{ textAlign: 'center', color: '#1e293b', fontSize: '0.75rem', marginTop: '1.5rem' }}>
          © 2025 FDI PM · Phiên bản nội bộ
        </p>
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes bounceIn { 0% { transform: scale(0.3); opacity: 0; } 60% { transform: scale(1.1); } 100% { transform: scale(1); opacity: 1; } }
        input::placeholder { color: #334155; }
      `}</style>
    </div>
  );
};

export default InvitePage;
