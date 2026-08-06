import React, { useState, useContext, useEffect } from 'react';
import { ROLES } from '../constants';
import { UserPlus, Mail, Phone, Shield, Star, X, Share2, ShieldOff } from 'lucide-react';
import { EMPLOYEE_LEVELS } from '../data';
import { DocumentContext } from '../context/DocumentContext';
import { useConfirm } from '../context/UIContext';

import ProfileModal from './ProfileModal';
import InviteUserModal from './InviteUserModal';

const AccessDenied = () => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', textAlign: 'center', padding: '2rem' }}>
    <div style={{ width: '80px', height: '80px', borderRadius: '50%', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.5rem' }}>
      <ShieldOff size={36} style={{ color: '#ef4444' }} />
    </div>
    <h2 style={{ fontSize: '1.4rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Không có quyền truy cập</h2>
    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.9rem', maxWidth: '360px', lineHeight: '1.7' }}>
      Trang <strong>Quản lý Thành viên</strong> chỉ dành cho Quản trị viên.<br />
      Liên hệ Admin nếu bạn cần hỗ trợ.
    </p>
  </div>
);

const formatPhone = (phone) => {
  if (!phone) return '';
  const cleaned = ('' + phone).replace(/\D/g, '');
  if (cleaned.length <= 4) return cleaned;
  if (cleaned.length <= 7) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
  return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 7)} ${cleaned.slice(7)}`;
};

const Members = () => {
  const { members, addMember, editMember, deleteMember, userRole, enableLazy } = useContext(DocumentContext);
  useEffect(() => { enableLazy(); }, [enableLazy]);
  const confirm = useConfirm();

  // Guard: User không được vào trang này
  if (false && userRole !== ROLES.ADMIN) return <AccessDenied />;
  const [isAdding, setIsAdding] = useState(false);
  const [newMember, setNewMember] = useState({ name: '', email: '', phone: '', role: 'User', level: 1, avatar: '' });
  const [editingId, setEditingId] = useState(null);
  const [editFormData, setEditFormData] = useState({});
  const [viewingMember, setViewingMember] = useState(null);
  const [filters, setFilters] = useState({ keyword: '', role: '', level: '' });
  const [showInvite, setShowInvite] = useState(false);

  const handleAdd = async () => {
    if (newMember.name && newMember.email) {
      await addMember({ 
        ...newMember, 
        avatar: newMember.avatar || `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70)}`,
        locked: false
      });
      setIsAdding(false);
      setNewMember({ name: '', email: '', phone: '', role: 'User', level: 1, avatar: '' });
    }
  };

  const handleDelete = async (id) => {
    const ok = await confirm('Bạn có chắc chắn muốn xóa thành viên này?');
    if (ok) await deleteMember(id);
  };

  const handleToggleLock = async (id) => {
    const member = members.find(m => m.id === id);
    if (member) {
      await editMember(id, { ...member, locked: !member.locked });
    }
  };

  const resizeImage = (dataUrl, callback) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      let width = img.width;
      let height = img.height;
      const MAX_DIMENSION = 800;
      
      if (width > height && width > MAX_DIMENSION) {
        height *= MAX_DIMENSION / width;
        width = MAX_DIMENSION;
      } else if (height > MAX_DIMENSION) {
        width *= MAX_DIMENSION / height;
        height = MAX_DIMENSION;
      }
      
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, width, height);
      
      callback(canvas.toDataURL('image/jpeg', 0.7));
    };
    img.src = dataUrl;
  };

  const handleAvatarUpload = (e, isEdit = false) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        resizeImage(reader.result, (resizedDataUrl) => {
          if (isEdit) {
            setEditFormData(prev => ({ ...prev, avatar: resizedDataUrl }));
          } else {
            setNewMember(prev => ({ ...prev, avatar: resizedDataUrl }));
          }
        });
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditClick = (member) => {
    setEditingId(member.id);
    setEditFormData(member);
  };

  const handleUpdate = async () => {
    await editMember(editingId, editFormData);
    setEditingId(null);
  };

  const handleCancelEdit = () => {
    setEditingId(null);
  };

  const handleExportPDF = async (member) => {
    const element = document.getElementById('member-printable-area');
    if (!element) return;

    const opt = {
      margin:       10,
      filename:     `info_${member.name}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, logging: false },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    const html2pdf = (await import('html2pdf.js')).default;
    html2pdf().set(opt).from(element).save();
  };

  const filteredMembers = members.filter(m => {
    const matchKeyword = !filters.keyword || 
      (m.name && m.name.toLowerCase().includes(filters.keyword.toLowerCase())) || 
      (m.email && m.email.toLowerCase().includes(filters.keyword.toLowerCase())) ||
      (m.phone && m.phone.includes(filters.keyword));
    const matchRole = !filters.role || m.role === filters.role;
    const matchLevel = !filters.level || m.level.toString() === filters.level.toString();
    return matchKeyword && matchRole && matchLevel;
  });

  return (
    <div className="card" style={{ padding: '1.5rem', minHeight: '80vh' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: '600' }}>Quản lý Thành viên</h2>
        {userRole === ROLES.ADMIN && (
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button className="btn btn-outline" onClick={() => setShowInvite(true)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.85rem' }}>
              📨 Mời qua email
            </button>
            <button className="btn btn-primary" onClick={() => setIsAdding(!isAdding)} style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <UserPlus size={18} /> {isAdding ? 'Hủy' : 'Thêm trực tiếp'}
            </button>
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '1.25rem', marginBottom: '1.5rem', backgroundColor: 'var(--color-bg-surface)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '1rem' }}>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 180px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Từ khóa (Tên, Email, SĐT)</label>
            <input type="text" className="input-field" placeholder="Nhập từ khóa..." value={filters.keyword} onChange={(e) => setFilters({...filters, keyword: e.target.value})} />
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Vai trò</label>
            <select className="input-field" value={filters.role} onChange={(e) => setFilters({...filters, role: e.target.value})}>
              <option value="">Tất cả vai trò</option>
              <option value="Admin">Admin</option>
              <option value="User">User</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0, flex: '1 1 160px' }}>
            <label className="form-label" style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>Cấp bậc</label>
            <select className="input-field" value={filters.level} onChange={(e) => setFilters({...filters, level: e.target.value})}>
              <option value="">Tất cả cấp bậc</option>
              {EMPLOYEE_LEVELS.map(lvl => (
                <option key={lvl.id} value={lvl.id}>{lvl.shortName}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {isAdding && (
        <div style={{ marginBottom: '2rem', padding: '1rem', border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', backgroundColor: 'var(--color-bg-surface-hover)', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', alignItems: 'end' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Tên</label>
            <input type="text" className="input-field" value={newMember.name} onChange={(e) => setNewMember({...newMember, name: e.target.value})} placeholder="Nguyễn Văn X" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Email</label>
            <input type="email" className="input-field" value={newMember.email} onChange={(e) => setNewMember({...newMember, email: e.target.value})} placeholder="x@example.com" />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Số ĐT</label>
            <input type="text" className="input-field" value={newMember.phone} onChange={(e) => setNewMember({...newMember, phone: e.target.value})} placeholder="09..." />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Vai trò</label>
            <select className="input-field" value={newMember.role} onChange={(e) => setNewMember({...newMember, role: e.target.value})}>
              <option value="User">User</option>
              <option value="Admin">Admin</option>
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Cấp bậc</label>
            <select className="input-field" value={newMember.level} onChange={(e) => setNewMember({...newMember, level: Number(e.target.value)})}>
              {EMPLOYEE_LEVELS.map(lvl => (
                <option key={lvl.id} value={lvl.id}>{lvl.shortName}</option>
              ))}
            </select>
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label className="form-label">Ảnh đại diện</label>
            <input type="file" accept="image/*" className="input-field" onChange={(e) => handleAvatarUpload(e, false)} style={{ padding: '0.5rem' }} />
          </div>
          <button className="btn btn-primary" onClick={handleAdd}>Lưu</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
        {filteredMembers.map(member => (
          <div key={member.id} style={{ 
            border: '1px solid var(--color-border)', borderRadius: 'var(--radius-lg)', padding: '1.5rem', 
            display: 'flex', flexDirection: 'column', alignItems: 'center', 
            backgroundColor: member.locked ? '#f9f9f9' : 'var(--color-bg-surface-hover)', 
            opacity: member.locked ? 0.7 : 1,
            transition: 'transform var(--transition-fast), box-shadow var(--transition-fast)',
            cursor: 'pointer'
          }} 
          onDoubleClick={() => setViewingMember(member)}
          onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-4px)'; e.currentTarget.style.boxShadow = 'var(--shadow-md)'; }} 
          onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = 'none'; }}>
            
            {editingId === member.id ? (
              <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'stretch' }}>
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.5rem', textAlign: 'center' }}>Sửa thông tin</h3>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Tên</label>
                  <input type="text" className="input-field" value={editFormData.name} onChange={(e) => setEditFormData({...editFormData, name: e.target.value})} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Email</label>
                  <input type="email" className="input-field" value={editFormData.email} onChange={(e) => setEditFormData({...editFormData, email: e.target.value})} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Số ĐT</label>
                  <input type="text" className="input-field" value={editFormData.phone} onChange={(e) => setEditFormData({...editFormData, phone: e.target.value})} />
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Vai trò</label>
                  <select className="input-field" value={editFormData.role} onChange={(e) => setEditFormData({...editFormData, role: e.target.value})}>
                    <option value="User">User</option>
                    <option value="Admin">Admin</option>
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Cấp bậc</label>
                  <select className="input-field" value={editFormData.level} onChange={(e) => setEditFormData({...editFormData, level: Number(e.target.value)})}>
                    {EMPLOYEE_LEVELS.map(lvl => (
                      <option key={lvl.id} value={lvl.id}>{lvl.shortName}</option>
                    ))}
                  </select>
                </div>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label className="form-label">Ảnh đại diện mới</label>
                  <input type="file" accept="image/*" className="input-field" onChange={(e) => handleAvatarUpload(e, true)} style={{ padding: '0.5rem' }} />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleUpdate}>Lưu</button>
                  <button className="btn" style={{ flex: 1, backgroundColor: '#e2e8f0', color: '#333' }} onClick={handleCancelEdit}>Hủy</button>
                </div>
              </div>
            ) : (
              <>
                {member.locked && <div style={{ color: 'var(--color-danger)', fontSize: '0.75rem', fontWeight: 'bold', alignSelf: 'flex-end' }}>ĐÃ KHÓA</div>}
                <div style={{ width: '80px', height: '80px', borderRadius: '50%', marginBottom: '1rem', border: '3px solid white', boxShadow: 'var(--shadow-sm)', backgroundImage: `url(${member.avatar})`, backgroundSize: 'cover', backgroundPosition: 'center', flexShrink: 0 }} />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '600', marginBottom: '0.25rem' }}>{member.name}</h3>
                
                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem' }}>
                  <span style={{ 
                    backgroundColor: member.role === 'Admin' ? 'rgba(115, 169, 130, 0.15)' : 'rgba(130, 168, 209, 0.15)', 
                    color: member.role === 'Admin' ? 'var(--color-success)' : 'var(--color-primary)', 
                    padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: '600' 
                  }}>
                    {member.role}
                  </span>
                  <span title={EMPLOYEE_LEVELS.find(l => l.id === member.level)?.fullName} style={{ 
                    backgroundColor: 'rgba(240, 173, 78, 0.15)', 
                    color: '#d97706', 
                    padding: '0.25rem 0.75rem', borderRadius: '1rem', fontSize: '0.75rem', fontWeight: '600',
                    display: 'flex', alignItems: 'center', gap: '4px', cursor: 'help'
                  }}>
                    <Star size={12} /> Cấp {member.level}
                  </span>
                </div>
                
                <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.875rem', color: 'var(--color-text-muted)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Mail size={14} /> {member.email}</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Phone size={14} /> {formatPhone(member.phone)}</div>
                </div>

                {userRole === ROLES.ADMIN && (
                  <div style={{ width: '100%', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', display: 'flex', justifyContent: 'center', gap: '1rem' }}>
                    <button onClick={() => handleEditClick(member)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' }}>
                      Sửa
                    </button>
                    <button onClick={() => handleToggleLock(member.id)} style={{ background: 'none', border: 'none', color: member.locked ? 'var(--color-success)' : 'var(--color-warning)', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' }}>
                      {member.locked ? 'Mở khóa' : 'Khóa'}
                    </button>
                    <button onClick={() => handleDelete(member.id)} style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', fontWeight: '500', fontSize: '0.875rem' }}>
                      Xóa
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        ))}
      </div>

      {viewingMember && (
        <ProfileModal
          member={viewingMember}
          onClose={() => setViewingMember(null)}
          onEdit={(member) => { handleEditClick(member); }}
        />
      )}

      {showInvite && <InviteUserModal onClose={() => setShowInvite(false)} />}
    </div>
  );
};

export default Members;
