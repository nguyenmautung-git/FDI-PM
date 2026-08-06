import React, { useContext, useState, useEffect, useMemo } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { Plus, Trash2, Save, Edit2, X, Check, ChevronDown, ChevronUp, ShieldOff, ShieldCheck, Eye, Pencil, Trash, Lock, Users2, Info, RotateCcw, AlertTriangle, ClipboardList, FileX } from 'lucide-react';
import { db } from '../firebase';
import { collection, query, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { format } from 'date-fns';
import { LIST_CONFIGS } from '../data';
import { ROLES } from '../constants';

// ── Access Denied ──────────────────────────────────────────────────────────
const AccessDenied = () => (
  <div style={{
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    minHeight: '60vh', textAlign: 'center', padding: '2rem',
  }}>
    <div style={{
      width: '80px', height: '80px', borderRadius: '50%',
      background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem',
    }}>
      <ShieldOff size={36} style={{ color: '#ef4444' }} />
    </div>
    <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>
      Không có quyền truy cập
    </h2>
    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: '360px', lineHeight: '1.7' }}>
      Trang <strong>Cài đặt hệ thống</strong> chỉ dành cho Quản trị viên.<br />
      Liên hệ Admin nếu bạn cần thay đổi cấu hình.
    </p>
  </div>
);

// ── List section ───────────────────────────────────────────────────────────
const ListSettingsSection = ({ config, listData, addListItem, editListItem, deleteListItem, initialExpanded = false }) => {
  const [newValue, setNewValue] = useState('');
  const [editingId, setEditingId] = useState(null);
  const [editName, setEditName] = useState('');
  const [isExpanded, setIsExpanded] = useState(initialExpanded);

  const handleAdd = () => {
    if (newValue.trim()) { addListItem(config.collectionName, newValue.trim()); setNewValue(''); }
  };
  const handleEdit = (item) => { setEditingId(item.id); setEditName(item.name); };
  const saveEdit = () => {
    if (editName.trim() && editingId) { editListItem(config.collectionName, editingId, editName.trim()); setEditingId(null); }
  };

  return (
    <section style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '0.5rem' }} onClick={() => setIsExpanded(!isExpanded)}>
        <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>{config.name}</h3>
        <button style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {isExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {isExpanded && (
        <div style={{ marginTop: '1rem' }}>
          <p style={{ fontSize: '0.875rem', color: 'var(--color-text-muted)', marginBottom: '1rem' }}>{config.description}</p>

          {/* Add form (Admin only — already inside Admin-only gate) */}
          <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem', maxWidth: '400px' }}>
            <input
              type="text" className="input-field"
              placeholder={`Nhập ${config.name.toLowerCase()} mới...`}
              value={newValue} onChange={(e) => setNewValue(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleAdd()}
            />
            <button className="btn btn-primary" onClick={handleAdd} style={{ padding: '0.5rem 1rem' }}>
              <Plus size={18} /> Thêm
            </button>
          </div>

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            {listData && listData.map((item) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', backgroundColor: 'var(--color-bg-surface-hover)', padding: '0.5rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
                {editingId === item.id ? (
                  <>
                    <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} style={{ border: '1px solid var(--color-border)', borderRadius: '4px', padding: '2px 4px' }} autoFocus />
                    <button onClick={saveEdit} style={{ background: 'none', border: 'none', color: 'var(--color-success)', cursor: 'pointer' }}><Check size={16} /></button>
                    <button onClick={() => setEditingId(null)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer' }}><X size={16} /></button>
                  </>
                ) : (
                  <>
                    <span style={{ fontWeight: '500' }}>{item.name}</span>
                    <div style={{ display: 'flex', gap: '0.25rem', marginLeft: '0.5rem' }}>
                      <button onClick={() => handleEdit(item)} style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', padding: '2px' }}><Edit2 size={14} /></button>
                      <button onClick={() => deleteListItem(config.collectionName, item.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '2px' }}><Trash2 size={14} /></button>
                    </div>
                  </>
                )}
              </div>
            ))}
            {(!listData || listData.length === 0) && (
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>Chưa có dữ liệu.</span>
            )}
          </div>
        </div>
      )}
    </section>
  );
};

// ── Project Role Matrix ─────────────────────────────────────────────────────
const PERMISSION_GROUPS = [
  {
    group: 'Tài liệu & Dự án',
    icon: '📁',
    perms: [
      { key: 'view_docs',    label: 'Xem tài liệu & dự án' },
      { key: 'add_docs',     label: 'Thêm tài liệu mới' },
      { key: 'edit_docs',    label: 'Sửa / Xóa tài liệu' },
    ],
  },
  {
    group: 'Pháp lý & Tiến độ',
    icon: '⚖️',
    perms: [
      { key: 'view_steps',   label: 'Xem bước pháp lý / tiến độ' },
      { key: 'add_steps',    label: 'Thêm bước mới' },
      { key: 'edit_steps',   label: 'Sửa / Xóa bước' },
      { key: 'reorder',      label: 'Kéo-thả sắp xếp thứ tự' },
      { key: 'upload_att',   label: 'Upload tệp đính kèm' },
    ],
  },
  {
    group: 'Đấu thầu & Nhà thầu',
    icon: '📋',
    perms: [
      { key: 'view_bidding', label: 'Xem kế hoạch LCNT' },
      { key: 'edit_bidding', label: 'Thêm / Sửa / Xóa gói thầu' },
      { key: 'view_contractor', label: 'Xem lựa chọn nhà thầu' },
      { key: 'edit_contractor', label: 'Cập nhật trạng thái nhà thầu' },
    ],
  },
  {
    group: 'Nghiệm thu & Thanh toán',
    icon: '✅',
    perms: [
      { key: 'view_acceptance', label: 'Xem nghiệm thu' },
      { key: 'edit_acceptance', label: 'Thêm / Sửa / Xóa bước nghiệm thu' },
      { key: 'view_payment',    label: 'Xem thanh toán' },
      { key: 'update_payment',  label: 'Cập nhật trạng thái thanh toán' },
    ],
  },
  {
    group: 'Danh mục lỗi',
    icon: '⚠️',
    perms: [
      { key: 'view_defects', label: 'Xem danh mục lỗi' },
      { key: 'edit_defects', label: 'Thêm / Sửa / Xóa lỗi & Thẻ' },
    ],
  },
  {
    group: 'Quản trị (Admin only)',
    icon: '🔒',
    perms: [
      { key: 'manage_members',  label: 'Quản lý thành viên CĐT' },
      { key: 'manage_partners', label: 'Quản lý đối tác' },
      { key: 'system_settings', label: 'Cài đặt hệ thống' },
    ],
  },
];

const DEFAULT_MATRIX = {
  'Giám đốc DA': {
    view_docs: true,  add_docs: true,  edit_docs: true,
    view_steps: true, add_steps: true, edit_steps: true, reorder: true, upload_att: true,
    view_bidding: true, edit_bidding: true, view_contractor: true, edit_contractor: true,
    view_acceptance: true, edit_acceptance: true, view_payment: true, update_payment: true,
    view_defects: true, edit_defects: true,
    manage_members: false, manage_partners: false, system_settings: false,
  },
  'Chuyên viên': {
    view_docs: true,  add_docs: true,  edit_docs: false,
    view_steps: true, add_steps: true, edit_steps: false, reorder: false, upload_att: true,
    view_bidding: true, edit_bidding: false, view_contractor: true, edit_contractor: true,
    view_acceptance: true, edit_acceptance: false, view_payment: true, update_payment: false,
    view_defects: true, edit_defects: false,
    manage_members: false, manage_partners: false, system_settings: false,
  },
  'Thư ký DA': {
    view_docs: true,  add_docs: false, edit_docs: false,
    view_steps: true, add_steps: false, edit_steps: false, reorder: false, upload_att: false,
    view_bidding: true, edit_bidding: false, view_contractor: true, edit_contractor: false,
    view_acceptance: true, edit_acceptance: false, view_payment: true, update_payment: false,
    view_defects: true, edit_defects: false,
    manage_members: false, manage_partners: false, system_settings: false,
  },
};

const getRoleColors = (roleName) => {
  const name = (roleName || '').toLowerCase();
  if (name.includes('giám đốc') || name.includes('gd') || name.includes('pm') || name.includes('chủ trì') || name.includes('admin')) {
    return { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.4)', text: '#818cf8' };
  }
  if (name.includes('thư ký') || name.includes('trợ lý')) {
    return { bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.35)', text: '#fbbf24' };
  }
  return { bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.35)', text: '#34d399' };
};

const ProjectRoleMatrix = () => {
  const { projectRoleMatrix, saveProjectRoleMatrix, globalLists } = useContext(DocumentContext);
  const [expanded, setExpanded] = useState(true);
  const [matrix, setMatrix] = useState({});
  const [saved, setSaved] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState({});

  const rolesList = useMemo(() => {
    if (globalLists?.projectRoles && globalLists.projectRoles.length > 0) {
      return globalLists.projectRoles.map(item => item.name);
    }
    return Object.keys(projectRoleMatrix || {});
  }, [globalLists, projectRoleMatrix]);

  useEffect(() => {
    if (projectRoleMatrix) {
      setMatrix(projectRoleMatrix);
    }
  }, [projectRoleMatrix]);

  const toggleGroup = (gi) => {
    setCollapsedGroups(prev => ({
      ...prev,
      [gi]: !prev[gi]
    }));
  };

  const toggle = (role, permKey) => {
    setMatrix(prev => {
      const rolePerms = prev[role] || {};
      return {
        ...prev,
        [role]: { ...rolePerms, [permKey]: !rolePerms[permKey] },
      };
    });
    setSaved(false);
  };

  const handleSave = async () => {
    try {
      await saveProjectRoleMatrix(matrix);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error("Lỗi khi lưu ma trận vai trò:", error);
    }
  };

  const countGranted = (role) => {
    if (!matrix[role]) return 0;
    return Object.values(matrix[role]).filter(Boolean).length;
  };

  const totalPerms = useMemo(() => {
    if (!matrix || Object.keys(matrix).length === 0) return 0;
    const firstRole = Object.keys(matrix)[0];
    if (!firstRole || !matrix[firstRole]) return 0;
    return Object.values(matrix[firstRole]).length;
  }, [matrix]);

  if (!rolesList || rolesList.length === 0) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
        Đang tải danh sách vai trò...
      </div>
    );
  }

  return (
    <section style={{ paddingBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', marginBottom: '1.5rem' }}>
      {/* Header */}
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '0.5rem' }}
        onClick={() => setExpanded(v => !v)}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
          <ShieldCheck size={20} color="#818cf8" />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Ma trận Vai trò Dự án</h3>
          <span style={{
            fontSize: '0.68rem', padding: '2px 8px', borderRadius: '20px',
            background: 'rgba(99,102,241,0.15)', color: '#818cf8', fontWeight: '600', border: '1px solid rgba(99,102,241,0.3)',
          }}>BETA</span>
        </div>
        <button style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
          {expanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
        </button>
      </div>

      {expanded && (
        <div style={{ marginTop: '1rem' }}>
          {/* Info banner */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: '0.6rem', padding: '0.75rem 1rem',
            background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.2)',
            borderRadius: '10px', marginBottom: '1.5rem', fontSize: '0.82rem', color: 'var(--color-text-muted)', lineHeight: '1.6',
          }}>
            <Info size={15} style={{ color: '#60a5fa', flexShrink: 0, marginTop: '2px' }} />
            <span>
              Ma trận này định nghĩa quyền của từng <strong style={{ color: 'var(--color-text-main)' }}>vai trò trong dự án</strong>. Danh sách vai trò được cấu hình tại tab Danh mục hệ thống và được cập nhật tự động tại đây.
            </span>
          </div>

          {/* Role summary badges */}
          <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            {rolesList.map(role => {
              const c = getRoleColors(role);
              const granted = countGranted(role);
              return (
                <div key={role} style={{
                  display: 'flex', alignItems: 'center', gap: '0.5rem',
                  padding: '0.5rem 1rem', borderRadius: '10px',
                  background: c.bg, border: `1px solid ${c.border}`,
                }}>
                  <Users2 size={14} color={c.text} />
                  <span style={{ fontWeight: '700', fontSize: '0.85rem', color: c.text }}>{role}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                    {granted}/{totalPerms} quyền
                  </span>
                </div>
              );
            })}
          </div>

          {/* Matrix table */}
          <div style={{ overflowX: 'auto', borderRadius: '12px', border: '1px solid var(--color-border)' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', minWidth: '580px' }}>
              <thead>
                <tr style={{ background: 'var(--color-bg-surface-hover)' }}>
                  <th style={{ padding: '0.75rem 1rem', textAlign: 'left', fontSize: '0.78rem', fontWeight: '700', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', width: '44%' }}>
                    Tính năng
                  </th>
                  {rolesList.map(role => {
                    const c = getRoleColors(role);
                    return (
                      <th key={role} style={{ padding: '0.75rem 0.5rem', textAlign: 'center', fontSize: '0.78rem', fontWeight: '700', color: c.text, width: `${56 / rolesList.length}%` }}>
                        {role}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {PERMISSION_GROUPS.map((group, gi) => {
                  const isCollapsed = collapsedGroups[gi];
                  return [
                    // Group header row
                    <tr
                      key={`g-${gi}`}
                      onClick={() => toggleGroup(gi)}
                      style={{
                        background: 'rgba(255,255,255,0.03)',
                        cursor: 'pointer',
                        transition: 'background 0.15s',
                      }}
                      onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.06)'}
                      onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
                    >
                      <td colSpan={rolesList.length + 1} style={{
                        padding: '0.6rem 1rem', fontSize: '0.75rem', fontWeight: '700',
                        color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em',
                        borderTop: gi > 0 ? '1px solid var(--color-border)' : 'none',
                        userSelect: 'none',
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span>{group.icon} {group.group}</span>
                          <span style={{ display: 'flex', alignItems: 'center', opacity: 0.7 }}>
                            {isCollapsed ? <ChevronDown size={14} /> : <ChevronUp size={14} />}
                          </span>
                        </div>
                      </td>
                    </tr>,
                    // Permission rows
                    ...(!isCollapsed ? group.perms.map((perm, pi) => {
                      const isAdminOnly = group.group.includes('Admin only');
                      return (
                        <tr
                          key={perm.key}
                          style={{
                            borderTop: '1px solid rgba(255,255,255,0.04)',
                            background: pi % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
                            transition: 'background 0.15s',
                          }}
                        >
                          <td style={{ padding: '0.6rem 1rem', fontSize: '0.84rem', color: 'var(--color-text-main)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                              {isAdminOnly && <Lock size={11} color="#ef4444" />}
                              {perm.label}
                            </div>
                          </td>
                          {rolesList.map(role => {
                            const granted = matrix[role] ? matrix[role][perm.key] : false;
                            const c = getRoleColors(role);
                            // Admin-only perms are always locked off for project roles
                            const locked = isAdminOnly;
                            return (
                              <td key={role} style={{ textAlign: 'center', padding: '0.6rem 0.5rem' }}>
                                <button
                                  onClick={() => !locked && toggle(role, perm.key)}
                                  title={locked ? 'Chỉ dành cho Admin hệ thống' : (granted ? 'Đang bật — nhấn để tắt' : 'Đang tắt — nhấn để bật')}
                                  style={{
                                    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                                    width: '28px', height: '28px', borderRadius: '8px', border: 'none',
                                    cursor: locked ? 'not-allowed' : 'pointer',
                                    background: locked
                                      ? 'rgba(148,163,184,0.08)'
                                      : granted ? c.bg : 'rgba(148,163,184,0.08)',
                                    outline: granted && !locked ? `1.5px solid ${c.border}` : '1.5px solid transparent',
                                    transition: 'all 0.18s',
                                    opacity: locked ? 0.45 : 1,
                                  }}
                                >
                                  {locked
                                    ? <Lock size={13} color="#64748b" />
                                    : granted
                                      ? <Check size={14} color={c.text} strokeWidth={2.5} />
                                      : <X size={13} color="#64748b" />
                                  }
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      );
                    }) : [])
                  ];
                })}
              </tbody>
            </table>
          </div>

          {/* Save button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
            <button
              className="btn btn-primary"
              onClick={handleSave}
              style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: '140px', justifyContent: 'center' }}
            >
              {saved ? <><Check size={16} /> Đã lưu!</> : <><Save size={16} /> Lưu cấu hình</>}
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

const Settings = () => {
  const { globalLists, addListItem, editListItem, deleteListItem, userRole, allDocuments, restoreDocument, permanentDeleteDocument } = useContext(DocumentContext);
  const [activeTab, setActiveTab] = useState('projectRoles');
  const [displayExpanded, setDisplayExpanded] = useState(true);
  const [auditLogs, setAuditLogs] = useState([]);

  // Load audit logs khi chuyển sang tab Nhật ký
  useEffect(() => {
    if (activeTab !== 'auditLog') return;
    const q = query(collection(db, 'auditLogs'), orderBy('timestamp', 'desc'), limit(100));
    const unsub = onSnapshot(q, (snap) => {
      setAuditLogs(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return unsub;
  }, [activeTab]);

  // Guard: User không được vào trang này
  if (false && userRole !== ROLES.ADMIN) return <AccessDenied />;

  return (
    <div className="card" style={{ padding: '1.5rem', minHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', marginBottom: '1.5rem' }}>Cài đặt hệ thống</h2>

      {/* Tabs navigation */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--color-border)',
        marginBottom: '2rem',
        gap: '1.5rem',
        overflowX: 'auto',
        paddingBottom: '2px'
      }}>
        <button
          onClick={() => setActiveTab('projectRoles')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'projectRoles' ? '2.5px solid #818cf8' : '2.5px solid transparent',
            color: activeTab === 'projectRoles' ? '#818cf8' : 'var(--color-text-muted)',
            padding: '0.75rem 0.5rem',
            fontSize: '0.92rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <ShieldCheck size={18} />
          Vai trò & Phân quyền
        </button>

        <button
          onClick={() => setActiveTab('lists')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'lists' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'lists' ? '#818cf8' : 'var(--color-text-muted)',
            padding: '0.75rem 0.5rem',
            fontSize: '0.92rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <Users2 size={18} />
          Danh mục hệ thống
        </button>

        <button
          onClick={() => setActiveTab('display')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            background: 'none',
            border: 'none',
            borderBottom: activeTab === 'display' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'display' ? '#818cf8' : 'var(--color-text-muted)',
            padding: '0.75rem 0.5rem',
            fontSize: '0.92rem',
            fontWeight: '600',
            cursor: 'pointer',
            transition: 'all 0.2s',
            whiteSpace: 'nowrap'
          }}
        >
          <Eye size={18} />
          Giao diện &amp; Hiển thị
        </button>

        <button
          onClick={() => setActiveTab('trash')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none',
            borderBottom: activeTab === 'trash' ? '2px solid #f87171' : '2px solid transparent',
            color: activeTab === 'trash' ? '#f87171' : 'var(--color-text-muted)',
            padding: '0.75rem 0.5rem', fontSize: '0.92rem', fontWeight: '600',
            cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}
        >
          <Trash2 size={18} />
          Thùng rác
          {(allDocuments || []).filter(d => d.isDeleted).length > 0 && (
            <span style={{ background: '#ef4444', color: 'white', borderRadius: '999px', padding: '1px 7px', fontSize: '0.72rem', fontWeight: '700' }}>
              {(allDocuments || []).filter(d => d.isDeleted).length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('auditLog')}
          style={{
            display: 'flex', alignItems: 'center', gap: '0.5rem',
            background: 'none', border: 'none',
            borderBottom: activeTab === 'auditLog' ? '2px solid #818cf8' : '2px solid transparent',
            color: activeTab === 'auditLog' ? '#818cf8' : 'var(--color-text-muted)',
            padding: '0.75rem 0.5rem', fontSize: '0.92rem', fontWeight: '600',
            cursor: 'pointer', transition: 'all 0.2s', whiteSpace: 'nowrap'
          }}
        >
          <ClipboardList size={18} />
          Nhật ký hoạt động
        </button>

      </div>{/* /tabs nav */}

      {/* Tab contents */}
      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'projectRoles' && (
          <ProjectRoleMatrix />
        )}

        {activeTab === 'lists' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            {LIST_CONFIGS.map((config, index) => (
              <ListSettingsSection
                key={config.key}
                config={config}
                listData={globalLists[config.key]}
                addListItem={addListItem}
                editListItem={editListItem}
                deleteListItem={deleteListItem}
                initialExpanded={index === 0}
              />
            ))}
          </div>
        )}

        {activeTab === 'display' && (
          <section style={{ marginTop: '0.5rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', marginBottom: '1.5rem', borderBottom: '1px solid var(--color-border)', paddingBottom: '0.5rem' }} onClick={() => setDisplayExpanded(!displayExpanded)}>
              <h3 style={{ fontSize: '1.1rem', fontWeight: '600', margin: 0 }}>Cài đặt Hiển thị</h3>
              <button style={{ background: 'none', border: 'none', color: 'var(--color-text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center' }}>
                {displayExpanded ? <ChevronUp size={20} /> : <ChevronDown size={20} />}
              </button>
            </div>
            {displayExpanded && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem', maxWidth: '400px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Giao diện mặc định</label>
                  <select className="input-field">
                    <option>Sáng (Mặc định)</option>
                    <option>Tối (Đang phát triển)</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Chế độ xem danh sách mặc định</label>
                  <select className="input-field">
                    <option>Dạng Lưới (Grid)</option>
                    <option>Dạng Bảng (List)</option>
                  </select>
                </div>
                <button className="btn btn-primary" style={{ alignSelf: 'flex-start', marginTop: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <Save size={18} /> Lưu Cài đặt
                </button>
              </div>
            )}
          </section>
        )}

        {activeTab === 'trash' && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <AlertTriangle size={20} style={{ color: '#f87171' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>Thùng rác tài liệu</h3>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>— Tài liệu sẽ bị xóa vĩnh viễn sau 30 ngày</span>
            </div>
            {(allDocuments || []).filter(d => d.isDeleted).length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                <FileX size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p>Thùng rác trống</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {(allDocuments || []).filter(d => d.isDeleted).map(d => {
                  const deletedDaysAgo = d.deletedAt
                    ? Math.floor((Date.now() - new Date(d.deletedAt)) / (1000 * 60 * 60 * 24))
                    : 0;
                  const daysLeft = 30 - deletedDaysAgo;
                  return (
                    <div key={d.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.875rem 1.25rem',
                      background: 'rgba(239,68,68,0.05)', border: '1px solid rgba(239,68,68,0.2)',
                      borderRadius: 'var(--radius-md)',
                    }}>
                      <div>
                        <div style={{ fontWeight: '600', color: 'var(--color-text-main)', fontSize: '0.9rem' }}>
                          {d.documentNumber || d.documentCode || d.id}
                        </div>
                        <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', marginTop: '0.2rem' }}>
                          Xóa bởi {d.deletedBy || 'unknown'} &nbsp;·&nbsp;
                          {d.deletedAt ? format(new Date(d.deletedAt), 'dd/MM/yyyy') : ''} &nbsp;·&nbsp;
                          <span style={{ color: daysLeft <= 7 ? '#f87171' : 'inherit' }}>
                            Còn {daysLeft} ngày trước khi xóa vĩnh viễn
                          </span>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '0.5rem' }}>
                        <button
                          onClick={() => restoreDocument(d.id)}
                          title="Khôi phục tài liệu"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.4rem 0.85rem', borderRadius: '8px',
                            background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(59,130,246,0.3)',
                            color: '#60a5fa', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                          }}
                        >
                          <RotateCcw size={14} /> Khôi phục
                        </button>
                        <button
                          onClick={() => {
                            if (window.confirm(`Xóa vĩnh viễn "${d.documentNumber || d.id}"? Hành động này không thể hoàn tác.`)) {
                              permanentDeleteDocument(d.id);
                            }
                          }}
                          title="Xóa vĩnh viễn"
                          style={{
                            display: 'flex', alignItems: 'center', gap: '0.4rem',
                            padding: '0.4rem 0.85rem', borderRadius: '8px',
                            background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)',
                            color: '#f87171', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer',
                          }}
                        >
                          <Trash2 size={14} /> Xóa hẳn
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {activeTab === 'auditLog' && (
          <section>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.5rem' }}>
              <ClipboardList size={20} style={{ color: '#818cf8' }} />
              <h3 style={{ fontSize: '1.05rem', fontWeight: '600', margin: 0 }}>Nhật ký hoạt động</h3>
              <span style={{ color: 'var(--color-text-muted)', fontSize: '0.82rem' }}>— 100 thao tác gần nhất</span>
            </div>
            {auditLogs.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--color-text-muted)' }}>
                <ClipboardList size={48} style={{ opacity: 0.3, marginBottom: '1rem' }} />
                <p>Chưa có nhật ký nào</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                {auditLogs.map(log => {
                  const ACTION_LABELS = {
                    add_document:     { label: 'Thêm tài liệu',      color: '#34d399' },
                    edit_document:    { label: 'Sửa tài liệu',       color: '#60a5fa' },
                    delete_document:  { label: 'Xóa (mềm)',          color: '#f87171' },
                    restore_document: { label: 'Khôi phục',          color: '#818cf8' },
                    permanent_delete: { label: 'Xóa vĩnh viễn',      color: '#ef4444' },
                    download_file:    { label: 'Tải file',           color: '#fbbf24' },
                    mark_read_all:    { label: 'Đánh dấu đã đọc tất cả', color: '#94a3b8' },
                  };
                  const info = ACTION_LABELS[log.action] || { label: log.action, color: '#94a3b8' };
                  const ts = log.timestamp?.toDate?.() || (log.timestamp ? new Date(log.timestamp) : null);
                  return (
                    <div key={log.id} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '0.65rem 1rem',
                      background: 'var(--color-bg-surface)', border: '1px solid var(--color-border)',
                      borderRadius: '8px', fontSize: '0.82rem',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                        <span style={{
                          background: `${info.color}22`, color: info.color,
                          borderRadius: '6px', padding: '2px 8px', fontSize: '0.75rem', fontWeight: '700',
                          whiteSpace: 'nowrap',
                        }}>
                          {info.label}
                        </span>
                        <span style={{ color: 'var(--color-text-main)', fontWeight: '500' }}>
                          {log.documentNumber || log.documentId || ''}
                          {log.fileName ? ` / ${log.fileName}` : ''}
                        </span>
                      </div>
                      <div style={{ color: 'var(--color-text-muted)', whiteSpace: 'nowrap', marginLeft: '1rem' }}>
                        <span style={{ color: 'var(--color-text-main)' }}>{log.userName || log.userId}</span>
                        &nbsp;·&nbsp;
                        {ts ? format(ts, 'dd/MM/yyyy HH:mm') : ''}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>
        )}
      </div>
    </div>
  );
};

export default Settings;
