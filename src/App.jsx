import React, { useState, useEffect, lazy, Suspense } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from './firebase';
import { DocumentProvider } from './context/DocumentContext';
import { UIProvider } from './context/UIContext';
import LoginPage from './components/LoginPage';
import InvitePage from './components/InvitePage';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import DocumentForm from './components/DocumentForm';
import AIAssistant from './components/AIAssistant';

// ── Core pages (tải ngay) ──────────────────────────────────────────────────
import Dashboard from './components/Dashboard';
import Overview from './components/Overview';
import Projects from './components/Projects';
import ComingSoon from './components/ComingSoon';

// ── Lazy pages ─────────────────────────────────────────────────────────────
const Members            = lazy(() => import('./components/Members'));
const Settings           = lazy(() => import('./components/Settings'));
const Partners           = lazy(() => import('./components/Partners'));
const BiddingPackages    = lazy(() => import('./components/BiddingPackages'));
const BiddingPlan        = lazy(() => import('./components/BiddingPlan'));
const ContractorSelection = lazy(() => import('./components/ContractorSelection'));
const PhapLy             = lazy(() => import('./components/PhapLy'));
const TienDo             = lazy(() => import('./components/TienDo'));
const KhoiLuong          = lazy(() => import('./components/KhoiLuong'));
const NghiemThu          = lazy(() => import('./components/NghiemThu'));
const DanhMucLoi         = lazy(() => import('./components/DanhMucLoi'));
const Payment            = lazy(() => import('./components/Payment'));
const MobileDocumentApp  = lazy(() => import('./components/MobileDocumentApp'));

// ── Màn hình chờ ─────────────────────────────────────────────────────────
const LoadingScreen = () => (
  <div style={{
    minHeight: '100vh', backgroundColor: '#0f172a',
    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
    gap: '1rem',
  }}>
    <div style={{
      width: '48px', height: '48px', borderRadius: '14px',
      background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
      boxShadow: '0 6px 24px rgba(59,130,246,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </div>
    <div style={{ width: '32px', height: '32px', border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3b82f6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
  </div>
);

// Component nội dung chính sau khi đã bọc DocumentProvider liên tục
const AppMain = () => {
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [searchFocus, setSearchFocus] = useState(null);

  // Phát hiện điện thoại thật (iPhone / Android)
  const isMobileDevice = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

  const [currentView, setCurrentView] = useState(() => {
    return isMobileDevice ? 'mobileDocs' : 'overview';
  });

  const renderContent = () => {
    switch (currentView) {
      case 'overview':           return <Overview />;
      case 'dashboard':          return <Dashboard onOpenForm={() => setIsFormOpen(true)} />;
      case 'projects':           return <Projects focusProjectId={searchFocus?.type === 'project' ? searchFocus.data?.id : null} onFocusCleared={() => setSearchFocus(null)} />;
      case 'members':            return <Members />;
      case 'partners':           return <Partners />;
      case 'bidding':            return <BiddingPackages />;
      case 'biddingPlan':        return <BiddingPlan />;
      case 'contractorSelection':return <ContractorSelection />;
      case 'phapLy':             return <PhapLy />;
      case 'tienDo':             return <TienDo />;
      case 'khoiLuong':          return <KhoiLuong />;
      case 'atld':               return <ComingSoon title="ATLĐ & VSMT" icon="🪦" description="Quản lý an toàn lao động, vệ sinh môi trường thi công, biên bản kiểm tra định kỳ." />;
      case 'nghiemThu':          return <NghiemThu />;
      case 'payment':            return <Payment />;
      case 'danhMucLoi':         return <DanhMucLoi />;
      case 'mobileDocs':         return <MobileDocumentApp onCloseMobileView={() => setCurrentView('overview')} />;
      case 'settings':           return <Settings />;
      default: return (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--color-text-muted)' }}>
          <h2 style={{ fontSize: '1.5rem', fontWeight: '600', marginBottom: '1rem', color: 'var(--color-text-main)' }}>Chức năng đang phát triển</h2>
          <p>Khu vực này hiện chưa được xây dựng nội dung.</p>
          <button className="btn btn-primary" style={{ marginTop: '1.5rem' }} onClick={() => setCurrentView('overview')}>
            Quay lại Tổng quan
          </button>
        </div>
      );
    }
  };

  // Màn hình di động (iPhone / Android) hoặc xem thử mobile mode
  if (currentView === 'mobileDocs' && isMobileDevice) {
    return (
      <Suspense fallback={<LoadingScreen />}>
        <MobileDocumentApp onCloseMobileView={null} />
      </Suspense>
    );
  }

  // Giao diện Desktop đầy đủ với Sidebar & Header
  return (
    <div className="app-container">
      <Sidebar currentView={currentView} setCurrentView={setCurrentView} />
      <main className="main-content">
        <Header currentView={currentView} onOpenForm={() => setIsFormOpen(true)} onNavigate={setCurrentView} onSearchSelect={setSearchFocus} />
        <div className="content-area">
          <Suspense fallback={<LoadingScreen />}>
            {renderContent()}
          </Suspense>
        </div>
      </main>
      {isFormOpen && <DocumentForm onClose={() => setIsFormOpen(false)} />}
      {searchFocus?.type === 'document' && (
        <DocumentForm
          initialData={searchFocus.data}
          previewMode={true}
          onClose={() => setSearchFocus(null)}
        />
      )}
      <AIAssistant />
    </div>
  );
};

function App() {
  const [authUser, setAuthUser]     = useState(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [inviteToken, setInviteToken] = useState(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tok = params.get('invite');
    if (tok) setInviteToken(tok);

    const unsub = onAuthStateChanged(auth, (user) => {
      setAuthUser(user);
      setAuthLoading(false);
    });
    return unsub;
  }, []);

  const handleInviteDone = () => {
    setInviteToken(null);
    const url = new URL(window.location.href);
    url.searchParams.delete('invite');
    window.history.replaceState({}, '', url.toString());
  };

  if (authLoading) return <LoadingScreen />;

  if (inviteToken) return (
    <UIProvider>
      <DocumentProvider>
        <InvitePage token={inviteToken} onDone={handleInviteDone} />
      </DocumentProvider>
    </UIProvider>
  );

  if (!authUser) return <LoginPage />;

  return (
    <UIProvider>
      <DocumentProvider currentUser={authUser}>
        <AppMain />
      </DocumentProvider>
    </UIProvider>
  );
}

export default App;
