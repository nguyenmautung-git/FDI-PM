import React, { useState, useMemo, useEffect, useContext, useRef } from 'react';
import {
  Search, ArrowLeft, Plus, Download, Eye, FileText, Check, ChevronRight, ChevronDown, ChevronLeft,
  Building2, Calendar, Shield, Share2, Filter, AlertCircle, Sparkles, Paperclip, X, ExternalLink,
  Sun, Moon, RefreshCw, Star, Info, MapPin, Globe, Settings, Home, LogOut, Camera,
  Layers, Folder, Users, Mail, Phone
} from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';
import { EMPLOYEE_LEVELS } from '../data';
import { auth, storage } from '../firebase';
import { signOut, updateProfile } from 'firebase/auth';
import { ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';

// ── Bảng màu Pastel & Màu nền linh hoạt cho Chế độ Sáng / Tối ─────────────
const SCREEN_COLORS = {
  overview: '#eff6ff',      // Sky Blue Pastel
  settings: '#f8fafc',      // Neutral Slate Light
  user_profile: '#f8fafc',
  search: '#eff6ff',        // Sky Blue Pastel
  upload_form: '#ffffff',
  project_list: '#fffbeb',  // Amber Pastel
  project_detail: '#e0f2fe',// Ice Blue Pastel
  doc_detail: '#f0fdf4',    // Mint Green Pastel
  recent_7days: '#fdf2f8'   // Rose / Lavender Pastel
};


// ── Bảng màu Pastel đa dạng cho các thẻ, tag, chip, combo box ─────────────
const PASTEL_PALETTE = [
  { bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af', iconBg: '#dbeafe', shadow: '0 2px 8px rgba(59,130,246,0.06)' },  // Sky Blue
  { bg: '#f0fdf4', border: '#bbf7d0', text: '#166534', iconBg: '#dcfce7', shadow: '0 2px 8px rgba(34,197,94,0.06)' },  // Green
  { bg: '#fffbeb', border: '#fef08a', text: '#854d0e', iconBg: '#fef3c7', shadow: '0 2px 8px rgba(234,179,8,0.06)' },  // Amber/Yellow
  { bg: '#faf5ff', border: '#e9d5ff', text: '#6b21a8', iconBg: '#f3e8ff', shadow: '0 2px 8px rgba(168,85,247,0.06)' }, // Purple
  { bg: '#fff1f2', border: '#fecdd3', text: '#9f1239', iconBg: '#ffe4e6', shadow: '0 2px 8px rgba(244,63,94,0.06)' },  // Rose
  { bg: '#f0fdfa', border: '#99f6e4', text: '#115e59', iconBg: '#ccfbf1', shadow: '0 2px 8px rgba(20,184,166,0.06)' }, // Teal
  { bg: '#fff7ed', border: '#fed7aa', text: '#9a3412', iconBg: '#ffedd5', shadow: '0 2px 8px rgba(249,115,22,0.06)' }, // Orange
  { bg: '#fdf2f8', border: '#fbcfe8', text: '#9d174d', iconBg: '#fce7f3', shadow: '0 2px 8px rgba(236,72,153,0.06)' }, // Pink
  { bg: '#f5f3ff', border: '#ddd6fe', text: '#5b21b6', iconBg: '#ede9fe', shadow: '0 2px 8px rgba(139,92,246,0.06)' }, // Indigo
];

const getPastelForString = (str = '', offset = 0) => {
  if (!str) return PASTEL_PALETTE[offset % PASTEL_PALETTE.length];
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  const idx = Math.abs(hash + offset) % PASTEL_PALETTE.length;
  return PASTEL_PALETTE[idx];
};

const PLANNING_CARD_PASTELS = [
  { bg: '#eff6ff', border: '#bfdbfe', color: '#1e40af', shadow: '0 2px 8px rgba(59,130,246,0.06)' },
  { bg: '#f0fdf4', border: '#bbf7d0', color: '#166534', shadow: '0 2px 8px rgba(34,197,94,0.06)' },
  { bg: '#fefce8', border: '#fef08a', color: '#854d0e', shadow: '0 2px 8px rgba(234,179,8,0.06)' },
  { bg: '#faf5ff', border: '#e9d5ff', color: '#6b21a8', shadow: '0 2px 8px rgba(168,85,247,0.06)' },
  { bg: '#fff1f2', border: '#fecdd3', color: '#9f1239', shadow: '0 2px 8px rgba(244,63,94,0.06)' },
  { bg: '#f0fdfa', border: '#99f6e4', color: '#115e59', shadow: '0 2px 8px rgba(20,184,166,0.06)' }
];

// Bảng 7 màu Pastel nhẹ nhàng gợi ý từ nhận diện thương hiệu FPT (Xanh dương - Xanh lá - Cam) cho 7 Level
const FPT_LEVEL_PASTELS = [
  { bg: '#eff6ff', border: '#bfdbfe', borderActive: '#3b82f6', text: '#1d4ed8', darkBg: 'rgba(30, 58, 138, 0.35)', darkBorder: '#2563eb', darkText: '#93c5fd' }, // Level 1: Xanh dương nhạt FPT
  { bg: '#f0fdfa', border: '#99f6e4', borderActive: '#14b8a6', text: '#0f766e', darkBg: 'rgba(19, 78, 74, 0.35)', darkBorder: '#0d9488', darkText: '#5eead4' }, // Level 2: Lam ngọc pastel
  { bg: '#f0fdf4', border: '#bbf7d0', borderActive: '#22c55e', text: '#15803d', darkBg: 'rgba(20, 83, 45, 0.35)', darkBorder: '#16a34a', darkText: '#86efac' }, // Level 3: Xanh lá FPT pastel
  { bg: '#f7fee7', border: '#d9f99d', borderActive: '#84cc16', text: '#4d7c0f', darkBg: 'rgba(54, 83, 20, 0.35)', darkBorder: '#65a30d', darkText: '#bef264' }, // Level 4: Vàng cốm/chanh pastel
  { bg: '#fffbeb', border: '#fde68a', borderActive: '#f59e0b', text: '#b45309', darkBg: 'rgba(120, 53, 15, 0.35)', darkBorder: '#d97706', darkText: '#fcd34d' }, // Level 5: Vàng hổ phách pastel
  { bg: '#fff7ed', border: '#fed7aa', borderActive: '#f97316', text: '#c2410c', darkBg: 'rgba(124, 45, 18, 0.35)', darkBorder: '#ea580c', darkText: '#fdba74' }, // Level 6: Cam FPT pastel
  { bg: '#fff1f2', border: '#fecdd3', borderActive: '#f43f5e', text: '#be123c', darkBg: 'rgba(136, 19, 55, 0.35)', darkBorder: '#e11d48', darkText: '#fda4af' }, // Level 7: Đỏ cam FPT pastel
];

// Bảng tọa độ GPS chính xác 100% của các dự án (Định vị chuẩn xác từng lô đất, chống lệch vị trí và chống tự kích hoạt tìm đường)
const PROJECT_EXACT_COORDINATES = {
  'CNS1': { lat: 21.05530, lng: 105.73480, name: 'Tòa nhà Công nghệ số 01 (CNS1)' },
  'CNS2': { lat: 21.05600, lng: 105.73550, name: 'Tòa nhà Công nghệ số 02 (CNS2)' },
  'CNS3': { lat: 21.05650, lng: 105.73600, name: 'Tòa nhà Công nghệ số 03 (CNS3)' },
  'HH1': { lat: 21.05450, lng: 105.73400, name: 'Khu hỗn hợp HH1' },
  'CNS-CVBT': { lat: 21.05500, lng: 105.73500, name: 'Công viên - biểu tượng KCN CNS' },
  'GPMB-CNS': { lat: 21.05350, lng: 105.73650, name: 'Khu đô thị Công viên CNS FPT' },
  '57A': { lat: 21.05400, lng: 105.73500, name: 'Dự án 57A' }
};

const ALL_PROJECT_STATUSES = ['Chưa bắt đầu', 'Đang thực hiện', 'Đã hoàn thành', 'Đã bị hủy'];

const ACCESS_LEVEL_MAP = {
  1: { label: 'Bình thường', desc: 'Mọi thành viên' },
  2: { label: 'Quan trọng', desc: 'Trưởng phòng' },
  3: { label: 'Mật', desc: 'Ban Giám đốc' },
  4: { label: 'Tuyệt mật', desc: 'Chỉ định riêng' }
};

// ── BẮT ĐẦU: PHƯƠNG ÁN 1 - KHỐI THÔNG TIN QUY HOẠCH & CHỈ TIÊU KIẾN TRÚC (GOM GỌN ĐỘC LẬP) ──
const DEFAULT_PLANNING_FALLBACK_DETAILS = [
  { name: 'Tổng diện tích ô đất dự án', value: '17.217 m²' },
  { name: 'Mật độ xây dựng', value: '45%' },
  { name: 'Hệ số sử dụng đất', value: '3,15 lần' },
  { name: 'Số tầng cao', value: '07 tầng' },
  { name: 'Số tầng hầm', value: '01 tầng' },
  { name: 'Diện tích xây dựng', value: '7.749 m²' },
  { name: 'Tổng diện tích sàn xây dựng', value: '54.243 m²' },
  { name: 'Công suất phục vụ', value: '6.000 nhân viên' },
  { name: 'Chiều cao PCCC', value: '< 28 m' },
  { name: 'Chiều cao tĩnh không', value: '29,5 m' },
  { name: 'Chiều sâu tầng hầm', value: '3,3 m' },
  { name: 'Phân cấp dự án', value: 'Cấp I' },
  { name: 'Phân loại dự án', value: 'Công trình công cộng, dân dụng' }
];

const MobileProjectPlanningSection = ({
  selectedProject,
  isDark = false,
  cardBg = '#ffffff',
  borderColor = '#e2e8f0',
  textColor = '#0f172a',
  subTextColor = '#64748b'
}) => {
  const [isExpanded, setIsExpanded] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  // 1. Dữ liệu các dòng chỉ tiêu quy hoạch (100% đồng bộ từ Web App)
  const allDetails = useMemo(() => {
    if (!selectedProject) return [];
    if (Array.isArray(selectedProject.details) && selectedProject.details.length > 0) {
      return selectedProject.details;
    }
    return DEFAULT_PLANNING_FALLBACK_DETAILS.map(d => ({
      ...d,
      value: selectedProject[d.key] || d.value
    }));
  }, [selectedProject]);

  // 2. Các cột hiển thị nếu xem dạng bảng
  const columns = useMemo(() => {
    if (Array.isArray(selectedProject?.detailColumns) && selectedProject.detailColumns.length > 0) {
      return selectedProject.detailColumns;
    }
    return [
      { key: 'name', label: 'Chỉ tiêu quy hoạch - kiến trúc', align: 'left' },
      { key: 'value', label: 'Thông số / Giá trị', align: 'left' }
    ];
  }, [selectedProject?.detailColumns]);

  // Các cột chứa dữ liệu/thông tin để vuốt qua lại (loại trừ cột Tên chỉ tiêu 'name')
  const valueColumns = useMemo(() => {
    const nonName = columns.filter(c => c.key !== 'name');
    if (nonName.length > 0) return nonName;
    return [{ key: 'value', label: 'Thông số / Giá trị', align: 'left' }];
  }, [columns]);

  // Vị trí cột hiện tại đang xem trong chế độ Thẻ Pastel
  const [activeColIndex, setActiveColIndex] = useState(0);
  const [swipeAnim, setSwipeAnim] = useState(null); // 'left' | 'right' | null
  const touchStartRef = useRef({ x: 0, y: 0, time: 0 });

  // Reset về cột đầu tiên khi đổi dự án
  useEffect(() => {
    setActiveColIndex(0);
  }, [selectedProject?.id]);

  const safeColIndex = Math.min(Math.max(0, activeColIndex), Math.max(0, valueColumns.length - 1));
  const currentCol = valueColumns[safeColIndex] || valueColumns[0];

  // Xử lý thao tác vuốt cảm ứng (Swipe gesture)
  const handleTouchStart = (e) => {
    if (!e.touches || e.touches.length === 0) return;
    touchStartRef.current = {
      x: e.touches[0].clientX,
      y: e.touches[0].clientY,
      time: Date.now()
    };
  };

  const handleTouchEnd = (e) => {
    if (!e.changedTouches || e.changedTouches.length === 0) return;
    const deltaX = e.changedTouches[0].clientX - touchStartRef.current.x;
    const deltaY = e.changedTouches[0].clientY - touchStartRef.current.y;
    const deltaTime = Date.now() - touchStartRef.current.time;

    // Ngưỡng vuốt: khoảng cách ngang > 35px, lớn hơn khoảng cách dọc, thời gian < 700ms
    if (Math.abs(deltaX) > 35 && Math.abs(deltaX) > Math.abs(deltaY) && deltaTime < 700) {
      if (deltaX < 0) {
        // Vuốt sang trái -> Hiện thông tin cột tiếp theo
        if (safeColIndex < valueColumns.length - 1) {
          setSwipeAnim('left');
          setActiveColIndex(prev => prev + 1);
          setTimeout(() => setSwipeAnim(null), 250);
        }
      } else {
        // Vuốt sang phải -> Trả về thông tin cột trước đó
        if (safeColIndex > 0) {
          setSwipeAnim('right');
          setActiveColIndex(prev => prev - 1);
          setTimeout(() => setSwipeAnim(null), 250);
        }
      }
    }
  };

  // 3. Lọc theo từ khóa tìm kiếm (nếu có nhập)
  const filteredDetails = useMemo(() => {
    if (!searchTerm.trim()) return allDetails;
    const q = searchTerm.trim().toLowerCase();
    return allDetails.filter(d => {
      if (d.isGroup) return true; // Giữ lại tiêu đề nhóm để dễ định hướng
      const nameMatch = (d.name || '').toLowerCase().includes(q);
      const valueMatch = (d.value || '').toLowerCase().includes(q);
      const otherMatch = Object.values(d).some(v => typeof v === 'string' && v.toLowerCase().includes(q));
      return nameMatch || valueMatch || otherMatch;
    });
  }, [allDetails, searchTerm]);

  // Đếm tổng số chỉ tiêu (không tính dòng nhóm)
  const totalItemCount = useMemo(() => {
    return allDetails.filter(d => !d.isGroup).length;
  }, [allDetails]);

  return (
    <div style={{
      backgroundColor: cardBg,
      borderRadius: '16px',
      padding: '16px',
      border: `1px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
    }}>
      {/* ── HEADER CỦA KHỐI QUY HOẠCH ── */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: isExpanded ? `1px solid ${borderColor}` : 'none',
        paddingBottom: isExpanded ? '10px' : '0',
        cursor: 'pointer',
        userSelect: 'none',
        gap: '8px',
        flexWrap: 'wrap'
      }}>
        {/* Tiêu đề & Icon */}
        <div
          onClick={() => setIsExpanded(!isExpanded)}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '180px' }}
        >
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Layers size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.98rem', fontWeight: '800', color: textColor }}>
                Thông tin quy hoạch
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: '800',
                color: '#2563eb',
                backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff',
                padding: '1px 6px',
                borderRadius: '10px',
                border: `1px solid ${isDark ? '#2563eb' : '#bfdbfe'}`
              }}>
                {totalItemCount} chỉ tiêu
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: subTextColor, fontWeight: '500' }}>
              Chỉ tiêu quy hoạch - kiến trúc dự án
            </span>
          </div>
        </div>

        {/* Mũi tên Accordion */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            onClick={() => setIsExpanded(!isExpanded)}
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '50%',
              backgroundColor: isDark ? '#334155' : '#f1f5f9',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'transform 0.25s ease',
              transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
              flexShrink: 0
            }}
          >
            <ChevronDown size={18} color="#2563eb" />
          </div>
        </div>
      </div>

      {/* ── NỘI DUNG CHÍNH (KHI MỞ ACCORDION) ── */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Thanh tìm kiếm nhanh chỉ tiêu */}
          {allDetails.length > 6 && (
            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: isDark ? '#0f172a' : '#f8fafc',
              border: `1px solid ${borderColor}`,
              borderRadius: '10px',
              padding: '6px 10px',
              gap: '6px'
            }}>
              <Search size={14} color={subTextColor} />
              <input
                type="text"
                placeholder="Tìm nhanh chỉ tiêu (mật độ, tầng cao, diện tích...)"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                style={{
                  flex: 1,
                  background: 'none',
                  border: 'none',
                  outline: 'none',
                  fontSize: '0.78rem',
                  color: textColor
                }}
              />
              {searchTerm && (
                <button
                  type="button"
                  onClick={() => setSearchTerm('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '0.7rem',
                    color: subTextColor,
                    cursor: 'pointer',
                    padding: '0 4px'
                  }}
                >
                  ✕
                </button>
              )}
            </div>
          )}

          {/* ════ DẠNG THẺ PASTEL (CARDS CÓ HỖ TRỢ VUỐT TRÁI / PHẢI) ════ */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {/* Thanh điều hướng & chỉ báo cột (Chỉ cần thiết khi có ít nhất 1 cột) */}
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                backgroundColor: isDark ? '#1e293b' : '#f1f5f9',
                borderRadius: '12px',
                padding: '7px 12px',
                border: `1px solid ${isDark ? '#334155' : '#e2e8f0'}`,
                marginTop: '2px'
              }}>
                <button
                  type="button"
                  disabled={safeColIndex === 0}
                  onClick={() => {
                    if (safeColIndex > 0) {
                      setSwipeAnim('right');
                      setActiveColIndex(prev => prev - 1);
                      setTimeout(() => setSwipeAnim(null), 250);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: safeColIndex === 0 ? (isDark ? '#475569' : '#cbd5e1') : '#2563eb',
                    cursor: safeColIndex === 0 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                  title="Cột trước đó (Vuốt sang phải)"
                >
                  <ChevronLeft size={18} />
                </button>

                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: '800', color: textColor }}>
                      {currentCol?.label || 'Thông số / Giá trị'}
                    </span>
                    {valueColumns.length > 1 && (
                      <span style={{
                        fontSize: '0.68rem',
                        fontWeight: '800',
                        color: '#2563eb',
                        backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff',
                        padding: '1px 7px',
                        borderRadius: '8px',
                        border: `1px solid ${isDark ? '#2563eb' : '#bfdbfe'}`
                      }}>
                        {safeColIndex + 1}/{valueColumns.length}
                      </span>
                    )}
                  </div>

                  {valueColumns.length > 1 ? (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '2px' }}>
                      {valueColumns.map((c, i) => (
                        <div
                          key={c.key || i}
                          onClick={() => {
                            setSwipeAnim(i > safeColIndex ? 'left' : 'right');
                            setActiveColIndex(i);
                            setTimeout(() => setSwipeAnim(null), 250);
                          }}
                          style={{
                            width: i === safeColIndex ? '18px' : '6px',
                            height: '5px',
                            borderRadius: '3px',
                            backgroundColor: i === safeColIndex ? '#2563eb' : (isDark ? '#475569' : '#cbd5e1'),
                            transition: 'all 0.2s ease',
                            cursor: 'pointer'
                          }}
                          title={c.label}
                        />
                      ))}
                    </div>
                  ) : (
                    <span style={{ fontSize: '0.68rem', color: subTextColor }}>
                      (Vuốt 👈 👉 trên thẻ để chuyển cột khi có nhiều cột)
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  disabled={safeColIndex >= valueColumns.length - 1}
                  onClick={() => {
                    if (safeColIndex < valueColumns.length - 1) {
                      setSwipeAnim('left');
                      setActiveColIndex(prev => prev + 1);
                      setTimeout(() => setSwipeAnim(null), 250);
                    }
                  }}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: safeColIndex >= valueColumns.length - 1 ? (isDark ? '#475569' : '#cbd5e1') : '#2563eb',
                    cursor: safeColIndex >= valueColumns.length - 1 ? 'not-allowed' : 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    padding: '4px',
                    borderRadius: '6px'
                  }}
                  title="Cột tiếp theo (Vuốt sang trái)"
                >
                  <ChevronRight size={18} />
                </button>
              </div>

              {/* Lưới thẻ Pastel hỗ trợ vuốt ngón tay (Touch Swipe) */}
              <div
                onTouchStart={handleTouchStart}
                onTouchEnd={handleTouchEnd}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '10px',
                  marginTop: '2px',
                  userSelect: 'none',
                  touchAction: 'pan-y',
                  transition: 'opacity 0.2s ease, transform 0.2s ease',
                  opacity: swipeAnim ? 0.65 : 1,
                  transform: swipeAnim === 'left' ? 'translateX(-6px)' : (swipeAnim === 'right' ? 'translateX(6px)' : 'none')
                }}
              >
                {filteredDetails.length === 0 ? (
                  <div style={{
                    gridColumn: '1 / -1',
                    textAlign: 'center',
                    padding: '24px',
                    color: subTextColor,
                    fontSize: '0.82rem'
                  }}>
                    Không tìm thấy chỉ tiêu quy hoạch nào khớp với từ khóa "{searchTerm}".
                  </div>
                ) : (
                  filteredDetails.map((item, pIdx) => {
                    if (item.isGroup) {
                      const level = item.level || 0;
                      return (
                        <div
                          key={item.id || `group_${pIdx}`}
                          style={{
                            gridColumn: '1 / -1',
                            backgroundColor: level === 0 
                              ? (isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff') 
                              : (isDark ? 'rgba(37,99,235,0.1)' : '#f8fafc'),
                            padding: '10px 14px',
                            borderRadius: '10px',
                            borderLeft: level === 0 ? '4px solid #2563eb' : '3px solid #60a5fa',
                            color: '#2563eb',
                            fontWeight: '800',
                            fontSize: '0.85rem',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            marginTop: pIdx > 0 ? '6px' : '0'
                          }}
                        >
                          <Folder size={15} />
                          <span>{item.name}</span>
                        </div>
                      );
                    }

                    const pastelStyle = PLANNING_CARD_PASTELS[pIdx % PLANNING_CARD_PASTELS.length];
                    const cellVal = item[currentCol.key];

                    return (
                      <div
                        key={item.id || `item_${pIdx}`}
                        style={{
                          backgroundColor: isDark ? '#0f172a' : pastelStyle.bg,
                          padding: '12px 14px',
                          borderRadius: '14px',
                          border: `1px solid ${isDark ? borderColor : pastelStyle.border}`,
                          boxShadow: isDark ? 'none' : pastelStyle.shadow,
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between'
                        }}
                      >
                        <span style={{
                          fontSize: '0.75rem',
                          color: subTextColor,
                          display: 'block',
                          fontWeight: '600',
                          lineHeight: '1.3'
                        }}>
                          {item.name}
                        </span>
                        
                        <div>
                          <span style={{
                            fontSize: '0.94rem',
                            fontWeight: '800',
                            color: isDark ? textColor : pastelStyle.color,
                            marginTop: '6px',
                            display: 'block',
                            lineHeight: '1.25',
                            wordBreak: 'break-word'
                          }}>
                            {cellVal || (currentCol.key === 'value' ? item.value : '') || 'Chưa cập nhật'}
                          </span>

                          {valueColumns.length > 1 && (
                            <span style={{
                              fontSize: '0.66rem',
                              color: subTextColor,
                              marginTop: '4px',
                              display: 'block',
                              fontWeight: '500'
                            }}>
                              {currentCol.label}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
        </div>
      )}
    </div>
  );
};
// ── KẾT THÚC: PHƯƠNG ÁN 1 - KHỐI THÔNG TIN QUY HOẠCH & CHỈ TIÊU KIẾN TRÚC ──

// ── BẮT ĐẦU: KHỐI THÀNH VIÊN DỰ ÁN TRÊN MOBILE ─────────────────────────────
const MobileProjectMembersSection = ({
  selectedProject,
  members = [],
  isDark = false,
  cardBg = '#ffffff',
  borderColor = '#e2e8f0',
  textColor = '#0f172a',
  subTextColor = '#64748b'
}) => {
  const [isExpanded, setIsExpanded] = useState(true);

  // Danh sách thành viên của dự án (kèm thông tin chi tiết được ánh xạ từ members)
  const projectMembersList = useMemo(() => {
    if (!selectedProject) return [];
    let rawList = selectedProject.projectMembers || selectedProject.members || [];
    
    // Nếu chưa cấu hình thành viên trong dự án và là dự án mẫu, fallback danh sách hiển thị
    if ((!Array.isArray(rawList) || rawList.length === 0) && (selectedProject.code === 'CNS-01' || selectedProject.name?.includes('CNS-1'))) {
      rawList = [
        { memberId: 1, role: 'Giám đốc DA' },
        { memberId: 2, role: 'Chuyên viên' },
        { memberId: 4, role: 'Thư ký DA' }
      ];
    }

    if (!Array.isArray(rawList)) return [];

    return rawList.map((item, idx) => {
      const memberId = typeof item === 'object' ? (item.memberId || item.id) : item;
      const projectRole = typeof item === 'object' ? (item.role || item.projectRole || '') : '';
      
      const memberInfo = members.find(m => 
        (memberId && m.id?.toString() === memberId?.toString()) ||
        (item?.email && m.email?.toLowerCase() === item.email?.toLowerCase())
      );

      return {
        id: memberId || idx,
        name: memberInfo?.name || (typeof item === 'object' ? item.name : '') || 'Thành viên',
        role: projectRole || memberInfo?.projectRole || memberInfo?.role || 'Thành viên',
        email: memberInfo?.email || (typeof item === 'object' ? item.email : '') || '',
        phone: memberInfo?.phone || (typeof item === 'object' ? item.phone : '') || '',
        avatar: memberInfo?.avatar || (typeof item === 'object' ? item.avatar : '') || '',
        department: memberInfo?.department || '',
        position: memberInfo?.position || ''
      };
    });
  }, [selectedProject, members]);

  return (
    <div style={{
      backgroundColor: cardBg,
      borderRadius: '16px',
      padding: '16px',
      border: `1px solid ${borderColor}`,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      boxShadow: '0 4px 16px rgba(0,0,0,0.03)'
    }}>
      {/* Header Khối Thành viên dự án */}
      <div
        onClick={() => setIsExpanded(!isExpanded)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          borderBottom: isExpanded ? `1px solid ${borderColor}` : 'none',
          paddingBottom: isExpanded ? '10px' : '0',
          cursor: 'pointer',
          userSelect: 'none'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div style={{
            width: '32px',
            height: '32px',
            borderRadius: '10px',
            backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff',
            color: '#2563eb',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0
          }}>
            <Users size={18} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ fontSize: '0.98rem', fontWeight: '800', color: textColor }}>
                Thành viên dự án
              </span>
              <span style={{
                fontSize: '0.7rem',
                fontWeight: '800',
                color: '#2563eb',
                backgroundColor: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff',
                padding: '1px 7px',
                borderRadius: '10px',
                border: `1px solid ${isDark ? '#2563eb' : '#bfdbfe'}`
              }}>
                {projectMembersList.length} thành viên
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: subTextColor, fontWeight: '500' }}>
              Nhân sự tham gia & vai trò trong dự án
            </span>
          </div>
        </div>

        <div style={{
          width: '30px',
          height: '30px',
          borderRadius: '50%',
          backgroundColor: isDark ? '#334155' : '#f1f5f9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'transform 0.25s ease',
          transform: isExpanded ? 'rotate(0deg)' : 'rotate(-90deg)',
          flexShrink: 0
        }}>
          <ChevronDown size={18} color="#2563eb" />
        </div>
      </div>

      {/* Danh sách thành viên */}
      {isExpanded && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '2px' }}>
          {projectMembersList.length === 0 ? (
            <div style={{
              backgroundColor: isDark ? '#0f172a' : '#f8fafc',
              padding: '18px',
              borderRadius: '12px',
              textAlign: 'center',
              color: subTextColor,
              fontSize: '0.82rem',
              border: `1px solid ${borderColor}`
            }}>
              Chưa có thành viên nào được phân công vào dự án này.
            </div>
          ) : (
            projectMembersList.map((mem, idx) => {
              const initials = mem.name
                ? mem.name.trim().split(/\s+/).slice(-2).map(w => w[0]).join('').toUpperCase()
                : 'TV';

              // Màu thẻ pastel cho từng vai trò
              const roleColorMap = {
                'Giám đốc DA': { bg: isDark ? 'rgba(239,68,68,0.2)' : '#fef2f2', text: '#dc2626', border: isDark ? '#dc2626' : '#fecaca' },
                'Chuyên viên': { bg: isDark ? 'rgba(37,99,235,0.2)' : '#eff6ff', text: '#2563eb', border: isDark ? '#2563eb' : '#bfdbfe' },
                'Thư ký DA': { bg: isDark ? 'rgba(16,185,129,0.2)' : '#ecfdf5', text: '#059669', border: isDark ? '#059669' : '#a7f3d0' }
              };
              const roleStyle = roleColorMap[mem.role] || {
                bg: isDark ? 'rgba(99,102,241,0.2)' : '#eef2ff',
                text: '#4f46e5',
                border: isDark ? '#6366f1' : '#c7d2fe'
              };

              return (
                <div
                  key={mem.id || idx}
                  style={{
                    backgroundColor: isDark ? '#0f172a' : '#f8fafc',
                    borderRadius: '12px',
                    padding: '10px 12px',
                    border: `1px solid ${borderColor}`,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '10px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                    {/* Ảnh đại diện Avatar */}
                    {mem.avatar ? (
                      <img
                        src={mem.avatar}
                        alt={mem.name}
                        style={{
                          width: '40px',
                          height: '40px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: `2px solid ${isDark ? '#334155' : '#ffffff'}`,
                          boxShadow: '0 2px 5px rgba(0,0,0,0.06)',
                          flexShrink: 0
                        }}
                      />
                    ) : (
                      <div style={{
                        width: '40px',
                        height: '40px',
                        borderRadius: '50%',
                        backgroundColor: '#2563eb',
                        color: '#ffffff',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: '800',
                        fontSize: '0.85rem',
                        flexShrink: 0,
                        boxShadow: '0 2px 5px rgba(37,99,235,0.25)'
                      }}>
                        {initials}
                      </div>
                    )}

                    {/* Họ tên & thông tin liên hệ */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', minWidth: 0, flex: 1 }}>
                      <span style={{
                        fontSize: '0.88rem',
                        fontWeight: '800',
                        color: textColor,
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis'
                      }}>
                        {mem.name}
                      </span>

                      {mem.email && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          color: subTextColor,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap'
                        }}>
                          <Mail size={12} color={subTextColor} style={{ flexShrink: 0 }} />
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{mem.email}</span>
                        </div>
                      )}

                      {mem.phone && (
                        <div style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          fontSize: '0.72rem',
                          color: '#2563eb'
                        }}>
                          <Phone size={12} color="#2563eb" style={{ flexShrink: 0 }} />
                          <a
                            href={`tel:${mem.phone}`}
                            style={{ color: '#2563eb', textDecoration: 'none', fontWeight: '600' }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {mem.phone}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Nhãn vai trò dự án */}
                  <div style={{ flexShrink: 0 }}>
                    <span style={{
                      backgroundColor: roleStyle.bg,
                      color: roleStyle.text,
                      fontSize: '0.72rem',
                      fontWeight: '800',
                      padding: '3px 9px',
                      borderRadius: '8px',
                      border: `1px solid ${roleStyle.border}`,
                      display: 'inline-block',
                      whiteSpace: 'nowrap'
                    }}>
                      {mem.role}
                    </span>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};
// ── KẾT THÚC: KHỐI THÀNH VIÊN DỰ ÁN TRÊN MOBILE ─────────────────────────────

const MobileDocumentApp = ({ onCloseMobileView }) => {
  const {
    allDocuments: documents = [],
    allProjects: allProjects = [],
    addDocument,
    deleteDocument,
    members = [],
    editMember,
    addMember,
    currentUser,
    userRole,
    documentTypes: dynamicDocTypes = [],
    uniqueAgencies: issuingAgencies = []
  } = useContext(DocumentContext);

  // Screen Navigation States
  const [activeScreen, setActiveScreen] = useState('overview');
  const [selectedDoc, setSelectedDoc] = useState(null);
  const [selectedProject, setSelectedProject] = useState(null);

  // Dark Mode State
  const [isDark, setIsDark] = useState(() => {
    try {
      return localStorage.getItem('fdi_mobile_theme') === 'dark';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('fdi_mobile_theme', isDark ? 'dark' : 'light');
    } catch {}
  }, [isDark]);

  // Tình trạng dự án lọc theo cài đặt người dùng (Lưu trữ bền vững trong LocalStorage)
  const [projectStatusFilter, setProjectStatusFilter] = useState(() => {
    try {
      const saved = localStorage.getItem('fdi_mobile_project_status_filter');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {}
    return ALL_PROJECT_STATUSES;
  });

  const handleToggleProjectStatus = (status) => {
    setProjectStatusFilter(prev => {
      let next;
      if (prev.includes(status)) {
        next = prev.filter(s => s !== status);
        if (next.length === 0) next = [status];
      } else {
        next = [...prev, status];
      }
      try {
        localStorage.setItem('fdi_mobile_project_status_filter', JSON.stringify(next));
      } catch {}
      return next;
    });
  };

  // Expandable sections in Project Detail
  const [isPlanningExpanded, setIsPlanningExpanded] = useState(true);
  const [isDocsExpanded, setIsDocsExpanded] = useState(true);

  // Search & Filter States
  const [searchKeyword, setSearchKeyword] = useState('');
  const [selectedFilterChip, setSelectedFilterChip] = useState('Tất cả');
  const [selectedProjectFilterChip, setSelectedProjectFilterChip] = useState('Tất cả');

  // Favorites & Toast
  const [favorites, setFavorites] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('fdi_mobile_favs') || '[]');
    } catch {
      return [];
    }
  });
  const [toastMessage, setToastMessage] = useState(null);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  const toggleFavorite = (docId, e) => {
    if (e) e.stopPropagation();
    setFavorites(prev => {
      const next = prev.includes(docId) ? prev.filter(id => id !== docId) : [...prev, docId];
      try {
        localStorage.setItem('fdi_mobile_favs', JSON.stringify(next));
      } catch {}
      showToast(next.includes(docId) ? 'Đã thêm vào mục Yêu thích ⭐' : 'Đã xóa khỏi mục Yêu thích');
      return next;
    });
  };

  // SSOT Project Name & Code Resolver
  const resolveProjectDisplayName = (rawPrj) => {
    if (!rawPrj) return 'Dự án chung';
    if (typeof rawPrj === 'object') {
      const matched = (allProjects || []).find(p => String(p.id) === String(rawPrj.id));
      if (matched && matched.name) return matched.name;
      if (rawPrj.name) {
        if (rawPrj.name.includes('Khu công viên công nghệ số và hỗn hợp')) return 'Khu đô thị Công viên công nghệ số FPT';
        return rawPrj.name;
      }
      return 'Dự án chung';
    }
    const str = String(rawPrj).trim();
    if (str.includes('Khu công viên công nghệ số và hỗn hợp')) return 'Khu đô thị Công viên công nghệ số FPT';
    const foundById = (allProjects || []).find(p => String(p.id) === str);
    if (foundById && foundById.name) return foundById.name;
    const foundByCode = (allProjects || []).find(p => (p.code || '').toLowerCase() === str.toLowerCase());
    if (foundByCode && foundByCode.name) return foundByCode.name;
    const foundByName = (allProjects || []).find(p => (p.name || '').toLowerCase() === str.toLowerCase());
    if (foundByName && foundByName.name) return foundByName.name;
    return str || 'Dự án chung';
  };

  const getDocProjectName = (doc) => {
    if (!doc) return 'Dự án chung';
    if (doc.projectId) {
      const found = (allProjects || []).find(p => String(p.id) === String(doc.projectId));
      if (found && found.name) return found.name;
    }
    if (Array.isArray(doc.relatedProjects) && doc.relatedProjects.length > 0) {
      return resolveProjectDisplayName(doc.relatedProjects[0]);
    }
    if (doc.projectName) {
      return resolveProjectDisplayName(doc.projectName);
    }
    return 'Dự án chung';
  };

  // User Profile & Initials
  const firebaseUser = auth?.currentUser;
  
  const currentMemberInfo = useMemo(() => {
    const email = firebaseUser?.email || currentUser?.email;
    if (!email) return null;
    return members.find(m => (m.email || '').toLowerCase() === email.toLowerCase()) || null;
  }, [members, currentUser, firebaseUser]);

  const userName = useMemo(() => {
    return firebaseUser?.displayName 
      || currentMemberInfo?.name 
      || currentUser?.name 
      || currentUser?.displayName 
      || 'Nguyễn Mậu Tùng';
  }, [firebaseUser, currentMemberInfo, currentUser]);

  const userEmail = useMemo(() => {
    return firebaseUser?.email 
      || currentMemberInfo?.email 
      || currentUser?.email 
      || 'tungnm35@fpt.com';
  }, [firebaseUser, currentMemberInfo, currentUser]);

  const userProjectRole = useMemo(() => {
    // 1. Kiểm tra các vai trò được phân công cụ thể trong các dự án (projectMembers)
    const currentMemberId = currentMemberInfo?.id;
    const currentEmail = (firebaseUser?.email || currentUser?.email || userEmail || '').toLowerCase();
    const rolesFromProjects = new Set();

    if (Array.isArray(allProjects)) {
      allProjects.forEach(p => {
        if (Array.isArray(p.projectMembers)) {
          const pm = p.projectMembers.find(m => 
            (currentMemberId && m.memberId?.toString() === currentMemberId.toString()) ||
            (m.email && m.email.toLowerCase() === currentEmail)
          );
          if (pm?.role && pm.role.trim()) {
            rolesFromProjects.add(pm.role.trim());
          }
        }
      });
    }

    if (rolesFromProjects.size > 0) {
      return Array.from(rolesFromProjects).join(', ');
    }

    // 2. Vai trò trong dự án từ thông tin thành viên (members)
    if (currentMemberInfo?.projectRole && currentMemberInfo.projectRole.trim()) {
      return currentMemberInfo.projectRole.trim();
    }
    if (currentMemberInfo?.role && currentMemberInfo.role.trim()) {
      return currentMemberInfo.role.trim();
    }

    // 3. Vai trò từ currentUser hoặc context
    if (currentUser?.projectRole && currentUser.projectRole.trim()) {
      return currentUser.projectRole.trim();
    }
    if (currentUser?.role && currentUser.role.trim()) {
      return currentUser.role.trim();
    }
    if (userRole && userRole.trim() && userRole !== 'User') {
      return userRole.trim();
    }

    return 'Giám đốc DA';
  }, [currentMemberInfo, allProjects, firebaseUser, currentUser, userEmail, userRole]);

  const userAvatar = useMemo(() => {
    return currentMemberInfo?.avatar 
      || firebaseUser?.photoURL 
      || currentUser?.avatar 
      || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=120&h=120&fit=crop&crop=faces';
  }, [currentMemberInfo, firebaseUser, currentUser]);

  const userInitials = useMemo(() => {
    if (!userName) return 'T';
    const parts = userName.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return userName.slice(0, 2).toUpperCase();
  }, [userName]);

  const renderUserAvatar = (size = 46, fontSize = '1rem', editable = false) => {
    const avatarContent = userAvatar ? (
      <div style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        backgroundImage: `url(${userAvatar})`, backgroundSize: 'cover', backgroundPosition: 'center',
        border: '2px solid #ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.12)', flexShrink: 0
      }} />
    ) : (
      <div style={{
        width: `${size}px`, height: `${size}px`, borderRadius: '50%',
        backgroundColor: '#2563eb', color: '#ffffff', display: 'flex', alignItems: 'center',
        justifyContent: 'center', fontWeight: '800', fontSize: fontSize,
        boxShadow: '0 4px 12px rgba(37,99,235,0.3)', flexShrink: 0
      }}>
        {userInitials}
      </div>
    );

    if (!editable) return avatarContent;

    const badgeSize = Math.max(18, Math.round(size * 0.38));
    const iconSize = Math.max(10, Math.round(size * 0.22));

    return (
      <div
        onClick={(e) => {
          e.stopPropagation();
          avatarInputRef.current?.click();
        }}
        title="Bấm để đổi ảnh đại diện"
        style={{ position: 'relative', cursor: 'pointer', flexShrink: 0 }}
      >
        {avatarContent}
        <div style={{
          position: 'absolute',
          bottom: '-2px',
          right: '-2px',
          width: `${badgeSize}px`,
          height: `${badgeSize}px`,
          borderRadius: '50%',
          backgroundColor: '#2563eb',
          color: '#ffffff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: '2px solid #ffffff',
          boxShadow: '0 2px 6px rgba(0,0,0,0.25)'
        }}>
          {isUpdatingAvatar ? (
            <RefreshCw size={iconSize} className="spin" />
          ) : (
            <Camera size={iconSize} />
          )}
        </div>
      </div>
    );
  };

  // Helper kiểm tra tài liệu thuộc về dự án: CHỈ khớp các tài liệu được tag trực tiếp tên / ID / mã dự án liên quan
  const isDocRelatedToProject = (doc, prj) => {
    if (!doc || !prj) return false;
    
    const prjId = String(prj.id || '').trim().toLowerCase();
    const prjCode = String(prj.code || '').trim().toLowerCase();
    const prjName = String(prj.name || '').trim().toLowerCase();
    
    const docPrjId = String(doc.projectId || '').trim().toLowerCase();
    const docPrjName = String(doc.projectName || '').trim().toLowerCase();
    
    // 1. Khớp trực tiếp qua trường projectId hoặc projectName của tài liệu
    if (docPrjId && prjId && docPrjId === prjId) return true;
    if (docPrjId && prjCode && docPrjId === prjCode) return true;
    if (docPrjName && prjName && (docPrjName === prjName || (prjName.includes(docPrjName) && docPrjName.length > 5))) return true;
    if (docPrjName && prjCode && docPrjName === prjCode) return true;
    
    // 2. Khớp trực tiếp qua mảng relatedProjects (chỉ khớp chính xác tên, ID hoặc mã dự án được tag)
    if (Array.isArray(doc.relatedProjects) && doc.relatedProjects.length > 0) {
      for (const item of doc.relatedProjects) {
        if (!item) continue;
        if (typeof item === 'object') {
          const iId = String(item.id || '').trim().toLowerCase();
          const iCode = String(item.code || '').trim().toLowerCase();
          const iName = String(item.name || '').trim().toLowerCase();
          if (prjId && iId === prjId) return true;
          if (prjCode && iCode === prjCode) return true;
          if (prjName && (iName === prjName || iName.includes(prjName) || prjName.includes(iName))) return true;
        } else {
          const str = String(item).trim().toLowerCase();
          if (prjId && str === prjId) return true;
          if (prjCode && str === prjCode) return true;
          if (prjName && (str === prjName || str.includes(prjName) || prjName.includes(str))) return true;
          
          // Chỉ chuyển đổi riêng tên cũ thành tên mới của đúng 1 dự án FPT:
          // "Khu công viên công nghệ số và hỗn hợp" <-> "Khu đô thị Công viên công nghệ số FPT" (GPMB-CNS)
          if (
            (str.includes('công nghệ số và hỗn hợp') || str === 'gpmb-cns') &&
            (prjCode === 'gpmb-cns' || prjName.includes('công viên công nghệ số fpt') || prjName.includes('công nghệ số và hỗn hợp'))
          ) {
            return true;
          }
        }
      }
    }

    return false;
  };

  // List of active documents
  const activeDocsList = useMemo(() => {
    return (documents || []).filter(d => !d.isDeleted);
  }, [documents]);

  // List of active projects (Lọc tự động theo Tình trạng dự án đã chọn trong Cài đặt)
  const projectsList = useMemo(() => {
    return (allProjects || []).filter(p => {
      if (p.isDeleted) return false;
      const pStatus = (p.status || 'Đang thực hiện').trim();
      return projectStatusFilter.some(s => s.toLowerCase() === pStatus.toLowerCase());
    });
  }, [allProjects, projectStatusFilter]);

  // Dynamic filter chips for Document Types
  const dynamicFilterChips = useMemo(() => {
    const rawList = Array.isArray(dynamicDocTypes) && dynamicDocTypes.length > 0
      ? dynamicDocTypes.map(t => typeof t === 'string' ? t : (t.name || t.label || 'Khác'))
      : ['Báo cáo', 'Biên bản', 'Chưa xác định', 'Công văn đến', 'Công văn đi', 'Hồ sơ thiết kế', 'Hợp đồng', 'Kế hoạch', 'Nghị định', 'Nghị quyết', 'Quyết định', 'Thông báo', 'Thông tư', 'Tờ trình'];
    const unique = Array.from(new Set(rawList.filter(Boolean))).sort((a, b) => a.localeCompare(b, 'vi'));
    return ['Tất cả', ...unique];
  }, [dynamicDocTypes]);

  // Dynamic filter chips for Project Codes
  const projectFilterChips = useMemo(() => {
    const codes = new Set();
    (allProjects || []).forEach(p => {
      if (p.code && p.code.trim()) codes.add(p.code.trim());
    });
    return ['Tất cả', ...Array.from(codes).sort((a, b) => a.localeCompare(b, 'vi'))];
  }, [allProjects]);

  // Short project codes for Upload Form
  const shortProjectCodes = useMemo(() => {
    const codeMap = new Map();
    (allProjects || []).forEach(p => {
      const code = (p.code && p.code.trim()) || p.id || 'DA';
      codeMap.set(code, p);
    });
    return Array.from(codeMap.keys()).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [allProjects]);

  // Dynamic Issuing Agencies
  const dynamicAgencies = useMemo(() => {
    const list = Array.isArray(issuingAgencies) && issuingAgencies.length > 0
      ? issuingAgencies.map(a => typeof a === 'string' ? a : (a.name || a.label || 'Chưa xác định'))
      : ['Chưa xác định', 'UBND Thành phố Hà Nội', 'Sở Xây dựng', 'Sở Quy hoạch - Kiến trúc', 'Sở Kế hoạch và Đầu tư', 'Sở Tài nguyên và Môi trường', 'Tập đoàn FPT', 'Công ty TNHH Hạ tầng công nghệ số FPT'];
    const unique = Array.from(new Set(list.filter(Boolean)));
    const withoutUnspecified = unique.filter(a => a !== 'Chưa xác định').sort((a, b) => a.localeCompare(b, 'vi'));
    return ['Chưa xác định', ...withoutUnspecified];
  }, [issuingAgencies]);

  // Upload Form State
  const autoGeneratedDocCode = useMemo(() => {
    const today = new Date();
    const d = String(today.getDate()).padStart(2, '0');
    const m = String(today.getMonth() + 1).padStart(2, '0');
    const y = today.getFullYear();
    const count = (activeDocsList.length + 1).toString().padStart(3, '0');
    return `${d}.${m}.${y}_${count}`;
  }, [activeDocsList.length]);

  const avatarInputRef = useRef(null);
  const [isUpdatingAvatar, setIsUpdatingAvatar] = useState(false);

  const handleAvatarChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('Vui lòng chọn tệp hình ảnh hợp lệ (PNG, JPG, JPEG, WebP)!');
      return;
    }

    setIsUpdatingAvatar(true);
    showToast('Đang tải và cập nhật ảnh đại diện... ⏳');

    try {
      // 1. Tải ảnh lên Firebase Storage
      const fileStorageRef = storageRef(storage, `avatars/${Date.now()}_${file.name}`);
      const snapshot = await uploadBytes(fileStorageRef, file);
      const downloadURL = await getDownloadURL(snapshot.ref);

      // 2. Cập nhật Firebase Auth profile để đồng bộ toàn phiên làm việc
      if (auth.currentUser) {
        await updateProfile(auth.currentUser, { photoURL: downloadURL });
      }

      // 3. Cập nhật vào Firestore members collection (nguồn dữ liệu chính của bản Web và Mobile)
      const targetEmail = (firebaseUser?.email || currentUser?.email || userEmail || '').toLowerCase();
      const existingMember = members.find(m => (m.email || '').toLowerCase() === targetEmail);

      if (existingMember?.id && editMember) {
        await editMember(existingMember.id, {
          ...existingMember,
          avatar: downloadURL
        });
      } else if (addMember) {
        await addMember({
          name: userName,
          email: targetEmail,
          avatar: downloadURL,
          role: 'User',
          level: 1,
          createdAt: new Date().toISOString()
        });
      }

      showToast('Cập nhật ảnh đại diện thành công trên cả Mobile và Web! 📸');
    } catch (err) {
      console.error('Lỗi khi cập nhật ảnh đại diện:', err);
      showToast('Có lỗi xảy ra khi cập nhật ảnh đại diện. Vui lòng thử lại!');
    } finally {
      setIsUpdatingAvatar(false);
      if (e.target) e.target.value = '';
    }
  };

  const [isUploading, setIsUploading] = useState(false);
  const [showSignOut, setShowSignOut] = useState(false);
  const [uploadFormState, setUploadFormState] = useState({
    code: autoGeneratedDocCode,
    documentNumber: '',
    documentType: '',
    summary: '',
    keywords: '',
    effectiveDate: new Date().toISOString().split('T')[0],
    issuingAgency: 'Chưa xác định',
    accessLevel: 1, minAccessLevel: 1,
    relatedProjects: [],
    attachments: []
  });

  useEffect(() => {
    if (activeScreen === 'upload_form') {
      setUploadFormState(prev => ({
        ...prev,
        code: autoGeneratedDocCode,
        documentType: prev.documentType || (dynamicFilterChips[1] || 'Báo cáo')
      }));
    }
  }, [activeScreen, autoGeneratedDocCode, dynamicFilterChips]);

  const handleToggleUploadProjectCode = (pCode) => {
    setUploadFormState(prev => {
      const current = prev.relatedProjects || [];
      if (current.includes(pCode)) {
        return { ...prev, relatedProjects: current.filter(c => c !== pCode) };
      } else {
        return { ...prev, relatedProjects: [...current, pCode] };
      }
    });
  };

  const handleUploadFilePick = (e) => {
    const pickedFiles = Array.from(e.target.files || []);
    if (pickedFiles.length === 0) return;
    const newFileObjs = pickedFiles.map(file => ({
      name: file.name,
      size: (file.size / 1024 / 1024).toFixed(2) + ' MB',
      type: file.type,
      rawFile: file,
      url: URL.createObjectURL(file)
    }));
    setUploadFormState(prev => ({
      ...prev,
      attachments: [...prev.attachments, ...newFileObjs]
    }));
  };

  const handleRemoveUploadFile = (idx) => {
    setUploadFormState(prev => ({
      ...prev,
      attachments: prev.attachments.filter((_, i) => i !== idx)
    }));
  };

  const handleSubmitUploadForm = async (e) => {
    e.preventDefault();
    if (!uploadFormState.summary.trim()) {
      showToast('Vui lòng nhập trích yếu nội dung văn bản!');
      return;
    }

    setIsUploading(true);
    showToast('Đang xử lý và tải tệp tin lên hệ thống lưu trữ... ⏳');

    try {
      const withTimeout = (promise, ms = 300000) =>
        Promise.race([
          promise,
          new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), ms))
        ]);

      // Tải tất cả các tệp thực tế lên Firebase Storage để lấy URL vĩnh viễn
      const finalAttachments = await Promise.all(
        uploadFormState.attachments.map(async (fileObj, fIdx) => {
          if (fileObj.rawFile && storage) {
            try {
              const fileStorageRef = storageRef(storage, `documents/${Date.now()}_${fIdx}_${fileObj.rawFile.name}`);
              const snapshot = await withTimeout(uploadBytes(fileStorageRef, fileObj.rawFile), 300000);
              const permanentUrl = await getDownloadURL(snapshot.ref);
              return {
                name: fileObj.name || fileObj.rawFile.name,
                size: fileObj.size,
                url: permanentUrl,
                type: fileObj.type || 'file'
              };
            } catch (err) {
              console.error('Lỗi khi tải file lên Storage:', err);
              return {
                name: fileObj.name,
                size: fileObj.size,
                url: fileObj.url
              };
            }
          }
          return {
            name: fileObj.name,
            size: fileObj.size,
            url: fileObj.url
          };
        })
      );

      const matchedPrj = (allProjects || []).find(p => (uploadFormState.relatedProjects || []).includes(p.code));

      const newDoc = {
        code: uploadFormState.code,
        documentNumber: uploadFormState.documentNumber || uploadFormState.code,
        summary: uploadFormState.summary,
        keywords: uploadFormState.keywords || '',
        documentType: uploadFormState.documentType || 'Báo cáo',
        type: uploadFormState.documentType || 'Báo cáo',
        effectiveDate: uploadFormState.effectiveDate,
        date: uploadFormState.effectiveDate,
        issuingAgency: uploadFormState.issuingAgency || 'Chưa xác định',
        minAccessLevel: uploadFormState.minAccessLevel || 1,
        accessLevels: [uploadFormState.minAccessLevel || 1],
        relatedProjects: uploadFormState.relatedProjects || [],
        projectId: matchedPrj?.id || (allProjects[0]?.id || ''),
        projectName: matchedPrj?.name || 'Dự án chung',
        attachments: finalAttachments,
        createdAt: new Date().toISOString()
      };

      if (addDocument) {
        await addDocument(newDoc);
      }
      showToast('Tải lên tài liệu thành công! 📄');
      setActiveScreen('overview');
      setUploadFormState({
        code: '',
        documentNumber: '',
        documentType: '',
        summary: '',
        keywords: '',
        effectiveDate: new Date().toISOString().split('T')[0],
        issuingAgency: 'Chưa xác định',
        accessLevel: 1, minAccessLevel: 1,
        relatedProjects: [],
        attachments: []
      });
    } catch (error) {
      console.error('Lỗi khi tải lên tài liệu:', error);
      showToast('Có lỗi xảy ra khi lưu tài liệu. Vui lòng thử lại!');
    } finally {
      setIsUploading(false);
    }
  };

  // Google Maps Exact Location Opener
  const handleOpenMapLocation = (locationStr, prjObj) => {
    if (prjObj?.mapUrl && typeof prjObj.mapUrl === 'string' && prjObj.mapUrl.startsWith('http')) {
      window.open(prjObj.mapUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    if (prjObj?.coordinates && typeof prjObj.coordinates === 'string' && prjObj.coordinates.trim()) {
      const exactPinUrl = `https://www.google.com/maps?q=${encodeURIComponent(prjObj.coordinates.trim())}&z=17`;
      window.open(exactPinUrl, '_blank', 'noopener,noreferrer');
      return;
    }
    const prjCode = prjObj?.code || '';
    const exactGeo = PROJECT_EXACT_COORDINATES[prjCode] || (prjObj?.lat && prjObj?.lng ? { lat: prjObj.lat, lng: prjObj.lng, name: prjObj.name } : null);

    if (exactGeo) {
      const exactPinUrl = `https://www.google.com/maps?q=${exactGeo.lat},${exactGeo.lng}&z=17`;
      window.open(exactPinUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!locationStr) return;
    let cleanLocation = String(locationStr).trim();
    cleanLocation = cleanLocation.replace(/^Lô\s+[A-Za-z0-9_-]+,\s*/i, '');
    const mapsUrl = `https://www.google.com/maps?q=${encodeURIComponent(cleanLocation)}&z=17`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  // Hard Refresh Handler
  const handleRealtimeRefresh = () => {
    showToast('Đang làm mới và đồng bộ dữ liệu thời gian thực... 🔄');
    if ('caches' in window) {
      caches.keys().then(keys => Promise.all(keys.map(k => caches.delete(k)))).catch(() => {});
    }
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.getRegistrations().then(regs => {
        regs.forEach(r => r.update());
      }).catch(() => {});
    }
    setTimeout(() => {
      const url = new URL(window.location.href);
      url.searchParams.set('_t', Date.now().toString());
      window.location.replace(url.toString());
    }, 400);
  };

  // ── MỤC 6: BỘ GIẢI MÃ TỆP ĐÍNH KÈM TOÀN DIỆN (CHỐNG NGẮT KẾT NỐI TỆP) ─────────
  const getDocFiles = (doc) => {
    if (!doc) return [];
    const files = [];

    // 1. Kiểm tra mảng attachments chính thống
    if (Array.isArray(doc.attachments) && doc.attachments.length > 0) {
      doc.attachments.forEach((att, idx) => {
        if (!att) return;
        if (typeof att === 'string') {
          files.push({ name: `Tệp đính kèm ${idx + 1}`, url: att, size: 'PDF' });
        } else if (att.url || att.link || att.path || att.downloadURL) {
          files.push({
            name: att.name || att.fileName || att.title || `Tệp đính kèm ${idx + 1}`,
            url: att.url || att.link || att.path || att.downloadURL,
            size: att.size || att.fileSize || 'PDF',
            type: att.type || 'file'
          });
        }
      });
    }

    // 2. Kiểm tra mảng files phụ
    if (Array.isArray(doc.files) && doc.files.length > 0) {
      doc.files.forEach((f, idx) => {
        if (!f) return;
        if (typeof f === 'string') {
          if (!files.some(existing => existing.url === f)) {
            files.push({ name: `Tệp đính kèm ${files.length + 1}`, url: f, size: 'PDF' });
          }
        } else if (f.url || f.link) {
          const fileUrl = f.url || f.link;
          if (!files.some(existing => existing.url === fileUrl)) {
            files.push({
              name: f.name || f.fileName || `Tệp đính kèm ${files.length + 1}`,
              url: fileUrl,
              size: f.size || f.fileSize || 'PDF'
            });
          }
        }
      });
    }

    // 3. Kiểm tra attachmentLink đơn
    if (doc.attachmentLink && typeof doc.attachmentLink === 'string' && doc.attachmentLink.trim()) {
      const link = doc.attachmentLink.trim();
      if (!files.some(existing => existing.url === link)) {
        files.push({
          name: doc.attachmentName || doc.fileName || 'Tệp liên kết gốc',
          url: link,
          size: 'Link'
        });
      }
    }

    // 4. Kiểm tra fileUrl đơn
    if (doc.fileUrl && typeof doc.fileUrl === 'string' && doc.fileUrl.trim()) {
      const link = doc.fileUrl.trim();
      if (!files.some(existing => existing.url === link)) {
        files.push({
          name: doc.fileName || 'Tài liệu đính kèm',
          url: link,
          size: doc.fileSize || 'PDF'
        });
      }
    }

    return files;
  };

  // Mở tệp trực tiếp và an toàn
  const handleOpenFile = (url, e) => {
    if (e) e.stopPropagation();
    if (!url) {
      showToast('Tệp không có đường dẫn hợp lệ!');
      return;
    }
    if (typeof url === 'string' && url.startsWith('blob:')) {
      showToast('Tệp này được lưu dưới dạng tạm thời cũ (blob). Vui lòng cập nhật lại tệp mới!');
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleShare = async (doc, e) => {
    if (e) e.stopPropagation();
    if (navigator.share) {
      try {
        await navigator.share({
          title: doc.summary || doc.title,
          text: `Văn bản: ${doc.summary || doc.title} (${doc.documentNumber || doc.code || ''})`,
          url: window.location.href
        });
      } catch {}
    } else {
      navigator.clipboard?.writeText(window.location.href);
      showToast('Đã sao chép liên kết vào bộ nhớ tạm! 📋');
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      showToast('Đã đăng xuất thành công!');
    } catch (error) {
      console.error('Lỗi khi đăng xuất:', error);
      showToast('Có lỗi xảy ra khi đăng xuất.');
    }
  };

  // ── MỤC 4: TÌM KIẾM TOÀN DIỆN THEO TÊN DỰ ÁN, SỐ TÀI LIỆU, TRÍCH YẾU, TỪ KHÓA ────────
  const searchResults = useMemo(() => {
    let list = activeDocsList;
    if (selectedFilterChip !== 'Tất cả') {
      const filterLower = selectedFilterChip.toLowerCase();
      list = list.filter(d => (d.documentType || d.type || '').toLowerCase() === filterLower);
    }
    if (selectedProjectFilterChip !== 'Tất cả') {
      const pCodeLower = selectedProjectFilterChip.toLowerCase();
      list = list.filter(d => {
        const prj = (allProjects || []).find(p => String(p.id) === String(d.projectId));
        const codeMatches = (prj?.code || '').toLowerCase() === pCodeLower;
        const relMatches = Array.isArray(d.relatedProjects) && d.relatedProjects.some(c => String(c).toLowerCase() === pCodeLower);
        return codeMatches || relMatches;
      });
    }
    if (searchKeyword.trim()) {
      const kw = searchKeyword.trim().toLowerCase();
      list = list.filter(d => {
        const matchTitle = (d.summary || d.title || d.name || '').toLowerCase().includes(kw);
        const matchCode = (d.code || '').toLowerCase().includes(kw);
        const matchDocNumber = (d.documentNumber || d.documentCode || '').toLowerCase().includes(kw);
        const matchAgency = (d.issuingAgency || '').toLowerCase().includes(kw);
        const matchPrj = getDocProjectName(d).toLowerCase().includes(kw);
        const matchType = (d.type || d.documentType || '').toLowerCase().includes(kw);
        const matchKeywords = (d.keywords || d.tags || d.content || '').toLowerCase().includes(kw);
        return matchTitle || matchCode || matchDocNumber || matchAgency || matchPrj || matchType || matchKeywords;
      });
    }
    return list;
  }, [activeDocsList, selectedFilterChip, selectedProjectFilterChip, searchKeyword, allProjects]);

  // Recent 7 Days Documents & Projects
  const recent7DaysDocs = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    return activeDocsList.filter(d => {
      const dateStr = d.createdAt || d.effectiveDate || d.date;
      if (!dateStr) return false;
      const dDate = new Date(dateStr);
      return !isNaN(dDate.getTime()) && dDate >= sevenDaysAgo;
    });
  }, [activeDocsList]);

  // Safe area & container styles
  const bgColor = isDark ? '#090d16' : (SCREEN_COLORS[activeScreen] || '#f8fafc');
  const cardBg = isDark ? '#131b2e' : '#ffffff';
  const textColor = isDark ? '#f8fafc' : '#0f172a';
  const subTextColor = isDark ? '#94a3b8' : '#64748b';
  const borderColor = isDark ? '#1e293b' : '#e2e8f0';

  const HEADER_SAFE_PADDING = 'calc(env(safe-area-inset-top, 0px) + 12px) 16px 12px 16px';
  const MAIN_SAFE_PADDING = '14px 16px 85px 16px';

  return (
    <div style={{
      position: 'fixed',
      inset: 0,
      zIndex: 99999,
      backgroundColor: bgColor,
      color: textColor,
      display: 'flex',
      flexDirection: 'column',
      fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
      userSelect: 'none',
      overflow: 'hidden'
    }}>
      {/* Input ẩn phục vụ đổi ảnh đại diện từ thiết bị */}
      <input
        ref={avatarInputRef}
        type="file"
        accept="image/*"
        onChange={handleAvatarChange}
        style={{ display: 'none' }}
      />

      {/* Toast Notification */}
      {toastMessage && (
        <div style={{
          position: 'fixed',
          top: 'calc(env(safe-area-inset-top, 0px) + 16px)',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: isDark ? '#1e293b' : '#0f172a',
          color: '#ffffff',
          padding: '10px 20px',
          borderRadius: '24px',
          fontSize: '0.85rem',
          fontWeight: '700',
          zIndex: 999999,
          boxShadow: '0 8px 24px rgba(0,0,0,0.3)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          whiteSpace: 'nowrap'
        }}>
          <Sparkles size={16} color="#60a5fa" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* ── 1. MÀN HÌNH TỔNG QUAN (HOME / OVERVIEW SCREEN) ── */}
      {activeScreen === 'overview' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          {/* Header FDI Doc Cố định với 3 nút chức năng: [Làm mới] [Cài đặt] [Tìm kiếm] đẩy sát lề phải */}
          <header style={{
            padding: HEADER_SAFE_PADDING,
            backgroundColor: cardBg,
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexShrink: 0,
            zIndex: 10,
            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '1.5rem', fontWeight: '900', color: isDark ? '#60a5fa' : '#1e3a8a', letterSpacing: '-0.5px' }}>FDI</span>
              <span style={{ fontSize: '1.5rem', fontWeight: '400', color: isDark ? '#cbd5e1' : '#475569', letterSpacing: '-0.5px' }}>Doc</span>
            </div>

            {/* MỤC 2: 3 nút chức năng đẩy sát lề phải: [Làm mới] [Cài đặt] [Tìm kiếm] */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
              <button
                onClick={handleRealtimeRefresh}
                title="Làm mới dữ liệu từ Server"
                style={{
                  background: isDark ? '#334155' : '#f1f5f9', border: 'none', borderRadius: '12px',
                  width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isDark ? '#cbd5e1' : '#64748b', cursor: 'pointer'
                }}
              >
                <RefreshCw size={18} />
              </button>

              <button
                onClick={() => setActiveScreen('settings')}
                title="Cài đặt ứng dụng"
                style={{
                  background: isDark ? '#334155' : '#f1f5f9', border: 'none', borderRadius: '12px',
                  width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isDark ? '#cbd5e1' : '#64748b', cursor: 'pointer'
                }}
              >
                <Settings size={18} />
              </button>

              <button
                onClick={() => setActiveScreen('search')}
                title="Tìm kiếm"
                style={{
                  background: isDark ? '#334155' : '#f1f5f9', border: 'none', borderRadius: '12px',
                  width: '38px', height: '38px', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: isDark ? '#cbd5e1' : '#64748b', cursor: 'pointer'
                }}
              >
                <Search size={18} />
              </button>
            </div>
          </header>

          {/* Vùng nội dung cuộn mượt mà */}
          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorY: 'contain',
            scrollBehavior: 'smooth',
            padding: MAIN_SAFE_PADDING,
            display: 'flex',
            flexDirection: 'column',
            gap: '18px',
            boxSizing: 'border-box'
          }}>
            {/* User Greeting Row - Click to toggle Actions (Đổi ảnh / Sign out) */}
            <div
              onClick={() => setShowSignOut(prev => !prev)}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '6px 8px',
                borderRadius: '16px',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                backgroundColor: showSignOut ? (isDark ? 'rgba(37, 99, 235, 0.12)' : '#eff6ff') : 'transparent',
                border: showSignOut ? `1.5px solid ${isDark ? '#2563eb' : '#bfdbfe'}` : '1.5px solid transparent'
              }}
              title="Nhấn để đổi ảnh hoặc đăng xuất"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px', minWidth: 0 }}>
                {renderUserAvatar(46, '1rem', true)}
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.88rem', color: subTextColor, fontWeight: '500' }}>Chào bạn quay lại</span>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginTop: '2px' }}>
                    <span style={{ fontSize: '1.15rem', fontWeight: '800', color: textColor }}>{userName}</span>
                    <span
                      title={`Vai trò trong dự án: ${userProjectRole}`}
                      style={{
                        fontSize: '0.74rem',
                        fontWeight: '700',
                        color: isDark ? '#93c5fd' : '#1d4ed8',
                        backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff',
                        border: `1px solid ${isDark ? '#2563eb' : '#bfdbfe'}`,
                        padding: '2px 8px',
                        borderRadius: '6px',
                        lineHeight: '1.2',
                        whiteSpace: 'nowrap'
                      }}
                    >
                      {userProjectRole}
                    </span>
                  </div>
                </div>
              </div>

              {showSignOut && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      avatarInputRef.current?.click();
                    }}
                    disabled={isUpdatingAvatar}
                    style={{
                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                      color: '#2563eb',
                      border: `1.5px solid ${isDark ? '#3b82f6' : '#bfdbfe'}`,
                      borderRadius: '12px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: '700',
                      cursor: isUpdatingAvatar ? 'not-allowed' : 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 6px rgba(37,99,235,0.1)'
                    }}
                  >
                    {isUpdatingAvatar ? <RefreshCw size={14} className="spin" /> : <Camera size={14} />} Đổi ảnh
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLogout();
                    }}
                    style={{
                      backgroundColor: '#ef4444',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      fontSize: '0.8rem',
                      fontWeight: '800',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: '0 2px 8px rgba(239,68,68,0.3)'
                    }}
                  >
                    <LogOut size={14} /> Sign out
                  </button>
                </div>
              )}
            </div>

            {/* MỤC 3: 3 THẺ THỐNG BÁO TÔNG PASTEL NHẬN DIỆN THƯƠNG HIỆU (XANH DƯƠNG -> CAM/HỔ PHÁCH -> XANH LÁ) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
              {/* Thẻ 1: Tổng tài liệu - Xanh dương Pastel */}
              <div
                onClick={() => setActiveScreen('search')}
                style={{
                  backgroundColor: isDark ? 'rgba(37,99,235,0.15)' : '#eff6ff',
                  borderRadius: '16px', padding: '16px 8px',
                  border: `1.5px solid ${isDark ? '#1e3a8a' : '#bfdbfe'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(37,99,235,0.06)'
                }}
              >
                <span style={{ fontSize: '1.65rem', fontWeight: '900', color: '#2563eb', lineHeight: '1.1' }}>{activeDocsList.length}</span>
                <span style={{ fontSize: '0.78rem', color: isDark ? '#93c5fd' : '#1e40af', fontWeight: '700', marginTop: '6px' }}>Tổng tài liệu</span>
              </div>

              {/* Thẻ 2: Dự án theo dõi - Cam / Hổ phách Pastel */}
              <div
                onClick={() => setActiveScreen('project_list')}
                style={{
                  backgroundColor: isDark ? 'rgba(245,158,11,0.15)' : '#fffbeb',
                  borderRadius: '16px', padding: '16px 8px',
                  border: `1.5px solid ${isDark ? '#92400e' : '#fef08a'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(245,158,11,0.06)'
                }}
              >
                <span style={{ fontSize: '1.65rem', fontWeight: '900', color: '#d97706', lineHeight: '1.1' }}>{projectsList.length}</span>
                <span style={{ fontSize: '0.78rem', color: isDark ? '#fde047' : '#854d0e', fontWeight: '700', marginTop: '6px' }}>Dự án theo dõi</span>
              </div>

              {/* Thẻ 3: Mới 7 ngày qua - Xanh lá Pastel */}
              <div
                onClick={() => setActiveScreen('recent_7days')}
                style={{
                  backgroundColor: isDark ? 'rgba(16,185,129,0.15)' : '#f0fdf4',
                  borderRadius: '16px', padding: '16px 8px',
                  border: `1.5px solid ${isDark ? '#065f46' : '#bbf7d0'}`,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center',
                  cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.06)'
                }}
              >
                <span style={{ fontSize: '1.65rem', fontWeight: '900', color: '#059669', lineHeight: '1.1' }}>{recent7DaysDocs.length}</span>
                <span style={{ fontSize: '0.75rem', color: isDark ? '#6ee7b7' : '#166534', fontWeight: '700', marginTop: '6px', lineHeight: '1.2' }}>Mới trong 7 ngày gần đây</span>
              </div>
            </div>

            {/* MỤC 4: Thanh Tìm kiếm nhanh với Placeholder chuẩn */}
            <div
              onClick={() => setActiveScreen('search')}
              style={{ backgroundColor: cardBg, borderRadius: '14px', padding: '12px 16px', border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer', color: subTextColor, boxShadow: '0 2px 6px rgba(0,0,0,0.02)' }}
            >
              <Search size={18} color="#2563eb" />
              <span style={{ fontSize: '0.88rem', fontWeight: '500', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                Tìm theo tên dự án, số tài liệu, trích yếu, từ khóa...
              </span>
            </div>

            {/* Primary Quick Action Banner: Thu thập tài liệu mới */}
            <div
              onClick={() => setActiveScreen('upload_form')}
              style={{
                backgroundColor: '#2563eb', backgroundImage: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                borderRadius: '16px', padding: '18px 20px', color: '#ffffff', display: 'flex', alignItems: 'center',
                justifyContent: 'space-between', boxShadow: '0 8px 24px rgba(37,99,235,0.3)', cursor: 'pointer'
              }}
            >
              <div>
                <div style={{ fontSize: '1.1rem', fontWeight: '700', letterSpacing: '-0.2px' }}>Thu thập tài liệu mới</div>
                <div style={{ fontSize: '0.85rem', color: 'rgba(255,255,255,0.85)', marginTop: '4px' }}>Tải lên hoặc chụp ảnh tài liệu dự án</div>
              </div>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <ChevronRight size={22} color="#ffffff" />
              </div>
            </div>

            {/* Recent Documents List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 4px' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: '800', color: textColor }}>Tài liệu gần đây</span>
                <button onClick={() => setActiveScreen('search')} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '0.9rem', fontWeight: '700', cursor: 'pointer' }}>
                  Xem tất cả
                </button>
              </div>

              {activeDocsList.length === 0 ? (
                <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '32px 20px', textAlign: 'center', color: subTextColor, border: `1px solid ${borderColor}` }}>
                  <AlertCircle size={32} color="#94a3b8" style={{ marginBottom: '6px' }} />
                  <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Chưa có tài liệu nào trong hệ thống</div>
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {activeDocsList.slice(0, 5).map((doc, idx) => {
                    const docPastel = getPastelForString(doc.summary || doc.title || doc.code || '', idx);
                    return (
                      <div
                        key={doc.id || idx}
                        onClick={() => { setSelectedDoc(doc); setActiveScreen('doc_detail'); }}
                        style={{
                          backgroundColor: cardBg, borderRadius: '16px', padding: '14px 16px', border: `1px solid ${borderColor}`,
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', cursor: 'pointer',
                          boxShadow: isDark ? 'none' : docPastel.shadow
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: isDark ? '#1e293b' : docPastel.iconBg, color: isDark ? '#60a5fa' : docPastel.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={22} />
                          </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: '700', color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {doc.summary || doc.title || doc.name || 'Tài liệu dự án'}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: subTextColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getDocProjectName(doc)} • {doc.effectiveDate || doc.date || 'Hôm nay'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={18} color={subTextColor} style={{ flexShrink: 0 }} />
                    </div>
                    );
                  })}
                </div>
              )}
            </div>
          </main>
        </div>
      )}

      {/* ── 2. MÀN HÌNH TRA CỨU TÀI LIỆU (SEARCH SCREEN) ── */}
      {activeScreen === 'search' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <header style={{
            padding: HEADER_SAFE_PADDING,
            backgroundColor: cardBg,
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            flexShrink: 0,
            zIndex: 10,
            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <button onClick={() => setActiveScreen('overview')} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={22} />
              </button>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: textColor }}>Tra cứu tài liệu</h2>
            </div>

            {/* Ô tìm kiếm với Placeholder chuẩn */}
            <div style={{ position: 'relative' }}>
              <Search size={18} color={subTextColor} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }} />
              <input
                type="text"
                value={searchKeyword}
                onChange={e => setSearchKeyword(e.target.value)}
                placeholder="Tìm theo tên dự án, số tài liệu, trích yếu, từ khóa..."
                autoFocus
                style={{ width: '100%', backgroundColor: isDark ? '#0f172a' : '#f8fafc', border: `1.5px solid ${borderColor}`, borderRadius: '12px', padding: '12px 36px 12px 40px', fontSize: '0.9rem', color: textColor, outline: 'none', boxSizing: 'border-box' }}
              />
              {searchKeyword && (
                <button onClick={() => setSearchKeyword('')} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: subTextColor, cursor: 'pointer' }}>
                  <X size={16} />
                </button>
              )}
            </div>

            {/* 2 Combobox Dropdown thu gọn */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: '700', color: subTextColor }}>Loại tài liệu:</label>
                <select
                  value={selectedFilterChip}
                  onChange={e => setSelectedFilterChip(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: isDark ? '#0f172a' : getPastelForString(selectedFilterChip, 0).bg,
                    border: `1.5px solid ${isDark ? borderColor : getPastelForString(selectedFilterChip, 0).border}`,
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    color: isDark ? textColor : getPastelForString(selectedFilterChip, 0).text,
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  {dynamicFilterChips.map(chip => (
                    <option key={chip} value={chip}>
                      {chip === 'Tất cả' ? 'Tất cả loại tài liệu' : chip}
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                <label style={{ fontSize: '0.72rem', fontWeight: '700', color: subTextColor }}>Mã dự án:</label>
                <select
                  value={selectedProjectFilterChip}
                  onChange={e => setSelectedProjectFilterChip(e.target.value)}
                  style={{
                    width: '100%',
                    backgroundColor: isDark ? '#0f172a' : getPastelForString(selectedProjectFilterChip, 1).bg,
                    border: `1.5px solid ${isDark ? borderColor : getPastelForString(selectedProjectFilterChip, 1).border}`,
                    borderRadius: '10px',
                    padding: '8px 10px',
                    fontSize: '0.82rem',
                    fontWeight: '700',
                    color: isDark ? textColor : getPastelForString(selectedProjectFilterChip, 1).text,
                    outline: 'none',
                    cursor: 'pointer',
                    boxSizing: 'border-box'
                  }}
                >
                  {projectFilterChips.map(pChip => (
                    <option key={pChip} value={pChip}>
                      {pChip === 'Tất cả' ? 'Tất cả mã dự án' : pChip}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </header>

          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorY: 'contain',
            scrollBehavior: 'smooth',
            padding: MAIN_SAFE_PADDING,
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '0.82rem', fontWeight: '700', color: subTextColor, paddingLeft: '4px' }}>
              {searchResults.length} kết quả
            </div>

            {searchResults.length === 0 ? (
              <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '40px 20px', textAlign: 'center', color: subTextColor, border: `1px solid ${borderColor}` }}>
                <AlertCircle size={36} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Không tìm thấy tài liệu phù hợp.</div>
              </div>
            ) : (
              searchResults.map((doc, idx) => {
                const docPastel = getPastelForString(doc.summary || doc.title || doc.code || '', idx);
                return (
                  <div
                    key={doc.id || idx}
                    onClick={() => { setSelectedDoc(doc); setActiveScreen('doc_detail'); }}
                    style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '14px 16px', border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', cursor: 'pointer', boxShadow: isDark ? 'none' : docPastel.shadow }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: isDark ? '#1e293b' : docPastel.iconBg, color: isDark ? '#60a5fa' : docPastel.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <FileText size={22} />
                      </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                      <span style={{ fontSize: '0.95rem', fontWeight: '700', color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.summary || doc.title || doc.name}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: subTextColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {doc.documentNumber || doc.code || 'N/A'} • {getDocProjectName(doc)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} color={subTextColor} style={{ flexShrink: 0 }} />
                </div>
                    );
              })
            )}
          </main>
        </div>
      )}

      {/* ── 3. MÀN HÌNH CÀI ĐẶT (SETTINGS SCREEN) ── */}
      {activeScreen === 'settings' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <header style={{
            padding: HEADER_SAFE_PADDING,
            backgroundColor: cardBg,
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            gap: '16px',
            flexShrink: 0,
            zIndex: 10,
            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <button onClick={() => setActiveScreen('overview')} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={22} />
            </button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: textColor }}>Cài đặt</h2>
          </header>

          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorY: 'contain',
            scrollBehavior: 'smooth',
            padding: MAIN_SAFE_PADDING,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxSizing: 'border-box'
          }}>
            {/* User Profile Card */}
            <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px', border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', gap: '14px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
              {renderUserAvatar(52, '1.1rem', true)}
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '1.1rem', fontWeight: '800', color: textColor }}>{userName}</span>
                  <span
                    title={`Vai trò trong dự án: ${userProjectRole}`}
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: '700',
                      color: isDark ? '#93c5fd' : '#1d4ed8',
                      backgroundColor: isDark ? 'rgba(37, 99, 235, 0.18)' : '#eff6ff',
                      border: `1px solid ${isDark ? '#2563eb' : '#bfdbfe'}`,
                      padding: '2px 8px',
                      borderRadius: '6px',
                      lineHeight: '1.2',
                      whiteSpace: 'nowrap'
                    }}
                  >
                    {userProjectRole}
                  </span>
                </div>
                <span style={{ fontSize: '0.85rem', color: subTextColor, marginTop: '2px' }}>{userEmail}</span>
              </div>
            </div>

                        {/* MỤC LỌC THEO TÌNH TRẠNG DỰ ÁN */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', paddingLeft: '4px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '800', color: subTextColor, letterSpacing: '0.5px' }}>
                  TÌNH TRẠNG DỰ ÁN
                </span>
                <span style={{ fontSize: '0.75rem', fontWeight: '700', color: '#2563eb' }}>
                  ({projectStatusFilter.length}/{ALL_PROJECT_STATUSES.length} đã chọn)
                </span>
              </div>

              <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px', border: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ fontSize: '0.82rem', color: subTextColor, lineHeight: '1.4' }}>
                  Chọn một hoặc nhiều thẻ tình trạng để chỉ hiển thị các dự án bạn quan tâm:
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {ALL_PROJECT_STATUSES.map((status, idx) => {
                    const isSelected = projectStatusFilter.includes(status);
                    const pastel = getPastelForString(status, idx);
                    return (
                      <button
                        key={status}
                        type="button"
                        onClick={() => handleToggleProjectStatus(status)}
                        style={{
                          backgroundColor: isSelected ? (isDark ? '#1e3a8a' : pastel.bg) : (isDark ? '#0f172a' : '#f8fafc'),
                          color: isSelected ? (isDark ? '#93c5fd' : pastel.text) : subTextColor,
                          border: isSelected ? `1.5px solid ${isDark ? '#3b82f6' : pastel.border}` : `1px solid ${borderColor}`,
                          borderRadius: '12px',
                          padding: '12px 10px',
                          fontSize: '0.85rem',
                          fontWeight: isSelected ? '800' : '600',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          cursor: 'pointer',
                          boxShadow: isSelected ? (isDark ? 'none' : pastel.shadow) : 'none',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <span>{status}</span>
                        {isSelected && <Check size={16} color={isDark ? '#60a5fa' : pastel.text} style={{ flexShrink: 0 }} />}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* MỤC 2: TÍNH NĂNG CHỌN CHẾ ĐỘ SÁNG / TỐI TRONG CÀI ĐẶT */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', color: subTextColor, marginBottom: '8px', paddingLeft: '4px', letterSpacing: '0.5px' }}>
                GIAO DIỆN & HIỂN THỊ
              </div>
              <div style={{ backgroundColor: cardBg, borderRadius: '16px', border: `1px solid ${borderColor}`, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                <div style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '38px', height: '38px', borderRadius: '10px', backgroundColor: isDark ? '#334155' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                      {isDark ? <Moon size={20} color="#f59e0b" /> : <Sun size={20} color="#64748b" />}
                    </div>
                    <div>
                      <div style={{ fontSize: '0.95rem', fontWeight: '700', color: textColor }}>Chế độ xem Sáng / Tối</div>
                      <div style={{ fontSize: '0.78rem', color: subTextColor, marginTop: '2px' }}>
                        {isDark ? 'Đang dùng Giao diện Tối (Dark)' : 'Đang dùng Giao diện Sáng (Light)'}
                      </div>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsDark(!isDark)}
                    style={{
                      width: '54px', height: '30px', borderRadius: '15px',
                      backgroundColor: isDark ? '#2563eb' : '#cbd5e1',
                      border: 'none', padding: '2px', cursor: 'pointer',
                      display: 'flex', alignItems: 'center',
                      justifyContent: isDark ? 'flex-end' : 'flex-start',
                      transition: 'all 0.2s ease'
                    }}
                  >
                    <div style={{ width: '26px', height: '26px', borderRadius: '50%', backgroundColor: '#ffffff', boxShadow: '0 2px 4px rgba(0,0,0,0.2)' }} />
                  </button>
                </div>
              </div>
            </div>

            {/* Chuyển sang Web đầy đủ nếu có */}
            {onCloseMobileView && (
              <div>
                <div style={{ fontSize: '0.8rem', fontWeight: '800', color: subTextColor, marginBottom: '8px', paddingLeft: '4px', letterSpacing: '0.5px' }}>
                  PHIÊN BẢN HỆ THỐNG
                </div>
                <div style={{ backgroundColor: cardBg, borderRadius: '16px', border: `1px solid ${borderColor}`, overflow: 'hidden', boxShadow: '0 4px 12px rgba(0,0,0,0.03)' }}>
                  <div
                    onClick={onCloseMobileView}
                    style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
                  >
                    <span style={{ fontSize: '0.95rem', fontWeight: '700', color: '#2563eb', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <Globe size={18} /> Chuyển sang giao diện Web đầy đủ
                    </span>
                    <ChevronRight size={18} color="#2563eb" />
                  </div>
                </div>
              </div>
            )}

            {/* Thông tin ứng dụng */}
            <div>
              <div style={{ fontSize: '0.8rem', fontWeight: '800', color: subTextColor, marginBottom: '8px', paddingLeft: '4px', letterSpacing: '0.5px' }}>
                THÔNG TIN ỨNG DỤNG
              </div>
              <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '14px 16px', border: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: subTextColor }}>Phiên bản App:</span>
                  <span style={{ fontWeight: '700', color: textColor }}>v2.4.0 (PWA Mobile)</span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', borderTop: `1px solid ${borderColor}`, paddingTop: '8px' }}>
                  <span style={{ color: subTextColor }}>Đồng bộ dữ liệu:</span>
                  <span style={{ fontWeight: '700', color: '#059669' }}>Thời gian thực (Realtime)</span>
                </div>
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ── 4. FORM TẢI LÊN TÀI LIỆU MỚI (UPLOAD FORM MODAL) ── */}
      {activeScreen === 'upload_form' && (
        <div style={{
          position: 'fixed',
          inset: 0,
          zIndex: 100000,
          backgroundColor: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(6px)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'flex-end'
        }}>
          <div style={{
            width: '100%',
            height: '92vh',
            backgroundColor: cardBg,
            borderTopLeftRadius: '24px',
            borderTopRightRadius: '24px',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            boxShadow: '0 -10px 40px rgba(0,0,0,0.3)'
          }}>
            <header style={{
              padding: 'calc(env(safe-area-inset-top, 0px) + 14px) 16px 14px 16px',
              borderBottom: `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              backgroundColor: cardBg,
              zIndex: 10
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button onClick={() => setActiveScreen('overview')} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer', padding: 0 }}>
                  <ArrowLeft size={22} />
                </button>
                <h2 style={{ fontSize: '1.15rem', fontWeight: '800', margin: 0, color: textColor }}>Tải lên tài liệu mới</h2>
              </div>
              <button onClick={() => setActiveScreen('overview')} style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: isDark ? '#1e293b' : '#f1f5f9', border: 'none', color: subTextColor, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
                <X size={18} />
              </button>
            </header>

            <main style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              padding: '16px 16px 40px 16px',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box'
            }}>
              <form onSubmit={handleSubmitUploadForm} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>Mã tài liệu (Tự động):</label>
                    <input
                      type="text"
                      readOnly
                      value={uploadFormState.code}
                      style={{ width: '100%', backgroundColor: isDark ? '#0f172a' : '#f1f5f9', border: `1px solid ${borderColor}`, borderRadius: '10px', padding: '10px', fontSize: '0.85rem', fontWeight: '700', color: '#2563eb', outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>Số hiệu văn bản:</label>
                    <input
                      type="text"
                      placeholder="VD: 128/QĐ-UBND..."
                      value={uploadFormState.documentNumber}
                      onChange={e => setUploadFormState({...uploadFormState, documentNumber: e.target.value})}
                      style={{ width: '100%', backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1.5px solid ${borderColor}`, borderRadius: '10px', padding: '10px', fontSize: '0.85rem', color: textColor, outline: 'none', boxSizing: 'border-box' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>Loại tài liệu:</label>
                    <select
                      value={uploadFormState.documentType}
                      onChange={e => setUploadFormState({...uploadFormState, documentType: e.target.value})}
                      style={{ width: '100%', backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1.5px solid ${borderColor}`, borderRadius: '10px', padding: '10px', fontSize: '0.85rem', fontWeight: '700', color: textColor, outline: 'none', boxSizing: 'border-box' }}
                    >
                      {dynamicFilterChips.filter(c => c !== 'Tất cả').map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>Ngày hiệu lực:</label>
                    <div style={{ position: 'relative', width: '100%', height: '40px' }}>
                      <div style={{
                        position: 'absolute', inset: 0,
                        backgroundColor: isDark ? '#0f172a' : '#ffffff',
                        border: `1.5px solid ${borderColor}`,
                        borderRadius: '10px',
                        padding: '0 10px',
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        fontSize: '0.85rem', fontWeight: '700', color: textColor,
                        pointerEvents: 'none'
                      }}>
                        <span>
                          {uploadFormState.effectiveDate
                            ? uploadFormState.effectiveDate.split('-').reverse().join('/')
                            : new Date().toLocaleDateString('vi-VN')}
                        </span>
                        <Calendar size={16} color="#2563eb" />
                      </div>
                      <input
                        type="date"
                        value={uploadFormState.effectiveDate}
                        onChange={e => setUploadFormState({...uploadFormState, effectiveDate: e.target.value})}
                        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0, cursor: 'pointer' }}
                      />
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>Cơ quan ban hành:</label>
                  <select
                    value={uploadFormState.issuingAgency}
                    onChange={e => setUploadFormState({...uploadFormState, issuingAgency: e.target.value})}
                    style={{ width: '100%', backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1.5px solid ${borderColor}`, borderRadius: '10px', padding: '10px', fontSize: '0.85rem', fontWeight: '600', color: textColor, outline: 'none', boxSizing: 'border-box' }}
                  >
                    {dynamicAgencies.map(agency => (
                      <option key={agency} value={agency}>{agency}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>Trích yếu nội dung <span style={{ color: '#ef4444' }}>*</span>:</label>
                  <textarea
                    rows={3}
                    required
                    placeholder="Nhập trích yếu tóm tắt nội dung văn bản..."
                    value={uploadFormState.summary}
                    onChange={e => setUploadFormState({...uploadFormState, summary: e.target.value})}
                    style={{ width: '100%', backgroundColor: isDark ? '#0f172a' : '#ffffff', border: `1.5px solid ${borderColor}`, borderRadius: '10px', padding: '10px', fontSize: '0.88rem', color: textColor, outline: 'none', resize: 'vertical', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>
                    Từ khóa tìm kiếm (phân cách bởi dấu phẩy):
                  </label>
                  <input
                    type="text"
                    placeholder="ví dụ: pháp lý, quy hoạch, pccc, tiến độ..."
                    value={uploadFormState.keywords || ''}
                    onChange={e => setUploadFormState({...uploadFormState, keywords: e.target.value})}
                    style={{
                      width: '100%',
                      backgroundColor: isDark ? '#0f172a' : '#ffffff',
                      border: `1.5px solid ${borderColor}`,
                      borderRadius: '10px',
                      padding: '10px',
                      fontSize: '0.85rem',
                      fontWeight: '600',
                      color: textColor,
                      outline: 'none',
                      boxSizing: 'border-box'
                    }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>Mã dự án liên quan:</label>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                    {shortProjectCodes.map((pCode, pIdx) => {
                      const isSelected = (uploadFormState.relatedProjects || []).includes(pCode);
                      const pastel = getPastelForString(pCode, pIdx);
                      return (
                        <button
                          key={pCode}
                          type="button"
                          onClick={() => handleToggleUploadProjectCode(pCode)}
                          style={{
                            backgroundColor: isSelected ? '#2563eb' : (isDark ? '#0f172a' : pastel.bg),
                            color: isSelected ? '#ffffff' : (isDark ? textColor : pastel.text),
                            border: isSelected ? '1.5px solid #2563eb' : `1px solid ${isDark ? borderColor : pastel.border}`,
                            borderRadius: '12px',
                            padding: '6px 12px',
                            fontSize: '0.8rem',
                            fontWeight: isSelected ? '800' : '700',
                            cursor: 'pointer',
                            boxShadow: isSelected ? '0 2px 8px rgba(37,99,235,0.25)' : (isDark ? 'none' : pastel.shadow)
                          }}
                        >
                          {isSelected && <Check size={12} style={{ display: 'inline', marginRight: '4px' }} />}
                          {pCode}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* MỤC 1: CẤP ĐỘ BẢO MẬT KIỂU SLIDE (7 LEVEL PASTEL FPT, HIGHLIGHT TỪ ĐIỂM CHỌN SANG PHẢI) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>
                      Cấp độ bảo mật:
                    </label>
                    <span style={{ fontSize: '0.8rem', fontWeight: '800', color: textColor }}>
                      Level {uploadFormState.minAccessLevel || 1}
                    </span>
                  </div>

                  {/* 7 Thẻ LEVEL 1 -> LEVEL 7: Mỗi level 1 màu pastel FPT, Highlight các thẻ bên phải kể từ thẻ được chọn */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '6px' }}>
                    {[1, 2, 3, 4, 5, 6, 7].map(lvl => {
                      const selectedLvl = uploadFormState.minAccessLevel || 1;
                      const isHighlighted = lvl >= selectedLvl; // Highlight thẻ được chọn và tất cả các thẻ bên phải
                      const isThumbLevel = lvl === selectedLvl;
                      const pastel = FPT_LEVEL_PASTELS[lvl - 1];

                      return (
                        <div
                          key={lvl}
                          onClick={() => setUploadFormState({...uploadFormState, minAccessLevel: lvl, accessLevel: lvl})}
                          style={{
                            backgroundColor: isHighlighted 
                              ? (isDark ? pastel.darkBg : pastel.bg) 
                              : (isDark ? '#0f172a' : '#f8fafc'),
                            border: isThumbLevel 
                              ? `2px solid ${isDark ? pastel.borderActive : pastel.borderActive}` 
                              : (isHighlighted 
                                  ? `1.5px solid ${isDark ? pastel.darkBorder : pastel.border}` 
                                  : `1px solid ${isDark ? '#334155' : '#e2e8f0'}`),
                            borderRadius: '8px',
                            padding: '8px 2px 6px 2px',
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
                            boxShadow: isThumbLevel 
                              ? `0 4px 12px ${isDark ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.1)'}` 
                              : 'none',
                            transform: isThumbLevel ? 'scale(1.04)' : 'scale(1)',
                            opacity: isHighlighted ? 1 : 0.45,
                            transition: 'all 0.15s ease'
                          }}
                        >
                          <span style={{
                            fontSize: '0.62rem',
                            fontWeight: '800',
                            color: isHighlighted ? (isDark ? pastel.darkText : pastel.text) : (isDark ? '#475569' : '#94a3b8'),
                            letterSpacing: '0.4px'
                          }}>
                            LEVEL
                          </span>
                          <span style={{
                            fontSize: '1.45rem',
                            fontWeight: '900',
                            color: isHighlighted ? (isDark ? pastel.darkText : pastel.text) : (isDark ? '#475569' : '#94a3b8'),
                            lineHeight: '1.1',
                            marginTop: '2px'
                          }}>
                            {lvl}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Thanh Slide chia khấc: Highlight phần bên phải kể từ thẻ được chọn */}
                  <div style={{ position: 'relative', width: '100%', height: '36px', display: 'flex', alignItems: 'center' }}>
                    {/* Ray nền inactive xám nhạt */}
                    <div style={{
                      position: 'absolute',
                      left: 'calc(100% / 14)',
                      right: 'calc(100% / 14)',
                      height: '5px',
                      backgroundColor: isDark ? '#334155' : '#e2e8f0',
                      borderRadius: '3px'
                    }} />

                    {/* Ray highlight từ thẻ được chọn sang hết bên phải */}
                    <div style={{
                      position: 'absolute',
                      left: `calc((100% / 14) + (${((uploadFormState.minAccessLevel || 1) - 1) / 6} * (100% - (100% / 7))))`,
                      right: 'calc(100% / 14)',
                      height: '5px',
                      backgroundColor: isDark ? '#f97316' : '#f36f21',
                      borderRadius: '3px',
                      transition: 'left 0.15s ease'
                    }} />

                    {/* 7 Vạch chia khấc thẳng đứng nằm chính tâm từng thẻ Level */}
                    <div style={{
                      position: 'absolute',
                      left: 0,
                      right: 0,
                      display: 'grid',
                      gridTemplateColumns: 'repeat(7, 1fr)',
                      height: '100%',
                      pointerEvents: 'none'
                    }}>
                      {[1, 2, 3, 4, 5, 6, 7].map(lvl => {
                        const selectedLvl = uploadFormState.minAccessLevel || 1;
                        const isHighlighted = lvl >= selectedLvl;
                        const pastel = FPT_LEVEL_PASTELS[lvl - 1];

                        return (
                          <div key={lvl} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
                            <div style={{
                              width: '2px',
                              height: '22px',
                              backgroundColor: isHighlighted 
                                ? (isDark ? pastel.darkText : pastel.borderActive) 
                                : (isDark ? '#334155' : '#cbd5e1'),
                              borderRadius: '1px',
                              transition: 'all 0.15s ease'
                            }} />
                          </div>
                        );
                      })}
                    </div>

                    {/* Con trượt tròn hiển thị tại vị trí cấp độ hiện tại */}
                    <div
                      style={{
                        position: 'absolute',
                        left: `calc((100% / 14) + (${((uploadFormState.minAccessLevel || 1) - 1) / 6} * (100% - (100% / 7))) - 8px)`,
                        width: '16px',
                        height: '16px',
                        borderRadius: '50%',
                        backgroundColor: '#ffffff',
                        border: `3.5px solid ${FPT_LEVEL_PASTELS[(uploadFormState.minAccessLevel || 1) - 1].borderActive}`,
                        boxShadow: '0 2px 6px rgba(0, 0, 0, 0.25)',
                        pointerEvents: 'none',
                        zIndex: 4,
                        transition: 'left 0.15s ease'
                      }}
                    />

                    {/* Input range trượt ngầm cho phép vuốt kéo cảm ứng trên điện thoại */}
                    <input
                      type="range"
                      min="1"
                      max="7"
                      step="1"
                      value={uploadFormState.minAccessLevel || 1}
                      onChange={e => {
                        const val = parseInt(e.target.value, 10);
                        setUploadFormState({...uploadFormState, minAccessLevel: val, accessLevel: val});
                      }}
                      style={{
                        position: 'absolute',
                        left: 'calc(100% / 14 - 12px)',
                        width: 'calc(100% - (100% / 7) + 24px)',
                        height: '36px',
                        opacity: 0,
                        cursor: 'pointer',
                        zIndex: 10
                      }}
                    />
                  </div>

                  {/* Mô tả chi tiết chức danh cấp bậc (Màu giống các text trong trang) */}
                  <div style={{
                    textAlign: 'center',
                    fontSize: '0.78rem',
                    color: textColor,
                    fontWeight: '600',
                    backgroundColor: isDark ? '#1e293b' : '#f8fafc',
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: `1px solid ${borderColor}`,
                    lineHeight: '1.4'
                  }}>
                    {EMPLOYEE_LEVELS.find(l => l.id === (uploadFormState.minAccessLevel || 1))?.fullName || `Cấp ${uploadFormState.minAccessLevel || 1}`}
                  </div>
                </div>

                {/* Đính kèm Tệp tin */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', marginTop: '6px' }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: '700', color: subTextColor }}>Tệp đính kèm ({uploadFormState.attachments.length}):</label>
                  <label style={{
                    border: `1.5px dashed ${borderColor}`,
                    borderRadius: '12px',
                    padding: '16px',
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '6px',
                    cursor: 'pointer', backgroundColor: isDark ? '#0f172a' : '#fafafa'
                  }}>
                    <Paperclip size={20} color="#2563eb" />
                    <span style={{ fontSize: '0.82rem', fontWeight: '700', color: '#2563eb' }}>Chọn tệp từ điện thoại / máy tính</span>
                    <input type="file" multiple onChange={handleUploadFilePick} style={{ display: 'none' }} />
                  </label>

                  {uploadFormState.attachments.map((file, idx) => (
                    <div key={idx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '8px 12px', borderRadius: '10px', border: `1px solid ${borderColor}` }}>
                      <span style={{ fontSize: '0.8rem', fontWeight: '600', color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        📄 {file.name}
                      </span>
                      <button type="button" onClick={() => handleRemoveUploadFile(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer' }}>
                        <X size={16} />
                      </button>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  style={{
                    backgroundColor: '#2563eb',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '14px',
                    padding: '14px',
                    fontSize: '0.95rem',
                    fontWeight: '800',
                    marginTop: '12px',
                    cursor: 'pointer',
                    boxShadow: '0 4px 14px rgba(37,99,235,0.35)'
                  }}
                >
                  Hoàn tất & Tải lên tài liệu 🚀
                </button>
              </form>
            </main>
          </div>
        </div>
      )}

      {/* ── 5. MÀN HÌNH DANH SÁCH DỰ ÁN (PROJECTS LIST SCREEN) ── */}
      {activeScreen === 'project_list' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <header style={{
            padding: HEADER_SAFE_PADDING,
            backgroundColor: cardBg,
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
            zIndex: 10,
            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <button onClick={() => setActiveScreen('overview')} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={22} />
            </button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: textColor }}>
              Dự án ({projectsList.length})
            </h2>
          </header>

          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorY: 'contain',
            scrollBehavior: 'smooth',
            padding: MAIN_SAFE_PADDING,
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            boxSizing: 'border-box'
          }}>
            {projectsList.length === 0 ? (
              <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '40px 20px', textAlign: 'center', color: subTextColor, border: `1px solid ${borderColor}` }}>
                <Building2 size={36} color="#94a3b8" style={{ marginBottom: '8px' }} />
                <div style={{ fontSize: '0.9rem', fontWeight: '600' }}>Chưa có dự án nào trong hệ thống</div>
              </div>
            ) : (
              projectsList.map(prj => {
                const prjDocsCount = activeDocsList.filter(d => isDocRelatedToProject(d, prj)).length;
                return (
                  <div
                    key={prj.id}
                    onClick={() => { setSelectedProject(prj); setActiveScreen('project_detail'); }}
                    style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px', border: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '42px', height: '42px', borderRadius: '12px', backgroundColor: isDark ? '#334155' : '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#2563eb' }}>
                        <Building2 size={22} />
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: '1rem', fontWeight: '800', color: textColor }}>{prj.name}</div>
                        <div style={{ fontSize: '0.8rem', color: subTextColor, marginTop: '2px' }}>{prj.owner || prj.investor || prj.code || 'Dự án FDI PM'}</div>
                      </div>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: `1px solid ${borderColor}`, paddingTop: '10px' }}>
                      <div style={{ fontSize: '0.78rem', color: subTextColor }}>Mã nội bộ: <span style={{ fontWeight: '700', color: textColor }}>{prj.code || prj.id}</span></div>
                      <span style={{ backgroundColor: '#e0f2fe', color: '#0284c7', fontSize: '0.75rem', fontWeight: '800', padding: '4px 10px', borderRadius: '8px' }}>
                        {prj.status || 'Đang thực hiện'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.82rem', color: '#2563eb', fontWeight: '700' }}>
                      {prjDocsCount} tài liệu
                    </div>
                  </div>
                );
              })
            )}
          </main>
        </div>
      )}

      {/* ── 6. MÀN HÌNH CHI TIẾT DỰ ÁN (PROJECT DETAIL SCREEN) ── */}
      {activeScreen === 'project_detail' && selectedProject && (() => {
        const prjDocs = activeDocsList.filter(d => isDocRelatedToProject(d, selectedProject));
        const projectCoverImg = selectedProject.image || selectedProject.banner || selectedProject.thumbnail || selectedProject.coverImage || null;
        
        const planningDetailsList = Array.isArray(selectedProject.details) && selectedProject.details.length > 0
          ? selectedProject.details.filter(d => d.value || d.name)
          : [
              { name: 'Tổng diện tích ô đất dự án', value: selectedProject.totalArea || '17.217 m²' },
              { name: 'Mật độ xây dựng', value: selectedProject.buildingDensity || '45%' },
              { name: 'Hệ số sử dụng đất', value: selectedProject.landUseRatio || '3,15 lần' },
              { name: 'Số tầng cao', value: selectedProject.floors || '07 tầng' },
              { name: 'Số tầng hầm', value: selectedProject.basements || '01 tầng' },
              { name: 'Diện tích xây dựng', value: selectedProject.buildArea || '7.749 m²' },
              { name: 'Tổng diện tích sàn xây dựng', value: selectedProject.grossFloorArea || '54.243 m²' },
              { name: 'Công suất phục vụ', value: selectedProject.capacity || '6.000 nhân viên' },
              { name: 'Chiều cao PCCC', value: selectedProject.fireHeight || '< 28 m' },
              { name: 'Chiều cao tĩnh không', value: selectedProject.clearanceHeight || '29,5 m' },
              { name: 'Chiều sâu tầng hầm', value: selectedProject.basementDepth || '3,3 m' },
              { name: 'Phân cấp dự án', value: selectedProject.projectGrade || 'Cấp I' },
              { name: 'Phân loại dự án', value: selectedProject.projectCategory || 'Công trình công cộng, dân dụng' }
            ];

        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <header style={{
              padding: HEADER_SAFE_PADDING,
              backgroundColor: cardBg,
              borderBottom: `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              flexShrink: 0,
              zIndex: 10,
              boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <button onClick={() => setActiveScreen('project_list')} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer', padding: 0 }}>
                <ArrowLeft size={22} />
              </button>
              <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: textColor }}>Thông tin dự án</h2>
            </header>

            <main style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehaviorY: 'contain',
              scrollBehavior: 'smooth',
              padding: MAIN_SAFE_PADDING,
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              boxSizing: 'border-box'
            }}>
              {/* Banner dự án */}
              <div style={{
                borderRadius: '16px', padding: '20px', color: '#ffffff', display: 'flex', flexDirection: 'column', gap: '12px',
                position: 'relative', overflow: 'hidden',
                backgroundImage: projectCoverImg 
                  ? `linear-gradient(180deg, rgba(15,23,42,0.45) 0%, rgba(15,23,42,0.88) 100%), url(${projectCoverImg})`
                  : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
                backgroundSize: 'cover', backgroundPosition: 'center',
                boxShadow: '0 8px 24px rgba(37,99,235,0.25)',
                flexShrink: 0
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#ffffff', backgroundColor: 'rgba(0,0,0,0.35)', padding: '4px 10px', borderRadius: '8px', backdropFilter: 'blur(4px)' }}>
                    Mã nội bộ: <span style={{ fontWeight: '900' }}>{selectedProject.code || selectedProject.id}</span>
                  </div>
                  <span style={{ backgroundColor: 'rgba(255,255,255,0.25)', color: '#ffffff', fontSize: '0.78rem', fontWeight: '800', padding: '5px 14px', borderRadius: '20px', backdropFilter: 'blur(4px)' }}>
                    {selectedProject.status || 'Đang thực hiện'}
                  </span>
                </div>

                <div style={{ fontSize: '1.25rem', fontWeight: '900', textShadow: '0 2px 4px rgba(0,0,0,0.5)', lineHeight: '1.3' }}>
                  {selectedProject.name}
                </div>

                <div
                  onClick={() => handleOpenMapLocation(selectedProject.location || 'Lô CNS1, đường Văn Tiến Dũng, phường Tây Tựu, thành phố Hà Nội', selectedProject)}
                  style={{
                    fontSize: '0.85rem',
                    color: 'rgba(255,255,255,0.95)',
                    backgroundColor: 'rgba(0,0,0,0.3)',
                    padding: '8px 12px',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '8px',
                    cursor: 'pointer',
                    backdropFilter: 'blur(4px)',
                    transition: 'all 0.15s ease'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden' }}>
                    <MapPin size={16} color="#60a5fa" style={{ flexShrink: 0 }} />
                    <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      <strong style={{ color: '#93c5fd' }}>Địa điểm DA:</strong> {selectedProject.location || 'Lô CNS1, đường Văn Tiến Dũng, phường Tây Tựu, thành phố Hà Nội'}
                    </span>
                  </div>
                  <span style={{ backgroundColor: '#2563eb', color: '#ffffff', fontSize: '0.72rem', fontWeight: '800', padding: '4px 8px', borderRadius: '12px', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                    <Globe size={11} /> Bản đồ 📍
                  </span>
                </div>
              </div>

              {/* ── BẮT ĐẦU: KHỐI THÔNG TIN QUY HOẠCH & CHỈ TIÊU KIẾN TRÚC (PHƯƠNG ÁN 1 - GOM GỌN ĐỂ DỄ DÀNG HOÀN TÁC/UNDO) ── */}
              <MobileProjectPlanningSection
                selectedProject={selectedProject}
                isDark={isDark}
                cardBg={cardBg}
                borderColor={borderColor}
                textColor={textColor}
                subTextColor={subTextColor}
              />
              {/* ── KẾT THÚC: KHỐI THÔNG TIN QUY HOẠCH & CHỈ TIÊU KIẾN TRÚC ── */}

              {/* ── BẮT ĐẦU: KHỐI THÀNH VIÊN DỰ ÁN ── */}
              <MobileProjectMembersSection
                selectedProject={selectedProject}
                members={members}
                isDark={isDark}
                cardBg={cardBg}
                borderColor={borderColor}
                textColor={textColor}
                subTextColor={subTextColor}
              />
              {/* ── KẾT THÚC: KHỐI THÀNH VIÊN DỰ ÁN ── */}

              {/* Khối XEM TÀI LIỆU ĐÍNH KÈM */}
              <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px', border: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: '12px', boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}>
                <div
                  onClick={() => setIsDocsExpanded(!isDocsExpanded)}
                  style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    borderBottom: isDocsExpanded ? `1px solid ${borderColor}` : 'none',
                    paddingBottom: isDocsExpanded ? '10px' : '0',
                    cursor: 'pointer', userSelect: 'none'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <FileText size={20} color="#2563eb" />
                    <span style={{ fontSize: '1.05rem', fontWeight: '800', color: textColor }}>Xem tài liệu đính kèm</span>
                    <span style={{ backgroundColor: '#e0edff', color: '#2563eb', fontSize: '0.78rem', fontWeight: '800', padding: '2px 9px', borderRadius: '12px' }}>
                      {prjDocs.length}
                    </span>
                  </div>
                  <div style={{
                    width: '32px', height: '32px', borderRadius: '50%',
                    backgroundColor: isDark ? '#334155' : '#f1f5f9',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'transform 0.25s ease',
                    transform: isDocsExpanded ? 'rotate(0deg)' : 'rotate(-90deg)'
                  }}>
                    <ChevronDown size={22} color="#2563eb" />
                  </div>
                </div>

                {isDocsExpanded && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '2px' }}>
                    {prjDocs.length === 0 ? (
                      <div style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '18px', borderRadius: '12px', textAlign: 'center', color: subTextColor, fontSize: '0.88rem', border: `1px solid ${borderColor}` }}>
                        Chưa có tài liệu nào đính kèm cho dự án này.
                      </div>
                    ) : (
                      prjDocs.map((doc, idx) => {
                        const prjDocPastel = getPastelForString(doc.summary || doc.title || '', idx);
                        const docFiles = getDocFiles(doc);
                        return (
                          <div
                            key={doc.id || idx}
                            onClick={() => { setSelectedDoc(doc); setActiveScreen('doc_detail'); }}
                            style={{ backgroundColor: isDark ? '#0f172a' : prjDocPastel.bg, borderRadius: '14px', padding: '14px', border: `1.5px solid ${isDark ? borderColor : prjDocPastel.border}`, display: 'flex', flexDirection: 'column', gap: '10px', cursor: 'pointer', boxShadow: isDark ? 'none' : prjDocPastel.shadow }}
                          >
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                                <div style={{ width: '36px', height: '36px', borderRadius: '10px', backgroundColor: isDark ? '#1e293b' : prjDocPastel.iconBg, color: isDark ? '#60a5fa' : prjDocPastel.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                  <FileText size={18} />
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', overflow: 'hidden' }}>
                                  <span style={{ fontSize: '0.9rem', fontWeight: '700', color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                    {doc.summary || doc.title || doc.name}
                                  </span>
                                  <span style={{ fontSize: '0.75rem', color: subTextColor }}>
                                    {doc.documentNumber || doc.code || 'N/A'} • {doc.effectiveDate || doc.date || 'Hôm nay'}
                                  </span>
                                </div>
                              </div>
                              <ChevronRight size={16} color={subTextColor} />
                            </div>

                            {/* Danh sách tệp đính kèm ngay trong thẻ tài liệu của Dự án */}
                            {docFiles.length > 0 && (
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', borderTop: `1px dashed ${isDark ? borderColor : prjDocPastel.border}`, paddingTop: '8px' }}>
                                {docFiles.map((file, fIdx) => (
                                  <button
                                    key={fIdx}
                                    onClick={(e) => handleOpenFile(file.url, e)}
                                    style={{
                                      backgroundColor: isDark ? '#1e293b' : '#ffffff',
                                      color: isDark ? '#93c5fd' : '#2563eb',
                                      border: `1px solid ${isDark ? '#3b82f6' : '#bfdbfe'}`,
                                      borderRadius: '8px',
                                      padding: '4px 8px',
                                      fontSize: '0.72rem',
                                      fontWeight: '700',
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '4px',
                                      cursor: 'pointer'
                                    }}
                                  >
                                    <Paperclip size={12} />
                                    <span style={{ maxWidth: '140px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{file.name}</span>
                                    <ExternalLink size={10} />
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}
              </div>
            </main>
          </div>
        );
      })()}

      {/* ── 7. MÀN HÌNH CHI TIẾT VĂN BẢN (DOC DETAIL SCREEN) ── */}
      {activeScreen === 'doc_detail' && selectedDoc && (() => {
        const files = getDocFiles(selectedDoc);
        const isFav = favorites.includes(selectedDoc.id);

        return (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
            <header style={{
              padding: HEADER_SAFE_PADDING,
              backgroundColor: cardBg,
              borderBottom: `1px solid ${borderColor}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexShrink: 0,
              zIndex: 10,
              boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.03)'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <button onClick={() => setActiveScreen('overview')} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer', padding: 0 }}>
                  <ArrowLeft size={22} />
                </button>
                <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: textColor }}>Chi tiết văn bản</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button onClick={(e) => toggleFavorite(selectedDoc.id, e)} style={{ background: 'none', border: 'none', color: isFav ? '#f59e0b' : subTextColor, cursor: 'pointer' }}>
                  <Star size={22} fill={isFav ? '#f59e0b' : 'none'} />
                </button>
                <button onClick={(e) => handleShare(selectedDoc, e)} style={{ background: 'none', border: 'none', color: subTextColor, cursor: 'pointer' }}>
                  <Share2 size={20} />
                </button>
              </div>
            </header>

            <main style={{
              flex: 1,
              overflowY: 'auto',
              overflowX: 'hidden',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-y',
              overscrollBehaviorY: 'contain',
              scrollBehavior: 'smooth',
              padding: MAIN_SAFE_PADDING,
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              boxSizing: 'border-box'
            }}>
              {/* MỤC 5: THAY MÃ LƯU TÀI LIỆU BẰNG "SỐ TÀI LIỆU, VĂN BẢN" CÙNG HÀNG */}
              <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px', border: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: '700', color: subTextColor }}>
                    Số tài liệu, văn bản:
                  </span>
                  <span style={{ backgroundColor: '#e0edff', color: '#2563eb', fontSize: '0.85rem', fontWeight: '800', padding: '4px 10px', borderRadius: '8px' }}>
                    {selectedDoc.documentNumber || selectedDoc.code || selectedDoc.documentCode || 'Chưa xác định'}
                  </span>
                </div>

                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: textColor, margin: 0, lineHeight: '1.4' }}>
                  {selectedDoc.summary || selectedDoc.title || selectedDoc.name}
                </h3>
              </div>

              {/* Metadata Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div style={{ backgroundColor: isDark ? '#0f172a' : getPastelForString(selectedDoc.type || selectedDoc.documentType || '', 0).bg, borderRadius: '14px', padding: '12px', border: `1.5px solid ${isDark ? borderColor : getPastelForString(selectedDoc.type || selectedDoc.documentType || '', 0).border}` }}>
                  <span style={{ fontSize: '0.75rem', color: isDark ? subTextColor : getPastelForString(selectedDoc.type || selectedDoc.documentType || '', 0).text, fontWeight: '600' }}>Phân loại:</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: isDark ? textColor : getPastelForString(selectedDoc.type || selectedDoc.documentType || '', 0).text, marginTop: '2px' }}>{selectedDoc.type || selectedDoc.documentType || 'N/A'}</div>
                </div>
                <div style={{ backgroundColor: cardBg, borderRadius: '14px', padding: '12px', border: `1px solid ${borderColor}` }}>
                  <span style={{ fontSize: '0.75rem', color: subTextColor, fontWeight: '600' }}>Cơ quan ban hành:</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: textColor, marginTop: '2px' }}>{selectedDoc.issuingAgency || 'Chưa xác định'}</div>
                </div>
                <div style={{ backgroundColor: cardBg, borderRadius: '14px', padding: '12px', border: `1px solid ${borderColor}` }}>
                  <span style={{ fontSize: '0.75rem', color: subTextColor, fontWeight: '600' }}>Ngày hiệu lực:</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: textColor, marginTop: '2px' }}>
                    {selectedDoc.effectiveDate || selectedDoc.date || 'N/A'}
                  </div>
                </div>
                <div style={{ backgroundColor: isDark ? '#0f172a' : getPastelForString(getDocProjectName(selectedDoc), 2).bg, borderRadius: '14px', padding: '12px', border: `1.5px solid ${isDark ? borderColor : getPastelForString(getDocProjectName(selectedDoc), 2).border}` }}>
                  <span style={{ fontSize: '0.75rem', color: isDark ? subTextColor : getPastelForString(getDocProjectName(selectedDoc), 2).text, fontWeight: '600' }}>Dự án liên quan:</span>
                  <div style={{ fontSize: '0.88rem', fontWeight: '800', color: isDark ? textColor : getPastelForString(getDocProjectName(selectedDoc), 2).text, marginTop: '2px' }}>
                    {getDocProjectName(selectedDoc)}
                  </div>
                </div>
              </div>

              {/* Thẻ Quyền truy cập tài liệu trong Chi tiết văn bản */}
              <div style={{ backgroundColor: isDark ? 'rgba(37,99,235,0.1)' : '#eff6ff', borderRadius: '14px', padding: '12px 16px', border: `1.5px solid ${isDark ? '#1e3a8a' : '#bfdbfe'}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: '700', color: isDark ? '#93c5fd' : '#1e40af' }}>Quyền truy cập tài liệu:</span>
                <span style={{ fontSize: '0.85rem', fontWeight: '800', color: '#2563eb', backgroundColor: isDark ? '#1e293b' : '#ffffff', padding: '4px 10px', borderRadius: '8px', border: `1px solid ${isDark ? borderColor : '#bfdbfe'}` }}>
                  {EMPLOYEE_LEVELS.find(l => (selectedDoc.accessLevels || []).includes(l.id) || l.id === selectedDoc.minAccessLevel)?.shortName || 'Tất cả thành viên (Cấp 1 - 7)'}
                </span>
              </div>

              {/* MỤC 6: DANH SÁCH TỆP ĐÍNH KÈM TOÀN DIỆN */}
              <div style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '16px', border: `1px solid ${borderColor}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: '800', color: textColor, display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Paperclip size={18} color="#2563eb" />
                  <span>Danh sách tệp đính kèm ({files.length})</span>
                </div>

                {files.length === 0 ? (
                  <div style={{ backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '14px', borderRadius: '12px', fontSize: '0.82rem', color: subTextColor, textAlign: 'center', border: `1px solid ${borderColor}` }}>
                    Không có tệp đính kèm nào được lưu cho văn bản này.
                  </div>
                ) : (
                  files.map((file, fIdx) => (
                    <div key={fIdx} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: isDark ? '#0f172a' : '#f8fafc', padding: '10px 14px', borderRadius: '12px', border: `1px solid ${borderColor}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', overflow: 'hidden', paddingRight: '8px' }}>
                        <span style={{ fontSize: '1.1rem' }}>📄</span>
                        <span style={{ fontSize: '0.85rem', fontWeight: '700', color: textColor, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {file.name}
                        </span>
                      </div>
                      <button
                        onClick={(e) => handleOpenFile(file.url, e)}
                        style={{ backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '0.78rem', fontWeight: '800', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, boxShadow: '0 3px 8px rgba(37,99,235,0.25)' }}
                      >
                        Mở file <ExternalLink size={12} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </main>
          </div>
        );
      })()}

      {/* ── 8. MÀN HÌNH MỚI TRONG 7 NGÀY GẦN ĐÂY (RECENT 7 DAYS SCREEN) ── */}
      {activeScreen === 'recent_7days' && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
          <header style={{
            padding: HEADER_SAFE_PADDING,
            backgroundColor: cardBg,
            borderBottom: `1px solid ${borderColor}`,
            display: 'flex',
            alignItems: 'center',
            gap: '14px',
            flexShrink: 0,
            zIndex: 10,
            boxShadow: isDark ? '0 2px 10px rgba(0,0,0,0.3)' : '0 1px 3px rgba(0,0,0,0.03)'
          }}>
            <button onClick={() => setActiveScreen('overview')} style={{ background: 'none', border: 'none', color: textColor, cursor: 'pointer', padding: 0 }}>
              <ArrowLeft size={22} />
            </button>
            <h2 style={{ fontSize: '1.2rem', fontWeight: '800', margin: 0, color: textColor }}>
              Mới trong 7 ngày gần đây
            </h2>
          </header>

          <main style={{
            flex: 1,
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-y',
            overscrollBehaviorY: 'contain',
            scrollBehavior: 'smooth',
            padding: MAIN_SAFE_PADDING,
            display: 'flex',
            flexDirection: 'column',
            gap: '20px',
            boxSizing: 'border-box'
          }}>
            <div style={{ fontSize: '0.85rem', color: subTextColor, paddingLeft: '4px' }}>
              Tổng hợp tài liệu và dự án có hoạt động mới trong 7 ngày gần đây.
            </div>

            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: textColor, marginBottom: '10px', paddingLeft: '4px' }}>
                TÀI LIỆU MỚI ({recent7DaysDocs.length})
              </div>
              {recent7DaysDocs.length === 0 ? (
                <div style={{ backgroundColor: cardBg, padding: '20px', borderRadius: '14px', textAlign: 'center', color: subTextColor, fontSize: '0.85rem', border: `1px solid ${borderColor}` }}>
                  Chưa có tài liệu mới nào trong 7 ngày qua.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {recent7DaysDocs.map((doc, idx) => {
                    const docPastel = getPastelForString(doc.summary || doc.title || doc.code || '', idx);
                    return (
                      <div
                        key={doc.id || idx}
                        onClick={() => { setSelectedDoc(doc); setActiveScreen('doc_detail'); }}
                        style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '14px 16px', border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '14px', cursor: 'pointer', boxShadow: isDark ? 'none' : docPastel.shadow }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                          <div style={{ width: '44px', height: '44px', borderRadius: '12px', backgroundColor: isDark ? '#1e293b' : docPastel.iconBg, color: isDark ? '#60a5fa' : docPastel.text, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                            <FileText size={22} />
                          </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '3px', overflow: 'hidden' }}>
                          <span style={{ fontSize: '0.95rem', fontWeight: '700', color: textColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {doc.summary || doc.title || doc.name}
                          </span>
                          <span style={{ fontSize: '0.8rem', color: subTextColor, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {getDocProjectName(doc)} • {doc.effectiveDate || 'Hôm nay'}
                          </span>
                        </div>
                      </div>
                      <ChevronRight size={18} color={subTextColor} style={{ flexShrink: 0 }} />
                    </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: '800', color: textColor, marginBottom: '10px', paddingLeft: '4px' }}>
                DỰ ÁN CÓ CẬP NHẬT
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {projectsList.map((prj, pIdx) => {
                  const prjPastel = getPastelForString(prj.name || prj.code || '', pIdx);
                  const count = activeDocsList.filter(d => isDocRelatedToProject(d, prj)).length;
                  return (
                    <div
                      key={prj.id || pIdx}
                      onClick={() => { setSelectedProject(prj); setActiveScreen('project_detail'); }}
                      style={{ backgroundColor: cardBg, borderRadius: '16px', padding: '14px 16px', border: `1px solid ${borderColor}`, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
                    >
                      <div>
                        <div style={{ fontSize: '0.95rem', fontWeight: '800', color: textColor }}>{prj.name}</div>
                        <div style={{ fontSize: '0.78rem', color: subTextColor, marginTop: '2px' }}>{prj.owner || prj.investor || prj.code || 'Dự án FDI PM'}</div>
                      </div>
                      <span style={{ fontSize: '0.82rem', fontWeight: '800', color: '#2563eb', flexShrink: 0 }}>
                        {count} tài liệu
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </main>
        </div>
      )}

      {/* ── MỤC 1: BOTTOM FOOTER NAV VỚI ICON HOME ĐƠN SẮC PHONG CÁCH CŨ ── */}
      <footer style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: '65px',
        backgroundColor: cardBg,
        borderTop: `1px solid ${borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 50,
        boxShadow: '0 -2px 10px rgba(0,0,0,0.03)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)'
      }}>
        <button
          onClick={() => {
            setSelectedDoc(null);
            setSelectedProject(null);
            setActiveScreen('overview');
          }}
          style={{
            background: 'none',
            border: 'none',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '3px',
            color: activeScreen === 'overview' ? '#2563eb' : subTextColor,
            cursor: 'pointer',
            padding: '4px 24px'
          }}
        >
          <Home size={22} color={activeScreen === 'overview' ? '#2563eb' : subTextColor} />
          <span style={{ fontSize: '0.72rem', fontWeight: '700' }}>Trang chủ</span>
        </button>
      </footer>
    </div>
  );
};

export default MobileDocumentApp;
