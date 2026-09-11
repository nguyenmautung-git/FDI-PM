import React, { useState } from 'react';
import { signInWithEmailAndPassword, sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase';
import { Eye, EyeOff, AlertCircle, ArrowLeft, CheckCircle } from 'lucide-react';

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
      minHeight: '100vh',
      backgroundColor: '#f0f4fa',
      backgroundImage: 'linear-gradient(180deg, #f4f7fc 0%, #ebf1f9 100%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justify: 'center',
      padding: '24px 20px',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "Segoe UI", Roboto, sans-serif',
      boxSizing: 'border-box'
    }}>
      <div style={{ width: '100%', maxWidth: '360px' }}>

        {/* ── LOGO BADGE & BRAND TITLE ── */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          {/* Logo Badge Icon */}
          <div style={{
            width: '76px',
            height: '76px',
            borderRadius: '22px',
            backgroundColor: '#ffffff',
            boxShadow: '0 10px 30px rgba(0,0,0,0.05)',
            display: 'flex',
            alignItems: 'center',
            justify: 'center',
            marginBottom: '18px',
            border: '1px solid #f1f5f9'
          }}>
            <svg width="42" height="42" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Blue diagonal bar */}
              <rect x="17" y="7" width="8" height="15" rx="4" transform="rotate(30 17 7)" fill="#2563eb" />
              {/* Green horizontal bar */}
              <rect x="10" y="24" width="16" height="7" rx="3.5" fill="#16a34a" />
              {/* Orange diagonal pill/dot */}
              <rect x="23" y="19" width="8" height="12" rx="4" transform="rotate(-40 23 19)" fill="#ea580c" />
            </svg>
          </div>

          {/* Brand Name */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px' }}>
            <span style={{ fontSize: '1.8rem', fontWeight: '900', color: '#0f172a', letterSpacing: '-0.5px' }}>
              FDI
            </span>
            <span style={{ fontSize: '1.8rem', fontWeight: '400', color: '#334155', letterSpacing: '-0.5px' }}>
              Doc
            </span>
          </div>

          {/* Subtitle */}
          <p style={{ color: '#64748b', fontSize: '0.92rem', margin: '6px 0 28px', textAlign: 'center', fontWeight: '400' }}>
            Tra cứu & thu thập tài liệu dự án
          </p>
        </div>

        {/* ── FORM CONTAINER ── */}
        {!resetMode ? (
          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {/* Field 1: Email công việc */}
            <div>
              <label style={{ fontSize: '0.88rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Email công việc
              </label>
              <input
                type="email"
                value={email}
                autoComplete="email"
                onChange={e => { setEmail(e.target.value); setError(''); }}
                placeholder="ten@congty.vn"
                style={{
                  width: '100%',
                  backgroundColor: '#ffffff',
                  border: '1.5px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '14px 16px',
                  fontSize: '0.95rem',
                  color: '#0f172a',
                  outline: 'none',
                  boxSizing: 'border-box',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                  transition: 'border-color 0.2s ease'
                }}
                onFocus={e => e.target.style.borderColor = '#2563eb'}
                onBlur={e => e.target.style.borderColor = '#e2e8f0'}
              />
            </div>

            {/* Field 2: Mật khẩu */}
            <div>
              <label style={{ fontSize: '0.88rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '8px' }}>
                Mật khẩu
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPwd ? 'text' : 'password'}
                  value={password}
                  autoComplete="current-password"
                  onChange={e => { setPassword(e.target.value); setError(''); }}
                  placeholder="********"
                  style={{
                    width: '100%',
                    backgroundColor: '#ffffff',
                    border: '1.5px solid #e2e8f0',
                    borderRadius: '14px',
                    padding: '14px 44px 14px 16px',
                    fontSize: '0.95rem',
                    color: '#0f172a',
                    outline: 'none',
                    boxSizing: 'border-box',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.01)',
                    transition: 'border-color 0.2s ease'
                  }}
                  onFocus={e => e.target.style.borderColor = '#2563eb'}
                  onBlur={e => e.target.style.borderColor = '#e2e8f0'}
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  style={{
                    position: 'absolute',
                    right: '14px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  {showPwd ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Quên mật khẩu Link */}
            <div style={{ textAlign: 'right', marginTop: '-4px' }}>
              <button
                type="button"
                onClick={() => { setResetMode(true); setResetEmail(email); setError(''); }}
                style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.82rem', fontWeight: '600', cursor: 'pointer', padding: 0 }}
              >
                Quên mật khẩu?
              </button>
            </div>

            {/* Error Notification */}
            {error && (
              <div style={{
                display: 'flex',
                gap: '8px',
                alignItems: 'center',
                padding: '10px 14px',
                backgroundColor: '#fef2f2',
                border: '1px solid #fecaca',
                borderRadius: '12px',
                color: '#ef4444',
                fontSize: '0.85rem',
                fontWeight: '500'
              }}>
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{error}</span>
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                width: '100%',
                padding: '14px',
                border: 'none',
                borderRadius: '14px',
                backgroundColor: loading ? '#93c5fd' : '#2563eb',
                color: '#ffffff',
                fontSize: '1rem',
                fontWeight: '700',
                cursor: loading ? 'wait' : 'pointer',
                boxShadow: '0 6px 20px rgba(37,99,235,0.3)',
                marginTop: '6px',
                transition: 'background-color 0.15s ease'
              }}
            >
              {loading ? 'Đang xử lý...' : 'Đăng nhập'}
            </button>
          </form>
        ) : (
          /* ── FORGOT PASSWORD MODAL FLOW ── */
          <div style={{ backgroundColor: '#ffffff', borderRadius: '20px', padding: '24px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)', border: '1px solid #e2e8f0' }}>
            <button
              onClick={() => { setResetMode(false); setResetSent(false); setResetError(''); }}
              style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '0.85rem', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer', marginBottom: '16px', padding: 0 }}
            >
              <ArrowLeft size={16} /> Quay lại Đăng nhập
            </button>

            {!resetSent ? (
              <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#0f172a', margin: '0 0 6px' }}>Đặt lại mật khẩu</h3>
                  <p style={{ fontSize: '0.82rem', color: '#64748b', margin: 0 }}>Nhập email công việc để nhận liên kết khôi phục mật khẩu.</p>
                </div>

                <div>
                  <label style={{ fontSize: '0.85rem', fontWeight: '700', color: '#334155', display: 'block', marginBottom: '6px' }}>Email công việc</label>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => { setResetEmail(e.target.value); setResetError(''); }}
                    placeholder="ten@congty.vn"
                    style={{
                      width: '100%', backgroundColor: '#ffffff', border: '1.5px solid #e2e8f0', borderRadius: '12px', padding: '12px 14px', fontSize: '0.9rem', color: '#0f172a', outline: 'none', boxSizing: 'border-box'
                    }}
                  />
                </div>

                {resetError && (
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', color: '#ef4444', fontSize: '0.82rem' }}>
                    <AlertCircle size={16} /> {resetError}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  style={{
                    width: '100%', padding: '12px', border: 'none', borderRadius: '12px', backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.92rem', fontWeight: '700', cursor: 'pointer'
                  }}
                >
                  {resetLoading ? 'Đang gửi...' : 'Gửi liên kết khôi phục'}
                </button>
              </form>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <CheckCircle size={44} color="#16a34a" style={{ marginBottom: '12px' }} />
                <h4 style={{ fontSize: '1.05rem', fontWeight: '800', color: '#0f172a', margin: '0 0 6px' }}>Đã gửi email khôi phục!</h4>
                <p style={{ fontSize: '0.84rem', color: '#64748b', margin: '0 0 16px' }}>Vui lòng kiểm tra hộp thư đến của bạn để hoàn tất đặt lại mật khẩu.</p>
                <button
                  onClick={() => { setResetMode(false); setResetSent(false); }}
                  style={{ backgroundColor: '#2563eb', color: '#fff', border: 'none', borderRadius: '12px', padding: '10px 20px', fontWeight: '700', fontSize: '0.88rem', cursor: 'pointer' }}
                >
                  Quay lại Đăng nhập
                </button>
              </div>
            )}
          </div>
        )}

        {/* ── FOOTER NOTE ── */}
        <div style={{ textAlign: 'center', marginTop: '28px', color: '#94a3b8', fontSize: '0.85rem', fontWeight: '500' }}>
          Bản dùng thử nội bộ – dữ liệu minh hoạ
        </div>
      </div>
    </div>
  );
};

export default LoginPage;
