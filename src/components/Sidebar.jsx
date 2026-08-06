import React, { useState, useContext } from 'react';
import { ROLES } from '../constants';
import { FolderOpen, LayoutDashboard, FileText, Settings, Users, HelpCircle, Briefcase, Building2, Package, ChevronDown, ChevronRight, ClipboardList, Scale, Clock, BarChart3, HardHat, CheckSquare, AlertCircle, UserCheck, PanelLeftClose, PanelLeftOpen, CreditCard, Smartphone } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';

const Sidebar = ({ currentView, setCurrentView }) => {
  const { userRole, canViewDefects } = useContext(DocumentContext);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [openSection, setOpenSection] = useState(null);

  const handleToggleSection = (section) => {
    if (isCollapsed) {
      setIsCollapsed(false);
      setOpenSection(section);
    } else {
      setOpenSection(openSection === section ? null : section);
    }
  };

  return (
    <aside className="sidebar" style={{ width: isCollapsed ? '80px' : '260px', alignItems: isCollapsed ? 'center' : 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: isCollapsed ? 'column' : 'row', alignItems: 'center', justifyContent: isCollapsed ? 'center' : 'space-between', gap: isCollapsed ? '1rem' : '10px', marginBottom: '2rem', width: '100%' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
          <svg viewBox="0 0 160 60" style={{ width: '44px', height: 'auto', flexShrink: 0 }}>
            <g transform="skewX(-18)">
              <rect x="15" y="5" width="40" height="50" rx="4" fill="#0284c7"/>
              <text x="35" y="41" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="34" fill="#ffffff" textAnchor="middle">F</text>
              <rect x="60" y="5" width="40" height="50" rx="4" fill="#f97316"/>
              <text x="80" y="41" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="34" fill="#ffffff" textAnchor="middle">D</text>
              <rect x="105" y="5" width="40" height="50" rx="4" fill="#22c55e"/>
              <text x="125" y="41" fontFamily="Arial, Helvetica, sans-serif" fontWeight="900" fontStyle="italic" fontSize="34" fill="#ffffff" textAnchor="middle">I</text>
            </g>
          </svg>
          {!isCollapsed && <h2 style={{ fontSize: '1.15rem', fontWeight: '700', color: 'var(--color-text-main)', lineHeight: '1.2', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden' }}>FDI PM</h2>}
        </div>
        <button onClick={() => setIsCollapsed(!isCollapsed)} style={{ color: 'var(--color-text-muted)', cursor: 'pointer', flexShrink: 0, padding: '4px', borderRadius: '4px', display: 'flex', border: 'none', background: 'transparent' }} title={isCollapsed ? "Mở rộng" : "Thu gọn"}>
          {isCollapsed ? <PanelLeftOpen size={20} /> : <PanelLeftClose size={20} />}
        </button>
      </div>

      <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', flex: 1, width: '100%', overflowX: 'hidden' }}>
        <NavItem icon={<LayoutDashboard size={20} style={{ flexShrink: 0 }} />} label="Tổng quan" active={currentView === 'overview'} onClick={() => setCurrentView('overview')} isCollapsed={isCollapsed} />

        <NavAccordion label="Thông tin dự án" icon={<FolderOpen size={20} style={{ flexShrink: 0 }} />} isOpen={openSection === 'info'} onToggle={() => handleToggleSection('info')} isCollapsed={isCollapsed}>
          <NavItem icon={<Briefcase size={20} style={{ flexShrink: 0 }} />} label="Dự án" active={currentView === 'projects'} onClick={() => setCurrentView('projects')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<FileText size={20} style={{ flexShrink: 0 }} />} label="Tài liệu" active={currentView === 'dashboard'} onClick={() => setCurrentView('dashboard')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<Smartphone size={20} style={{ flexShrink: 0, color: '#60a5fa' }} />} label="Tra cứu Mobile" active={currentView === 'mobileDocs'} onClick={() => setCurrentView('mobileDocs')} isChild isCollapsed={isCollapsed} />
        </NavAccordion>

        <NavAccordion label="Công tác đấu thầu" icon={<Briefcase size={20} style={{ flexShrink: 0 }} />} isOpen={openSection === 'bidding'} onToggle={() => handleToggleSection('bidding')} isCollapsed={isCollapsed}>
          <NavItem icon={<ClipboardList size={20} style={{ flexShrink: 0 }} />} label="Kế hoạch LCNT" active={currentView === 'biddingPlan'} onClick={() => setCurrentView('biddingPlan')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<UserCheck size={20} style={{ flexShrink: 0 }} />} label="Lựa chọn nhà thầu" active={currentView === 'contractorSelection'} onClick={() => setCurrentView('contractorSelection')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<Package size={20} style={{ flexShrink: 0 }} />} label="Danh mục gói thầu" active={currentView === 'bidding'} onClick={() => setCurrentView('bidding')} isChild isCollapsed={isCollapsed} />
        </NavAccordion>

        <NavAccordion label="Quản lý dự án" icon={<BarChart3 size={20} style={{ flexShrink: 0 }} />} isOpen={openSection === 'management'} onToggle={() => handleToggleSection('management')} isCollapsed={isCollapsed}>
          <NavItem icon={<Scale size={20} style={{ flexShrink: 0 }} />} label="Pháp lý" active={currentView === 'phapLy'} onClick={() => setCurrentView('phapLy')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<Clock size={20} style={{ flexShrink: 0 }} />} label="Tiến độ" active={currentView === 'tienDo'} onClick={() => setCurrentView('tienDo')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<BarChart3 size={20} style={{ flexShrink: 0 }} />} label="Khối lượng & chất lượng" active={currentView === 'khoiLuong'} onClick={() => setCurrentView('khoiLuong')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<HardHat size={20} style={{ flexShrink: 0 }} />} label="ATLĐ & VSMT" active={currentView === 'atld'} onClick={() => setCurrentView('atld')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<CheckSquare size={20} style={{ flexShrink: 0 }} />} label="Nghiệm thu - Thanh quyết toán" active={currentView === 'nghiemThu'} onClick={() => setCurrentView('nghiemThu')} isChild isCollapsed={isCollapsed} />
          <NavItem icon={<CreditCard size={20} style={{ flexShrink: 0 }} />} label="Thanh toán" active={currentView === 'payment'} onClick={() => setCurrentView('payment')} isChild isCollapsed={isCollapsed} />
          {(userRole === ROLES.ADMIN || canViewDefects()) && (
            <NavItem icon={<AlertCircle size={20} style={{ flexShrink: 0 }} />} label="Danh mục lỗi" active={currentView === 'danhMucLoi'} onClick={() => setCurrentView('danhMucLoi')} isChild isCollapsed={isCollapsed} />
          )}
        </NavAccordion>

        {/* Quản trị — chỉ Admin */}
        {true && (
          <NavAccordion label="Quản trị" icon={<Settings size={20} style={{ flexShrink: 0 }} />} isOpen={openSection === 'admin'} onToggle={() => handleToggleSection('admin')} isCollapsed={isCollapsed}>
            <NavItem icon={<Users size={20} style={{ flexShrink: 0 }} />} label="Thành viên CĐT" active={currentView === 'members'} onClick={() => setCurrentView('members')} isChild isCollapsed={isCollapsed} />
            <NavItem icon={<Building2 size={20} style={{ flexShrink: 0 }} />} label="Đối tác" active={currentView === 'partners'} onClick={() => setCurrentView('partners')} isChild isCollapsed={isCollapsed} />
            <NavItem icon={<Settings size={20} style={{ flexShrink: 0 }} />} label="Cài đặt" active={currentView === 'settings'} onClick={() => setCurrentView('settings')} isChild isCollapsed={isCollapsed} />
          </NavAccordion>
        )}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: '1rem', borderTop: '1px solid var(--color-border)', width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        <NavItem icon={<HelpCircle size={20} style={{ flexShrink: 0 }} />} label="Trợ giúp" active={currentView === 'help'} onClick={() => setCurrentView('help')} isCollapsed={isCollapsed} />
      </div>
    </aside>
  );
};

const NavAccordion = ({ label, icon, isOpen, onToggle, isCollapsed, children }) => {
  return (
    <div style={{ marginTop: '0.25rem' }}>
      <a href="#" onClick={(e) => { e.preventDefault(); onToggle(); }} style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: isCollapsed ? 'center' : 'space-between',
        padding: isCollapsed ? '10px' : '10px 12px',
        borderRadius: 'var(--radius-md)',
        color: isOpen && !isCollapsed ? 'var(--color-primary)' : 'var(--color-text-muted)',
        fontWeight: '600',
        textDecoration: 'none',
        transition: 'all var(--transition-fast)',
        backgroundColor: isOpen && !isCollapsed ? 'var(--color-bg-surface-hover)' : 'transparent'
      }} title={isCollapsed ? label : undefined}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {icon}
          {!isCollapsed && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
        </div>
        {!isCollapsed && (isOpen ? <ChevronDown size={16} style={{ flexShrink: 0 }} /> : <ChevronRight size={16} style={{ flexShrink: 0 }} />)}
      </a>
      {isOpen && !isCollapsed && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', marginTop: '0.25rem', paddingLeft: '1.5rem' }}>
          {children}
        </div>
      )}
    </div>
  );
};

const NavItem = ({ icon, label, active, onClick, isChild = false, isCollapsed = false }) => (
  <a href="#" onClick={(e) => { e.preventDefault(); onClick && onClick(); }} style={{
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    justifyContent: isCollapsed ? 'center' : 'flex-start',
    padding: isCollapsed ? '10px' : (isChild ? '8px 12px' : '10px 12px'),
    borderRadius: 'var(--radius-md)',
    color: active ? 'var(--color-primary)' : 'var(--color-text-muted)',
    backgroundColor: active && !isChild ? 'var(--color-bg-surface-hover)' : 'transparent',
    fontWeight: active ? '600' : '500',
    fontSize: isChild ? '0.9rem' : '1rem',
    textDecoration: 'none',
    transition: 'all var(--transition-fast)'
  }} title={isCollapsed ? label : undefined}>
    {icon}
    {!isCollapsed && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{label}</span>}
  </a>
);

export default Sidebar;
