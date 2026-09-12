import React, { useContext, useState, useRef, useEffect, useMemo } from 'react';
import { ROLES } from '../constants';
import { Search, Bell, Plus, User, FileText, X, LogOut, Camera, FolderOpen, Smartphone, ArrowLeft, Home, AlertTriangle, Check, CheckCheck, Trash2 } from 'lucide-react';
import { format } from 'date-fns';
import { vi } from 'date-fns/locale';
import { signOut } from 'firebase/auth';
import { auth } from '../firebase';
import { DocumentContext } from '../context/DocumentContext';
import ProfileModal from './ProfileModal';
import { useToast } from '../context/UIContext';

const Header = ({ currentView, onOpenForm, onNavigate, onGoBack, onGoHome, onSearchSelect }) => {
  const { 
    getNewCount, 
    markAsRead, 
    isDocNew, 
    documents, 
    projects, 
    members, 
    userRole, 
    toggleRole, 
    canAddDocument,
    userNotifications = [],
    markNotificationAsRead,
    markAllNotificationsAsRead,
    deleteNotification
  } = useContext(DocumentContext);
  const [showNoti, setShowNoti] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const notiRef = useRef(null);
  const userMenuRef = useRef(null);
  const searchRef = useRef(null);

  const toast = useToast();
  const newCount = typeof getNewCount === 'function' ? getNewCount() : 0;
  const unreadNotifs = useMemo(() => (userNotifications || []).filter(n => !n.isRead), [userNotifications]);
  const totalNotiBadge = newCount + unreadNotifs.length;

  const formatNotiDate = (createdAt) => {
    if (!createdAt) return '';
    try {
      const date = createdAt.toDate ? createdAt.toDate() : new Date(createdAt);
      if (isNaN(date.getTime())) return '';
      return format(date, 'dd/MM/yyyy HH:mm', { locale: vi });
    } catch {
      return '';
    }
  };

  // Lấy thông tin người dùng đang đăng nhập
  const firebaseUser = auth.currentUser;
  const displayName  = firebaseUser?.displayName || 'Người dùng';
  const email        = firebaseUser?.email        || '';
  // Tìm member document để lấy avatar
  const currentMember = members?.find(m => m.email === email) || null;

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (notiRef.current && !notiRef.current.contains(event.target)) setShowNoti(false);
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) setShowUserMenu(false);
      if (searchRef.current && !searchRef.current.contains(event.target)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ── Lắng nghe cảnh báo tài liệu sắp hết hiệu lực (dispatch từ DocumentContext)
  useEffect(() => {
    const handler = (e) => {
      const { count } = e.detail || {};
      if (count > 0) {
        toast.warning(`⚠️ ${count} tài liệu sắp hết hiệu lực trong 30 ngày tới!`);
      }
    };
    window.addEventListener('doc:expiry-warning', handler);
    return () => window.removeEventListener('doc:expiry-warning', handler);
  }, []);

  // ── Tìm kiếm toàn cục ───────────────────────────────────────────────────
  const searchResults = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q || q.length < 2) return { docs: [], projects: [] };

    const docs = (documents || []).filter(d =>
      (d.documentCode || '').toLowerCase().includes(q) ||
      (d.documentNumber || '').toLowerCase().includes(q) ||
      (d.summary || '').toLowerCase().includes(q) ||
      (d.issuingAgency || '').toLowerCase().includes(q)
    ).slice(0, 5);

    const projs = (projects || []).filter(p =>
      (p.name || '').toLowerCase().includes(q) ||
      (p.code || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    ).slice(0, 3);

    return { docs, projects: projs };
  }, [searchQuery, documents, projects]);

  const hasResults = searchResults.docs.length > 0 || searchResults.projects.length > 0;

  const handleSearchSelect = (type, data, view) => {
    onSearchSelect?.({ type, data });
    onNavigate?.(view);
    setSearchQuery('');
    setShowSearch(false);
  };

  const handleNotiClick = () => {
    setShowNoti(!showNoti);
    setShowUserMenu(false);
    if (!showNoti && newCount > 0) markAsRead();
  };

  const handleUserMenuClick = () => {
    setShowUserMenu(!showUserMenu);
    setShowNoti(false);
  };

  const handleLogout = async () => {
    await signOut(auth);
    // onAuthStateChanged in App.jsx sẽ tự chuyển về LoginPage
  };

  return (
    <header className="header">
      {/* ── Nút Back & Home điều hướng nhanh ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
        <button
          type="button"
          className="btn-icon"
          onClick={onGoBack}
          title="Quay lại trang trước (Phím Back / Backspace)"
          style={{
            padding: '0.45rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface-hover)',
            color: 'var(--color-text-main)',
            border: '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <ArrowLeft size={18} />
        </button>

        <button
          type="button"
          className="btn-icon"
          onClick={onGoHome}
          title="Về trang chủ (Phím Home)"
          style={{
            padding: '0.45rem',
            borderRadius: 'var(--radius-md)',
            backgroundColor: 'var(--color-bg-surface-hover)',
            color: currentView === 'overview' ? 'var(--color-primary)' : 'var(--color-text-main)',
            border: currentView === 'overview' ? '1px solid rgba(59,130,246,0.4)' : '1px solid var(--color-border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s'
          }}
        >
          <Home size={18} />
        </button>
      </div>

      {/* ── Ô tìm kiếm toàn cục ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flex: 1, maxWidth: '500px' }} ref={searchRef}>
        <div style={{ position: 'relative', width: '100%' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Tìm kiếm tài liệu, dự án..."
            className="input-field"
            value={searchQuery}
            onChange={e => { setSearchQuery(e.target.value); setShowSearch(true); }}
            onFocus={() => setShowSearch(true)}
            onKeyDown={e => { if (e.key === 'Escape') { setSearchQuery(''); setShowSearch(false); } }}
            style={{ paddingLeft: '36px', paddingRight: searchQuery ? '32px' : '12px', borderRadius: 'var(--radius-full)', backgroundColor: 'var(--color-bg-surface-hover)', border: showSearch && hasResults ? '1px solid rgba(59,130,246,0.4)' : 'none', transition: 'border 0.15s' }}
          />
          {searchQuery && (
            <button onClick={() => { setSearchQuery(''); setShowSearch(false); }}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', padding: '2px' }}>
              <X size={14} />
            </button>
          )}

          {/* Dropdown kết quả */}
          {showSearch && searchQuery.length >= 2 && (
            <div style={{
              position: 'absolute', top: 'calc(100% + 8px)', left: 0, right: 0,
              background: 'var(--color-bg-surface)',
              border: '1px solid var(--color-border)',
              borderRadius: '14px', overflow: 'hidden',
              boxShadow: '0 16px 48px rgba(0,0,0,0.4)',
              zIndex: 999, minWidth: '360px',
            }}>
              {!hasResults ? (
                <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
                  Không tìm thấy kết quả cho &ldquo;<strong>{searchQuery}</strong>&rdquo;
                </div>
              ) : (
                <>
                  {/* Documents */}
                  {searchResults.docs.length > 0 && (
                    <div>
                      <div style={{ padding: '0.6rem 1rem 0.3rem', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Tài liệu
                      </div>
                      {searchResults.docs.map(doc => (
                        <button key={doc.id}
                          onClick={() => handleSearchSelect('document', doc, 'dashboard')}
                          style={{ width: '100%', textAlign: 'left', padding: '0.65rem 1rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'flex-start', gap: '0.75rem', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-surface-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <FileText size={16} style={{ color: 'var(--color-primary)', marginTop: '2px', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.83rem', fontWeight: '600', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              Số: {doc.documentNumber}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', marginTop: '1px' }}>
                              {doc.summary}
                            </div>
                          </div>
                          <span style={{ fontSize: '0.68rem', color: 'var(--color-primary)', background: 'rgba(59,130,246,0.1)', borderRadius: '6px', padding: '2px 6px', whiteSpace: 'nowrap', flexShrink: 0 }}>{doc.documentCode}</span>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Projects */}
                  {searchResults.projects.length > 0 && (
                    <div style={{ borderTop: searchResults.docs.length > 0 ? '1px solid var(--color-border)' : 'none' }}>
                      <div style={{ padding: '0.6rem 1rem 0.3rem', fontSize: '0.7rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                        Dự án
                      </div>
                      {searchResults.projects.map(p => (
                        <button key={p.id}
                          onClick={() => handleSearchSelect('project', p, 'projects')}
                          style={{ width: '100%', textAlign: 'left', padding: '0.65rem 1rem', background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.75rem', transition: 'background 0.1s' }}
                          onMouseEnter={e => e.currentTarget.style.background = 'var(--color-bg-surface-hover)'}
                          onMouseLeave={e => e.currentTarget.style.background = 'none'}
                        >
                          <FolderOpen size={16} style={{ color: '#a78bfa', flexShrink: 0 }} />
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '0.83rem', fontWeight: '600', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {p.name}
                            </div>
                            {p.code && <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>{p.code}</div>}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Footer */}
                  <div style={{ padding: '0.5rem 1rem', borderTop: '1px solid var(--color-border)', background: 'var(--color-bg-surface-hover)' }}>
                    <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Nhấn <kbd style={{ background: 'rgba(255,255,255,0.1)', border: '1px solid var(--color-border)', borderRadius: '4px', padding: '0 4px', fontSize: '0.68rem' }}>Esc</kbd> để đóng</span>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem' }}>
        <button 
          className="btn btn-outline" 
          onClick={() => onNavigate && onNavigate('mobileDocs')}
          title="Chuyển sang giao diện tra cứu trên di động (iPhone/PWA)"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#60a5fa', borderColor: 'rgba(96, 165, 250, 0.4)' }}
        >
          <Smartphone size={16} />
          <span>Mobile App</span>
        </button>

        {/* Notifications */}
        <div style={{ position: 'relative' }} ref={notiRef}>
          <button className="btn-icon" onClick={handleNotiClick} style={{ position: 'relative' }}>
            <Bell size={22} />
            {totalNotiBadge > 0 && (
              <span style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                minWidth: '18px',
                height: '18px',
                padding: '0 4px',
                backgroundColor: 'var(--color-danger)',
                borderRadius: '10px',
                border: '2px solid var(--color-bg-surface)',
                color: 'white',
                fontSize: '0.65rem',
                fontWeight: '700',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}>
                {totalNotiBadge > 99 ? '99+' : totalNotiBadge}
              </span>
            )}
          </button>
          {showNoti && (
            <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '10px', width: '360px', backgroundColor: 'var(--color-bg-surface)', backdropFilter: 'blur(16px)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)', zIndex: 100, padding: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.85rem' }}>
                <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: '700' }}>Thông báo</h4>
                {unreadNotifs.length > 0 && (
                  <button
                    onClick={() => markAllNotificationsAsRead && markAllNotificationsAsRead()}
                    style={{ background: 'none', border: 'none', color: '#60a5fa', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '3px', padding: 0 }}
                  >
                    <CheckCheck size={13} /> Đã đọc tất cả
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', maxHeight: '360px', overflowY: 'auto' }}>
                
                {/* ── THÔNG BÁO TỪ CHỐI TÀI LIỆU ── */}
                {userNotifications && userNotifications.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginBottom: '0.5rem' }}>
                    <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: '#f87171', letterSpacing: '0.5px' }}>
                      Phản hồi từ chối ({unreadNotifs.length} chưa đọc)
                    </span>
                    {userNotifications.slice(0, 6).map(n => (
                      <div
                        key={n.id}
                        onClick={() => markNotificationAsRead && markNotificationAsRead(n.id)}
                        style={{
                          padding: '10px 12px',
                          borderRadius: '8px',
                          backgroundColor: n.isRead ? 'rgba(255,255,255,0.03)' : 'rgba(239, 68, 68, 0.12)',
                          border: n.isRead ? '1px solid var(--color-border)' : '1px solid rgba(239, 68, 68, 0.35)',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '4px',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '6px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <AlertTriangle size={14} color="#ef4444" style={{ flexShrink: 0 }} />
                            <span style={{ fontSize: '0.82rem', fontWeight: '700', color: n.isRead ? 'var(--color-text-main)' : '#fca5a5' }}>
                              {n.title || `Tài liệu ${n.documentNumber || n.documentCode} bị từ chối`}
                            </span>
                          </div>
                          <button
                            onClick={(e) => { e.stopPropagation(); deleteNotification && deleteNotification(n.id); }}
                            title="Xóa thông báo này"
                            style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px' }}
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', paddingLeft: '20px' }}>
                          <strong>Lý do:</strong> <span style={{ color: '#fca5a5' }}>{n.reason}</span>
                        </div>
                        <div style={{ fontSize: '0.72rem', color: '#94a3b8', paddingLeft: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '2px' }}>
                          <span>{n.senderName ? `Duyệt bởi: ${n.senderName}` : ''}</span>
                          <span>{formatNotiDate(n.createdAt)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── TÀI LIỆU MỚI ĐĂNG TẢI ── */}
                {(() => {
                  const unreadDocs = (documents || [])
                    .filter(d => !d.isDeleted && (isDocNew ? isDocNew(d.id) : d.isNew))
                    .slice(0, 5);

                  if (unreadDocs.length === 0 && (!userNotifications || userNotifications.length === 0)) {
                    return (
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', textAlign: 'center', padding: '1.5rem 0' }}>
                        Tất cả thông báo đã đọc ✓
                      </p>
                    );
                  }

                  if (unreadDocs.length === 0) return null;

                  return (
                    <div>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', textTransform: 'uppercase', color: 'var(--color-primary)', letterSpacing: '0.5px', display: 'block', marginBottom: '6px' }}>
                        Tài liệu mới ({unreadDocs.length})
                      </span>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {unreadDocs.map(doc => (
                          <div key={doc.id} style={{ display: 'flex', gap: '10px', padding: '8px 10px', borderRadius: '8px', border: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface-hover)' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'var(--color-primary-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', flexShrink: 0 }}>
                              <FileText size={15} />
                            </div>
                            <div>
                              <p style={{ fontSize: '0.82rem', margin: '0', color: 'var(--color-text-main)' }}>
                                <span style={{ fontWeight: '600' }}>{doc.uploader || doc.createdByName}</span> vừa tải: <strong>{doc.documentNumber}</strong>
                              </p>
                              <span style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>Mã: {doc.documentCode}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

              </div>
            </div>
          )}
        </div>

        {/* User menu */}
        <div style={{ position: 'relative' }} ref={userMenuRef}>
          <div onClick={handleUserMenuClick} style={{ display: 'flex', alignItems: 'center', gap: '10px', borderLeft: '1px solid var(--color-border)', paddingLeft: '1.5rem', cursor: 'pointer' }}>
            {/* Avatar */}
            <div style={{
              width: '36px', height: '36px', borderRadius: '50%', overflow: 'hidden',
              backgroundColor: 'var(--color-bg-surface-hover)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--color-primary)',
              backgroundImage: currentMember?.avatar ? `url(${currentMember.avatar})` : 'none',
              backgroundSize: 'cover', backgroundPosition: 'center',
            }}>
              {!currentMember?.avatar && <User size={20} />}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '0.875rem', fontWeight: '600' }}>{displayName}</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{userRole}</span>
            </div>
          </div>

          {showUserMenu && (
            <div style={{ position: 'absolute', top: '100%', right: '0', marginTop: '10px', width: '340px', backgroundColor: 'var(--color-bg-surface)', backdropFilter: 'blur(20px)', borderRadius: '24px', boxShadow: 'var(--shadow-lg)', border: '1px solid var(--color-border)', zIndex: 100, overflow: 'hidden' }}>
              {/* Top bar */}
              <div style={{ display: 'flex', justifyContent: 'center', padding: '16px 16px 8px', position: 'relative' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--color-text-main)', fontWeight: '500' }}>{email}</span>
                <button onClick={() => setShowUserMenu(false)} style={{ position: 'absolute', right: '16px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}>
                  <X size={20} />
                </button>
              </div>

              {/* Avatar + name */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 20px 20px' }}>
                <div style={{ position: 'relative' }}>
                  <div style={{
                    width: '80px', height: '80px', borderRadius: '50%',
                    backgroundColor: 'var(--color-bg-surface-hover)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'var(--color-primary)', border: '1px solid var(--color-border)',
                    backgroundImage: currentMember?.avatar ? `url(${currentMember.avatar})` : 'none',
                    backgroundSize: 'cover', backgroundPosition: 'center',
                  }}>
                    {!currentMember?.avatar && <User size={40} />}
                  </div>
                  <div style={{ position: 'absolute', bottom: '0', right: '0', width: '26px', height: '26px', borderRadius: '50%', backgroundColor: 'var(--color-bg-surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', border: '1px solid var(--color-border)', color: 'var(--color-text-main)' }}>
                    <Camera size={14} />
                  </div>
                </div>
                <h3 style={{ margin: '16px 0 8px', fontSize: '1.25rem', fontWeight: '400', color: 'var(--color-text-main)' }}>
                  Xin chào, {displayName.split(' ').slice(-1)[0]}!
                </h3>
                <button
                  onClick={() => { setShowProfile(true); setShowUserMenu(false); }}
                  style={{ background: 'transparent', border: '1px solid var(--color-border)', borderRadius: '100px', padding: '8px 16px', fontSize: '0.875rem', color: 'var(--color-text-main)', cursor: 'pointer', fontWeight: '500' }}
                >
                  Xem hồ sơ cá nhân
                </button>
              </div>

              {/* Actions */}
              <div style={{ backgroundColor: 'var(--color-bg-surface-hover)', borderRadius: '24px 24px 0 0', padding: '8px 0 0' }}>
                {/* Toggle role (debug, admin only) */}
                {userRole === ROLES.ADMIN && (
                  <div onClick={() => { if (typeof toggleRole === 'function') toggleRole(); setShowUserMenu(false); }} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 24px', cursor: 'pointer', borderBottom: '1px solid var(--color-border)' }}>
                    <div style={{ width: '36px', height: '36px', borderRadius: '50%', backgroundColor: '#ea4335', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 'bold', fontSize: '1.2rem' }}>U</div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.875rem', fontWeight: '500', color: 'var(--color-text-main)' }}>Xem giao diện User</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Chỉ Admin thấy tuỳ chọn này</span>
                    </div>
                  </div>
                )}

                {/* Logout */}
                <div
                  onClick={handleLogout}
                  style={{ display: 'flex', alignItems: 'center', gap: '16px', padding: '14px 24px', cursor: 'pointer', color: '#ef4444' }}
                >
                  <LogOut size={20} />
                  <span style={{ fontSize: '0.875rem', fontWeight: '500' }}>Đăng xuất</span>
                </div>
              </div>

              <div style={{ padding: '12px', display: 'flex', justifyContent: 'center', gap: '12px', fontSize: '0.75rem', color: 'var(--color-text-muted)', backgroundColor: 'var(--color-bg-surface)' }}>
                <span style={{ cursor: 'pointer' }}>Chính sách bảo mật</span>
                <span>•</span>
                <span style={{ cursor: 'pointer' }}>Điều khoản dịch vụ</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Profile modal for current user */}
      {showProfile && (
        <ProfileModal
          member={currentMember}
          onClose={() => setShowProfile(false)}
        />
      )}
    </header>
  );
};

export default Header;
