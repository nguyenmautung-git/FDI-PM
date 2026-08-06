import React, { useState, useContext, useEffect } from 'react';
import { Package, Plus, Edit, Trash2, Search, Filter, X } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { useConfirm } from '../context/UIContext';

const BiddingPackages = () => {
  const { biddingPackages = [], projects, deleteBiddingPackage, enableLazy } = useContext(DocumentContext);
  useEffect(() => { enableLazy(); }, [enableLazy]);
  const confirm = useConfirm();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterProject, setFilterProject] = useState('All');
  const [filterStatus, setFilterStatus] = useState('All');

  const filteredPackages = (biddingPackages || []).filter(pkg => {
    const matchSearch = pkg.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                        pkg.code.toLowerCase().includes(searchTerm.toLowerCase());
    const matchProject = filterProject === 'All' || pkg.projectId?.toString() === filterProject;
    const matchStatus = filterStatus === 'All' || pkg.status === filterStatus;
    return matchSearch && matchProject && matchStatus;
  });

  const totalBudget = filteredPackages.reduce((acc, pkg) => {
    const num = parseFloat((pkg.budget || '0').replace(/,/g, ''));
    return acc + (isNaN(num) ? 0 : num);
  }, 0);
  const totalBudgetFormatted = totalBudget.toLocaleString('en-US');

  const orphanedPackages = (biddingPackages || []).filter(pkg => !projects.find(p => p.id.toString() === pkg.projectId?.toString()));

  const handleCleanup = async () => {
    const ok = await confirm(`Bạn có chắc chắn muốn xóa vĩnh viễn ${orphanedPackages.length} gói thầu lỗi (N/A) không?`);
    if (ok) orphanedPackages.forEach(pkg => { deleteBiddingPackage(null, pkg.id); });
  };

  const getStatusBadge = (status) => {
    switch(status) {
      case 'Đang mời thầu': return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--color-warning)', color: '#000', fontSize: '0.75rem', fontWeight: '500' }}>{status}</span>;
      case 'Đang chấm thầu': return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--color-primary-light)', color: 'white', fontSize: '0.75rem', fontWeight: '500' }}>{status}</span>;
      case 'Đã có kết quả': return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--color-success)', color: 'white', fontSize: '0.75rem', fontWeight: '500' }}>{status}</span>;
      case 'Đã hủy': return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--color-danger)', color: 'white', fontSize: '0.75rem', fontWeight: '500' }}>{status}</span>;
      default: return <span style={{ padding: '0.25rem 0.5rem', borderRadius: '4px', backgroundColor: 'var(--color-border)', fontSize: '0.75rem', fontWeight: '500' }}>{status}</span>;
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', boxSizing: 'border-box' }}>
      <div style={{ flexShrink: 0, padding: '1.5rem 1.5rem 0 1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.5rem' }}>Danh sách Gói thầu</h1>
            <p style={{ color: 'var(--color-text-muted)' }}>Quản lý {(biddingPackages || []).length} gói thầu trên hệ thống</p>
          </div>
          {orphanedPackages.length > 0 && (
            <button onClick={handleCleanup} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', backgroundColor: 'var(--color-danger)', color: 'white', border: 'none', borderRadius: '8px', cursor: 'pointer', fontWeight: '600' }}>
              <Trash2 size={16} /> Xóa {orphanedPackages.length} gói thầu lỗi (N/A)
            </button>
          )}
        </div>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <div style={{ position: 'relative', flex: '1', minWidth: '250px' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--color-text-light)' }} />
          <input 
            type="text" 
            placeholder="Tìm theo mã hoặc tên gói thầu..." 
            className="input-field"
            style={{ paddingLeft: '36px', margin: 0 }}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <select className="input-field" style={{ width: 'auto', margin: 0 }} value={filterProject} onChange={(e) => setFilterProject(e.target.value)}>
            <option value="All">Tất cả dự án</option>
            {projects.map(p => (
              <option key={p.id} value={p.id}>{p.code || p.name}</option>
            ))}
          </select>
          <select className="input-field" style={{ width: 'auto', margin: 0 }} value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="All">Tất cả trạng thái</option>
            <option value="Đang mời thầu">Đang mời thầu</option>
            <option value="Đang chấm thầu">Đang chấm thầu</option>
            <option value="Đã có kết quả">Đã có kết quả</option>
          </select>
        </div>
      </div>
    </div>

    <div style={{ flex: 1, overflowY: 'auto', padding: '0 1.5rem 1.5rem 1.5rem', minHeight: 0 }}>
        <div style={{ backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', height: '100%', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '800px' }}>
            <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: '#1e293b', borderBottom: '2px solid var(--color-border)' }}>
              <tr>
                <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--color-text-muted)', width: '150px' }}>Mã gói thầu</th>
                <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--color-text-muted)' }}>Tên gói thầu</th>
                <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--color-text-muted)', width: '250px' }}>Dự án</th>
                <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--color-text-muted)', width: '200px' }}>Dự toán (VNĐ)</th>
                <th style={{ padding: '1rem', fontWeight: '600', color: 'var(--color-text-muted)', width: '180px' }}>Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {filteredPackages.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                    Không tìm thấy gói thầu nào.
                  </td>
                </tr>
              ) : (
                filteredPackages.map(pkg => {
                  const project = projects.find(p => p.id.toString() === pkg.projectId?.toString());
                  return (
                    <tr 
                      key={pkg.id} 
                      style={{ borderBottom: '1px solid var(--color-border)', transition: 'background-color 0.2s' }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-bg-surface-hover)'}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                    >
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{pkg.code}</td>
                      <td style={{ padding: '1rem' }}>
                        <div style={{ fontWeight: '600', color: 'var(--color-primary)' }}>{pkg.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '4px' }}>{pkg.type} • {pkg.selectionMethod}</div>
                      </td>
                      <td style={{ padding: '1rem', color: 'var(--color-text-muted)' }}>{project ? project.name : 'N/A'}</td>
                      <td style={{ padding: '1rem', fontWeight: '500' }}>{pkg.budget}</td>
                      <td style={{ padding: '1rem' }}>{getStatusBadge(pkg.status)}</td>
                    </tr>
                  )
                })
              )}
            </tbody>
            <tfoot style={{ position: 'sticky', bottom: 0, zIndex: 10, backgroundColor: '#1e293b', borderTop: '2px solid var(--color-border)' }}>
              <tr>
                <td colSpan="3" style={{ padding: '1rem', fontWeight: '700', textAlign: 'right', color: 'var(--color-text-main)' }}>Tổng cộng dự toán:</td>
                <td colSpan="2" style={{ padding: '1rem', fontWeight: '700', color: 'var(--color-primary)' }}>{totalBudgetFormatted} VNĐ</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>
    </div>
  );
};

export default BiddingPackages;
