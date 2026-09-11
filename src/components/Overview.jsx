import React, { useContext, useMemo, useState, useEffect } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { 
  FileText, Briefcase, Users, TrendingUp, Calendar, Activity,
  AlertTriangle, Clock, ShieldAlert, CheckSquare, HardHat,
  ChevronRight, ExternalLink, ArrowUpRight, CheckCircle2,
  AlertCircle, Scale, CreditCard, Sparkles, Building2
} from 'lucide-react';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { format, subDays } from 'date-fns';
import { vi } from 'date-fns/locale';

const VIBRANT_COLORS = ['#3b82f6', '#8b5cf6', '#ec4899', '#10b981', '#f59e0b', '#06b6d4'];

const getTaskDeadlineInfo = (targetDateStr, status) => {
  if (status === 'done' || status === 'resolved') {
    return { isOverdue: false, isUpcoming: false, text: 'Đã hoàn thành', type: 'done' };
  }
  if (!targetDateStr) {
    return { isOverdue: false, isUpcoming: false, text: 'Chưa đặt hạn', type: 'none' };
  }
  
  const target = new Date(targetDateStr);
  if (isNaN(target.getTime())) {
    return { isOverdue: false, isUpcoming: false, text: 'Chưa đặt hạn', type: 'none' };
  }
  target.setHours(23, 59, 59, 999);
  
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  
  const diffDays = Math.ceil((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  
  if (diffDays < 0) {
    return {
      isOverdue: true,
      isUpcoming: false,
      diffDays: Math.abs(diffDays),
      text: `Trễ ${Math.abs(diffDays)} ngày`,
      type: 'overdue'
    };
  } else if (diffDays <= 14) {
    return {
      isOverdue: false,
      isUpcoming: true,
      diffDays,
      text: diffDays === 0 ? 'Hôm nay đến hạn' : `Còn ${diffDays} ngày`,
      type: 'upcoming'
    };
  }
  return {
    isOverdue: false,
    isUpcoming: false,
    diffDays,
    text: `Còn ${diffDays} ngày`,
    type: 'ontrack'
  };
};

const Overview = ({ onNavigate }) => {
  const { 
    documents = [], 
    projects = [], 
    members = [],
    legalSteps = [],
    scheduleSteps = [],
    acceptanceSteps = [],
    atldIssues = [],
    defectLibrary = [],
    defectTabs = [],
    enableLazy
  } = useContext(DocumentContext);

  useEffect(() => {
    if (enableLazy) enableLazy();
  }, [enableLazy]);

  const [activeTab, setActiveTab] = useState('critical');

  const totalDocs = documents.length;
  const totalProjects = projects.length;
  const totalMembers = members.length;
  
  const thirtyDaysAgo = subDays(new Date(), 30);
  const newDocsCount = documents.filter(doc => new Date(doc.createdAt) >= thirtyDaysAgo).length;

  // Helper tìm tên dự án
  const getProjectName = (projId) => {
    if (!projId) return 'Dự án Toà nhà CNS-1';
    const found = projects.find(p => p.id === projId || p.id?.toString() === projId?.toString());
    return found ? found.name : 'Dự án Toà nhà CNS-1';
  };

  // 1. TÌNH TRẠNG PHÁP LÝ
  const legalAnalysis = useMemo(() => {
    const pendingSteps = legalSteps.filter(s => s.status !== 'done');
    const items = pendingSteps.map(step => {
      const deadline = getTaskDeadlineInfo(step.targetDate, step.status);
      return {
        id: `legal-${step.id}`,
        title: step.name,
        projectName: getProjectName(step.projectId),
        projectId: step.projectId,
        targetDate: step.targetDate,
        status: step.status,
        deadline,
        category: 'Pháp lý',
        navView: 'phapLy'
      };
    });

    const overdue = items.filter(i => i.deadline.isOverdue).sort((a, b) => (b.deadline.diffDays || 0) - (a.deadline.diffDays || 0));
    const upcoming = items.filter(i => i.deadline.isUpcoming).sort((a, b) => (a.deadline.diffDays || 0) - (b.deadline.diffDays || 0));
    const onTrack = items.filter(i => !i.deadline.isOverdue && !i.deadline.isUpcoming);

    return {
      total: legalSteps.length,
      done: legalSteps.filter(s => s.status === 'done').length,
      overdue,
      upcoming,
      onTrack,
      displayList: [...overdue, ...upcoming, ...onTrack]
    };
  }, [legalSteps, projects]);

  // 2. TIẾN ĐỘ THI CÔNG
  const scheduleAnalysis = useMemo(() => {
    const pendingSteps = scheduleSteps.filter(s => s.status !== 'done');
    const items = pendingSteps.map(step => {
      const deadline = getTaskDeadlineInfo(step.targetDate, step.status);
      return {
        id: `sched-${step.id}`,
        title: step.name,
        projectName: getProjectName(step.projectId),
        projectId: step.projectId,
        targetDate: step.targetDate,
        status: step.status,
        deadline,
        category: 'Tiến độ',
        navView: 'tienDo'
      };
    });

    const overdue = items.filter(i => i.deadline.isOverdue).sort((a, b) => (b.deadline.diffDays || 0) - (a.deadline.diffDays || 0));
    const upcoming = items.filter(i => i.deadline.isUpcoming).sort((a, b) => (a.deadline.diffDays || 0) - (b.deadline.diffDays || 0));
    const onTrack = items.filter(i => !i.deadline.isOverdue && !i.deadline.isUpcoming);

    return {
      total: scheduleSteps.length,
      done: scheduleSteps.filter(s => s.status === 'done').length,
      overdue,
      upcoming,
      onTrack,
      displayList: [...overdue, ...upcoming, ...onTrack]
    };
  }, [scheduleSteps, projects]);

  // 3. ATLĐ & VSMT
  const atldAnalysis = useMemo(() => {
    const unresolved = atldIssues.filter(i => i.status !== 'resolved');
    const items = unresolved.map(issue => {
      const deadline = getTaskDeadlineInfo(issue.deadline, issue.status);
      return {
        id: `atld-${issue.id}`,
        title: issue.title,
        projectName: issue.project || getProjectName(issue.projectId),
        projectId: issue.projectId,
        targetDate: issue.deadline,
        severity: issue.severity || 'Trung bình',
        status: issue.status,
        deadline,
        category: issue.category || 'ATLĐ',
        location: issue.location,
        assignedTo: issue.assignedTo,
        navView: 'atld'
      };
    });

    const severeOrder = { 'Nghiêm trọng': 4, 'Cao': 3, 'Trung bình': 2, 'Thấp': 1 };
    items.sort((a, b) => {
      const sevDiff = (severeOrder[b.severity] || 0) - (severeOrder[a.severity] || 0);
      if (sevDiff !== 0) return sevDiff;
      if (a.deadline.isOverdue && !b.deadline.isOverdue) return -1;
      if (!a.deadline.isOverdue && b.deadline.isOverdue) return 1;
      return 0;
    });

    const severeCount = items.filter(i => i.severity === 'Nghiêm trọng' || i.severity === 'Cao').length;
    return {
      total: atldIssues.length,
      unresolved: items,
      severeCount,
      resolvedCount: atldIssues.filter(i => i.status === 'resolved').length
    };
  }, [atldIssues, projects]);

  // 4. NGHIỆM THU - THANH TOÁN
  const acceptanceAnalysis = useMemo(() => {
    const pendingAcceptance = acceptanceSteps.filter(s => s.status !== 'done').map(step => {
      const deadline = getTaskDeadlineInfo(step.effectiveDate || step.targetDate, step.status);
      return {
        id: `acc-${step.id}`,
        title: step.name,
        projectName: getProjectName(step.projectId),
        projectId: step.projectId,
        targetDate: step.effectiveDate || step.targetDate,
        status: step.status,
        deadline,
        type: 'Nghiệm thu',
        category: 'Nghiệm thu',
        navView: 'nghiemThu'
      };
    });

    // Mẫu các đợt thanh toán từ dự án
    const paymentStages = [
      { id: 'advance', label: 'Tạm ứng HĐ', percentage: 20 },
      { id: 'phase1', label: 'Thanh toán đợt 1 (Phần thô)', percentage: 30 },
      { id: 'phase2', label: 'Thanh toán đợt 2 (Hoàn thiện)', percentage: 30 },
      { id: 'final', label: 'Quyết toán & Thanh lý', percentage: 20 },
    ];

    const pendingPayments = (projects.length > 0 ? projects : [{ id: 1, name: 'Dự án Toà nhà CNS-1' }]).slice(0, 2).map((proj, idx) => ({
      id: `pay-${proj.id}-${idx}`,
      title: `Hồ sơ ${paymentStages[idx % paymentStages.length].label} (${paymentStages[idx % paymentStages.length].percentage}%)`,
      projectName: proj.name,
      projectId: proj.id,
      targetDate: format(new Date(Date.now() + (idx === 0 ? -2 : 5) * 86400000), 'yyyy-MM-dd'),
      status: 'inprogress',
      deadline: getTaskDeadlineInfo(format(new Date(Date.now() + (idx === 0 ? -2 : 5) * 86400000), 'yyyy-MM-dd'), 'inprogress'),
      type: 'Thanh toán',
      category: 'Thanh toán',
      navView: 'payment'
    }));

    const combined = [...pendingAcceptance, ...pendingPayments];
    const overdue = combined.filter(i => i.deadline.isOverdue);
    const upcoming = combined.filter(i => i.deadline.isUpcoming);

    return {
      total: combined.length,
      overdue,
      upcoming,
      displayList: combined.sort((a, b) => {
        if (a.deadline.isOverdue && !b.deadline.isOverdue) return -1;
        if (!a.deadline.isOverdue && b.deadline.isOverdue) return 1;
        return 0;
      })
    };
  }, [acceptanceSteps, projects]);

  // 5. DANH MỤC LỖI
  const defectAnalysis = useMemo(() => {
    const tabsMap = {};
    defectTabs.forEach(t => { tabsMap[t.id] = t.name; });

    const countsPerTab = {};
    defectLibrary.forEach(err => {
      const tabName = tabsMap[err.tabId] || 'Chung';
      countsPerTab[tabName] = (countsPerTab[tabName] || 0) + 1;
    });

    const topTabs = Object.entries(countsPerTab)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    const severeDefects = defectLibrary
      .filter(d => d.severity === 'Nghiêm trọng' || d.severity === 'Cao')
      .map(d => ({
        id: `def-${d.id}`,
        title: d.title,
        code: d.code,
        categoryName: tabsMap[d.tabId] || 'Chung',
        severity: d.severity,
        prevention: d.prevention,
        description: d.description,
        navView: 'danhMucLoi'
      }));

    return {
      total: defectLibrary.length,
      topTabs,
      severeDefects,
      displayList: defectLibrary.slice(0, 10).map(d => ({
        id: `def-${d.id}`,
        title: d.title,
        code: d.code,
        categoryName: tabsMap[d.tabId] || 'Chung',
        severity: d.severity,
        prevention: d.prevention,
        description: d.description,
        navView: 'danhMucLoi'
      }))
    };
  }, [defectLibrary, defectTabs]);

  // TỔNG HỢP TẤT CẢ CẢNH BÁO KHẨN
  const allCriticalItems = useMemo(() => {
    const items = [];
    
    // Pháp lý quá hạn & sắp đến hạn
    legalAnalysis.overdue.forEach(item => items.push({ ...item, urgencyLevel: 1, reason: 'Pháp lý quá hạn' }));
    legalAnalysis.upcoming.forEach(item => items.push({ ...item, urgencyLevel: 2, reason: 'Pháp lý sắp đến hạn' }));

    // Tiến độ quá hạn & sắp đến hạn
    scheduleAnalysis.overdue.forEach(item => items.push({ ...item, urgencyLevel: 1, reason: 'Tiến độ trễ mốc' }));
    scheduleAnalysis.upcoming.forEach(item => items.push({ ...item, urgencyLevel: 2, reason: 'Mốc tiến độ sắp tới' }));

    // ATLĐ nghiêm trọng chưa giải quyết
    atldAnalysis.unresolved.filter(i => i.severity === 'Nghiêm trọng' || i.severity === 'Cao').forEach(item => {
      items.push({ ...item, urgencyLevel: item.severity === 'Nghiêm trọng' ? 1 : 2, reason: `ATLĐ: ${item.severity}` });
    });

    // Nghiệm thu - Thanh toán quá hạn
    acceptanceAnalysis.overdue.forEach(item => items.push({ ...item, urgencyLevel: 1, reason: 'Nghiệm thu/TT trễ hạn' }));
    acceptanceAnalysis.upcoming.forEach(item => items.push({ ...item, urgencyLevel: 3, reason: 'Nghiệm thu/TT sắp tới' }));

    return items.sort((a, b) => a.urgencyLevel - b.urgencyLevel);
  }, [legalAnalysis, scheduleAnalysis, atldAnalysis, acceptanceAnalysis]);

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
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', height: '100%', overflowY: 'auto', paddingRight: '0.5rem', paddingBottom: '2rem' }}>
      
      {/* Header */}
      <div style={{ position: 'relative' }}>
        <div style={{ position: 'absolute', top: '-20px', left: '-20px', width: '150px', height: '150px', background: 'radial-gradient(circle, rgba(59,130,246,0.15) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
        <h1 style={{ position: 'relative', fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text-main)', marginBottom: '0.5rem', letterSpacing: '-0.5px', zIndex: 1, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Activity size={28} color="var(--color-primary)" />
          Tổng quan Hệ thống
        </h1>
        <p style={{ position: 'relative', color: 'var(--color-text-muted)', fontSize: '0.95rem', zIndex: 1 }}>
          Xem nhanh các chỉ số vận hành, cảnh báo tiến độ, pháp lý, an toàn và hoạt động mới nhất.
        </p>
      </div>

      {/* KPI Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1.25rem' }}>
        <KpiCard
          title="Tổng số Dự án"
          value={totalProjects}
          icon={<Briefcase size={26} />}
          gradient="linear-gradient(135deg, #3b82f6, #2563eb)"
          shadowColor="rgba(59, 130, 246, 0.4)"
          onClick={() => onNavigate && onNavigate('projects')}
        />
        <KpiCard
          title="Tổng số Tài liệu"
          value={totalDocs}
          icon={<FileText size={26} />}
          gradient="linear-gradient(135deg, #10b981, #059669)"
          shadowColor="rgba(16, 185, 129, 0.4)"
          onClick={() => onNavigate && onNavigate('dashboard')}
        />
        <KpiCard
          title="Tài liệu mới (30 ngày)"
          value={newDocsCount}
          icon={<TrendingUp size={26} />}
          gradient="linear-gradient(135deg, #f59e0b, #d97706)"
          shadowColor="rgba(245, 158, 11, 0.4)"
          onClick={() => onNavigate && onNavigate('dashboard')}
        />
        <KpiCard
          title="Thành viên"
          value={totalMembers}
          icon={<Users size={26} />}
          gradient="linear-gradient(135deg, #8b5cf6, #6d28d9)"
          shadowColor="rgba(139, 92, 246, 0.4)"
          onClick={() => onNavigate && onNavigate('members')}
        />
      </div>

      {/* Charts Section */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '1.25rem' }}>
        {/* Pie Chart */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, right: 0, width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(139,92,246,0.05) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', zIndex: 1 }}>Phân bổ Tài liệu theo Loại</h3>
          <div style={{ flex: 1, minHeight: '260px', zIndex: 1 }}>
            {docsByTypeData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={docsByTypeData}
                    cx="50%"
                    cy="50%"
                    innerRadius={70}
                    outerRadius={95}
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
                  <Legend verticalAlign="bottom" height={36} iconType="circle" wrapperStyle={{ fontSize: '0.8rem', opacity: 0.9 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', color: 'var(--color-text-muted)' }}>Chưa có dữ liệu</div>
            )}
          </div>
        </div>

        {/* Bar Chart */}
        <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', position: 'relative', overflow: 'hidden' }}>
          <div style={{ position: 'absolute', top: 0, left: 0, width: '180px', height: '180px', background: 'radial-gradient(circle, rgba(59,130,246,0.05) 0%, rgba(0,0,0,0) 70%)', zIndex: 0 }} />
          <h3 style={{ fontSize: '1.1rem', fontWeight: '700', marginBottom: '1.25rem', zIndex: 1 }}>Top 5 Dự án nhiều Tài liệu</h3>
          <div style={{ flex: 1, minHeight: '260px', zIndex: 1 }}>
             {docsByProjectData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={docsByProjectData}
                  margin={{ top: 20, right: 20, left: -20, bottom: 5 }}
                  barSize={32}
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

      {/* ========================================================================= */}
      {/* 5-FOCUS AREAS: EXECUTIVE OPERATIONS & MONITORING HUB                      */}
      {/* ========================================================================= */}
      <div className="card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        
        {/* Hub Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
          <div>
            <h2 style={{ fontSize: '1.25rem', fontWeight: '800', margin: 0, color: 'var(--color-text-main)', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <ShieldAlert size={22} color="#f59e0b" />
              Trung tâm Giám sát Điều hành & Cảnh báo Dự án
            </h2>
            <p style={{ margin: '4px 0 0 0', color: 'var(--color-text-muted)', fontSize: '0.85rem' }}>
              Báo cáo tập trung tác vụ quá hạn, sắp đến hạn và các vấn đề hiện trường cần xử lý ngay.
            </p>
          </div>
          
          {allCriticalItems.length > 0 && (
            <span style={{ 
              backgroundColor: 'rgba(239, 68, 68, 0.15)', 
              color: '#f87171', 
              border: '1px solid rgba(239, 68, 68, 0.3)', 
              padding: '4px 12px', 
              borderRadius: '20px', 
              fontSize: '0.8rem', 
              fontWeight: '700',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <AlertCircle size={14} /> Có {allCriticalItems.length} vấn đề cần lưu ý
            </span>
          )}
        </div>

        {/* 5 Mini Status Strip Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '0.75rem' }}>
          
          {/* 1. Pháp lý */}
          <MiniAlertCard
            icon={<Scale size={18} />}
            title="1. Pháp lý"
            active={activeTab === 'phapLy'}
            onClick={() => setActiveTab('phapLy')}
            accentColor="#6366f1"
            badgeCount={legalAnalysis.overdue.length}
            badgeText={legalAnalysis.overdue.length > 0 ? `${legalAnalysis.overdue.length} quá hạn` : `${legalAnalysis.upcoming.length} sắp đến`}
            subText={`${legalAnalysis.overdue.length} trễ • ${legalAnalysis.upcoming.length} sắp tới`}
            hasAlert={legalAnalysis.overdue.length > 0}
          />

          {/* 2. Tiến độ */}
          <MiniAlertCard
            icon={<Clock size={18} />}
            title="2. Tiến độ"
            active={activeTab === 'tienDo'}
            onClick={() => setActiveTab('tienDo')}
            accentColor="#3b82f6"
            badgeCount={scheduleAnalysis.overdue.length}
            badgeText={scheduleAnalysis.overdue.length > 0 ? `${scheduleAnalysis.overdue.length} quá hạn` : `${scheduleAnalysis.upcoming.length} sắp tới`}
            subText={`${scheduleAnalysis.overdue.length} trễ • ${scheduleAnalysis.upcoming.length} sắp tới`}
            hasAlert={scheduleAnalysis.overdue.length > 0}
          />

          {/* 3. ATLĐ & VSMT */}
          <MiniAlertCard
            icon={<HardHat size={18} />}
            title="3. ATLĐ & VSMT"
            active={activeTab === 'atld'}
            onClick={() => setActiveTab('atld')}
            accentColor="#f59e0b"
            badgeCount={atldAnalysis.severeCount}
            badgeText={`${atldAnalysis.unresolved.length} tồn đọng`}
            subText={`${atldAnalysis.severeCount} nghiêm trọng / cao`}
            hasAlert={atldAnalysis.severeCount > 0}
          />

          {/* 4. Nghiệm thu - Thanh toán */}
          <MiniAlertCard
            icon={<CheckSquare size={18} />}
            title="4. Nghiệm thu - TT"
            active={activeTab === 'nghiemThu'}
            onClick={() => setActiveTab('nghiemThu')}
            accentColor="#10b981"
            badgeCount={acceptanceAnalysis.overdue.length}
            badgeText={`${acceptanceAnalysis.total} việc xử lý`}
            subText={`${acceptanceAnalysis.overdue.length} trễ • ${acceptanceAnalysis.upcoming.length} sắp tới`}
            hasAlert={acceptanceAnalysis.overdue.length > 0}
          />

          {/* 5. Danh mục Lỗi */}
          <MiniAlertCard
            icon={<AlertTriangle size={18} />}
            title="5. Danh mục Lỗi"
            active={activeTab === 'danhMucLoi'}
            onClick={() => setActiveTab('danhMucLoi')}
            accentColor="#ec4899"
            badgeCount={defectAnalysis.severeDefects.length}
            badgeText={`${defectAnalysis.total} lỗi ghi nhận`}
            subText={`${defectAnalysis.severeDefects.length} lỗi nghiêm trọng`}
            hasAlert={defectAnalysis.severeDefects.length > 0}
          />

        </div>

        {/* Tab Selector Pills */}
        <div style={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem', 
          overflowX: 'auto', 
          paddingBottom: '4px',
          borderBottom: '1px solid rgba(255,255,255,0.08)'
        }}>
          <TabButton 
            active={activeTab === 'critical'} 
            onClick={() => setActiveTab('critical')}
            icon={<AlertCircle size={14} color="#ef4444" />}
            label="Tất cả cảnh báo khẩn"
            count={allCriticalItems.length}
            badgeColor="#ef4444"
          />
          <TabButton 
            active={activeTab === 'phapLy'} 
            onClick={() => setActiveTab('phapLy')}
            icon={<Scale size={14} color="#818cf8" />}
            label="Pháp lý"
            count={legalAnalysis.overdue.length + legalAnalysis.upcoming.length}
            badgeColor={legalAnalysis.overdue.length > 0 ? '#ef4444' : '#6366f1'}
          />
          <TabButton 
            active={activeTab === 'tienDo'} 
            onClick={() => setActiveTab('tienDo')}
            icon={<Clock size={14} color="#60a5fa" />}
            label="Tiến độ thi công"
            count={scheduleAnalysis.overdue.length + scheduleAnalysis.upcoming.length}
            badgeColor={scheduleAnalysis.overdue.length > 0 ? '#ef4444' : '#3b82f6'}
          />
          <TabButton 
            active={activeTab === 'atld'} 
            onClick={() => setActiveTab('atld')}
            icon={<HardHat size={14} color="#fbbf24" />}
            label="ATLĐ & VSMT"
            count={atldAnalysis.unresolved.length}
            badgeColor={atldAnalysis.severeCount > 0 ? '#f59e0b' : '#10b981'}
          />
          <TabButton 
            active={activeTab === 'nghiemThu'} 
            onClick={() => setActiveTab('nghiemThu')}
            icon={<CheckSquare size={14} color="#34d399" />}
            label="Nghiệm thu & TT"
            count={acceptanceAnalysis.displayList.length}
            badgeColor="#10b981"
          />
          <TabButton 
            active={activeTab === 'danhMucLoi'} 
            onClick={() => setActiveTab('danhMucLoi')}
            icon={<AlertTriangle size={14} color="#f472b6" />}
            label="Danh mục Lỗi"
            count={defectAnalysis.severeDefects.length}
            badgeColor="#ec4899"
          />
          <TabButton 
            active={activeTab === 'recent_docs'} 
            onClick={() => setActiveTab('recent_docs')}
            icon={<FileText size={14} color="#94a3b8" />}
            label="Tài liệu mới"
            count={recentDocuments.length}
            badgeColor="#64748b"
          />
        </div>

        {/* Tab Content List (Constrained height with inner scroll to prevent overflow) */}
        <div style={{ 
          maxHeight: '420px', 
          overflowY: 'auto', 
          paddingRight: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.65rem'
        }}>
          
          {/* TAB 1: ALL CRITICAL */}
          {activeTab === 'critical' && (
            allCriticalItems.length === 0 ? (
              <EmptyAlertMessage message="Rất tốt! Hiện không có tác vụ nào bị quá hạn hay vấn đề nghiêm trọng." />
            ) : (
              allCriticalItems.map(item => (
                <DetailRow 
                  key={item.id}
                  title={item.title}
                  projectName={item.projectName}
                  categoryTag={item.reason}
                  deadline={item.deadline}
                  targetDate={item.targetDate}
                  onAction={() => onNavigate && onNavigate(item.navView)}
                  actionText="Xử lý ngay"
                  highlightRed={item.deadline?.isOverdue || item.urgencyLevel === 1}
                />
              ))
            )
          )}

          {/* TAB 2: PHÁP LÝ */}
          {activeTab === 'phapLy' && (
            legalAnalysis.displayList.length === 0 ? (
              <EmptyAlertMessage message="Chưa có bước pháp lý nào đang thực hiện cần theo dõi." />
            ) : (
              legalAnalysis.displayList.map(item => (
                <DetailRow 
                  key={item.id}
                  title={item.title}
                  projectName={item.projectName}
                  categoryTag="Pháp lý"
                  deadline={item.deadline}
                  targetDate={item.targetDate}
                  onAction={() => onNavigate && onNavigate('phapLy')}
                  actionText="Mở Pháp lý"
                  highlightRed={item.deadline?.isOverdue}
                />
              ))
            )
          )}

          {/* TAB 3: TIẾN ĐỘ */}
          {activeTab === 'tienDo' && (
            scheduleAnalysis.displayList.length === 0 ? (
              <EmptyAlertMessage message="Tiến độ các mốc đang được đảm bảo đầy đủ." />
            ) : (
              scheduleAnalysis.displayList.map(item => (
                <DetailRow 
                  key={item.id}
                  title={item.title}
                  projectName={item.projectName}
                  categoryTag="Tiến độ"
                  deadline={item.deadline}
                  targetDate={item.targetDate}
                  onAction={() => onNavigate && onNavigate('tienDo')}
                  actionText="Mở Tiến độ"
                  highlightRed={item.deadline?.isOverdue}
                />
              ))
            )
          )}

          {/* TAB 4: ATLĐ & VSMT */}
          {activeTab === 'atld' && (
            atldAnalysis.unresolved.length === 0 ? (
              <EmptyAlertMessage message="Tuyệt vời! Hiện trường không có vi phạm ATLĐ & VSMT nào đang mở." />
            ) : (
              atldAnalysis.unresolved.map(item => (
                <DetailRow 
                  key={item.id}
                  title={item.title}
                  projectName={item.projectName}
                  categoryTag={`${item.category} • Mức ${item.severity}`}
                  subDetail={item.location ? `Vị trí: ${item.location}` : (item.assignedTo ? `Phụ trách: ${item.assignedTo}` : null)}
                  deadline={item.deadline}
                  targetDate={item.targetDate}
                  onAction={() => onNavigate && onNavigate('atld')}
                  actionText="Mở ATLĐ & VSMT"
                  highlightRed={item.severity === 'Nghiêm trọng' || item.deadline?.isOverdue}
                />
              ))
            )
          )}

          {/* TAB 5: NGHIỆM THU - THANH TOÁN */}
          {activeTab === 'nghiemThu' && (
            acceptanceAnalysis.displayList.length === 0 ? (
              <EmptyAlertMessage message="Không có hồ sơ nghiệm thu hay thanh toán nào đang chờ duyệt." />
            ) : (
              acceptanceAnalysis.displayList.map(item => (
                <DetailRow 
                  key={item.id}
                  title={item.title}
                  projectName={item.projectName}
                  categoryTag={item.type}
                  deadline={item.deadline}
                  targetDate={item.targetDate}
                  onAction={() => onNavigate && onNavigate(item.navView)}
                  actionText="Xem chi tiết"
                  highlightRed={item.deadline?.isOverdue}
                />
              ))
            )
          )}

          {/* TAB 6: DANH MỤC LỖI */}
          {activeTab === 'danhMucLoi' && (
            defectAnalysis.displayList.length === 0 ? (
              <EmptyAlertMessage message="Chưa có dữ liệu danh mục lỗi được ghi nhận." />
            ) : (
              defectAnalysis.displayList.map(item => (
                <div 
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.85rem 1.1rem',
                    borderRadius: '10px',
                    backgroundColor: 'var(--color-bg-surface-hover)',
                    border: item.severity === 'Nghiêm trọng' ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(255,255,255,0.05)',
                    gap: '1rem',
                    transition: 'all 0.2s'
                  }}
                >
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.25rem', flexWrap: 'wrap' }}>
                      <span style={{ fontSize: '0.72rem', fontWeight: '700', padding: '1px 6px', borderRadius: '4px', backgroundColor: 'rgba(236, 72, 153, 0.15)', color: '#f472b6', border: '1px solid rgba(236, 72, 153, 0.3)' }}>
                        {item.code}
                      </span>
                      <span style={{ fontSize: '0.72rem', fontWeight: '600', padding: '1px 6px', borderRadius: '4px', backgroundColor: item.severity === 'Nghiêm trọng' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(245, 158, 11, 0.15)', color: item.severity === 'Nghiêm trọng' ? '#f87171' : '#fbbf24' }}>
                        Mức {item.severity}
                      </span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
                        Thẻ: {item.categoryName}
                      </span>
                    </div>
                    <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {item.title}
                    </h4>
                    {item.prevention && (
                      <p style={{ margin: '3px 0 0 0', fontSize: '0.78rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        Phòng ngừa: {item.prevention}
                      </p>
                    )}
                  </div>
                  <button 
                    onClick={() => onNavigate && onNavigate('danhMucLoi')}
                    className="btn btn-outline"
                    style={{ fontSize: '0.75rem', padding: '4px 10px', flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                  >
                    Xem lỗi <ArrowUpRight size={13} />
                  </button>
                </div>
              ))
            )
          )}

          {/* TAB 7: TÀI LIỆU VỪA CẬP NHẬT (PRESERVED) */}
          {activeTab === 'recent_docs' && (
            recentDocuments.length === 0 ? (
              <EmptyAlertMessage message="Chưa có tài liệu nào trong hệ thống." />
            ) : (
              recentDocuments.map(doc => (
                <div 
                  key={doc.id} 
                  style={{ 
                    display: 'flex', alignItems: 'center', gap: '1rem', padding: '0.85rem 1.1rem', 
                    borderRadius: '10px', backgroundColor: 'var(--color-bg-surface-hover)',
                    border: '1px solid rgba(255,255,255,0.05)',
                    transition: 'all 0.2s',
                    cursor: 'pointer',
                  }}
                  onClick={() => onNavigate && onNavigate('dashboard')}
                >
                  <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.15)', display: 'flex', justifyContent: 'center', alignItems: 'center', color: '#60a5fa', flexShrink: 0 }}>
                    <FileText size={18} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', marginBottom: '0.2rem' }}>
                      <h4 style={{ fontWeight: '600', margin: 0, fontSize: '0.9rem', color: 'var(--color-text-main)' }}>{doc.documentNumber}</h4>
                      {doc.documentType && <span className="badge" style={{ backgroundColor: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', border: '1px solid rgba(245, 158, 11, 0.3)', fontSize: '0.7rem', padding: '1px 6px' }}>{doc.documentType}</span>}
                    </div>
                    <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.8rem', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {doc.summary}
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', color: 'var(--color-text-muted)', fontSize: '0.75rem', flexShrink: 0, backgroundColor: 'rgba(0,0,0,0.2)', padding: '3px 8px', borderRadius: '20px' }}>
                    <Calendar size={12} />
                    {format(new Date(doc.createdAt || doc.effectiveDate || Date.now()), 'dd/MM/yyyy', { locale: vi })}
                  </div>
                </div>
              ))
            )
          )}

        </div>

      </div>

    </div>
  );
};

// Mini Status Card Component
const MiniAlertCard = ({ icon, title, active, onClick, accentColor, badgeCount, badgeText, subText, hasAlert }) => (
  <div 
    onClick={onClick}
    style={{
      padding: '0.875rem 1rem',
      borderRadius: '12px',
      backgroundColor: active ? 'rgba(59, 130, 246, 0.12)' : 'var(--color-bg-surface-hover)',
      border: active ? `2px solid ${accentColor}` : (hasAlert ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255,255,255,0.06)'),
      cursor: 'pointer',
      display: 'flex',
      flexDirection: 'column',
      gap: '0.35rem',
      transition: 'all 0.2s',
      position: 'relative',
      overflow: 'hidden'
    }}
    onMouseEnter={e => { if (!active) e.currentTarget.style.borderColor = accentColor; }}
    onMouseLeave={e => { if (!active) e.currentTarget.style.borderColor = hasAlert ? 'rgba(239, 68, 68, 0.35)' : 'rgba(255,255,255,0.06)'; }}
  >
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: accentColor, fontWeight: '700', fontSize: '0.8rem' }}>
        {icon}
        <span>{title}</span>
      </div>
      {badgeText && (
        <span style={{ 
          fontSize: '0.7rem', 
          fontWeight: '700', 
          padding: '1px 6px', 
          borderRadius: '10px',
          backgroundColor: hasAlert ? 'rgba(239, 68, 68, 0.2)' : 'rgba(255,255,255,0.08)',
          color: hasAlert ? '#f87171' : 'var(--color-text-muted)'
        }}>
          {badgeText}
        </span>
      )}
    </div>
    <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
      {subText}
    </div>
  </div>
);

// Tab Button Component
const TabButton = ({ active, onClick, icon, label, count, badgeColor }) => (
  <button
    onClick={onClick}
    style={{
      padding: '6px 12px',
      borderRadius: '20px',
      fontSize: '0.8rem',
      fontWeight: '600',
      display: 'inline-flex',
      alignItems: 'center',
      gap: '6px',
      backgroundColor: active ? 'var(--color-bg-surface-hover)' : 'transparent',
      color: active ? 'var(--color-text-main)' : 'var(--color-text-muted)',
      border: active ? '1px solid var(--color-border)' : '1px solid transparent',
      transition: 'all 0.15s',
      flexShrink: 0,
      cursor: 'pointer'
    }}
  >
    {icon}
    <span>{label}</span>
    {count !== undefined && (
      <span style={{
        fontSize: '0.7rem',
        fontWeight: '700',
        backgroundColor: active ? (badgeColor || 'var(--color-primary)') : 'rgba(255,255,255,0.1)',
        color: active ? 'white' : 'var(--color-text-muted)',
        padding: '1px 6px',
        borderRadius: '10px'
      }}>
        {count}
      </span>
    )}
  </button>
);

// Detail Row Component
const DetailRow = ({ title, projectName, categoryTag, subDetail, deadline, targetDate, onAction, actionText, highlightRed }) => (
  <div style={{
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0.75rem 1rem',
    borderRadius: '10px',
    backgroundColor: 'var(--color-bg-surface-hover)',
    border: highlightRed ? '1px solid rgba(239, 68, 68, 0.35)' : '1px solid rgba(255,255,255,0.05)',
    gap: '0.75rem',
    transition: 'all 0.2s',
  }}>
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.2rem', flexWrap: 'wrap' }}>
        {categoryTag && (
          <span style={{ 
            fontSize: '0.7rem', 
            fontWeight: '700', 
            padding: '1px 6px', 
            borderRadius: '4px', 
            backgroundColor: highlightRed ? 'rgba(239, 68, 68, 0.15)' : 'rgba(59, 130, 246, 0.15)',
            color: highlightRed ? '#f87171' : '#60a5fa',
            border: `1px solid ${highlightRed ? 'rgba(239, 68, 68, 0.3)' : 'rgba(59, 130, 246, 0.3)'}`
          }}>
            {categoryTag}
          </span>
        )}
        {projectName && (
          <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
            <Building2 size={12} /> {projectName}
          </span>
        )}
      </div>

      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: '600', color: 'var(--color-text-main)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
        {title}
      </h4>

      {subDetail && (
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: '2px' }}>
          {subDetail}
        </div>
      )}
    </div>

    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexShrink: 0 }}>
      {deadline && (
        <span style={{
          fontSize: '0.75rem',
          fontWeight: '700',
          padding: '3px 8px',
          borderRadius: '6px',
          backgroundColor: deadline.isOverdue 
            ? 'rgba(239, 68, 68, 0.2)' 
            : (deadline.isUpcoming ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255,255,255,0.06)'),
          color: deadline.isOverdue 
            ? '#f87171' 
            : (deadline.isUpcoming ? '#fbbf24' : 'var(--color-text-muted)'),
          border: `1px solid ${deadline.isOverdue ? 'rgba(239,68,68,0.4)' : (deadline.isUpcoming ? 'rgba(245,158,11,0.4)' : 'transparent')}`
        }}>
          {deadline.text}
        </span>
      )}

      {targetDate && (
        <span style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
          <Calendar size={12} /> {targetDate}
        </span>
      )}

      {onAction && (
        <button 
          onClick={onAction}
          className="btn btn-outline"
          style={{ fontSize: '0.75rem', padding: '4px 10px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
        >
          {actionText || 'Xem'} <ArrowUpRight size={13} />
        </button>
      )}
    </div>
  </div>
);

// Empty Alert Component
const EmptyAlertMessage = ({ message }) => (
  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
    <CheckCircle2 size={32} color="#10b981" style={{ opacity: 0.8 }} />
    <span style={{ fontSize: '0.9rem' }}>{message}</span>
  </div>
);

const KpiCard = ({ title, value, icon, gradient, shadowColor, onClick }) => (
  <div className="card"
       onClick={onClick}
       style={{ 
         padding: '1.25rem', 
         display: 'flex', 
         alignItems: 'center', 
         gap: '1rem', 
         transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)', 
         cursor: onClick ? 'pointer' : 'default',
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
      width: '52px', height: '52px', borderRadius: '14px', 
      background: gradient, color: 'white', 
      display: 'flex', justifyContent: 'center', alignItems: 'center', 
      flexShrink: 0,
      boxShadow: `0 8px 16px -4px ${shadowColor}`
    }}>
      {icon}
    </div>
    <div>
      <p style={{ margin: 0, color: 'var(--color-text-muted)', fontSize: '0.75rem', fontWeight: '600', marginBottom: '0.2rem', textTransform: 'uppercase', letterSpacing: '0.5px' }}>{title}</p>
      <h3 style={{ margin: 0, fontSize: '1.75rem', fontWeight: '800', color: 'var(--color-text-main)', letterSpacing: '-0.5px' }}>{value}</h3>
    </div>
  </div>
);

export default Overview;
