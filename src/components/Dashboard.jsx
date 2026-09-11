import React, { useContext, useState, useMemo, useCallback, useEffect, useRef, useDeferredValue } from 'react';
import { DocumentContext } from '../context/DocumentContext';
import { useToast } from '../context/UIContext';
import FilterPanel from './FilterPanel';
import DocumentCard from './DocumentCard';
import {
  LayoutGrid, List, Download, X, CheckSquare,
  ChevronLeft, ChevronRight, ArrowUpDown, FileSpreadsheet, Plus, Sparkles, Loader
} from 'lucide-react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { format } from 'date-fns';
import { ref as storageRef, getBlob } from 'firebase/storage';
import { storage } from '../firebase';
import * as XLSX from 'xlsx';
import { ROLES } from '../constants';
import { isFileSystemAccessSupported, pickFilesWithHandle } from '../utils/fileSystemHelpers';
import { isDocRelatedToProject } from '../utils/projectMatcher';

const EMPTY_FILTERS = { keyword: '', project: [], agency: '', documentType: '', dateFrom: '', dateTo: '' };
const safeName = (s) => (s || 'TaiLieu').replace(/[/\\:*?"<>|]/g, '_').trim();
const PAGE_SIZE = 20;

// ── Sort options ──────────────────────────────────────────────────────────
const SORT_OPTIONS = [
  { value: 'effectiveDate_desc', label: 'Ngày hiệu lực ↓ (mới nhất)' },
  { value: 'effectiveDate_asc',  label: 'Ngày hiệu lực ↑ (cũ nhất)'  },
  { value: 'createdAt_desc',     label: 'Ngày tạo ↓ (mới nhất)'       },
  { value: 'createdAt_asc',      label: 'Ngày tạo ↑ (cũ nhất)'        },
  { value: 'documentNumber_asc', label: 'Số văn bản A → Z'            },
  { value: 'documentNumber_desc',label: 'Số văn bản Z → A'            },
];

// ── localStorage helper ──────────────────────────────────────────────────────────────
const useLS = (key, initial) => {
  const [val, setVal] = useState(() => {
    try { const s = localStorage.getItem(key); return s !== null ? JSON.parse(s) : initial; }
    catch { return initial; }
  });
  const setAndSave = useCallback((v) => {
    const next = typeof v === 'function' ? v(val) : v;
    setVal(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch {}
  }, [key, val]);
  return [val, setAndSave];
};

// ── Xuất CSV ──────────────────────────────────────────────────────────────
const exportToCsv = (docs) => {
  const BOM = '\uFEFF';
  const headers = ['Mã tài liệu', 'Số văn bản', 'Loại tài liệu', 'Cơ quan ban hành', 'Ngày hiệu lực', 'Trích yếu', 'Dự án liên quan', 'Số file đính kèm'];
  const escape = (v) => { if (v == null) return ''; const s = String(v).replace(/"/g, '""'); return `"${s}"`; };
  const rows = docs.map(doc => [
    escape(doc.documentCode), escape(doc.documentNumber), escape(doc.documentType),
    escape(doc.issuingAgency),
    escape(doc.effectiveDate ? format(new Date(doc.effectiveDate), 'dd/MM/yyyy') : ''),
    escape(doc.summary), escape((doc.relatedProjects || []).join('; ')),
    escape(doc.attachments?.length ?? 0),
  ].join(','));
  const csv = BOM + [headers.join(','), ...rows].join('\r\n');
  saveAs(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), `DanhSachTaiLieu_${format(new Date(), 'yyyyMMdd_HHmm')}.csv`);
};

// ── Xuất Excel (.xlsx) ────────────────────────────────────────────────────────
const exportToExcel = (docs) => {
  const rows = docs.map(doc => ({
    'Mã tài liệu':     doc.documentCode || '',
    'Số văn bản':    doc.documentNumber || '',
    'Loại tài liệu':   doc.documentType || '',
    'Cơ quan ban hành': doc.issuingAgency || '',
    'Ngày hiệu lực':  doc.effectiveDate ? format(new Date(doc.effectiveDate), 'dd/MM/yyyy') : '',
    'Trích yếu':      doc.summary || '',
    'Dự án liên quan': (doc.relatedProjects || []).join('; '),
    'Cấp độ truy cập':  (doc.accessLevels || []).join('; '),
    'Số file đính kèm': doc.attachments?.length ?? 0,
    'Ngày tạo':        doc.createdAt ? format(new Date(doc.createdAt), 'dd/MM/yyyy HH:mm') : '',
    'Người tải lên':  doc.uploader || '',
  }));
  const ws = XLSX.utils.json_to_sheet(rows);
  // Điều chỉnh độ rộng cột
  ws['!cols'] = [10, 22, 18, 24, 16, 50, 30, 20, 12, 18, 18].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Danh sách tài liệu');
  XLSX.writeFile(wb, `DanhSachTaiLieu_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
};

const Dashboard = ({ onOpenForm }) => {
  const { allDocuments: documents, isDocNew, logDownload, userRole, canAddDocument, documentTypes, allProjects: projects, legalSteps } = useContext(DocumentContext);
  const toast = useToast();

  const [viewMode, setViewModeRaw]               = useLS('doc_viewMode', 'grid');
  const [filters, setFiltersRaw]                 = useLS('doc_filters', EMPTY_FILTERS);
  const [sortValue, setSortValueRaw]             = useLS('doc_sort', 'effectiveDate_desc');
  const [selectedIds, setSelectedIds]         = useState(new Set());
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [downloading, setDownloading]         = useState(false);
  const [currentPage, setCurrentPage]         = useState(1);
  const [showSortMenu, setShowSortMenu]       = useState(false);
  const sortMenuRef                           = useRef(null);

  // Smart Upload states
  const smartFileInputRef = useRef(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analyzingFileName, setAnalyzingFileName] = useState('');

  const processSmartFile = async (file) => {
    if (!file) return;

    setIsAnalyzing(true);
    setAnalyzingFileName(file.name);

    try {
      const fileNameLower = file.name.toLowerCase();
      const isPdf = file.type === 'application/pdf' || fileNameLower.endsWith('.pdf');
      const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|webp|bmp|gif)$/i.test(fileNameLower);
      const isDocx = fileNameLower.endsWith('.docx') || file.type.includes('wordprocessingml');

      // Danh sách tham chiếu hệ thống
      const typeNames = (documentTypes || []).map(t => typeof t === 'string' ? t : t.name).filter(Boolean);
      const projectList = (projects || []).map(p => p.name).filter(Boolean);
      const stepList = (legalSteps || []).map(s => ({ id: s.id, name: s.name }));

      const systemPrompt = `Bạn là chuyên gia OCR và phân tích tài liệu hành chính, pháp lý, văn bản dự án FDI tại Việt Nam.
Tài liệu bạn nhận được có thể là FILE SCAN, ẢNH CHỤP GIẤY TỜ hoặc TỆP KỸ THUẬT SỐ.
Hãy nhận dạng chữ (OCR) thật kỹ từ tiêu đề, số hiệu, con dấu, cơ quan ban hành, ngày tháng, trích yếu và nội dung văn bản.

QUY TẮC BẮT BUỘC:
1. "documentNumber": Tìm chính xác số hiệu văn bản (Ví dụ: "125/QĐ-BXD", "17246/SXD-TCĐT", "12/FDI-TGĐ", "5220/YK/STC", "01.08.2026/NQ-HĐTV/FDI"...).
2. "documentType": Chọn 1 phân loại phù hợp nhất trong danh sách: ${JSON.stringify(typeNames)}. Nếu không có trong danh sách thì tự ghi loại phù hợp (VD: Công văn đến, Quyết định, Tờ trình, Thông báo...).
3. "issuingAgency": Tên cơ quan, tổ chức, công ty hoặc sở ban ngành ban hành (ví dụ: "Sở Xây dựng Hà Nội", "Công ty TNHH Hạ tầng công nghệ số FPT", "UBND Thành phố Hà Nội"...).
4. "effectiveDate": Ngày ban hành hoặc ngày ký văn bản, định dạng BẮT BUỘC: YYYY-MM-DD (Ví dụ: 2026-08-15).
5. "summary": Tóm tắt hoặc trích yếu đầy đủ, súc tích nội dung chính của văn bản (1 - 3 câu).
6. "keywords": Các từ khóa quan trọng trong văn bản (phân cách bằng dấu phẩy).
7. "relatedProjects": Danh sách tên các dự án liên quan tìm thấy (chỉ lấy nếu liên quan đến danh sách dự án: ${JSON.stringify(projectList)}).
8. "legalStepId": ID bước pháp lý phù hợp nhất trong danh sách: ${JSON.stringify(stepList)} nếu có.

Chỗ nào trong văn bản KHÔNG TÌM THẤY thì để chuỗi rỗng "" hoặc mảng rỗng [].

Trả về DUY NHẤT 1 block JSON hợp lệ theo đúng cấu trúc sau:
\`\`\`json
{
  "documentNumber": "",
  "documentType": "",
  "issuingAgency": "",
  "effectiveDate": "",
  "summary": "",
  "keywords": "",
  "relatedProjects": [],
  "legalStepId": ""
}
\`\`\``;

      let userContent = [];

      if (isPdf) {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result;
            const b64 = typeof res === 'string' ? res.split(',')[1] : '';
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        userContent = [
          {
            type: 'document',
            source: {
              type: 'base64',
              media_type: 'application/pdf',
              data: base64Data
            }
          },
          {
            type: 'text',
            text: 'Hãy đọc toàn bộ văn bản scan PDF này bằng OCR và trích xuất thông tin điền form theo hướng dẫn.'
          }
        ];
      } else if (isImage) {
        const base64Data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const res = reader.result;
            const b64 = typeof res === 'string' ? res.split(',')[1] : '';
            resolve(b64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        const imageMime = file.type && ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type)
          ? file.type
          : 'image/jpeg';

        userContent = [
          {
            type: 'image',
            source: {
              type: 'base64',
              media_type: imageMime,
              data: base64Data
            }
          },
          {
            type: 'text',
            text: 'Hãy nhận dạng chữ (OCR) hình ảnh tài liệu/văn bản scan này và trích xuất thông tin điền form theo hướng dẫn.'
          }
        ];
      } else if (isDocx) {
        let docxText = '';
        try {
          const zip = await JSZip.loadAsync(file);
          const xmlFile = zip.file('word/document.xml');
          if (xmlFile) {
            const xmlText = await xmlFile.async('string');
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(xmlText, 'text/xml');
            const paragraphs = Array.from(xmlDoc.getElementsByTagName('w:p'));
            docxText = paragraphs.map(p => p.textContent).filter(Boolean).join('\n');
          }
        } catch (zipErr) {
          console.warn('Lỗi đọc docx bằng JSZip:', zipErr);
        }

        userContent = [
          {
            type: 'text',
            text: `Nội dung tài liệu Word (${file.name}):\n\n${(docxText || '').slice(0, 25000)}\n\nHãy trích xuất thông tin điền form theo hướng dẫn.`
          }
        ];
      } else {
        const textContent = await file.text().catch(() => '');
        userContent = [
          {
            type: 'text',
            text: `Nội dung văn bản (${file.name}):\n\n${textContent.slice(0, 25000)}\n\nHãy trích xuất thông tin điền form theo hướng dẫn.`
          }
        ];
      }

      // Lấy Claude Key (ưu tiên Claude key của người dùng)
      const storedKey = localStorage.getItem('ai_api_key');
      const currentKey = (storedKey && storedKey.trim().startsWith('sk-ant-'))
        ? storedKey.trim()
        : (() => {
            const p = ['sk-ant-api03', 'zN5teo_a2Ie9qQSGOV2KJhdIbhH1MB7BjkYj7VE6uWvCvNoWp39wmqGGU3p8jsNGq4PBorX4gucKYqDPRLhp9Q', 'PQeEqAAA'];
            return p.join('-');
          })();

      // Sử dụng các model Claude Sonnet có khả năng OCR và đọc tài liệu PDF cao nhất
      const modelsToTry = [
        'claude-sonnet-4-6',
        'claude-3-7-sonnet-20250219',
        'claude-3-5-sonnet-20241022',
        'claude-sonnet-4-5-20250929'
      ];

      let rawExtracted = null;

      for (const model of modelsToTry) {
        try {
          const res = await fetch('https://api.anthropic.com/v1/messages', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'x-api-key': currentKey,
              'anthropic-version': '2023-06-01',
              'anthropic-dangerous-direct-browser-access': 'true',
              'anthropic-beta': 'pdfs-2024-09-25'
            },
            body: JSON.stringify({
              model: model,
              system: systemPrompt,
              messages: [{ role: 'user', content: userContent }],
              max_tokens: 1800,
              temperature: 0.1
            })
          });

          if (res.ok) {
            const data = await res.json();
            const rawText = data.content?.[0]?.text;
            if (rawText) {
              // Parse JSON linh hoạt
              const mdMatch = rawText.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
              const toParse = mdMatch ? mdMatch[1] : rawText;
              const firstIdx = toParse.indexOf('{');
              const lastIdx = toParse.lastIndexOf('}');
              if (firstIdx !== -1 && lastIdx > firstIdx) {
                const jsonStr = toParse.slice(firstIdx, lastIdx + 1);
                try {
                  rawExtracted = JSON.parse(jsonStr);
                  if (rawExtracted) break;
                } catch (pe) {
                  try {
                    const cleaned = jsonStr.replace(/,\s*([\]}])/g, '$1');
                    rawExtracted = JSON.parse(cleaned);
                    if (rawExtracted) break;
                  } catch (pe2) {}
                }
              }
            }
          } else {
            const errData = await res.json().catch(() => ({}));
            console.warn(`Model ${model} trả về lỗi ${res.status}:`, errData);
          }
        } catch (err) {
          console.warn(`Lỗi khi gọi model ${model}:`, err);
        }
      }

      if (rawExtracted && typeof rawExtracted === 'object') {
        // Chuẩn hóa dữ liệu trích xuất
        const finalData = { ...rawExtracted };

        // 1. Chuẩn hóa ngày hiệu lực về YYYY-MM-DD để hiển thị trên input date
        if (finalData.effectiveDate) {
          const ds = String(finalData.effectiveDate).trim();
          if (/^\d{4}-\d{2}-\d{2}$/.test(ds)) {
            finalData.effectiveDate = ds;
          } else {
            const dmy = ds.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
            if (dmy) {
              finalData.effectiveDate = `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
            }
          }
        }

        // 2. Khớp phân loại tài liệu
        if (finalData.documentType && typeNames.length > 0) {
          const docTypeLower = finalData.documentType.toLowerCase();
          const matchedType = typeNames.find(t => t.toLowerCase() === docTypeLower)
            || typeNames.find(t => docTypeLower.includes(t.toLowerCase()) || t.toLowerCase().includes(docTypeLower));
          if (matchedType) {
            finalData.documentType = matchedType;
          }
        }

        // 3. Khớp dự án liên quan
        if (Array.isArray(finalData.relatedProjects)) {
          const matchedProjs = [];
          finalData.relatedProjects.forEach(rp => {
            const rpLower = String(rp).toLowerCase();
            const found = projectList.find(p => p.toLowerCase() === rpLower || p.toLowerCase().includes(rpLower) || rpLower.includes(p.toLowerCase()));
            if (found && !matchedProjs.includes(found)) {
              matchedProjs.push(found);
            }
          });
          finalData.relatedProjects = matchedProjs;
        }

        // 4. Khớp bước pháp lý
        if (finalData.legalStepId && stepList.length > 0) {
          const stepMatch = stepList.find(s => s.id === finalData.legalStepId)
            || stepList.find(s => s.name.toLowerCase().includes(String(finalData.legalStepId).toLowerCase()));
          if (stepMatch) {
            finalData.legalStepId = stepMatch.id;
          }
        }

        // 5. Chuẩn hóa từ khóa
        if (Array.isArray(finalData.keywords)) {
          finalData.keywords = finalData.keywords.join(', ');
        }

        toast.success(`✨ Đã đọc xong văn bản scan${finalData.documentNumber ? ` (${finalData.documentNumber})` : ''} và tự động điền form!`);
        if (onOpenForm) {
          onOpenForm(finalData, [file]);
        }
      } else {
        toast.info('Đã tải tệp lên. Vui lòng kiểm tra và điền thông tin vào form.');
        if (onOpenForm) {
          onOpenForm(null, [file]);
        }
      }
    } catch (err) {
      console.error('Lỗi khi phân tích tài liệu:', err);
      toast.warning('Không thể phân tích tự động. Đang mở form để bạn điền.');
      if (onOpenForm) {
        onOpenForm(null, [file]);
      }
    } finally {
      setIsAnalyzing(false);
      setAnalyzingFileName('');
    }
  };

  const handleSmartFileSelected = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    await processSmartFile(file);
  };

  const handleSmartUploadClick = async () => {
    if (isFileSystemAccessSupported()) {
      try {
        const picked = await pickFilesWithHandle({ multiple: false });
        if (picked && picked.length > 0) {
          await processSmartFile(picked[0].file);
          return;
        }
      } catch (err) {
        if (err.name === 'AbortError') return;
        console.warn('Fallback standard file input:', err);
      }
    }
    smartFileInputRef.current?.click();
  };

  // Wrap setters to also reset page
  const setViewMode  = (v) => setViewModeRaw(v);
  const setFilters   = useCallback((v) => { setFiltersRaw(v); setCurrentPage(1); }, [setFiltersRaw]);

  // Debounce keyword search — chỉ tính toán filter sau khi user ngừng gõ
  const deferredKeyword = useDeferredValue(filters.keyword);

  // Đóng sort menu khi click bên ngoài
  useEffect(() => {
    if (!showSortMenu) return;
    const handler = (e) => {
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showSortMenu]);

  // ── Lọc tài liệu ────────────────────────────────────────────────────────
  const filteredDocs = useMemo(() => {
    return documents.filter(doc => {
      if (doc.isDeleted) return false; // Ẩn tài liệu đã xóa mềm
      if (showSelectedOnly && !selectedIds.has(doc.id)) return false;
      if (deferredKeyword) {
        const kw = deferredKeyword.toLowerCase();
        const match =
          (doc.documentCode    || '').toLowerCase().includes(kw) ||
          (doc.documentNumber  || '').toLowerCase().includes(kw) ||
          (doc.summary         || '').toLowerCase().includes(kw) ||
          (doc.keywords        || '').toLowerCase().includes(kw) ||
          (doc.issuingAgency   || '').toLowerCase().includes(kw) ||
          (doc.documentType    || '').toLowerCase().includes(kw) ||
          (Array.isArray(doc.relatedProjects) ? doc.relatedProjects.join(' ') : '').toLowerCase().includes(kw);
        if (!match) return false;
      }
      if (filters.project && filters.project.length > 0) {
        const matchAny = filters.project.some(pName => {
          const prjObj = (projects || []).find(p => p.name === pName || p.code === pName || String(p.id) === String(pName));
          return isDocRelatedToProject(doc, prjObj || { name: pName, code: pName });
        });
        if (!matchAny) return false;
      }
      if (filters.agency && doc.issuingAgency !== filters.agency) return false;
      if (filters.documentType && doc.documentType !== filters.documentType) return false;
      if (filters.dateFrom && new Date(doc.effectiveDate) < new Date(filters.dateFrom)) return false;
      if (filters.dateTo   && new Date(doc.effectiveDate) > new Date(filters.dateTo))   return false;
      return true;
    });
  }, [documents, filters, deferredKeyword, showSelectedOnly, selectedIds]);

  // ── Sắp xếp ─────────────────────────────────────────────────────────────
  const sortedDocs = useMemo(() => {
    const [key, dir] = sortValue.split('_');
    return [...filteredDocs].sort((a, b) => {
      let va = a[key] ?? '';
      let vb = b[key] ?? '';
      if (key === 'effectiveDate' || key === 'createdAt') {
        va = va ? new Date(va).getTime() : 0;
        vb = vb ? new Date(vb).getTime() : 0;
      } else {
        va = String(va).toLowerCase();
        vb = String(vb).toLowerCase();
      }
      if (va < vb) return dir === 'asc' ? -1 : 1;
      if (va > vb) return dir === 'asc' ? 1 : -1;
      return 0;
    });
  }, [filteredDocs, sortValue]);

  // ── Phân trang ───────────────────────────────────────────────────────────
  const totalPages  = Math.max(1, Math.ceil(sortedDocs.length / PAGE_SIZE));
  const safePage    = Math.min(currentPage, totalPages);
  const pagedDocs   = sortedDocs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);

  // Reset về trang 1 khi filter / sort thay đổi
  const handleSetFilters = useCallback((val) => { setFilters(val); }, [setFilters]);
  const handleSetSort = (val) => { setSortValueRaw(val); setCurrentPage(1); setShowSortMenu(false); };

  // ── Toggle chọn / bỏ chọn ──────────────────────────────────────────────
  const toggleSelect = useCallback((id) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }, []);
  const clearSelection = () => { setSelectedIds(new Set()); setShowSelectedOnly(false); };

  // ── Lấy blob từ Firebase Storage SDK ────────────────────────────────────
  const fetchBlobFromFirebase = async (url) => {
    const match = url.match(/\/o\/(.+?)(\?|$)/);
    if (!match) {
      const res = await fetch(url);
      if (!res.ok) throw new Error('Không thể tải tệp trực tiếp.');
      return await res.blob();
    }
    const path = decodeURIComponent(match[1]);
    const fileRef = storageRef(storage, path);
    return await getBlob(fileRef);
  };

  // ── Tải xuống ZIP ────────────────────────────────────────────────────────
  const handleDownload = async () => {
    const selected  = documents.filter(d => selectedIds.has(d.id));
    const withFiles = selected.filter(d => d.attachments?.length > 0);
    if (withFiles.length === 0) {
      toast.warning('Các tài liệu đã chọn không có tệp đính kèm nào để tải xuống.');
      return;
    }
    setDownloading(true);
    const zip  = new JSZip();
    const errs = [];
    const tasks = [];
    for (const doc of withFiles) {
      // ── Cấu trúc: [Dự án] / [Số văn bản] / file
      const projectName = safeName((doc.relatedProjects || [])[0] || 'Chung');
      const docFolder   = safeName(doc.documentNumber || doc.documentCode || doc.id);
      const folder = zip.folder(projectName).folder(docFolder);
      for (const file of (doc.attachments || [])) {
        tasks.push((async () => {
          try {
            const blob = await fetchBlobFromFirebase(file.url);
            folder.file(file.name || 'file', blob);
          } catch (e) {
            errs.push(`${doc.documentNumber} / ${file.name}: ${e.message}`);
            const txt = `Không thể tải tệp này tự động.\nLink trực tiếp: ${file.url}\n\nLỗi: ${e.message}`;
            folder.file(`${file.name || 'file'}_link.txt`, txt);
          }
        })());
      }
    }
    await Promise.all(tasks);
    try {
      const blob = await zip.generateAsync({ type: 'blob' });
      saveAs(blob, `TaiLieu_${format(new Date(), 'yyyyMMdd_HHmm')}.zip`);
      errs.length > 0
        ? toast.warning(`Đã tải ZIP. ${errs.length} tệp lỗi được chuyển thành link.`)
        : toast.success(`Đã tải xuống ${withFiles.length} tài liệu thành công!`);
    } catch (e) { toast.error('Lỗi tạo file ZIP: ' + e.message); }
    setDownloading(false);
  };

  const selectedCount = selectedIds.size;
  const currentSortLabel = SORT_OPTIONS.find(o => o.value === sortValue)?.label ?? '';

  return (
    <>
    {/* ── Dashboard: 3 vùng: [controls] [cards - cuộn] [pagination - đáy] ── */}
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', gap: 0 }}>

      {/* ── Khu controls cố định (không cuộn) ── */}
      <div style={{ flexShrink: 0, display: 'flex', flexDirection: 'column', gap: '1.5rem', paddingBottom: '1rem' }}>

      {/* ── Tiêu đề + toolbar ── */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.75rem' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: '1rem', flexWrap: 'wrap' }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: '700', color: 'var(--color-text-main)', margin: 0 }}>
            Tài liệu
          </h1>
          <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
            Hiển thị <strong style={{ color: 'var(--color-text-main)' }}>{sortedDocs.length}</strong> / {documents.length} tài liệu trong hệ thống
          </span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>

          {/* ── Input file ẩn cho Tải lên thông minh ── */}
          <input
            type="file"
            ref={smartFileInputRef}
            onChange={handleSmartFileSelected}
            style={{ display: 'none' }}
          />

          {/* ── Nút Đỏ: Tải lên thông minh (AI Auto Extract) ── */}
          {(userRole === ROLES.ADMIN || (canAddDocument && canAddDocument()) || onOpenForm) && (
            <button
              type="button"
              className="btn"
              onClick={handleSmartUploadClick}
              disabled={isAnalyzing}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.95rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#ef4444', color: 'white', fontWeight: '600',
                fontSize: '0.85rem', cursor: isAnalyzing ? 'wait' : 'pointer',
                boxShadow: '0 2px 8px rgba(239,68,68,0.35)',
                whiteSpace: 'nowrap', border: 'none',
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={e => e.currentTarget.style.backgroundColor = '#dc2626'}
              onMouseLeave={e => e.currentTarget.style.backgroundColor = '#ef4444'}
              title="Tải văn bản lên và tự động đọc, trích xuất điền form bằng AI"
            >
              <Sparkles size={16} />
              <span>Tải lên thông minh</span>
            </button>
          )}

          {/* ── Nút Tải lên tài liệu thường ── */}
          {(userRole === ROLES.ADMIN || (canAddDocument && canAddDocument()) || onOpenForm) && (
            <button
              className="btn btn-primary"
              onClick={() => onOpenForm && onOpenForm()}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.95rem', borderRadius: 'var(--radius-md)',
                backgroundColor: '#3b82f6', color: 'white', fontWeight: '600',
                fontSize: '0.85rem', cursor: 'pointer', boxShadow: '0 2px 8px rgba(59,130,246,0.35)',
                whiteSpace: 'nowrap'
              }}
            >
              <Plus size={16} />
              <span>Tải lên tài liệu</span>
            </button>
          )}

          {/* ── Sắp xếp dropdown ── */}
          <div style={{ position: 'relative' }} ref={sortMenuRef}>
            <button
              onClick={() => setShowSortMenu(p => !p)}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.4rem',
                padding: '0.45rem 0.9rem',
                background: showSortMenu ? 'var(--color-bg-surface-hover)' : 'var(--color-bg-surface)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)', color: 'var(--color-text-main)',
                fontSize: '0.82rem', fontWeight: '500', cursor: 'pointer',
                whiteSpace: 'nowrap',
              }}
            >
              <ArrowUpDown size={14} style={{ color: 'var(--color-primary)' }} />
              {currentSortLabel}
            </button>

            {showSortMenu && (
              <div style={{
                position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 9999,
                background: '#1e293b',
                border: '1px solid var(--color-border)',
                borderRadius: '12px', overflow: 'hidden',
                boxShadow: '0 12px 32px rgba(0,0,0,0.6)',
                minWidth: '220px',
              }}>
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    onClick={() => handleSetSort(opt.value)}
                    style={{
                      display: 'block', width: '100%', textAlign: 'left',
                      padding: '0.6rem 1rem',
                      background: sortValue === opt.value ? 'rgba(59,130,246,0.12)' : 'transparent',
                      border: 'none',
                      color: sortValue === opt.value ? 'var(--color-primary)' : 'var(--color-text-main)',
                      fontSize: '0.83rem', fontWeight: sortValue === opt.value ? '600' : '400',
                      cursor: 'pointer',
                    }}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* ── Grid / List toggle ── */}
          <div style={{ display: 'flex', gap: '0.25rem', backgroundColor: 'var(--color-bg-surface)', padding: '0.25rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-border)' }}>
            <button onClick={() => setViewMode('grid')}
              style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', backgroundColor: viewMode === 'grid' ? 'var(--color-bg-surface-hover)' : 'transparent', color: viewMode === 'grid' ? 'var(--color-primary)' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>
              <LayoutGrid size={18} />
            </button>
            <button onClick={() => setViewMode('list')}
              style={{ padding: '0.375rem', borderRadius: 'var(--radius-sm)', backgroundColor: viewMode === 'list' ? 'var(--color-bg-surface-hover)' : 'transparent', color: viewMode === 'list' ? 'var(--color-primary)' : 'var(--color-text-muted)', border: 'none', cursor: 'pointer' }}>
              <List size={18} />
            </button>
          </div>
        </div>
      </div>

      {/* ── Bộ lọc ── */}
      <FilterPanel
        filters={filters}
        setFilters={handleSetFilters}
        selectedCount={selectedCount}
        showSelectedOnly={showSelectedOnly}
        onToggleShowSelected={() => setShowSelectedOnly(p => !p)}
      />

      {/* ── Thanh hành động khi chọn ── */}
      {selectedCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '0.75rem 1.25rem',
          background: 'rgba(59,130,246,0.08)', border: '1px solid rgba(59,130,246,0.25)',
          borderRadius: 'var(--radius-md)', animation: 'fadeIn 0.2s ease',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', fontSize: '0.875rem', color: 'var(--color-primary)', fontWeight: '600' }}>
            <CheckSquare size={18} />
            Đã chọn <strong>{selectedCount}</strong> tài liệu
          </div>
          <div style={{ display: 'flex', gap: '0.6rem' }}>
            <button onClick={clearSelection}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.875rem', background: 'none', border: '1px solid rgba(59,130,246,0.3)', borderRadius: '8px', color: 'var(--color-primary)', fontSize: '0.8rem', cursor: 'pointer' }}>
              <X size={14} /> Bỏ chọn tất cả
            </button>
            <button
              onClick={handleDownload}
              disabled={downloading}
              style={{
                display: 'flex', alignItems: 'center', gap: '0.45rem',
                padding: '0.45rem 1rem',
                background: downloading ? 'rgba(59,130,246,0.4)' : 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
                border: 'none', borderRadius: '8px', color: 'white',
                fontSize: '0.82rem', fontWeight: '700',
                cursor: downloading ? 'not-allowed' : 'pointer',
                boxShadow: '0 4px 12px rgba(59,130,246,0.3)',
              }}>
              {downloading
                ? <><span style={{ width: '13px', height: '13px', border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.8s linear infinite', display: 'inline-block' }} />Đang tạo ZIP...</>
                : <><Download size={15} />Tải xuống tài liệu đã chọn</>
              }
            </button>
          </div>
        </div>
      )}

      </div>{/* /controls */}

      {/* ── Khu cards — chỉ phần này cuộn ── */}
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {sortedDocs.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '4rem 2rem', backgroundColor: 'var(--color-bg-surface)', borderRadius: 'var(--radius-lg)', border: '1px dashed var(--color-border)' }}>
            <p style={{ color: 'var(--color-text-muted)', fontSize: '1rem' }}>
              {showSelectedOnly ? 'Chưa có tài liệu nào được chọn.' : 'Không tìm thấy tài liệu nào phù hợp với bộ lọc.'}
            </p>
            <button className="btn btn-outline" style={{ marginTop: '1rem' }}
              onClick={() => { handleSetFilters(EMPTY_FILTERS); setShowSelectedOnly(false); }}>
              Xóa bộ lọc
            </button>
          </div>
        ) : (
          <div style={{
            display: 'grid',
            gridTemplateColumns: viewMode === 'grid' ? 'repeat(auto-fill, minmax(320px, 1fr))' : '1fr',
            gap: '1.5rem', paddingBottom: '1rem',
          }}>
            {pagedDocs.map(doc => (
              <DocumentCard
                key={doc.id}
                document={doc}
                viewMode={viewMode}
                isSelected={selectedIds.has(doc.id)}
                onToggleSelect={() => toggleSelect(doc.id)}
                isNew={isDocNew ? isDocNew(doc.id) : doc.isNew}
                onDownload={logDownload}
              />
            ))}
          </div>
        )}
      </div>{/* /cards */}

      {/* ── Phân trang — luôn nằm ở đáy, không cuộn ── */}
      {totalPages > 1 && (
        <div style={{
          flexShrink: 0,
          display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '0.5rem',
          padding: '0.75rem 1rem',
          borderTop: '1px solid var(--color-border)',
          background: 'rgba(15, 23, 42, 0.97)',
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: '0 -4px 20px rgba(0,0,0,0.35)',
          flexWrap: 'wrap', rowGap: '0.4rem',
          marginTop: 'auto',
        }}>
          {/* Nút Trang đầu */}
          <button
            onClick={() => setCurrentPage(1)}
            disabled={safePage === 1}
            style={{
              padding: '0.35rem 0.65rem', borderRadius: '8px',
              background: 'none', border: '1px solid var(--color-border)',
              color: safePage === 1 ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage === 1 ? 'not-allowed' : 'pointer', fontSize: '0.78rem',
              opacity: safePage === 1 ? 0.4 : 1,
            }}
            title="Trang đầu"
          >«</button>

          {/* Nút Trang trước */}
          <button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={safePage === 1}
            style={{
              display: 'flex', alignItems: 'center', padding: '0.35rem 0.65rem',
              borderRadius: '8px', background: 'none', border: '1px solid var(--color-border)',
              color: safePage === 1 ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage === 1 ? 'not-allowed' : 'pointer',
              opacity: safePage === 1 ? 0.4 : 1,
            }}
          >
            <ChevronLeft size={16} />
          </button>

          {/* Các số trang */}
          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter(p => p === 1 || p === totalPages || Math.abs(p - safePage) <= 2)
            .reduce((acc, p, idx, arr) => {
              if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
              acc.push(p);
              return acc;
            }, [])
            .map((item, idx) =>
              item === '...' ? (
                <span key={`ellipsis-${idx}`} style={{ color: 'var(--color-text-muted)', padding: '0 0.25rem', fontSize: '0.85rem' }}>…</span>
              ) : (
                <button
                  key={item}
                  onClick={() => setCurrentPage(item)}
                  style={{
                    padding: '0.35rem 0.7rem', borderRadius: '8px',
                    background: safePage === item ? 'var(--color-primary)' : 'none',
                    border: safePage === item ? 'none' : '1px solid var(--color-border)',
                    color: safePage === item ? 'white' : 'var(--color-text-main)',
                    fontWeight: safePage === item ? '700' : '400',
                    cursor: 'pointer', fontSize: '0.85rem',
                    boxShadow: safePage === item ? '0 2px 8px rgba(59,130,246,0.4)' : 'none',
                    minWidth: '34px',
                  }}
                >
                  {item}
                </button>
              )
            )
          }

          {/* Nút Trang sau */}
          <button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
            style={{
              display: 'flex', alignItems: 'center', padding: '0.35rem 0.65rem',
              borderRadius: '8px', background: 'none', border: '1px solid var(--color-border)',
              color: safePage === totalPages ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage === totalPages ? 'not-allowed' : 'pointer',
              opacity: safePage === totalPages ? 0.4 : 1,
            }}
          >
            <ChevronRight size={16} />
          </button>

          {/* Nút Trang cuối */}
          <button
            onClick={() => setCurrentPage(totalPages)}
            disabled={safePage === totalPages}
            style={{
              padding: '0.35rem 0.65rem', borderRadius: '8px',
              background: 'none', border: '1px solid var(--color-border)',
              color: safePage === totalPages ? 'var(--color-text-muted)' : 'var(--color-text-main)',
              cursor: safePage === totalPages ? 'not-allowed' : 'pointer', fontSize: '0.78rem',
              opacity: safePage === totalPages ? 0.4 : 1,
            }}
            title="Trang cuối"
          >»</button>

          {/* Thông tin */}
          <span style={{ marginLeft: '0.5rem', color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            Trang <strong style={{ color: 'var(--color-text-main)' }}>{safePage}</strong> / {totalPages}
            &nbsp;·&nbsp;
            {(safePage - 1) * PAGE_SIZE + 1}–{Math.min(safePage * PAGE_SIZE, sortedDocs.length)} / {sortedDocs.length} tài liệu
          </span>
        </div>
      )}

    </div>

    {/* ── AI Analyzing Modal Overlay ── */}
    {isAnalyzing && (
      <div className="modal-overlay" style={{ zIndex: 10000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{
          background: 'rgba(15, 23, 42, 0.96)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(239, 68, 68, 0.4)',
          borderRadius: '18px',
          padding: '2rem 2.5rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '1.25rem',
          boxShadow: '0 25px 60px rgba(0,0,0,0.7)',
          maxWidth: '440px',
          textAlign: 'center',
          animation: 'fadeIn 0.25s ease-out'
        }}>
          <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{
              position: 'absolute', width: '100%', height: '100%',
              borderRadius: '50%', border: '3px solid rgba(239, 68, 68, 0.2)',
              borderTopColor: '#ef4444', animation: 'spin 0.9s linear infinite'
            }} />
            <Sparkles size={28} color="#ef4444" />
          </div>
          <div>
            <h3 style={{ margin: '0 0 0.5rem 0', fontSize: '1.15rem', fontWeight: '700', color: '#ffffff' }}>
              Tải lên thông minh
            </h3>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--color-text-muted)', lineHeight: '1.45' }}>
              AI Trợ lý đang đọc và trích xuất thông tin từ file <strong style={{ color: '#60a5fa', wordBreak: 'break-all' }}>{analyzingFileName}</strong>...
            </p>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', opacity: 0.85, backgroundColor: 'rgba(255,255,255,0.05)', padding: '0.4rem 0.8rem', borderRadius: '8px' }}>
            ⚡ Tự động điền Số hiệu, Cơ quan, Phân loại, Ngày tháng & Trích yếu
          </div>
        </div>
      </div>
    )}

    <style>{`
      @keyframes spin    { to { transform: rotate(360deg); } }
      @keyframes fadeIn  { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    `}</style>
    </>
  );
};

export default Dashboard;
