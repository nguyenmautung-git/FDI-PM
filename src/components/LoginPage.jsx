import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Eye, EyeOff, Mail, Lock, AlertCircle, CheckCircle, ArrowLeft } from 'lucide-react';

const ERROR_MESSAGES = {
  'auth/invalid-email':          'Định dạng email không hợp lệ.',
  'auth/user-not-found':         'Email này chưa có tài khoản trong hệ thống.',
  'auth/wrong-password':         'Mật khẩu không đúng.',
  'auth/invalid-credential':     'Email hoặc mật khẩu không đúng.',
  'auth/too-many-requests':      'Quá nhiều lần thử. Tài khoản tạm khóa — thử lại sau vài phút.',
  'auth/user-disabled':          'Tài khoản đã bị vô hiệu hóa. Liên hệ quản trị viên.',
  'auth/network-request-failed': 'Mất kết nối mạng. Vui lòng thử lại.',
};
const getMsg = (code) => ERROR_MESSAGES[code] || 'Đã xảy ra lỗi. Vui lòng thử lại.';

const baseInput = {
  width: '100%', boxSizing: 'border-box',
  padding: '0.8rem 1rem 0.8rem 2.75rem',
  background: 'rgba(15,23,42,0.7)',
  border: '1px solid rgba(255,255,255,0.1)',
  borderRadius: '12px', color: '#f8fafc',
  fontSize: '0.9rem', outline: 'none',
  transition: 'border-color 0.2s',
  fontFamily: 'inherit',
};

const LoginPage = () => {
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [showPwd, setShowPwd]   = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const [resetMode, setResetMode]       = useState(false);
  const [resetEmail, setResetEmail]     = useState('');
  const [resetSent, setResetSent]       = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetError, setResetError]     = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email || !password) { setError('Vui lòng điền đầy đủ email và mật khẩu.'); return; }
    setLoading(true); setError('');
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err) {
      setError(getMsg(err.code));
      setLoading(false);
    }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (!resetEmail) { setResetError('Vui lòng nhập email.'); return; }
    setResetLoading(true); setResetError('');
    try {
      await sendPasswordResetEmail(auth, resetEmail);
      setResetSent(true);
    } catch (err) {
      setResetError(getMsg(err.code));
    } finally {
      setResetLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh', backgroundColor: '#0f172a',
      backgroundImage: `
        radial-gradient(at 0% 0%,   rgba(59,130,246,0.2) 0px, transparent 55%),
        radial-gradient(at 100% 0%,  rgba(139,92,246,0.15) 0px, transparent 50%),
        radial-gradient(at 50% 100%, rgba(16,185,129,0.12) 0px, transparent 50%)
      `,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Inter', -apple-system, sans-serif", padding: '1.5rem',
    }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>

        {/* Brand */}
        <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
            boxShadow: '0 8px 28px rgba(59,130,246,0.4)', marginBottom: '0.875rem',
          }}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h1 style={{ fontSize: '1.25rem', fontWeight: '800', margin: '0 0 0.25rem', background: 'linear-gradient(135deg,#f8fafc,#94a3b8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
            FDI PM
          </h1>
          <p style={{ color: '#475569', fontSize: '0.82rem', margin: 0 }}>Hệ thống quản lý nội bộ</p>
        </div>

        {/* Card */}
        <div style={{ background: 'rgba(30,41,59,0.85)', backdropFilter: 'blur(20px)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '24px', padding: '2rem', boxShadow: '0 32px 64px rgba(0,0,0,0.5)' }}>
          {!resetMode ? (
            <>
              <h2 style={{ color: '#f8fafc', fontSize: '1.2rem', fontWeight: '700', margin: '0 0 0.3rem' }}>Đăng nhập</h2>
              <p style={{ color: '#475569', fontSize: '0.82rem', margin: '0 0 1.75rem' }}>
                Chưa có tài khoản? Liên hệ quản trị viên để được mời.
              </p>
              <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Email</label>
                  <div style={{ position: 'relative' }}>
                    <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                    <input type="email" value={email} autoComplete="email"
                      onChange={e => { setEmail(e.target.value); setError(''); }}
                      placeholder="your@email.com" style={baseInput}
                      onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                  </div>
                </div>
                <div>
                  <label style={{ fontSize: '0.78rem', fontWeight: '600', color: '#94a3b8', display: 'block', marginBottom: '0.4rem' }}>Mật khẩu</label>
                  <div style={{ position: 'relative' }}>
                    <Lock size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                    <input type={showPwd ? 'text' : 'password'} value={password} autoComplete="current-password"
                      onChange={e => { setPassword(e.target.value); setError(''); }}
                      placeholder="••••••••" style={{ ...baseInput, paddingRight: '2.75rem' }}
                      onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                    />
                    <button type="button" onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: '#475569', cursor: 'pointer', padding: 0 }}>
                      {showPwd ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>
                <div style={{ textAlign: 'right', marginTop: '-0.25rem' }}>
                  <button type="button" onClick={() => { setResetMode(true); setResetEmail(email); setError(''); }} style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.8rem', cursor: 'pointer', padding: 0 }}>
                    Quên mật khẩu?
                  </button>
                </div>
                {error && (
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.65rem 0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#fca5a5', fontSize: '0.82rem' }}>
                    <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                    {error}
                  </div>
                )}
                <button type="submit" disabled={loading} style={{
                  width: '100%', padding: '0.85rem', border: 'none', borderRadius: '12px',
                  background: loading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                  color: 'white', fontSize: '0.95rem', fontWeight: '700',
                  cursor: loading ? 'wait' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem',
                  boxShadow: loading ? 'none' : '0 4px 20px rgba(59,130,246,0.3)',
                }}>
                  {loading
                    ? <><span style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.4)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Đang đăng nhập...</>
                    : 'Đăng nhập →'
                  }
                </button>
              </form>
            </>
          ) : (
            <>
              <button onClick={() => { setResetMode(false); setResetSent(false); setResetError(''); }} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', background: 'none', border: 'none', color: '#60a5fa', cursor: 'pointer', fontSize: '0.82rem', padding: 0, marginBottom: '1.25rem' }}>
                <ArrowLeft size={14} /> Quay lại đăng nhập
              </button>
              {!resetSent ? (
                <>
                  <h2 style={{ color: '#f8fafc', fontSize: '1.15rem', fontWeight: '700', margin: '0 0 0.3rem' }}>Đặt lại mật khẩu</h2>
                  <p style={{ color: '#475569', fontSize: '0.82rem', margin: '0 0 1.5rem', lineHeight: '1.6' }}>
                    Nhập email — chúng tôi sẽ gửi link đặt lại mật khẩu ngay.
                  </p>
                  <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ position: 'relative' }}>
                      <Mail size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#475569', pointerEvents: 'none' }} />
                      <input type="email" value={resetEmail}
                        onChange={e => { setResetEmail(e.target.value); setResetError(''); }}
                        placeholder="your@email.com" style={baseInput}
                        onFocus={e => e.target.style.borderColor = 'rgba(59,130,246,0.6)'}
                        onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
                      />
                    </div>
                    {resetError && (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'flex-start', padding: '0.65rem 0.875rem', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: '10px', color: '#fca5a5', fontSize: '0.82rem' }}>
                        <AlertCircle size={14} style={{ flexShrink: 0, marginTop: '1px' }} />
                        {resetError}
                      </div>
                    )}
                    <button type="submit" disabled={resetLoading} style={{ width: '100%', padding: '0.85rem', border: 'none', borderRadius: '12px', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', color: 'white', fontSize: '0.9rem', fontWeight: '700', cursor: resetLoading ? 'wait' : 'pointer' }}>
                      {resetLoading ? 'Đang gửi...' : 'Gửi link đặt lại →'}
                    </button>
                  </form>
                </>
              ) : (
                <div style={{ textAlign: 'center', padding: '1rem 0' }}>
                  <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 1rem', display: 'block' }} />
                  <h3 style={{ color: '#f8fafc', marginBottom: '0.5rem' }}>Đã gửi!</h3>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', lineHeight: '1.7' }}>
                    Email đặt lại mật khẩu đã gửi tới <strong style={{ color: '#f8fafc' }}>{resetEmail}</strong>.<br />
                    Kiểm tra hộp thư (kể cả mục Spam).
                  </p>
                  <button onClick={() => { setResetMode(false); setResetSent(false); }} style={{ marginTop: '1.25rem', background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.1)', color: '#f8fafc', padding: '0.6rem 1.5rem', borderRadius: '10px', cursor: 'pointer', fontSize: '0.85rem' }}>
                    Quay lại đăng nhập
                  </button>
                </div>
              )}
            </>
          )}
        </div>
        <p style={{ textAlign: 'center', color: '#1e293b', fontSize: '0.72rem', marginTop: '1.5rem' }}>
          © 2025 FDI PM · Phiên bản nội bộ
        </p>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } input::placeholder { color: #334155; }`}</style>
    </div>
  );
};

export default LoginPage;
