import React, { useContext, useMemo } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { FileText, Briefcase, Users, TrendingUp, Calendar, Activity } from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';

const VIBRANT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

const Overview = () => {
  const { documents, projects, members } = useContext(DocumentContext);

  const totalDocs = documents.length;
  const totalProjects = projects.length;
  const totalMembers = members.length;
  
  const thirtyDaysAgo = subDays(new Date(), 30);
  const newDocsCount = documents.filter(doc => new Date(doc.createdAt) >= thirtyDaysAgo).length;

  const docsByTypeData = useMemo(() => {
    const counts = {};
    documents.forEach(doc => {
      const type = doc.documentType || 'Khác';
      counts[type] = (counts[type] || 0) + 1;
    });
    return Object.keys(counts).map(key => ({
      name: key,
      value: counts[key]
    })).sort((a, b) => b.value - a.value);
  }, [documents]);

  const docsByProjectData = useMemo(() => {
    const counts = {};
    documents.forEach(doc => {
      if (doc.relatedProjects && doc.relatedProjects.length > 0) {
        doc.relatedProjects.forEach(proj => {
          counts[proj] = (counts[proj] || 0) + 1;
        });
      } else {
        counts['Không gán'] = (counts['Không gán'] || 0) + 1;
      }
    });
    return Object.keys(counts).map(key => ({
      name: key,
      TàiLiệu: counts[key]
    })).sort((a, b) => b.TàiLiệu - a.TàiLiệu).slice(0, 5);
  }, [documents]);

  const recentDocuments = documents.slice(0, 5);

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      return (
        <div style={{ backgroundColor: 'rgba(30, 41, 59, 0.9)', backdropFilter: 'blur(8px)', padding: '12px 16px', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', color: 'white' }}>
          <p style={{ margin: '0 0 4px 0', fontWeight: '600', fontSize: '0.9rem' }}>{payload[0].name}</p>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: payload[0].payload.fill || payload[0].color || 'var(--color-primary)' }} />
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'rgba(255,255,255,0.8)' }}>Số lượng: <span style={{ fontWeight: '700', color: 'white' }}>{payload[0].value}</span></p>
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem', height: '100%', overflowY: 'auto', paddingRight: '0.5rem', paddingBottom: '2rem' }}>
      
      {/* Header */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-20px', left: '-20px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
        <h1 style={{ position: 'relative', fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '0.5rem', letterSpacing: '-0.5px', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={28} color="var(--color-primary)" />
          Tổng quan Hệ thống
        </h1>
        <p style={{ position: 'relative', color: 'var(--color-text-muted)', fontSize: '0.95rem', zIndex: 1 }}>
          Xem nhanh các chỉ số và hoạt động mới nhất của dự án.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1.5rem' }}>
        <KpiCard title="Tổng số Dự án" value={totalProjects} icon={<Briefcase size={26} />} gradient="linear-gradient(135deg, #3b82f6, #2563eb)" shadowColor="rgba(59, 130, 246, 0.4)" />
        <KpiCard title="Tổng số Tài liệu" value={totalDocs} icon={<FileText size={26} />} gradient="linear-gradient(135deg, #10b981, #059669)" shadowColor="rgba(16, 185, 129, 0.4)" />
        <KpiCard title="Tài liệu mới (30 ngày)" value={newDocsCount} icon={<TrendingUp size={26} />} gradient="linear-gradient(135deg, #f59e0b, #d97706)" shadowColor="rgba(245, 158, 11, 0.4)" />
        <KpiCard title="Thành sự" value={totalMembers} icon={<Users size={26} />} gradient="linear-gradient(135deg, #8b5cf6, #6d28d9)" shadowColor="rgba(139, 92, 246, 0.4)" />
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(400px, 1fr))', gap: '1.5rem' }}>
        
        {/* Pie Chart */}
        <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1.5rem', zIndex: 1 }}>Phân bổ Tài liệu theo Loại</h3>
          <div style={{ flex: 1, minHeight: '320px', zIndex: 1 }}>
            {docsByTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={docsByTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={80}
                    outerRadius={110}
                    paddingAngle={6}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={8}
                  >
                    {docsByTypeData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={VIBRANT_COLORS[index % VIBRANT_COLORS.length]} style={{ filter: `drop-shadow(0px 4px 6px ${VIBRANT_COLORS[index % VIBRANT_COLORS.length]}40)` }} />
                    ))}
                  </Pie>
                  <RechartsTooltip content={<CustomTooltip />} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.85rem', opacity: 0.9 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--color-text-muted)' }}>Chưa có dữ liệu</div>
            )}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="card" style={{ padding: '1.75rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '200px', height: '200px', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700', marginBottom: '1.5rem', zIndex: 1 }}>Top 5 Dự án nhiều Tài liệu</h3>
          <div style={{ flex: 1, minHeight: '320px', zIndex: 1 }}>
             {docsByProjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={docsByProjectData}
                  margin={{ top: 20, right: 20, left: -20, bottom: 5 }}
                  barSize={36}
                >
                  <defs>
                    {docsByProjectData.map((entry, index) => (
                      <linearGradient key={`grad-${index}`} id={`colorBar-${index}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={VIBRANT_COLORS[index % VIBRANT_COLORS.length]} stopOpacity={1}/>
                        <stop offset="100%" stopColor={VIBRANT_COLORS[index % VIBRANT_COLORS.length]} stopOpacity={0.3}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
                  <XAxis dataKey="name" tick={{fontSize: 11, fill: 'var(--color-text-muted)'}} tickLine={false} axisLine={{stroke: 'rgba(255,255,255,0.1)'}} />
                  <YAxis tickLine={false} axisLine={false} tick={{fontSize: 11, fill: 'var(--color-text-muted)'}} />
                  <RechartsTooltip cursor={{fill: 'rgba(255,255,255,0.03)'}} content={<CustomTooltip />} />
                  <Bar dataKey="TàiLiệu" radius={[6, 6, 0, 0]}>
                    {docsByProjectData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={`url(#colorBar-${index})`} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
             ) : (
                <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--color-text-muted)' }}>Chưa có dữ liệu</div>
             )}
          </div>
        </div>
      </div>

      {/* Recent Activities */}
      <div className="card" style={{ padding: '1.75rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', bottom: 0, right: 0, width: '300px', height: '300px', background: 'radial-gradient(circle, rgba(16,185,129,0.03) 0%, rgba(0,0,0,0) 70%)', zIndex: 0, pointerEvents: 'none' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', zIndex: 1, position: 'relative' }}>
          <h3 style={{ fontSize: '1.15rem', fontWeight: '700' }}>Tài liệu vừa cập nhật</h3>
        </div>
        
        {recentDocuments.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem', zIndex: 1, position: 'relative' }}>
            {recentDocuments.map((doc, i) => (
              <div key={doc.id} style={{ 
                display: 'flex', alignItems: 'center', gap: '1.25rem', padding: '1rem 1.25rem', 
                borderRadius: '12px', backgroundColor: 'var(--color-bg-surface-hover)',
                border: '1px solid transparent',
                transition: 'all 0.2s',
                cursor: 'pointer',
              }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'; e.currentTarget.style.transform = 'translateX(4px)'; }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'transparent'; e.currentTarget.style.transform = 'none'; }}
              >
                <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: 'rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#60a5fa', flexShrink: 0 }}>
                  <FileText size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', marginBottom: '0.25rem' }}>
                    <h4 style={{ fontWeight: '600', margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)' }}>{doc.documentNumber}</h4>
                    {doc.documentType && <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)' }}>{doc.documentType}</span>}
                  </div>
                  <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.85rem', display: '-webkit-box', WebkitLineClamp: 1, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {doc.summary}
                  </p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem', flexShrink: 0, backgroundColor: 'rgba(0,0,0,0.2)', padding: '4px 10px', borderRadius: '20px' }}>
                  <Calendar size={13} />
                  {format(new Date(doc.createdAt || doc.effectiveDate), 'dd/MM/yyyy', { locale: vi })}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p style={{ color: 'var(--color-text-muted)', textAlign: 'center', padding: '2rem 0', zIndex: 1, position: 'relative' }}>Chưa có hoạt động nào.</p>
        )}
      </div>

    </div>
  );
};

const KpiCard = ({ title, value, icon, gradient, shadowColor }) => (
  <div className="card" style={{ 
    padding: '1.5rem', 
    display: 'flex', 
    alignItems: 'center', 
    gap: '1.25rem', 
    transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
    cursor: 'default',
    position: 'relative',
    overflow: 'hidden'
  }}
       onMouseOver={(e) => { 
         e.currentTarget.style.transform = 'translateY(-4px)'; 
         e.currentTarget.style.boxShadow = `0 12px 24px -8px ${shadowColor}`; 
         e.currentTarget.style.borderColor = shadowColor.replace('0.4', '0.3');
       }}
       onMouseOut={(e) => { 
         e.currentTarget.style.transform = 'none'; 
         e.currentTarget.style.boxShadow = 'var(--shadow-sm)'; 
         e.currentTarget.style.borderColor = 'var(--color-border)';
       }}>
    <div style={{ 
      position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', background: gradient 
    }} />
    <div style={{ 
      width: '56px', height: '56px', borderRadius: '16px', 
      background: gradient, color: 'white', 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      flexShrink: 0,
      boxShadow: `0 8px 16px -4px ${shadowColor}`
    }}>
      {icon}
    </div>
    <div>
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem', fontWeight: '600', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</p>
      <h3 style={{ margin: 0, fontSize: '1.85rem', fontWeight: '800', color: 'var(--color-text-main)', letterSpacing: '-0.5px' }}>{value}</h3>
    </div>
  </div>
);

export default Overview;
