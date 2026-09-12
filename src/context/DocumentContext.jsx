import React, { createContext, useState, useEffect, useCallback, useMemo } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, writeBatch, deleteDoc, query, where, getDocs, setDoc, serverTimestamp } from 'firebase/firestore';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { db, auth, storage } from '../firebase';
import { ref as storageRef, deleteObject } from 'firebase/storage';
import { mockProjects, mockMembers, mockPartners, LIST_CONFIGS, ALL_AGENCIES } from '../data';
import { generateToken, hashToken, getAppUrl } from '../utils/inviteUtils';
import { COLLECTIONS, ROLES } from '../constants';
import { isDocRelatedToProject } from '../utils/projectMatcher';

const ALL_ADMIN_PERMS = {
  view_docs: true,  add_docs: true,  edit_docs: true,  approve_docs: true,
  view_steps: true, add_steps: true, edit_steps: true, reorder: true, upload_att: true,
  view_bidding: true, edit_bidding: true, view_contractor: true, edit_contractor: true,
  view_acceptance: true, edit_acceptance: true, view_payment: true, update_payment: true,
  view_defects: true, edit_defects: true,
  manage_members: true, manage_partners: true, system_settings: true,
};

const DEFAULT_ROLE_PERMS = {
  'Admin': ALL_ADMIN_PERMS,
  'Giám đốc DA': {
    view_docs: true,  add_docs: true,  edit_docs: true,  approve_docs: true,
    view_steps: true, add_steps: true, edit_steps: true, reorder: true, upload_att: true,
    view_bidding: true, edit_bidding: true, view_contractor: true, edit_contractor: true,
    view_acceptance: true, edit_acceptance: true, view_payment: true, update_payment: true,
    view_defects: true, edit_defects: true,
    manage_members: false, manage_partners: false, system_settings: false,
  },
  'Chuyên viên': {
    view_docs: true,  add_docs: true,  edit_docs: false, approve_docs: false,
    view_steps: true, add_steps: true, edit_steps: false, reorder: false, upload_att: true,
    view_bidding: true, edit_bidding: false, view_contractor: true, edit_contractor: true,
    view_acceptance: true, edit_acceptance: false, view_payment: true, update_payment: false,
    view_defects: true, edit_defects: false,
    manage_members: false, manage_partners: false, system_settings: false,
  },
  'Thư ký DA': {
    view_docs: true,  add_docs: false, edit_docs: false, approve_docs: false,
    view_steps: true, add_steps: false, edit_steps: false, reorder: false, upload_att: false,
    view_bidding: true, edit_bidding: false, view_contractor: true, edit_contractor: false,
    view_acceptance: true, edit_acceptance: false, view_payment: true, update_payment: false,
    view_defects: true, edit_defects: false,
    manage_members: false, manage_partners: false, system_settings: false,
  },
};

const getDefaultPermissionsForRole = (roleName) => {
  const name = (roleName || '').toLowerCase();
  if (name === 'admin' || name.includes('quản trị')) {
    return ALL_ADMIN_PERMS;
  }
  if (name.includes('giám đốc') || name.includes('gd') || name.includes('pm') || name.includes('chủ trì')) {
    return DEFAULT_ROLE_PERMS['Giám đốc DA'];
  }
  if (name.includes('thư ký') || name.includes('trợ lý')) {
    return DEFAULT_ROLE_PERMS['Thư ký DA'];
  }
  return DEFAULT_ROLE_PERMS['Chuyên viên'];
};

const DEFAULT_MATRIX = {
  'Admin': ALL_ADMIN_PERMS,
  'Giám đốc dự án': DEFAULT_ROLE_PERMS['Giám đốc DA'],
  'Điều phối dự án': DEFAULT_ROLE_PERMS['Chuyên viên'],
  'Thành viên dự án': DEFAULT_ROLE_PERMS['Chuyên viên'],
  'Thư ký dự án': DEFAULT_ROLE_PERMS['Thư ký DA'],
  'Giám đốc DA': DEFAULT_ROLE_PERMS['Giám đốc DA'],
  'Chuyên viên': DEFAULT_ROLE_PERMS['Chuyên viên'],
  'Thư ký DA': DEFAULT_ROLE_PERMS['Thư ký DA'],
};

export const DocumentContext = createContext();

export const DocumentProvider = ({ children, currentUser }) => {
  const [documents, setDocuments]     = useState([]);
  const [userRole, setUserRole]         = useState('User');
  const [rawRoleMatrix, setRawRoleMatrix] = useState({});
  const [defectTabs, setDefectTabs]     = useState([]);
  const [defectLibrary, setDefectLibrary] = useState([]);
  const [readDocIds, setReadDocIds]     = useState(new Set()); // per-user read tracking
  const [globalLists, setGlobalLists] = useState(
    LIST_CONFIGS.reduce((acc, config) => {
      acc[config.key] = [];
      return acc;
    }, {})
  );

  const projectRoleMatrix = useMemo(() => {
    const matrix = {
      'Admin': { ...ALL_ADMIN_PERMS }
    };
    const activeRoles = globalLists.projectRoles?.map(r => r.name) || [];

    const rolesToUse = new Set([
      'Admin',
      ...activeRoles,
      ...Object.keys(DEFAULT_MATRIX),
      ...Object.keys(rawRoleMatrix || {})
    ]);

    rolesToUse.forEach(role => {
      if (role === 'Admin') {
        matrix['Admin'] = { ...ALL_ADMIN_PERMS };
      } else {
        const defaultPermsForThisRole = DEFAULT_MATRIX[role] || getDefaultPermissionsForRole(role);
        matrix[role] = {
          ...defaultPermsForThisRole,
          ...(rawRoleMatrix?.[role] || {})
        };
      }
    });

    return matrix;
  }, [rawRoleMatrix, globalLists.projectRoles]);
  const [projects, setProjects] = useState([]);
  const [members, setMembers] = useState([]);
  const [partners, setPartners] = useState([]);
  const [biddingPackages, setBiddingPackages] = useState([]);
  const [legalSteps, setLegalSteps] = useState([]);
  const [scheduleSteps, setScheduleSteps] = useState([]);
  const [acceptanceSteps, setAcceptanceSteps] = useState([]);
  const [invitations, setInvitations] = useState([]);
  const [atldIssues, setAtldIssues] = useState([]);
  const [userNotifications, setUserNotifications] = useState([]);
  // ── Lazy subscription flag ─────────────────────────────────────────────
  const [lazyEnabled, setLazyEnabled] = useState(false);
  /**
   * Gọi từ bất kỳ trang nào cần dữ liệu lazy (Partners, BiddingPlan, PhapLy...).
   * Một khi bật, giữ nguyên suốt session — không bao giờ unsubscribe giữa chừng.
   */
  const enableLazy = useCallback(() => setLazyEnabled(true), []);

  useEffect(() => {
    // Theo dõi danh sách tài liệu (lọc bỏ isDeleted ở client)
    const unsubscribeDocs = onSnapshot(collection(db, COLLECTIONS.DOCUMENTS), (snapshot) => {
      const OLD_PROJECT_REGEX = /Khu\s+công\s+viên\s+công\s+nghệ\s+số\s+và\s+hỗn\s+hợp/i;
      const NEW_PROJECT_NAME = 'Khu đô thị Công viên công nghệ số FPT';

      const docsData = snapshot.docs.map(d => {
        const data = d.data();
        let modified = false;
        const updatePayload = {};

        let pName = data.projectName;
        if (typeof pName === 'string' && OLD_PROJECT_REGEX.test(pName)) {
          pName = pName.replace(OLD_PROJECT_REGEX, NEW_PROJECT_NAME);
          updatePayload.projectName = pName;
          modified = true;
        }

        let relProjects = data.relatedProjects;
        if (Array.isArray(relProjects)) {
          const hasOld = relProjects.some(p => typeof p === 'string' && OLD_PROJECT_REGEX.test(p));
          if (hasOld) {
            relProjects = relProjects.map(p => typeof p === 'string' && OLD_PROJECT_REGEX.test(p) ? p.replace(OLD_PROJECT_REGEX, NEW_PROJECT_NAME) : p);
            updatePayload.relatedProjects = relProjects;
            modified = true;
          }
        }

        if (modified) {
          updateDoc(doc(db, COLLECTIONS.DOCUMENTS, d.id), updatePayload).catch(console.warn);
        }

        return {
          id: d.id,
          ...data,
          projectName: pName || data.projectName,
          relatedProjects: relProjects || data.relatedProjects
        };
      });

      docsData.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      setDocuments(docsData);
    });

    // Theo dõi các danh mục cài đặt động (7 danh mục)
    const listUnsubscribes = LIST_CONFIGS.map(config => {
      return onSnapshot(collection(db, config.collectionName), (snapshot) => {
        if (!snapshot.empty) {
          const listData = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
          
          const uniqueData = listData.filter((item, index, self) => 
            index === self.findIndex((t) => t.name === item.name)
          );

          setGlobalLists(prev => ({ ...prev, [config.key]: uniqueData }));
        } else {
          // Nạp dữ liệu mẫu lên Firebase (chạy song song, không block)
          Promise.all(
            config.initialData.map((item) => addDoc(collection(db, config.collectionName), { name: item }))
          ).catch(console.error);
        }
      });
    });

    // Theo dõi danh sách dự án
    const unsubscribeProjects = onSnapshot(collection(db, COLLECTIONS.PROJECTS), (snapshot) => {
      if (!snapshot.empty) {
        const OLD_PROJECT_REGEX = /Khu\s+công\s+viên\s+công\s+nghệ\s+số\s+và\s+hỗn\s+hợp/i;
        const NEW_PROJECT_NAME = 'Khu đô thị Công viên công nghệ số FPT';

        const projectsData = snapshot.docs.map(d => {
          const data = d.data();
          let pName = data.name;
          if (typeof pName === 'string' && OLD_PROJECT_REGEX.test(pName)) {
            pName = pName.replace(OLD_PROJECT_REGEX, NEW_PROJECT_NAME);
            updateDoc(doc(db, COLLECTIONS.PROJECTS, d.id), { name: pName }).catch(console.warn);
          }
          return {
            id: d.id,
            ...data,
            name: pName || data.name
          };
        });
        setProjects(projectsData);
      } else {
        // Nạp dữ liệu mẫu (chạy song song, không block callback)
        Promise.all(
          mockProjects.map(({ id, ...data }) => addDoc(collection(db, COLLECTIONS.PROJECTS), data))
        ).catch(console.error);
      }
    });

    // Theo dõi danh sách thành viên
    const unsubscribeMembers = onSnapshot(collection(db, COLLECTIONS.MEMBERS), (snapshot) => {
      if (!snapshot.empty) {
        const membersData = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        setMembers(membersData);
      } else {
        // Nạp dữ liệu mẫu (chạy song song, không block callback)
        Promise.all(
          mockMembers.map(({ id, ...data }) => addDoc(collection(db, COLLECTIONS.MEMBERS), data))
        ).catch(console.error);
      }
    });

    const unsubscribePartners = onSnapshot(collection(db, COLLECTIONS.PARTNERS), (snapshot) => {
      if (!snapshot.empty) {
        setPartners(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } else {
        Promise.all(
          mockPartners.map(({ id, ...data }) => addDoc(collection(db, COLLECTIONS.PARTNERS), data))
        ).catch(console.error);
      }
    });

    const unsubscribeMatrix = onSnapshot(doc(db, 'system_settings', 'project_role_matrix'), (docSnap) => {
      if (docSnap.exists()) {
        setRawRoleMatrix(docSnap.data());
      } else {
        setDoc(doc(db, 'system_settings', 'project_role_matrix'), DEFAULT_MATRIX)
          .catch(err => console.error("Error setting default project matrix:", err));
      }
    });

    return () => {
      unsubscribeDocs();
      listUnsubscribes.forEach(unsub => unsub());
      unsubscribeProjects();
      unsubscribeMembers();
      unsubscribePartners();
      unsubscribeMatrix();
    };
  }, []);

  // ── Per-user read tracking ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (!currentUser?.uid) return;
    // Lấy danh sách tài liệu mà user này đã đọc
    const q = query(collection(db, 'userReadStatus'), where('userId', '==', currentUser.uid));
    const unsub = onSnapshot(q, (snap) => {
      setReadDocIds(new Set(snap.docs.map(d => d.data().documentId)));
    });
    return unsub;
  }, [currentUser?.uid]);

  // ── Lắng nghe thông báo cá nhân (Web app & Mobile app) ──────────────────
  useEffect(() => {
    if (!currentUser?.email) {
      setUserNotifications([]);
      return;
    }
    const myEmail = (currentUser.email || '').toLowerCase().trim();
    const q = query(
      collection(db, 'userNotifications'),
      where('recipientEmail', '==', myEmail)
    );
    const unsub = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a, b) => {
        const tA = a.createdAt?.toDate?.() ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.toDate?.() ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
      setUserNotifications(list);
    }, (err) => {
      console.warn('[Notifications] Lỗi khi nhận thông báo:', err.message);
    });

    return () => unsub();
  }, [currentUser?.email]);

  const markNotificationAsRead = async (id) => {
    try {
      await updateDoc(doc(db, 'userNotifications', id), { isRead: true });
    } catch (e) {
      console.warn('Lỗi đánh dấu thông báo đã đọc:', e.message);
    }
  };

  const markAllNotificationsAsRead = async () => {
    try {
      const unread = userNotifications.filter(n => !n.isRead);
      if (unread.length === 0) return;
      const batch = writeBatch(db);
      unread.forEach(n => {
        batch.update(doc(db, 'userNotifications', n.id), { isRead: true });
      });
      await batch.commit();
    } catch (e) {
      console.warn('Lỗi đánh dấu tất cả thông báo đã đọc:', e.message);
    }
  };

  const deleteNotification = async (id) => {
    try {
      await deleteDoc(doc(db, 'userNotifications', id));
    } catch (e) {
      console.warn('Lỗi xóa thông báo:', e.message);
    }
  };

  // ── Nhắc nhở tài liệu sắp hết hiệu lực (30 ngày) ────────────────────────────────
  useEffect(() => {
    if (documents.length === 0) return;
    const now  = new Date();
    const soon = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const expiring = documents.filter(d => {
      if (d.isDeleted) return false;
      const exp = d.effectiveDate ? new Date(d.effectiveDate) : null;
      return exp && exp >= now && exp <= soon;
    });
    if (expiring.length > 0) {
      // Chỉ hiện 1 lần mỗi session
      const key = `expiry_warned_${new Date().toDateString()}`;
      if (!sessionStorage.getItem(key)) {
        sessionStorage.setItem(key, '1');
        console.warn(`[QLDA] ${expiring.length} tài liệu sắp hết hiệu lực trong 30 ngày tới.`);
        // Toast sẽ được gọi từ nơi có UIContext (Header.jsx lắng nghe)
        window.dispatchEvent(new CustomEvent('doc:expiry-warning', { detail: { count: expiring.length, docs: expiring } }));
      }
    }
  // Chỉ chạy 1 lần sau khi documents load xong
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.length > 0 ? 'loaded' : 'empty']);

  // ── Hàm hỗ trợ: lấy storage path từ URL ────────────────────────────────────────────────────────
  const deleteStorageFile = async (url) => {
    try {
      const match = url?.match(/\/o\/(.+?)(\?|$)/);
      if (!match) return;
      const path = decodeURIComponent(match[1]);
      await deleteObject(storageRef(storage, path));
    } catch (e) {
      console.warn('[Storage] Không thể xóa file:', e.message);
    }
  };

  // ── Audit log ────────────────────────────────────────────────────────────────────────────────
  const logAudit = async (action, details = {}) => {
    try {
      await addDoc(collection(db, 'auditLogs'), {
        action,
        userId:    currentUser?.uid   || 'unknown',
        userName:  currentUser?.displayName || currentUser?.email || 'unknown',
        timestamp: serverTimestamp(),
        ...details,
      });
    } catch (e) {
      console.warn('[Audit] Không thể ghi log:', e.message);
    }
  };

  // ── Auto-purge: xóa vĩnh viễn các tài liệu đã xóa mềm > 30 ngày ──────────
  useEffect(() => {
    if (documents.length === 0) return;
    // Chỉ chạy 1 lần mỗi ngày/session
    const purgeKey = `auto_purged_${new Date().toDateString()}`;
    if (sessionStorage.getItem(purgeKey)) return;
    sessionStorage.setItem(purgeKey, '1');

    const now  = Date.now();
    const limit = 30 * 24 * 60 * 60 * 1000; // 30 ngày
    const expired = documents.filter(d =>
      d.isDeleted && d.deletedAt && (now - new Date(d.deletedAt).getTime()) > limit
    );
    if (expired.length === 0) return;

    console.log(`[QLDA] Auto-purge: xóa vĩnh viễn ${expired.length} tài liệu hết hạn trong thùng rác`);
    expired.forEach(async (d) => {
      try {
        await Promise.all((d.attachments || []).map(att => deleteStorageFile(att.url)));
        await deleteDoc(doc(db, 'documents', d.id));
        logAudit?.('permanent_delete', { documentId: d.id, documentNumber: d.documentNumber, reason: 'auto_purge_30d' });
      } catch (e) {
        console.warn('[AutoPurge] Lỗi khi xóa:', d.id, e.message);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [documents.length > 0 ? 'loaded' : 'empty']);

  // ── Tính toán danh sách Cơ quan ban hành chuẩn (1-1 với Đối tác) ─────────────────
  const uniqueAgencies = useMemo(() => {
    const agencySet = new Set();
    (partners || []).forEach(p => {
      if (p.name && p.name.trim()) agencySet.add(p.name.trim());
      if (p.shortName && p.shortName.trim()) agencySet.add(p.shortName.trim());
    });
    (documents || []).forEach(d => {
      if (d.issuingAgency && d.issuingAgency.trim()) agencySet.add(d.issuingAgency.trim());
    });
    (ALL_AGENCIES || []).forEach(a => {
      if (a && a.trim()) agencySet.add(a.trim());
    });
    return Array.from(agencySet).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [partners, documents]);

  const ensurePartnerExists = async (agencyName) => {
    if (!agencyName || !agencyName.trim()) return;
    const trimmed = agencyName.trim();
    const exists = (partners || []).some(p =>
      (p.name && p.name.trim().toLowerCase() === trimmed.toLowerCase()) ||
      (p.shortName && p.shortName.trim().toLowerCase() === trimmed.toLowerCase())
    );
    if (!exists) {
      try {
        await addDoc(collection(db, COLLECTIONS.PARTNERS), {
          name: trimmed,
          shortName: trimmed,
          type: ['Cơ quan ban hành'],
          locked: false,
          createdAt: new Date().toISOString()
        });
      } catch (err) {
        console.error("[PartnerSync] Lỗi khi thêm đối tác mới:", err);
      }
    }
  };

  // ── LAZY: subscribe khi enableLazy() được gọi lần đầu ───────────────────
  // Các collections ít dùng chỉ subscribe khi user điều hướng đến trang cần chúng.
  // Một khi bật, giữ nguyên cho đến khi logout (Provider unmount).
  useEffect(() => {
    if (!lazyEnabled) return;

    // Theo dõi gói thầu
    const unsubscribeBidding = onSnapshot(collection(db, COLLECTIONS.BIDDING_PACKAGES), (snapshot) => {
      setBiddingPackages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Theo dõi bước pháp lý
    const unsubscribeLegal = onSnapshot(collection(db, COLLECTIONS.LEGAL_STEPS), (snapshot) => {
      setLegalSteps(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Theo dõi tiến độ
    const unsubscribeSchedule = onSnapshot(collection(db, COLLECTIONS.SCHEDULE_STEPS), (snapshot) => {
      setScheduleSteps(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Theo dõi nghiệm thu
    const unsubscribeAcceptance = onSnapshot(collection(db, COLLECTIONS.ACCEPTANCE_STEPS), (snapshot) => {
      setAcceptanceSteps(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Theo dõi lời mời thành viên
    const unsubscribeInvitations = onSnapshot(collection(db, COLLECTIONS.INVITATIONS), (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      data.sort((a, b) => {
        const tA = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
        const tB = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
        return tB - tA;
      });
      setInvitations(data);
    });

    // Theo dõi thẻ danh mục lỗi
    const unsubscribeDefectTabs = onSnapshot(collection(db, 'defectTabs'), (snapshot) => {
      setDefectTabs(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Theo dõi thư viện danh mục lỗi
    const unsubscribeDefectLibrary = onSnapshot(collection(db, 'defectLibrary'), (snapshot) => {
      setDefectLibrary(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Tự động nạp dữ liệu mẫu cho danh mục lỗi nếu trống
    const seedDefects = async () => {
      try {
        const tabsSnap = await getDocs(collection(db, 'defectTabs'));
        if (tabsSnap.empty) {
          const tabRefs = await Promise.all([
            addDoc(collection(db, 'defectTabs'), { name: 'Quy hoạch' }),
            addDoc(collection(db, 'defectTabs'), { name: 'Concept' }),
            addDoc(collection(db, 'defectTabs'), { name: 'Thiết kế cơ sở' })
          ]);
          
          const tabIds = tabRefs.map(r => r.id);
          
          const initialErrors = [
            { tabId: tabIds[0], code: 'L-QH-01', title: 'Sai lệch mốc tọa độ quy hoạch', description: 'Tọa độ góc ranh giới lô đất trên bản vẽ thực tế không khớp với bản vẽ quy hoạch 1/500 đã duyệt, dẫn đến nguy cơ lấn chiếm lộ giới.', prevention: 'Yêu cầu đơn vị đo đạc độc lập khảo sát lại hiện trạng và đối chiếu với Sở Quy hoạch Kiến trúc trước khi chốt phương án.', severity: 'Nghiêm trọng', author: 'KTS. Nguyễn Văn A' },
            { tabId: tabIds[0], code: 'L-QH-02', title: 'Thiếu mảng xanh bắt buộc', description: 'Tỷ lệ cây xanh cảnh quan và phần đất thấm nước chưa đạt tối thiểu 20% theo QCVN 01:2021/BXD.', prevention: 'Tăng diện tích trồng cỏ gạch lỗ tại bãi xe ngoài trời, thiết kế thêm vườn mái (green roof).', severity: 'Trung bình', author: 'KTS. Lê Thị B' },
            { tabId: tabIds[1], code: 'L-CC-01', title: 'Bố cục luồng giao thông chồng chéo', description: 'Luồng xe nhập hàng (Logistics) cắt ngang luồng xe khách VIP, gây ách tắc vào giờ cao điểm.', prevention: 'Phân tách 2 cổng ra vào riêng biệt, hoặc bố trí đường hầm nội bộ cho khối vận hành.', severity: 'Cao', author: 'KTS. Trần C' },
            { tabId: tabIds[2], code: 'L-TKCS-01', title: 'Tính thiếu tải trọng thiết bị mái', description: 'Bản vẽ kết cấu chưa tính đến tải trọng động của hệ thống Chiller và Tháp giải nhiệt (Cooling Tower) đặt trên mái.', prevention: 'Phối hợp chặt chẽ bản vẽ MEP và Kết cấu, xin thông số thiết bị từ nhà cung cấp trước khi tính toán sàn mái.', severity: 'Nghiêm trọng', author: 'KS. Phạm D' }
          ];

          await Promise.all(
            initialErrors.map(err => addDoc(collection(db, 'defectLibrary'), err))
          );
        }
      } catch (err) {
        console.error("Lỗi khởi tạo danh mục lỗi:", err);
      }
    };
    seedDefects();

    // Theo dõi vấn đề ATLĐ & VSMT
    const unsubscribeAtld = onSnapshot(collection(db, COLLECTIONS.ATLD_ISSUES), (snapshot) => {
      setAtldIssues(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
    });

    // Tự động nạp dữ liệu mẫu cho ATLĐ & VSMT nếu trống
    const seedAtld = async () => {
      try {
        const snap = await getDocs(collection(db, COLLECTIONS.ATLD_ISSUES));
        if (snap.empty) {
          const sampleIssues = [
            {
              title: 'Chưa căng lưới an toàn chống vật rơi tại mặt ngoài giàn giáo',
              project: 'Dự án Toà nhà CNS-1',
              projectId: 1,
              category: 'ATLĐ',
              severity: 'Nghiêm trọng',
              status: 'open',
              location: 'Tầng 6 - 8, trục B-D',
              deadline: '2026-09-12',
              reportedDate: '2026-09-08',
              assignedTo: 'Coteccons - Đội thi công 2',
              description: 'Khu vực đang tháo dỡ cốp pha chưa có lưới hứng vật rơi, nguy cơ mất an toàn cho người bên dưới.'
            },
            {
              title: 'Xe chở phế thải đất đá ra vào công trường chưa được xịt rửa lốp',
              project: 'Dự án Toà nhà CNS-1',
              projectId: 1,
              category: 'VSMT',
              severity: 'Cao',
              status: 'open',
              location: 'Cổng số 1 ra đường chính',
              deadline: '2026-09-11',
              reportedDate: '2026-09-09',
              assignedTo: 'Nhà thầu vận chuyển',
              description: 'Gây vương vãi bùn đất ra đường giao thông công cộng, bị Ban quản lý nhắc nhở.'
            },
            {
              title: 'Tủ điện thi công tạm thời chưa nối đất an toàn và thiếu nắp đậy',
              project: 'Dự án Toà nhà CNS-1',
              projectId: 1,
              category: 'ATLĐ',
              severity: 'Nghiêm trọng',
              status: 'open',
              location: 'Tầng hầm B1, khu máy phát điện',
              deadline: '2026-09-10',
              reportedDate: '2026-09-07',
              assignedTo: 'Nhà thầu Cơ Điện',
              description: 'Tủ điện dã chiến ẩm ướt, chưa có cọc tiếp địa chống rò điện, tiềm ẩn nguy cơ chập điện.'
            },
            {
              title: 'Tập kết rác thải xây dựng và bao bì xi măng bừa bãi',
              project: 'Dự án Toà nhà CNS-1',
              projectId: 1,
              category: 'VSMT',
              severity: 'Trung bình',
              status: 'in_progress',
              location: 'Sân bãi phía Nam',
              deadline: '2026-09-15',
              reportedDate: '2026-09-06',
              assignedTo: 'Đội dọn dẹp vệ sinh',
              description: 'Bao bì xi măng và vụn xốp bay tán loạn khi có gió lớn, cần thu gom vào thùng chứa kín.'
            }
          ];
          await Promise.all(sampleIssues.map(issue => addDoc(collection(db, COLLECTIONS.ATLD_ISSUES), issue)));
        }
      } catch (err) {
        console.error("Lỗi khởi tạo ATLĐ & VSMT:", err);
      }
    };
    seedAtld();

    return () => {
      unsubscribeBidding();
      unsubscribeLegal();
      unsubscribeSchedule();
      unsubscribeAcceptance();
      unsubscribeInvitations();
      unsubscribeDefectTabs();
      unsubscribeDefectLibrary();
      unsubscribeAtld();
    };
  }, [lazyEnabled]);

  // Đồng bộ userRole từ member document của người đang đăng nhập
  useEffect(() => {
    if (currentUser) {
      const userEmail = (currentUser.email || '').toLowerCase().trim();
      const member = members.find(m => (m.email || '').toLowerCase().trim() === userEmail);
      if (member && member.role) {
        setUserRole(member.role);
      } else if (userEmail === 'tungnm35@fpt.com') {
        setUserRole('Admin');
      }
    }
  }, [members, currentUser]);

  // toggleRole: CHỈ dùng trong môi trường development để test giao diện
  // Tự động bị xóa khỏi production build (import.meta.env.DEV = false khi build)
  const toggleRole = import.meta.env.DEV
    ? () => setUserRole(prev => prev === 'Admin' ? 'User' : 'Admin')
    : () => {}; // no-op trong production

  const addListItem = async (collectionName, dataOrName) => {
    // Kiểm tra trùng lặp
    const config = LIST_CONFIGS.find(c => c.collectionName === collectionName);
    if (!config) return;

    const name = typeof dataOrName === 'string' ? dataOrName : dataOrName.name;
    const currentList = globalLists[config.key];
    const exists = currentList.find(t => t.name.toLowerCase() === name.toLowerCase());
    if (name && !exists) {
      try {
        const payload = typeof dataOrName === 'string' ? { name } : dataOrName;
        await addDoc(collection(db, collectionName), payload);
      } catch (error) {
        console.error(`Lỗi khi thêm vào ${collectionName}: `, error);
      }
    }
  };

  const deleteListItem = async (collectionName, id) => {
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      console.error(`Lỗi khi xóa khỏi ${collectionName}: `, error);
    }
  };

  const editListItem = async (collectionName, id, newData) => {
    try {
      const payload = typeof newData === 'string' ? { name: newData } : newData;
      await updateDoc(doc(db, collectionName, id), payload);
    } catch (error) {
      console.error(`Lỗi khi sửa ${collectionName}: `, error);
    }
  };

  // Wrapper for backward compatibility with existing code
  const addDocumentType = (name) => addListItem('documentTypes', name);
  const deleteDocumentType = (id) => deleteListItem('documentTypes', id);
  const editDocumentType = (id, newName) => editListItem('documentTypes', id, newName);


  const addDocument = async (newDoc) => {
    try {
      const { id, ...docData } = newDoc;
      const ref = await addDoc(collection(db, COLLECTIONS.DOCUMENTS), docData);
      if (docData.documentType) addDocumentType(docData.documentType);
      if (docData.issuingAgency) await ensurePartnerExists(docData.issuingAgency);
      logAudit('add_document', { documentId: ref.id, documentNumber: docData.documentNumber });
    } catch (error) {
      console.error("Lỗi khi tải lên tài liệu: ", error);
      throw error;
    }
  };

  const editDocument = async (id, updatedDoc) => {
    try {
      const docRef = doc(db, 'documents', id);
      const { id: docId, ...docData } = updatedDoc;
      await updateDoc(docRef, docData);
      if (docData.documentType) addDocumentType(docData.documentType);
      if (docData.issuingAgency) await ensurePartnerExists(docData.issuingAgency);
      logAudit('edit_document', { documentId: id, documentNumber: docData.documentNumber });
    } catch (error) {
      console.error("Lỗi khi cập nhật tài liệu: ", error);
      throw error;
    }
  };

  // Xóa mềm: đánh dấu isDeleted = true, lưu ngày xóa, không xóa file Storage
  const deleteDocument = async (id) => {
    try {
      const target = documents.find(d => d.id === id);
      await updateDoc(doc(db, 'documents', id), {
        isDeleted:   true,
        deletedAt:   new Date().toISOString(),
        deletedBy:   currentUser?.email || 'unknown',
      });
      logAudit('delete_document', { documentId: id, documentNumber: target?.documentNumber });
    } catch (error) {
      console.error("Lỗi khi xóa tài liệu: ", error);
      throw error;
    }
  };

  // Xóa vĩnh viễn (chỉ Admin, sau 30 ngày): xóa Firestore + Storage files
  const permanentDeleteDocument = async (id) => {
    try {
      const target = documents.find(d => d.id === id);
      // Xóa từng file đính kèm trên Storage
      await Promise.all((target?.attachments || []).map(att => deleteStorageFile(att.url)));
      await deleteDoc(doc(db, 'documents', id));
      logAudit('permanent_delete', { documentId: id, documentNumber: target?.documentNumber });
    } catch (error) {
      console.error("Lỗi khi xóa vĩnh viễn: ", error);
      throw error;
    }
  };

  // Khôi phục tài liệu từ thùng rác
  const restoreDocument = async (id) => {
    try {
      const target = documents.find(d => d.id === id);
      await updateDoc(doc(db, 'documents', id), { isDeleted: false, deletedAt: null, deletedBy: null });
      logAudit('restore_document', { documentId: id, documentNumber: target?.documentNumber });
    } catch (error) {
      console.error("Lỗi khi khôi phục tài liệu: ", error);
      throw error;
    }
  };

  // ── Phê duyệt đăng tải tài liệu (Công khai tài liệu) ──
  const approveDocument = async (id) => {
    try {
      const userEmail = currentUser?.email || 'Admin';
      const member = members.find(m => (m.email || '').toLowerCase().trim() === userEmail.toLowerCase().trim());
      const userName = currentUser?.displayName || member?.name || userEmail;

      await updateDoc(doc(db, 'documents', id), {
        status: 'approved',
        approvalStatus: 'approved',
        approvedBy: userEmail,
        approvedByName: userName,
        approvedAt: new Date().toISOString()
      });
      logAudit('approve_document', { documentId: id, approvedBy: userEmail, approvedByName: userName });
    } catch (error) {
      console.error("Lỗi khi phê duyệt tài liệu: ", error);
      throw error;
    }
  };

  // ── Từ chối đăng tải tài liệu -> Xóa tài liệu khỏi hệ thống và thông báo ──
  const rejectDocument = async (id, reason = '', recipientEmail = '') => {
    try {
      const target = documents.find(d => d.id === id);
      const userEmail = currentUser?.email || 'Admin';
      const member = members.find(m => (m.email || '').toLowerCase().trim() === userEmail.toLowerCase().trim());
      const userName = currentUser?.displayName || member?.name || userEmail;
      const targetRecipient = target?.createdByEmail || recipientEmail;

      // 1. Lưu thông báo vào userNotifications trong Firestore
      if (targetRecipient) {
        try {
          await addDoc(collection(db, 'userNotifications'), {
            recipientEmail: targetRecipient.toLowerCase().trim(),
            senderEmail: userEmail,
            senderName: userName,
            type: 'document_rejected',
            title: `Tài liệu ${target?.documentNumber || target?.documentCode || 'văn bản'} bị từ chối phê duyệt`,
            documentNumber: target?.documentNumber || '',
            documentCode: target?.documentCode || '',
            documentSummary: target?.summary || '',
            reason: reason || 'Tài liệu không phù hợp',
            createdAt: serverTimestamp(),
            isRead: false
          });
        } catch (notifErr) {
          console.warn('[RejectDoc] Không thể lưu thông báo:', notifErr.message);
        }
      }

      // 2. Xóa tệp đính kèm trên Storage
      if (target?.attachments && target.attachments.length > 0) {
        await Promise.all((target.attachments || []).map(att => deleteStorageFile(att.url)));
      }

      // 3. Xóa document khỏi Firestore
      await deleteDoc(doc(db, 'documents', id));

      // 4. Ghi Audit Log
      logAudit('reject_document', {
        documentId: id,
        documentNumber: target?.documentNumber,
        documentCode: target?.documentCode,
        reason,
        uploaderEmail: targetRecipient,
        rejectedBy: userEmail
      });
    } catch (error) {
      console.error("Lỗi khi từ chối tài liệu: ", error);
      throw error;
    }
  };

  // ── Per-user read tracking (thay thế isNew toàn cục) ────────────────────────────────
  const markAsRead = async (docId) => {
    if (!currentUser?.uid) return;
    try {
      if (docId) {
        // Đánh dấu 1 tài liệu cụ thể
        const key = `${currentUser.uid}_${docId}`;
        await setDoc(doc(db, 'userReadStatus', key), {
          userId: currentUser.uid, documentId: docId, readAt: serverTimestamp()
        });
      } else {
        // Đánh dấu tất cả — batch write cho từng tài liệu chưa đọc
        const unread = documents.filter(d => !d.isDeleted && !readDocIds.has(d.id));
        if (unread.length === 0) return;
        const batch = writeBatch(db);
        unread.forEach(d => {
          const key = `${currentUser.uid}_${d.id}`;
          batch.set(doc(db, 'userReadStatus', key), {
            userId: currentUser.uid, documentId: d.id, readAt: serverTimestamp()
          });
        });
        await batch.commit();
        logAudit('mark_read_all', { count: unread.length });
      }
    } catch (error) {
      console.error("Lỗi khi đánh dấu đã đọc: ", error);
    }
  };

  const getNewCount = () => {
    return documents.filter(d => !d.isDeleted && !readDocIds.has(d.id)).length;
  };

  // isDocNew: kiểm tra 1 tài liệu có mới không với user hiện tại
  const isDocNew = (docId) => !readDocIds.has(docId);

  // logDownload: dùng khi user tải file
  const logDownload = (documentId, documentNumber, fileName) => {
    logAudit('download_file', { documentId, documentNumber, fileName });
  };

  const addProject = async (newProject) => {
    try {
      const { id, ...data } = newProject;
      await addDoc(collection(db, COLLECTIONS.PROJECTS), data);
    } catch (error) {
      console.error("Lỗi khi thêm dự án: ", error);
      throw error;
    }
  };

  const editProject = async (id, updatedProject) => {
    try {
      const { id: _, ...data } = updatedProject;
      await updateDoc(doc(db, 'projects', id), data);
    } catch (error) {
      console.error("Lỗi khi sửa dự án: ", error);
      throw error;
    }
  };

  const deleteProject = async (id) => {
    try {
      await deleteDoc(doc(db, 'projects', id));
    } catch (error) {
      console.error("Lỗi khi xóa dự án: ", error);
      throw error;
    }
  };

  const addMember = async (newMember) => {
    try {
      const { id, ...data } = newMember;
      await addDoc(collection(db, COLLECTIONS.MEMBERS), data);
    } catch (error) {
      console.error("Lỗi khi thêm thành viên: ", error);
      throw error;
    }
  };

  const editMember = async (id, updatedMember) => {
    try {
      const { id: _, ...data } = updatedMember;
      await updateDoc(doc(db, 'members', id), data);
    } catch (error) {
      console.error("Lỗi khi sửa thành viên: ", error);
      throw error;
    }
  };

  const deleteMember = async (id) => {
    try {
      await deleteDoc(doc(db, 'members', id));
    } catch (error) {
      console.error("Lỗi khi xóa thành viên: ", error);
      throw error;
    }
  };

  const addPartner = async (newPartner) => {
    try {
      const { id, ...data } = newPartner;
      await addDoc(collection(db, COLLECTIONS.PARTNERS), data);
    } catch (error) {
      console.error("Lỗi khi thêm đối tác: ", error);
      throw error;
    }
  };

  const editPartner = async (id, updatedPartner) => {
    try {
      const { id: _, ...data } = updatedPartner;
      await updateDoc(doc(db, 'partners', id), data);
    } catch (error) {
      console.error("Lỗi khi sửa đối tác: ", error);
      throw error;
    }
  };

  const deletePartner = async (id) => {
    try {
      await deleteDoc(doc(db, 'partners', id));
    } catch (error) {
      console.error("Lỗi khi xóa đối tác: ", error);
      throw error;
    }
  };

  // ── Dọn dẹp gom tất cả đối tác trùng lặp trong Firestore về 1 bản ghi duy nhất ──
  const cleanDuplicatePartners = async () => {
    try {
      const snap = await getDocs(collection(db, COLLECTIONS.PARTNERS));
      const seen = new Map();
      const duplicateDocIds = [];

      snap.docs.forEach(docSnap => {
        const data = docSnap.data();
        const normName = (data.name || data.shortName || '').trim().toLowerCase();
        if (!normName) return;

        // Điểm đánh giá mức độ đầy đủ thông tin của bản ghi
        const score = (data.logo ? 6 : 0) +
                      (data.taxCode ? 4 : 0) +
                      (data.phone ? 2 : 0) +
                      (data.email ? 2 : 0) +
                      (data.representative ? 2 : 0) +
                      (data.address ? 1 : 0) +
                      (data.rating ? 1 : 0);

        if (seen.has(normName)) {
          const existing = seen.get(normName);
          if (score > existing.score) {
            // Bản ghi hiện tại đầy đủ hơn bản ghi trước -> Xóa bản ghi trước, giữ bản ghi hiện tại
            duplicateDocIds.push(existing.id);
            seen.set(normName, { id: docSnap.id, score, data });
          } else {
            // Bản ghi trước đầy đủ hơn -> Xóa bản ghi hiện tại
            duplicateDocIds.push(docSnap.id);
          }
        } else {
          seen.set(normName, { id: docSnap.id, score, data });
        }
      });

      if (duplicateDocIds.length === 0) {
        return { count: 0, remaining: seen.size };
      }

      // Xóa theo batch 450 documents (giới hạn tối đa của Firestore writeBatch là 500)
      const BATCH_SIZE = 450;
      for (let i = 0; i < duplicateDocIds.length; i += BATCH_SIZE) {
        const chunk = duplicateDocIds.slice(i, i + BATCH_SIZE);
        const batch = writeBatch(db);
        chunk.forEach(id => {
          batch.delete(doc(db, COLLECTIONS.PARTNERS, id));
        });
        await batch.commit();
      }

      return { count: duplicateDocIds.length, remaining: seen.size };
    } catch (error) {
      console.error("Lỗi khi dọn dẹp đối tác trùng lặp: ", error);
      throw error;
    }
  };

  // ==== Bidding Packages ====
  const addBiddingPackage = async (projectId, pkgData) => {
    await addDoc(collection(db, COLLECTIONS.BIDDING_PACKAGES), { projectId, ...pkgData, createdAt: new Date().toISOString() });
  };
  const editBiddingPackage = async (projectId, pkgId, pkgData) => {
    const { id, ...data } = pkgData;
    const cleanedData = {};
    Object.entries(data).forEach(([k, v]) => { if (v !== undefined) cleanedData[k] = v; });
    await updateDoc(doc(db, 'biddingPackages', pkgId), { ...cleanedData, updatedAt: new Date().toISOString() });
  };
  const deleteBiddingPackage = async (projectId, pkgId) => {
    await deleteDoc(doc(db, 'biddingPackages', pkgId));
  };
  const reorderBiddingPackages = async (pkgs, projectCode) => {
    const batch = writeBatch(db);
    pkgs.forEach((pkg, index) => {
      const ref = doc(db, 'biddingPackages', pkg.id);
      const { id, ...data } = pkg;
      const computedCode = projectCode ? `${projectCode}.GT.${String(index + 1).padStart(2, '0')}` : data.code;
      const cleanedData = {};
      Object.entries({ ...data, order: index, code: computedCode, updatedAt: new Date().toISOString() })
        .forEach(([k, v]) => { if (v !== undefined) cleanedData[k] = v; });
      batch.update(ref, cleanedData);
    });
    await batch.commit();
  };

  // ==== Legal Steps ====
  const addLegalStep = async (projectId, stepData) => {
    await addDoc(collection(db, COLLECTIONS.LEGAL_STEPS), { projectId, ...stepData, createdAt: new Date().toISOString() });
  };
  const updateLegalStep = async (id, stepData) => {
    await updateDoc(doc(db, 'legalSteps', id), { ...stepData, updatedAt: new Date().toISOString() });
  };
  const deleteLegalStep = async (id) => {
    await deleteDoc(doc(db, 'legalSteps', id));
  };

  // ==== Schedule Steps ====
  const addScheduleStep = async (projectId, stepData) => {
    await addDoc(collection(db, COLLECTIONS.SCHEDULE_STEPS), { projectId, ...stepData, createdAt: new Date().toISOString() });
  };
  const updateScheduleStep = async (id, stepData) => {
    await updateDoc(doc(db, 'scheduleSteps', id), { ...stepData, updatedAt: new Date().toISOString() });
  };
  const deleteScheduleStep = async (id) => {
    await deleteDoc(doc(db, 'scheduleSteps', id));
  };

  // ==== Acceptance Steps ====
  const addAcceptanceStep = async (projectId, stepData) => {
    await addDoc(collection(db, COLLECTIONS.ACCEPTANCE_STEPS), { projectId, ...stepData, createdAt: new Date().toISOString() });
  };
  const updateAcceptanceStep = async (id, stepData) => {
    await updateDoc(doc(db, 'acceptanceSteps', id), { ...stepData, updatedAt: new Date().toISOString() });
  };
  const deleteAcceptanceStep = async (id) => {
    await deleteDoc(doc(db, 'acceptanceSteps', id));
  };

  // ==== Invitations ====

  /** Gửi lời mời — trả về invite link để Admin copy */
  const sendInvitation = async ({ email, name, role, level }) => {
    // Rate limit: tối đa 5 lời mời trong 60 giây
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentCount = invitations.filter(inv => {
      const createdAt = inv.createdAt?.toDate?.() || new Date(inv.createdAt || 0);
      return createdAt > oneMinuteAgo && inv.status === 'pending';
    }).length;
    if (recentCount >= 5) throw new Error('RATE_LIMITED');

    // Kiểm tra email đã được mời chưa
    const alreadyPending = invitations.find(
      inv => inv.email === email && inv.status === 'pending'
    );
    if (alreadyPending) throw new Error('ALREADY_INVITED');

    // Tạo token bảo mật
    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000); // 48 giờ

    // Lưu vào Firestore (chỉ lưu hash, KHÔNG lưu plainToken)
    await addDoc(collection(db, COLLECTIONS.INVITATIONS), {
      email,
      name,
      role,
      level: Number(level),
      tokenHash,          // hash SHA-256, không phải token gốc
      expiresAt,
      status: 'pending',
      createdBy: 'Admin',
      createdAt: new Date(),
      activatedAt: null,
    });

    // Trả về link để Admin copy
    return `${getAppUrl()}?invite=${plainToken}`;
  };

  /** Admin thu hồi lời mời */
  const revokeInvitation = async (id) => {
    await updateDoc(doc(db, 'invitations', id), {
      status: 'revoked',
      tokenHash: null, // Vô hiệu hóa hash
    });
  };

  /** Gửi lại lời mời (tạo token mới) */
  const resendInvitation = async (id) => {
    // Rate limit check
    const oneMinuteAgo = new Date(Date.now() - 60 * 1000);
    const recentCount = invitations.filter(inv => {
      const createdAt = inv.createdAt?.toDate?.() || new Date(inv.createdAt || 0);
      return createdAt > oneMinuteAgo && inv.status === 'pending';
    }).length;
    if (recentCount >= 5) throw new Error('RATE_LIMITED');

    const plainToken = generateToken();
    const tokenHash = await hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000);

    await updateDoc(doc(db, 'invitations', id), {
      tokenHash,
      expiresAt,
      status: 'pending',
      createdAt: new Date(),
      activatedAt: null,
    });

    // Lấy email/name từ invitations state để tạo link
    const inv = invitations.find(i => i.id === id);
    return `${getAppUrl()}?invite=${plainToken}`;
  };

  /**
   * Xác minh token từ URL — gọi từ InvitePage
   * Returns { valid, invitation, error }
   */
  const verifyInviteToken = async (plainToken) => {
    try {
      const tokenHash = await hashToken(plainToken);
      const q = query(collection(db, COLLECTIONS.INVITATIONS), where('tokenHash', '==', tokenHash));
      const snapshot = await getDocs(q);

      if (snapshot.empty) return { valid: false, error: 'Link mời không hợp lệ hoặc đã được sử dụng.' };

      const invDoc = snapshot.docs[0];
      const inv = { id: invDoc.id, ...invDoc.data() };

      if (inv.status === 'revoked') return { valid: false, error: 'Link mời đã bị thu hồi bởi Admin.' };
      if (inv.status === 'active')  return { valid: false, error: 'Tài khoản đã được kích hoạt từ link này rồi.' };
      if (inv.status !== 'pending') return { valid: false, error: 'Link mời không còn hiệu lực.' };

      const expiresAt = inv.expiresAt?.toDate?.() || new Date(inv.expiresAt);
      if (expiresAt < new Date()) {
        await updateDoc(doc(db, 'invitations', inv.id), { status: 'expired', tokenHash: null });
        return { valid: false, error: 'Link mời đã hết hạn (>48 giờ). Vui lòng yêu cầu Admin gửi lại.' };
      }

      return { valid: true, invitation: inv };
    } catch (err) {
      return { valid: false, error: 'Không thể xác minh link. Kiểm tra kết nối internet.' };
    }
  };

  /**
   * Kích hoạt tài khoản — đặt mật khẩu và tạo Firebase Auth user
   * Gọi sau khi verifyInviteToken thành công
   */
  const activateAccount = async (plainToken, password) => {
    // Xác minh lại token lần cuối
    const { valid, invitation, error } = await verifyInviteToken(plainToken);
    if (!valid) throw new Error(error);

    // Tạo Firebase Auth user
    const userCredential = await createUserWithEmailAndPassword(auth, invitation.email, password);
    await updateProfile(userCredential.user, { displayName: invitation.name });

    // Thêm vào members collection
    await addDoc(collection(db, COLLECTIONS.MEMBERS), {
      name: invitation.name,
      email: invitation.email,
      phone: '',
      role: invitation.role,
      level: invitation.level,
      avatar: `https://i.pravatar.cc/150?img=${Math.floor(Math.random() * 70) + 1}`,
      locked: false,
      createdAt: new Date(),
    });

    // Vô hiệu hóa token (single-use)
    await updateDoc(doc(db, 'invitations', invitation.id), {
      status: 'active',
      activatedAt: new Date(),
      tokenHash: null, // Xóa hash sau khi dùng
    });

    return userCredential.user;
  };

  // ==== Permission Helpers (Phải khai báo TRƯỚC filteredProjects & filteredDocuments để tránh TDZ) ====
  const checkPermission = useCallback((projectId, permissionKey) => {
    if (!currentUser) return false;

    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const currentMember = members.find(m => (m.email || '').toLowerCase().trim() === userEmail);

    const memberRole = currentMember?.role || userRole;
    if (memberRole === ROLES.ADMIN || memberRole === 'Admin') return true;

    // 1. Nếu có projectId, ưu tiên vai trò cụ thể được gán trong dự án đó
    if (projectId && currentMember) {
      const project = projects.find(p => p.id === projectId);
      if (project) {
        const projectMember = project.projectMembers?.find(
          pm => pm.memberId?.toString() === currentMember.id?.toString()
        );
        const pRole = projectMember?.role;
        if (pRole) {
          if (pRole === 'Admin' || pRole === 'Quản trị viên') return true;
          if (projectRoleMatrix[pRole] && projectRoleMatrix[pRole][permissionKey] !== undefined) {
            return !!projectRoleMatrix[pRole][permissionKey];
          }
        }
      }
    }

    // 2. Nếu không có vai trò riêng trong dự án, áp dụng vai trò chung của User từ Ma trận vai trò
    if (memberRole && projectRoleMatrix[memberRole] && projectRoleMatrix[memberRole][permissionKey] !== undefined) {
      return !!projectRoleMatrix[memberRole][permissionKey];
    }

    return false;
  }, [projects, members, currentUser, userRole, projectRoleMatrix]);

  const checkDocumentPermission = useCallback((docObj, actionKey) => {
    if (!currentUser) return false;

    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const currentMember = members.find(m => (m.email || '').toLowerCase().trim() === userEmail);

    const memberRole = currentMember?.role || userRole;
    if (memberRole === ROLES.ADMIN || memberRole === 'Admin') return true;

    if (!docObj) return false;

    if (!docObj.relatedProjects || docObj.relatedProjects.length === 0) {
      if (memberRole && projectRoleMatrix[memberRole]?.[actionKey] !== undefined) {
        return !!projectRoleMatrix[memberRole][actionKey];
      }
      return actionKey.startsWith('view_');
    }

    return docObj.relatedProjects.some(projName => {
      const proj = projects.find(p => isDocRelatedToProject({ relatedProjects: [projName] }, p));
      if (!proj) return checkPermission(null, actionKey);
      return checkPermission(proj.id, actionKey);
    });
  }, [projects, members, currentUser, userRole, checkPermission, projectRoleMatrix]);

  const canAddDocument = useCallback(() => {
    if (!currentUser) return false;

    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const currentMember = members.find(m => (m.email || '').toLowerCase().trim() === userEmail);

    const memberRole = currentMember?.role || userRole;
    if (memberRole === ROLES.ADMIN || memberRole === 'Admin') return true;

    if (memberRole && projectRoleMatrix[memberRole]?.add_docs) return true;

    return projects.some(p => checkPermission(p.id, 'add_docs'));
  }, [projects, members, currentUser, userRole, checkPermission, projectRoleMatrix]);

  const canViewDefects = useCallback(() => {
    if (!currentUser) return false;

    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const currentMember = members.find(m => (m.email || '').toLowerCase().trim() === userEmail);

    const memberRole = currentMember?.role || userRole;
    if (memberRole === ROLES.ADMIN || memberRole === 'Admin') return true;

    if (memberRole && projectRoleMatrix[memberRole]?.view_defects) return true;

    return projects.some(p => checkPermission(p.id, 'view_defects'));
  }, [projects, members, currentUser, userRole, checkPermission, projectRoleMatrix]);

  const canEditDefects = useCallback(() => {
    if (!currentUser) return false;

    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const currentMember = members.find(m => (m.email || '').toLowerCase().trim() === userEmail);

    const memberRole = currentMember?.role || userRole;
    if (memberRole === ROLES.ADMIN || memberRole === 'Admin') return true;

    if (memberRole && projectRoleMatrix[memberRole]?.edit_defects) return true;

    return projects.some(p => checkPermission(p.id, 'edit_defects'));
  }, [projects, members, currentUser, userRole, checkPermission, projectRoleMatrix]);

  const canApproveDocs = useCallback((projectId = null) => {
    if (!currentUser) return false;

    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const currentMember = members.find(m => (m.email || '').toLowerCase().trim() === userEmail);

    const memberRole = currentMember?.role || userRole;
    if (memberRole === ROLES.ADMIN || memberRole === 'Admin') return true;

    if (projectId) {
      return checkPermission(projectId, 'approve_docs');
    }

    if (memberRole && projectRoleMatrix[memberRole]?.approve_docs) return true;

    return projects.some(p => checkPermission(p.id, 'approve_docs'));
  }, [projects, members, currentUser, userRole, checkPermission, projectRoleMatrix]);

  // Lọc danh sách dự án dựa theo email của currentUser (Admins xem toàn bộ)
  const filteredProjects = useMemo(() => {
    if (!currentUser || !members.length) return [];
    const currentMember = members.find(m => m.email === currentUser.email);
    const isAdmin = currentMember?.role === ROLES.ADMIN || userRole === ROLES.ADMIN;
    if (isAdmin) return projects;

    return projects.filter(p => {
      if (!p.projectMembers) return false;
      return p.projectMembers.some(pm => pm.memberId?.toString() === currentMember?.id?.toString());
    });
  }, [projects, members, currentUser, userRole]);

  // Lọc danh sách tài liệu dựa theo dự án mà user là thành viên & trạng thái duyệt đăng tải
  const filteredDocuments = useMemo(() => {
    if (!currentUser || !members.length) return [];
    const userEmail = (currentUser.email || '').toLowerCase().trim();
    const currentMember = members.find(m => (m.email || '').toLowerCase().trim() === userEmail);
    const isAdmin = currentMember?.role === ROLES.ADMIN || userRole === ROLES.ADMIN;
    
    // Lấy danh sách dự án mà user là thành viên
    const myProjects = isAdmin
      ? projects
      : projects.filter(p => p.projectMembers?.some(pm => pm.memberId?.toString() === currentMember?.id?.toString()));

    const canApproveAny = isAdmin || (currentMember?.role && projectRoleMatrix[currentMember.role]?.approve_docs) || projects.some(p => checkPermission(p.id, 'approve_docs'));

    return documents.filter(doc => {
      // 1. Nếu tài liệu không liên quan đến dự án nào, bất kỳ ai cũng xem được
      const hasProjectAccess = isAdmin ||
        (!doc.relatedProjects || doc.relatedProjects.length === 0) ||
        myProjects.some(p => isDocRelatedToProject(doc, p));

      if (!hasProjectAccess) return false;

      // 2. Kiểm tra trạng thái phê duyệt:
      // - Đã duyệt (status === 'approved' hoặc không có status - legacy) -> Cho phép xem
      // - Chờ phê duyệt (status === 'pending_approval'): Chỉ hiển thị cho Admin, Người có quyền duyệt, hoặc Người tải lên
      const isPending = doc.status === 'pending_approval' || doc.approvalStatus === 'pending';
      if (!isPending) return true;

      const isMyUpload = (doc.createdByEmail && doc.createdByEmail.toLowerCase().trim() === userEmail) ||
                         (doc.uploader && currentMember?.name && doc.uploader.toLowerCase().trim() === currentMember.name.toLowerCase().trim());

      return canApproveAny || isMyUpload;
    });
  }, [documents, projects, members, currentUser, userRole, checkPermission, projectRoleMatrix]);

  const saveProjectRoleMatrix = async (matrix) => {
    try {
      await setDoc(doc(db, 'system_settings', 'project_role_matrix'), matrix);
    } catch (error) {
      console.error("Lỗi khi lưu ma trận vai trò: ", error);
      throw error;
    }
  };

  const addDefectTab = async (name) => {
    try {
      const docRef = await addDoc(collection(db, 'defectTabs'), { name: name.trim() });
      return docRef.id;
    } catch (error) {
      console.error("Lỗi thêm thẻ lỗi:", error);
      throw error;
    }
  };

  const editDefectTab = async (id, name) => {
    try {
      await updateDoc(doc(db, 'defectTabs', id), { name: name.trim() });
    } catch (error) {
      console.error("Lỗi sửa thẻ lỗi:", error);
      throw error;
    }
  };

  const deleteDefectTab = async (id) => {
    try {
      await deleteDoc(doc(db, 'defectTabs', id));
      // Delete all errors in this tab
      const q = query(collection(db, 'defectLibrary'), where('tabId', '==', id));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.forEach(d => {
        batch.delete(doc(db, 'defectLibrary', d.id));
      });
      await batch.commit();
    } catch (error) {
      console.error("Lỗi xóa thẻ lỗi:", error);
      throw error;
    }
  };

  const addDefectError = async (errData) => {
    try {
      const { id, ...data } = errData;
      const docRef = await addDoc(collection(db, 'defectLibrary'), data);
      return docRef.id;
    } catch (error) {
      console.error("Lỗi thêm lỗi:", error);
      throw error;
    }
  };

  const editDefectError = async (id, errData) => {
    try {
      const { id: _, ...data } = errData;
      await updateDoc(doc(db, 'defectLibrary', id), data);
    } catch (error) {
      console.error("Lỗi sửa lỗi:", error);
      throw error;
    }
  };

  const deleteDefectError = async (id) => {
    try {
      await deleteDoc(doc(db, 'defectLibrary', id));
    } catch (error) {
      console.error("Lỗi xóa lỗi:", error);
      throw error;
    }
  };

  // ==== ATLĐ & VSMT ====
  const addAtldIssue = async (issueData) => {
    try {
      const { id, ...data } = issueData;
      const docRef = await addDoc(collection(db, COLLECTIONS.ATLD_ISSUES), {
        ...data,
        createdAt: new Date().toISOString()
      });
      return docRef.id;
    } catch (error) {
      console.error("Lỗi thêm vấn đề ATLĐ:", error);
      throw error;
    }
  };

  const updateAtldIssue = async (id, issueData) => {
    try {
      const { id: _, ...data } = issueData;
      await updateDoc(doc(db, COLLECTIONS.ATLD_ISSUES, id), {
        ...data,
        updatedAt: new Date().toISOString()
      });
    } catch (error) {
      console.error("Lỗi cập nhật vấn đề ATLĐ:", error);
      throw error;
    }
  };

  const deleteAtldIssue = async (id) => {
    try {
      await deleteDoc(doc(db, COLLECTIONS.ATLD_ISSUES, id));
    } catch (error) {
      console.error("Lỗi xóa vấn đề ATLĐ:", error);
      throw error;
    }
  };

  return (
    <DocumentContext.Provider value={{
      documents: filteredDocuments,
      allDocuments: documents,
      addDocument, editDocument, deleteDocument, permanentDeleteDocument, restoreDocument,
      approveDocument, rejectDocument,
      markAsRead, getNewCount, isDocNew, logDownload,
      userRole,
      toggleRole,
      documentTypes: globalLists.documentTypes, addDocumentType, deleteDocumentType, editDocumentType,
      globalLists, addListItem, editListItem, deleteListItem,
      projects: filteredProjects,
      allProjects: projects,
      addProject, editProject, deleteProject,
      members, addMember, editMember, deleteMember,
      // Lazy collections (rỗng cho đến khi enableLazy() được gọi lần đầu)
      partners, addPartner, editPartner, deletePartner, cleanDuplicatePartners, uniqueAgencies,
      biddingPackages, addBiddingPackage, editBiddingPackage, deleteBiddingPackage, reorderBiddingPackages,
      legalSteps, addLegalStep, updateLegalStep, deleteLegalStep,
      scheduleSteps, addScheduleStep, updateScheduleStep, deleteScheduleStep,
      acceptanceSteps, addAcceptanceStep, updateAcceptanceStep, deleteAcceptanceStep,
      atldIssues, addAtldIssue, updateAtldIssue, deleteAtldIssue,
      invitations, sendInvitation, revokeInvitation, resendInvitation, verifyInviteToken, activateAccount,
      enableLazy, // Gọi từ mỗi trang cần lazy data để kích hoạt subscriptions
      // Matrix & Defect Library
      projectRoleMatrix, saveProjectRoleMatrix,
      defectTabs, addDefectTab, editDefectTab, deleteDefectTab,
      defectLibrary, addDefectError, editDefectError, deleteDefectError,
      userNotifications,
      markNotificationAsRead,
      markAllNotificationsAsRead,
      deleteNotification,
      checkPermission, checkDocumentPermission, canAddDocument, canViewDefects, canEditDefects, canApproveDocs,
    }}>
      {children}
    </DocumentContext.Provider>
  );
};

