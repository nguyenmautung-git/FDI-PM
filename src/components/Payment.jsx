import React, { useState, useContext } from 'react';
import { ROLES } from '../constants';
import { DocumentContext } from '../context/DocumentContext';
import { CreditCard, CheckCircle2, Circle, Clock, ChevronDown, ChevronUp, DollarSign, FileCheck, CheckSquare, Edit2, AlertCircle } from 'lucide-react';

const PAYMENT_STAGES = [
  { id: 'advance', label: 'Tạm ứng', percentage: 20 },
  { id: 'phase1', label: 'Thanh toán đợt 1', percentage: 30 },
  { id: 'phase2', label: 'Thanh toán đợt 2', percentage: 30 },
  { id: 'final', label: 'Quyết toán', percentage: 20 },
];

const STATUS_MAP = {
  pending: { label: 'Chưa thực hiện', color: '#94a3b8', bg: 'rgba(148, 163, 184, 0.15)', icon: Circle },
  inprogress: { label: 'Đang xử lý', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.15)', icon: Clock },
  approved: { label: 'Đã duyệt', color: '#fbbf24', bg: 'rgba(245, 158, 11, 0.15)', icon: FileCheck },
  paid: { label: 'Đã chi tiền', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)', icon: CheckCircle2 },
};

const PaymentCard = ({ project, mockPayments, onUpdateStatus, isAdmin }) => {
  const [expanded, setExpanded] = useState(false);
  
  // Calculate total paid percentage
  const paidPercentage = mockPayments
    .filter(p => p.status === 'paid')
    .reduce((sum, p) => {
      const stage = PAYMENT_STAGES.find(s => s.id === p.stageId);
      return sum + (stage ? stage.percentage : 0);
    }, 0);

  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ position: 'relative', height: '120px', overflow: 'hidden', backgroundColor: 'var(--color-bg-surface-hover)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        {project.image ? (
          <img src={project.image} alt={project.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        ) : (
          <div style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)', width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
            <DollarSign size={40} opacity={0.5} />
          </div>
        )}
        <div style={{ position: 'absolute', top: '10px', left: '10px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backdropFilter: 'blur(4px)' }}>
          {project.code || 'N/A'}
        </div>
        <div style={{ position: 'absolute', top: '10px', right: '10px', backgroundColor: paidPercentage === 100 ? '#10b981' : 'rgba(0,0,0,0.6)', color: 'white', padding: '4px 10px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backdropFilter: 'blur(4px)' }}>
          Đã thanh toán: {paidPercentage}%
        </div>
      </div>

      <div style={{ padding: '1.25rem' }}>
        <h3 style={{ fontWeight: '700', fontSize: '1rem', color: 'var(--color-text-main)', marginBottom: '0.75rem' }}>{project.name}</h3>
        
        {/* Progress bar */}
        <div style={{ height: '8px', borderRadius: '4px', backgroundColor: 'var(--color-bg-surface-hover)', marginBottom: '1rem', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${paidPercentage}%`, backgroundColor: 'var(--color-success)', transition: 'width 0.5s ease' }} />
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Giá trị HĐ: {(project.id * 1500000000).toLocaleString('vi-VN')} VNĐ</span>
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', fontSize: '0.8rem', fontWeight: '600', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {expanded ? <><ChevronUp size={16} /> Thu gọn</> : <><ChevronDown size={16} /> Xem quy trình</>}
          </button>
        </div>

        {expanded && (
          <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--color-border)' }}>
            <h4 style={{ fontSize: '0.85rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text-muted)' }}>QUY TRÌNH THANH TOÁN</h4>
            
            <div style={{ position: 'relative', display: 'flex', justifyContent: 'space-between' }}>
              {/* Background line */}
              <div style={{ position: 'absolute', top: '24px', left: '10%', right: '10%', height: '2px', backgroundColor: 'var(--color-border)', zIndex: 0 }} />
              
              {PAYMENT_STAGES.map((stage, idx) => {
                const payment = mockPayments.find(p => p.stageId === stage.id) || { status: 'pending' };
                const st = STATUS_MAP[payment.status];
                const Icon = st.icon;
                
                return (
                  <div key={stage.id} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '25%', zIndex: 1 }}>
                    <div style={{ 
                      width: '48px', height: '48px', borderRadius: '50%', 
                      backgroundColor: 'var(--color-bg-surface)', border: `2px solid ${st.color}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: st.color, marginBottom: '0.75rem',
                      boxShadow: payment.status !== 'pending' ? `0 0 10px ${st.bg}` : 'none'
                    }}>
                      <Icon size={24} />
                    </div>
                    <span style={{ fontSize: '0.75rem', fontWeight: '600', textAlign: 'center', marginBottom: '4px', color: 'var(--color-text-main)' }}>{stage.label}</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)', marginBottom: '8px' }}>{stage.percentage}% giá trị</span>
                    
                    <span style={{ fontSize: '0.65rem', padding: '2px 8px', borderRadius: '10px', backgroundColor: st.bg, color: st.color, fontWeight: '600' }}>
                      {st.label}
                    </span>

                    {isAdmin && (
                      <select 
                        value={payment.status} 
                        onChange={(e) => onUpdateStatus(project.id, stage.id, e.target.value)}
                        style={{ marginTop: '8px', fontSize: '0.7rem', padding: '2px 4px', border: '1px solid var(--color-border)', borderRadius: '4px', background: 'var(--color-bg-surface)' }}
                      >
                        {Object.entries(STATUS_MAP).map(([key, val]) => (
                          <option key={key} value={key}>{val.label}</option>
                        ))}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const PaymentWorkflow = () => {
  const { projects, userRole, checkPermission } = useContext(DocumentContext);
  const isAdmin = userRole === ROLES.ADMIN;
  
  // Local mock state for payment data
  const [paymentsData, setPaymentsData] = useState(() => {
    const data = {};
    projects.forEach(p => {
      data[p.id] = [
        { stageId: 'advance', status: 'paid' },
        { stageId: 'phase1', status: 'inprogress' },
        { stageId: 'phase2', status: 'pending' },
        { stageId: 'final', status: 'pending' },
      ];
    });
    return data;
  });

  const handleUpdateStatus = (projectId, stageId, newStatus) => {
    setPaymentsData(prev => ({
      ...prev,
      [projectId]: prev[projectId].map(p => p.stageId === stageId ? { ...p, status: newStatus } : p)
    }));
  };

  return (
    <div className="fade-in" style={{ padding: '1.5rem' }}>
      <div style={{ marginBottom: '2rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', marginBottom: '0.25rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <CreditCard size={24} color="var(--color-primary)" />
          Quản lý Thanh toán (Workflow)
        </h1>
        <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
          Theo dõi quy trình thanh toán, giải ngân cho từng dự án qua các đợt thanh toán.
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(600px, 1fr))', gap: '1.5rem' }}>
        {projects.map(project => (
          <PaymentCard 
            key={project.id} 
            project={project} 
            mockPayments={paymentsData[project.id] || []}
            onUpdateStatus={handleUpdateStatus}
            isAdmin={checkPermission(project.id, 'update_payment')}
          />
        ))}
      </div>
    </div>
  );
};

export default PaymentWorkflow;
