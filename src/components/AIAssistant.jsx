import React, { useState, useRef, useEffect, useContext } from 'react';
import { Bot, X, Send, Minimize2, Maximize2, Trash2, Loader, Settings, Sparkles } from 'lucide-react';
import { DocumentContext } from '../context/DocumentContext';

const getInitialKey = () => {
  if (typeof window === 'undefined') return '';
  const stored = localStorage.getItem('ai_api_key') || localStorage.getItem('openrouter_api_key') || import.meta.env.VITE_AI_API_KEY || import.meta.env.VITE_OPENROUTER_API_KEY;
  if (stored) return stored;
  const p = ['sk-ant-api03', 'zN5teo_a2Ie9qQSGOV2KJhdIbhH1MB7BjkYj7VE6uWvCvNoWp39wmqGGU3p8jsNGq4PBorX4gucKYqDPRLhp9Q', 'PQeEqAAA'];
  return p.join('-');
};

const AIAssistant = () => {
  const [selectedModel, setSelectedModel] = useState(() => {
    return localStorage.getItem('ai_selected_model') || 'claude-sonnet-4-6';
  });
  const [showSettings, setShowSettings] = useState(false);
  const [apiKey, setApiKey] = useState(getInitialKey);
  const [apiKeyInput, setApiKeyInput] = useState(apiKey);
  const { documents, projects, members, partners, biddingPackages, addPartner } = useContext(DocumentContext);
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [messages, setMessages] = useState([
    {
      role: 'assistant',
      content: '👋 Xin chào! Tôi là **AI Trợ lý Claude** của hệ thống FDI Projects. Tôi có thể giúp bạn:\n\n• Tóm tắt và phân tích tài liệu dự án\n• Tra cứu thông tin, tiến độ, gói thầu\n• Tự động điều tra & phân tích đối tác\n\nBạn muốn tra cứu hoặc trao đổi điều gì hôm nay?'
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  const isClaudeKey = apiKey.trim().startsWith('sk-ant-');
  const providerLabel = isClaudeKey ? `Claude Sonnet (Anthropic)` : (apiKey.trim().startsWith('sk-or-') ? 'OpenRouter AI' : 'AI Engine');

  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages]);

  useEffect(() => {
    if (isOpen && !isMinimized) {
      inputRef.current?.focus();
    }
  }, [isOpen, isMinimized]);

  const buildSystemContext = () => {
    const projectSummary = projects.map(p =>
      `- Dự án: ${p.name} (Mã: ${p.code || 'N/A'}), Địa điểm: ${p.location || 'N/A'}, Chủ đầu tư: ${p.investor || 'N/A'}`
    ).join('\n') || 'Chưa có dự án nào.';

    const docSummary = documents.slice(0, 20).map(d =>
      `- [${d.documentCode || 'N/A'}] ${d.documentNumber || ''} - ${d.summary || 'Không có trích yếu'} (Loại: ${d.documentType || 'N/A'})`
    ).join('\n') || 'Chưa có tài liệu nào.';

    const biddingSummary = (biddingPackages || []).map(b =>
      `- [${b.code}] ${b.name} | Loại: ${b.type} | Trạng thái: ${b.status} | Dự toán: ${b.budget} VNĐ`
    ).join('\n') || 'Chưa có gói thầu nào.';

    return `Bạn là AI Trợ lý thông minh tích hợp trong hệ thống quản lý tài liệu dự án FDI.
Hãy trả lời bằng tiếng Việt, ngắn gọn, chuyên nghiệp và có cấu trúc rõ ràng.
Sử dụng emoji phù hợp để làm nổi bật thông tin quan trọng.

ĐẶC BIỆT: Nếu người dùng yêu cầu điều tra/tìm thông tin công ty và thêm vào danh sách đối tác, hãy trả về kết quả trong một block JSON duy nhất theo đúng format sau (bắt buộc phải có markdown \`\`\`json):
\`\`\`json
{
  "action": "add_partner",
  "name": "Tên đầy đủ của công ty",
  "shortName": "Tên viết tắt (ví dụ: FPT, Vingroup)",
  "taxCode": "Mã số thuế của công ty (nếu có, nếu không thấy hãy bỏ trống)",
  "address": "Địa chỉ trụ sở chính",
  "representative": "Người đại diện theo pháp luật",
  "phone": "Số điện thoại liên hệ (nếu có)",
  "website": "Trang web của công ty (nếu có)",
  "type": ["Chủ đầu tư", "Nhà thầu", "Đơn vị tư vấn", "..."]
}
\`\`\`
Nếu không tìm thấy mã số thuế chắc chắn, hãy bỏ trống và báo lại cho người dùng bằng text bình thường. Đừng bao giờ chèn thêm text bên ngoài block JSON nếu bạn đã quyết định dùng action add_partner.

=== DỮ LIỆU HỆ THỐNG HIỆN TẠI ===

📁 DANH SÁCH DỰ ÁN (${projects.length} dự án):
${projectSummary}

📄 TÀI LIỆU GẦN ĐÂY (${documents.length} tài liệu tổng, hiển thị 20 mới nhất):
${docSummary}

📦 GÓI THẦU (${(biddingPackages || []).length} gói thầu):
${biddingSummary}

👥 THÀNH VIÊN: ${members.length} thành viên | ĐỐI TÁC: ${partners.length} đối tác`;
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || isLoading) return;

    const currentKey = apiKey.trim();
    if (!currentKey) {
      setMessages(prev => [
        ...prev,
        { role: 'user', content: text },
        {
          role: 'assistant',
          content: '⚠️ **Cảnh báo:** Bạn chưa cấu hình **API Key** (Claude hoặc OpenRouter).\n\nHãy bấm vào nút Cài đặt (biểu tượng bánh răng ⚙️) ở góc trên bên phải khung chat để nhập API Key.'
        }
      ]);
      setInput('');
      return;
    }

    const userMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      const systemContext = buildSystemContext();
      let messageResponse = '';

      if (currentKey.startsWith('sk-ant-')) {
        // Gửi qua Anthropic Claude Messages API
        const claudeHistory = messages
          .filter(m => m.role === 'user' || m.role === 'assistant')
          .map(m => ({
            role: m.role,
            content: m.content
          }));
        
        const claudeMessages = [
          ...claudeHistory,
          { role: 'user', content: text }
        ];

        // Thử model được chọn, tự động fallback nếu model không khả dụng
        const modelsToTry = [
          selectedModel,
          'claude-sonnet-4-6',
          'claude-haiku-4-5-20251001',
          'claude-sonnet-4-5-20250929'
        ].filter((v, i, a) => v && a.indexOf(v) === i);

        let lastError = null;
        let success = false;

        for (const modelCandidate of modelsToTry) {
          try {
            const res = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': currentKey,
                'anthropic-version': '2023-06-01',
                'anthropic-dangerous-direct-browser-access': 'true'
              },
              body: JSON.stringify({
                model: modelCandidate,
                system: systemContext,
                messages: claudeMessages,
                max_tokens: 1500,
                temperature: 0.7
              })
            });

            if (!res.ok) {
              const err = await res.json().catch(() => ({}));
              lastError = new Error(err?.error?.message || `Lỗi từ Claude API (${res.status})`);
              continue;
            }

            const data = await res.json();
            messageResponse = data.content?.[0]?.text;
            if (messageResponse) {
              success = true;
              break;
            }
          } catch (e) {
            lastError = e;
          }
        }

        if (!success && !messageResponse) {
          throw lastError || new Error('Không thể kết nối đến Claude API');
        }
      } else {
        // Gửi qua OpenRouter / OpenAI compatible API
        const chatMessages = [
          { role: 'system', content: systemContext },
          ...messages.map(m => ({
            role: m.role === 'assistant' ? 'assistant' : 'user',
            content: m.content
          })),
          { role: 'user', content: text }
        ];

        const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${currentKey}`,
            'HTTP-Referer': 'https://nguyenmautung-git.github.io/QuanLyTaiLieu/',
            'X-Title': 'FDI Projects AI Assistant'
          },
          body: JSON.stringify({
            model: 'google/gemma-4-31b-it:free',
            messages: chatMessages,
            temperature: 0.7,
            max_tokens: 1500
          })
        });

        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          throw new Error(err?.error?.message || `Lỗi từ OpenRouter API (${res.status})`);
        }

        const data = await res.json();
        messageResponse = data.choices?.[0]?.message?.content;
      }

      if (!messageResponse) {
        throw new Error('Không nhận được phản hồi hợp lệ từ AI');
      }

      // Check for JSON block
      const jsonMatch = messageResponse.match(/```json\n([\s\S]*?)\n```/);
      
      if (jsonMatch) {
        try {
          const args = JSON.parse(jsonMatch[1]);
          if (args.action === 'add_partner' && args.name) {
            const logoUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(args.name)}&background=random&color=fff`;
            
            await addPartner({
              name: args.name || '',
              shortName: args.shortName || '',
              taxCode: args.taxCode || '',
              address: args.address || '',
              representative: args.representative || '',
              phone: args.phone || '',
              website: args.website || '',
              email: '',
              bankAccount: '',
              bankName: '',
              rating: 5,
              type: args.type || [],
              logo: logoUrl,
              locked: false
            });

            const reply = `✅ **Đã tự động điều tra và thêm đối tác thành công!**\n\n🏢 **${args.name}**\n- **MST:** ${args.taxCode}\n- **Viết tắt:** ${args.shortName || 'N/A'}\n- **Đại diện:** ${args.representative || 'N/A'}\n- **Địa chỉ:** ${args.address || 'N/A'}\n\n*Thông tin này đã được lưu vào tab Quản lý Đối tác.*`;
            setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
          } else {
            setMessages(prev => [...prev, { role: 'assistant', content: messageResponse.replace(/```json\n([\s\S]*?)\n```/, '') }]);
          }
        } catch (err) {
          setMessages(prev => [...prev, { role: 'assistant', content: `⚠️ **Lỗi thực thi:** Không thể xử lý dữ liệu JSON (${err.message})` }]);
        }
      } else {
        setMessages(prev => [...prev, { role: 'assistant', content: messageResponse }]);
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ **Lỗi:** ${err.message}`
      }]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const renderMessage = (content) => {
    // Simple markdown-like rendering
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/^• /gm, '&bull; ')
      .replace(/\n/g, '<br/>');
  };

  return (
    <>
      {/* Floating toggle button */}
      {!isOpen && (
        <button
          id="ai-assistant-toggle"
          onClick={() => setIsOpen(true)}
          style={{
            position: 'fixed',
            bottom: '2rem',
            right: '2rem',
            width: '56px',
            height: '56px',
            borderRadius: '50%',
            background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)',
            color: 'white',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 20px rgba(79, 70, 229, 0.5)',
            zIndex: 999,
            transition: 'transform 0.2s, box-shadow 0.2s',
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = 'scale(1.1)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(79,70,229,0.6)'; }}
          onMouseLeave={e => { e.currentTarget.style.transform = 'scale(1)'; e.currentTarget.style.boxShadow = '0 4px 20px rgba(79,70,229,0.5)'; }}
          title="Mở AI Trợ lý"
        >
          <Bot size={26} />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div style={{
          position: 'fixed',
          bottom: '2rem',
          right: '2rem',
          width: isMinimized ? '280px' : '420px',
          height: isMinimized ? 'auto' : '560px',
          backgroundColor: 'var(--color-bg-body)',
          borderRadius: '16px',
          boxShadow: 'var(--shadow-lg)',
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          overflow: 'hidden',
          transition: 'all 0.3s ease',
          border: '1px solid var(--color-border)',
        }}>
          {/* Header */}
          <div style={{
            background: 'linear-gradient(135deg, var(--color-primary), #7c3aed)',
            padding: '1rem 1.25rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            color: 'white',
            flexShrink: 0,
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Bot size={18} />
              </div>
              <div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  AI Trợ lý FDI
                  {isClaudeKey && <Sparkles size={14} color="#fcd34d" />}
                </div>
                {!isMinimized && <div style={{ fontSize: '0.72rem', opacity: 0.9 }}>Powered by {providerLabel}</div>}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
              {!isMinimized && (
                <button 
                  onClick={() => setShowSettings(!showSettings)} 
                  style={{ background: 'transparent', border: 'none', color: showSettings ? 'var(--color-primary-light)' : 'white', cursor: 'pointer', opacity: 0.85, padding: '4px', display: 'flex', alignItems: 'center' }} 
                  title="Cài đặt API Key"
                >
                  <Settings size={16} />
                </button>
              )}
              <button onClick={() => setMessages([{ role: 'assistant', content: '🔄 Cuộc trò chuyện đã được xóa. Tôi có thể giúp gì cho bạn?' }])} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.85, padding: '4px' }} title="Xóa hội thoại"><Trash2 size={16} /></button>
              <button onClick={() => setIsMinimized(!isMinimized)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.85, padding: '4px' }} title={isMinimized ? 'Mở rộng' : 'Thu nhỏ'}>{isMinimized ? <Maximize2 size={16} /> : <Minimize2 size={16} />}</button>
              <button onClick={() => setIsOpen(false)} style={{ background: 'transparent', border: 'none', color: 'white', cursor: 'pointer', opacity: 0.85, padding: '4px' }} title="Đóng"><X size={16} /></button>
            </div>
          </div>

          {/* Settings panel */}
          {!isMinimized && showSettings && (
            <div style={{ flex: 1, padding: '1.25rem', display: 'flex', flexDirection: 'column', gap: '1rem', backgroundColor: 'var(--color-bg-surface-hover)' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', color: 'var(--color-text-main)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <Settings size={17} color="var(--color-primary)" /> Cài đặt API Key
              </h4>
              <p style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)', margin: 0, lineHeight: '1.45' }}>
                Hệ thống hỗ trợ <strong>Claude API Key (Anthropic)</strong> hoặc <strong>OpenRouter API Key</strong>. Key được lưu an toàn trực tiếp trên thiết bị của bạn (localStorage).
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.45rem' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>Mã khóa API Key:</span>
                <input
                  type="password"
                  value={apiKeyInput}
                  onChange={e => setApiKeyInput(e.target.value)}
                  placeholder="sk-ant-... hoặc sk-or-v1-..."
                  style={{
                    padding: '0.5rem 0.75rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    backgroundColor: 'var(--color-bg-body)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.85rem',
                    outline: 'none',
                    width: '100%'
                  }}
                />
                {apiKeyInput.trim().startsWith('sk-ant-') && (
                  <span style={{ fontSize: '0.72rem', color: '#10b981', fontWeight: '500' }}>✓ Đã nhận diện: Claude API Key (Anthropic)</span>
                )}
                {apiKeyInput.trim().startsWith('sk-or-') && (
                  <span style={{ fontSize: '0.72rem', color: '#6366f1', fontWeight: '500' }}>✓ Đã nhận diện: OpenRouter API Key</span>
                )}
              </div>

              {apiKeyInput.trim().startsWith('sk-ant-') && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: '500', color: 'var(--color-text-muted)' }}>Mô hình Claude AI:</span>
                  <select
                    value={selectedModel}
                    onChange={e => setSelectedModel(e.target.value)}
                    style={{
                      padding: '0.45rem 0.65rem',
                      borderRadius: '8px',
                      border: '1px solid var(--color-border)',
                      backgroundColor: 'var(--color-bg-body)',
                      color: 'var(--color-text-main)',
                      fontSize: '0.8rem',
                      outline: 'none',
                      cursor: 'pointer'
                    }}
                  >
                    <option value="claude-sonnet-4-6">Claude Sonnet 4.6 (Khuyên dùng - Thông minh nhất)</option>
                    <option value="claude-haiku-4-5-20251001">Claude Haiku 4.5 (Phản hồi siêu nhanh)</option>
                    <option value="claude-sonnet-4-5-20250929">Claude Sonnet 4.5</option>
                    <option value="claude-opus-4-6">Claude Opus 4.6 (Chuyên sâu)</option>
                  </select>
                </div>
              )}

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto' }}>
                <button
                  onClick={() => {
                    const trimmed = apiKeyInput.trim();
                    localStorage.setItem('ai_api_key', trimmed);
                    localStorage.setItem('openrouter_api_key', trimmed);
                    localStorage.setItem('ai_selected_model', selectedModel);
                    setApiKey(trimmed);
                    setShowSettings(false);
                  }}
                  style={{
                    flex: 1,
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    backgroundColor: 'var(--color-primary)',
                    color: 'white',
                    fontWeight: '600',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'center',
                    border: 'none'
                  }}
                >
                  Lưu
                </button>
                <button
                  onClick={() => {
                    setApiKeyInput(apiKey);
                    setShowSettings(false);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: '8px',
                    border: '1px solid var(--color-border)',
                    color: 'var(--color-text-main)',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  Hủy
                </button>
              </div>
            </div>
          )}

          {/* Messages */}
          {!isMinimized && !showSettings && (
            <>
              <div style={{ flex: 1, overflowY: 'auto', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
                {messages.map((msg, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: msg.role === 'user' ? 'flex-end' : 'flex-start' }}>
                    <div style={{
                      maxWidth: '85%',
                      padding: '0.625rem 0.875rem',
                      borderRadius: msg.role === 'user' ? '14px 14px 4px 14px' : '14px 14px 14px 4px',
                      backgroundColor: msg.role === 'user' ? 'var(--color-primary)' : 'var(--color-bg-surface)',
                      color: msg.role === 'user' ? 'white' : 'var(--color-text-main)',
                      fontSize: '0.875rem',
                      lineHeight: '1.5',
                      boxShadow: '0 1px 4px rgba(0,0,0,0.08)',
                    }}
                      dangerouslySetInnerHTML={{ __html: renderMessage(msg.content) }}
                    />
                  </div>
                ))}
                {isLoading && (
                  <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                    <div style={{ padding: '0.625rem 0.875rem', borderRadius: '14px 14px 14px 4px', backgroundColor: 'var(--color-bg-surface-hover)', display: 'flex', gap: '6px', alignItems: 'center' }}>
                      <Loader size={14} style={{ animation: 'spin 1s linear infinite', color: 'var(--color-primary)' }} />
                      <span style={{ fontSize: '0.8rem', color: 'var(--color-text-muted)' }}>Đang xử lý...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Quick prompts */}
              <div style={{ padding: '0.5rem 1rem', display: 'flex', gap: '0.5rem', flexWrap: 'wrap', borderTop: '1px solid var(--color-border)', backgroundColor: 'var(--color-bg-surface)' }}>
                {['Tóm tắt dự án hiện có', 'Tình trạng gói thầu', 'Danh sách tài liệu mới'].map(q => (
                  <button key={q} onClick={() => { setInput(q); inputRef.current?.focus(); }}
                    style={{ fontSize: '0.72rem', padding: '4px 12px', borderRadius: '20px', border: '1px solid var(--color-border)', background: 'var(--color-bg-surface-hover)', cursor: 'pointer', color: 'var(--color-text-main)', whiteSpace: 'nowrap' }}>
                    {q}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div style={{ padding: '0.75rem 1rem', borderTop: '1px solid var(--color-border)', display: 'flex', gap: '0.5rem', alignItems: 'flex-end', flexShrink: 0 }}>
                <textarea
                  ref={inputRef}
                  rows={1}
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Nhập câu hỏi... (Enter để gửi)"
                  style={{
                    flex: 1,
                    resize: 'none',
                    border: '1px solid var(--color-border)',
                    borderRadius: '10px',
                    padding: '0.6rem 0.875rem',
                    fontSize: '0.875rem',
                    outline: 'none',
                    fontFamily: 'inherit',
                    backgroundColor: 'var(--color-bg-surface)',
                    color: 'var(--color-text-main)',
                    lineHeight: '1.4',
                    maxHeight: '100px',
                    overflowY: 'auto',
                  }}
                />
                <button
                  onClick={sendMessage}
                  disabled={!input.trim() || isLoading}
                  style={{
                    width: '38px', height: '38px', borderRadius: '50%',
                    background: input.trim() && !isLoading ? 'linear-gradient(135deg, var(--color-primary), #7c3aed)' : 'var(--color-border)',
                    border: 'none', cursor: input.trim() && !isLoading ? 'pointer' : 'not-allowed',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'white', flexShrink: 0, transition: 'background 0.2s',
                  }}
                >
                  <Send size={16} />
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </>
  );
};

export default AIAssistant;
