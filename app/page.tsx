'use client';

import { useState, useEffect, useCallback } from 'react';
import { Memory, PostItem, SavedPost, ONBOARD_QUESTIONS, createDefaultMemory, loadMemory, saveMemory, clearMemory } from './lib/data';

type Phase = 'init' | 'spec' | 'onboard' | 'loading' | 'rate' | 'profile' | 'ready';

export default function Home() {
  const [phase, setPhase] = useState<Phase>('init');
  const [mode, setMode] = useState<'generate' | 'train' | 'studio' | 'saved'>('generate');
  const [mem, setMem] = useState<Memory | null>(null);
  const [spec, setSpec] = useState('');
  const [obIdx, setObIdx] = useState(0);
  const [posts, setPosts] = useState<PostItem[]>([]);
  const [rIdx, setRIdx] = useState(0);
  const [err, setErr] = useState('');
  const [imgLoading, setImgLoading] = useState<Record<string, boolean>>({});
  // Training form states
  const [trainPost, setTrainPost] = useState('');
  const [trainTopic, setTrainTopic] = useState('');
  const [trainRule, setTrainRule] = useState('');
  const [trainAvoid, setTrainAvoid] = useState('');
  const [trainImgStyle, setTrainImgStyle] = useState('');
  const [trainImgAvoid, setTrainImgAvoid] = useState('');
  const [trainSuccess, setTrainSuccess] = useState('');
  // Edit states
  const [editingItem, setEditingItem] = useState<{ field: keyof Memory; index: number } | null>(null);
  const [editText, setEditText] = useState('');
  const [editTopic, setEditTopic] = useState('');
  // Studio states
  const [studioMode, setStudioMode] = useState<'create' | 'edit'>('create');
  const [studioPrompt, setStudioPrompt] = useState('');
  const [studioUploadedImage, setStudioUploadedImage] = useState<string | null>(null);
  const [studioUploadedMimeType, setStudioUploadedMimeType] = useState<string>('image/jpeg');
  const [studioEditPrompt, setStudioEditPrompt] = useState('');
  const [studioResults, setStudioResults] = useState<Array<{ id: string; image: string; prompt: string }>>([]);
  const [studioLoading, setStudioLoading] = useState(false);
  // Topic input for generation
  const [customTopic, setCustomTopic] = useState('');
  // Post edit instruction
  const [postEditInstruction, setPostEditInstruction] = useState('');
  const [postEditLoading, setPostEditLoading] = useState(false);
  // Theme
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  // Navbar scroll
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const saved = loadMemory();
    if (saved && saved.spec) {
      setMem(saved);
      setSpec(saved.spec);
      setPhase('ready');
    } else {
      setPhase('spec');
    }
    // Load theme
    const savedTheme = localStorage.getItem('basma-theme');
    if (savedTheme === 'dark' || savedTheme === 'light') {
      setTheme(savedTheme);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setTheme('dark');
    }
  }, []);

  // Scroll listener for navbar
  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Auto-dismiss errors
  useEffect(() => {
    if (err) {
      const t = setTimeout(() => setErr(''), 8000);
      return () => clearTimeout(t);
    }
  }, [err]);

  const toggleTheme = useCallback(() => {
    const next = theme === 'light' ? 'dark' : 'light';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('basma-theme', next);
  }, [theme]);

  // ===== API CALLS =====
  async function generatePosts(memory: Memory, topic?: string) {
    setPhase('loading');
    setErr('');
    try {
      const res = await fetch('/api/generate-posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          spec: memory.spec,
          goldenRules: memory.goldenRules,
          avoidRules: memory.avoidRules,
          dislikeReasons: memory.dislikeReasons,
          likedPosts: memory.likedPosts.slice(-5),
          dislikedPosts: memory.dislikedPosts.slice(-3),
          round: memory.round,
          totalLiked: memory.totalLiked,
          customTopic: topic || '',
        }),
      });
      const data = await res.json();
      if (data.error) { setErr(data.error); setPhase(memory.round > 0 ? 'ready' : 'spec'); return; }
      if (data.posts && data.posts.length > 0) {
        const newPosts: PostItem[] = data.posts.map((p: any, i: number) => ({
          id: `${Date.now()}-${i}`,
          content: p.content,
          topic: p.topic || '',
          image: null,
          imageRating: null,
        }));
        setPosts(newPosts);
        setRIdx(0);
        const updMem = { ...memory, round: (memory.round || 0) + 1 };
        setMem(updMem);
        saveMemory(updMem);
        setPhase('rate');
      } else {
        setErr('فشل توليد البوستات');
      }
    } catch (e: any) {
      setErr(e.message || 'خطأ غير متوقع');
    }
  }

  async function generateImage(postId: string, topic: string) {
    setImgLoading(prev => ({ ...prev, [postId]: true }));
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: topic,
          imageStyleRules: mem?.imageStyleRules || [],
          imageAvoidRules: mem?.imageAvoidRules || [],
        }),
      });
      const data = await res.json();
      if (data.image) {
        setPosts(prev => prev.map(p => p.id === postId ? { ...p, image: data.image, imageRating: null } : p));
      } else if (data.error) {
        setErr(`خطأ في توليد الصورة: ${data.error}`);
      }
    } catch (e: any) {
      setErr(`خطأ في توليد الصورة: ${e.message || 'خطأ غير متوقع'}`);
    }
    setImgLoading(prev => ({ ...prev, [postId]: false }));
  }

  async function analyzeDislike(content: string, memory: Memory) {
    try {
      const res = await fetch('/api/analyze-dislike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postContent: content }),
      });
      const data = await res.json();
      if (data.reason) {
        const updated = { ...memory, dislikeReasons: [...(memory.dislikeReasons || []), data.reason] };
        setMem(updated);
        saveMemory(updated);
      }
    } catch {}
  }

  async function analyzeImageDislike(topic: string, memory: Memory) {
    try {
      const res = await fetch('/api/analyze-image-dislike', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic,
          imageStyleRules: memory.imageStyleRules || [],
          imageAvoidRules: memory.imageAvoidRules || [],
        }),
      });
      const data = await res.json();
      const updated = { ...memory };
      if (data.reason) {
        updated.imageAvoidRules = [...(updated.imageAvoidRules || []), data.reason];
      }
      if (data.rule) {
        updated.imageStyleRules = [...(updated.imageStyleRules || []), data.rule];
      }
      updated.imagePreferences = [...(updated.imagePreferences || []), { topic, liked: false, reason: data.reason }];
      setMem(updated);
      saveMemory(updated);
    } catch {}
  }

  function handleImageRate(postId: string, liked: boolean) {
    const post = posts.find(p => p.id === postId);
    if (!post || !mem) return;
    setPosts(prev => prev.map(p => p.id === postId ? { ...p, imageRating: liked ? 'liked' : 'disliked' } : p));
    const updated = { ...mem };
    updated.imagePreferences = [...(updated.imagePreferences || []), { topic: post.topic, liked }];
    if (liked) {
      updated.imageStyleRules = [...(updated.imageStyleRules || [])];
    } else {
      analyzeImageDislike(post.topic, updated);
    }
    setMem(updated);
    saveMemory(updated);
  }

  // ===== HANDLERS =====
  function handleRate(liked: boolean) {
    const post = posts[rIdx];
    if (!post || !mem) return;
    const updated = { ...mem };
    if (liked) {
      updated.likedPosts = [...updated.likedPosts, { id: post.id, content: post.content, topic: post.topic }];
      updated.totalLiked += 1;
    } else {
      updated.dislikedPosts = [...updated.dislikedPosts, { id: post.id, content: post.content, topic: post.topic }];
      updated.totalDisliked += 1;
      analyzeDislike(post.content, updated);
    }
    setMem(updated);
    saveMemory(updated);
    setPostEditInstruction('');
    if (rIdx < posts.length - 1) {
      setTimeout(() => setRIdx(r => r + 1), 300);
    } else {
      setPhase('profile');
    }
  }

  function handleOnboard(choice: 'a' | 'b') {
    const q = ONBOARD_QUESTIONS[obIdx];
    const picked = choice === 'a' ? q.a : q.b;
    const m = mem || createDefaultMemory();
    m.goldenRules = [...m.goldenRules, picked.rule];
    setMem(m);
    if (obIdx < ONBOARD_QUESTIONS.length - 1) {
      setTimeout(() => setObIdx(i => i + 1), 250);
    } else {
      saveMemory(m);
      generatePosts(m);
    }
  }

  // ===== TRAINING HANDLERS =====
  function showTrainSuccess(msg: string) {
    setTrainSuccess(msg);
    setTimeout(() => setTrainSuccess(''), 3000);
  }

  function addTrainPost() {
    if (!trainPost.trim() || !mem) return;
    const updated = { ...mem };
    updated.likedPosts = [...updated.likedPosts, { id: `train-${Date.now()}`, content: trainPost, topic: trainTopic || 'تدريب يدوي' }];
    updated.totalLiked += 1;
    setMem(updated);
    saveMemory(updated);
    setTrainPost('');
    setTrainTopic('');
    showTrainSuccess('تم إضافة البوست كمرجع ناجح — الوكيل بيقلّد أسلوبه');
  }

  function addTrainRule() {
    if (!trainRule.trim() || !mem) return;
    const updated = { ...mem, goldenRules: [...mem.goldenRules, trainRule] };
    setMem(updated);
    saveMemory(updated);
    setTrainRule('');
    showTrainSuccess('تم إضافة القاعدة الذهبية — أعلى أولوية في النظام');
  }

  function addTrainAvoid() {
    if (!trainAvoid.trim() || !mem) return;
    const updated = { ...mem, dislikeReasons: [...mem.dislikeReasons, trainAvoid] };
    setMem(updated);
    saveMemory(updated);
    setTrainAvoid('');
    showTrainSuccess('تم إضافة النمط المرفوض — الوكيل بيتجنبه');
  }

  function addTrainImgStyle() {
    if (!trainImgStyle.trim() || !mem) return;
    const updated = { ...mem, imageStyleRules: [...(mem.imageStyleRules || []), trainImgStyle] };
    setMem(updated);
    saveMemory(updated);
    setTrainImgStyle('');
    showTrainSuccess('تم إضافة ستايل الصور — بيُطبق على كل صورة جديدة');
  }

  function addTrainImgAvoid() {
    if (!trainImgAvoid.trim() || !mem) return;
    const updated = { ...mem, imageAvoidRules: [...(mem.imageAvoidRules || []), trainImgAvoid] };
    setMem(updated);
    saveMemory(updated);
    setTrainImgAvoid('');
    showTrainSuccess('تم إضافة النمط المرفوض — بيتجنبه بالصور');
  }

  function removeFromMemory(field: keyof Memory, index: number) {
    if (!mem) return;
    const updated = { ...mem };
    const arr = [...(updated[field] as any[])];
    arr.splice(index, 1);
    (updated as any)[field] = arr;
    if (field === 'likedPosts') updated.totalLiked = Math.max(0, updated.totalLiked - 1);
    setMem(updated);
    saveMemory(updated);
  }

  function startEdit(field: keyof Memory, index: number) {
    if (!mem) return;
    const arr = mem[field] as any[];
    const item = arr[index];
    if (field === 'likedPosts') {
      setEditText(item.content);
      setEditTopic(item.topic || '');
    } else {
      setEditText(item);
      setEditTopic('');
    }
    setEditingItem({ field, index });
  }

  function cancelEdit() {
    setEditingItem(null);
    setEditText('');
    setEditTopic('');
  }

  function saveEdit() {
    if (!mem || !editingItem || !editText.trim()) return;
    const updated = { ...mem };
    const { field, index } = editingItem;
    if (field === 'likedPosts') {
      const arr = [...updated.likedPosts];
      arr[index] = { ...arr[index], content: editText, topic: editTopic || arr[index].topic };
      updated.likedPosts = arr;
    } else {
      const arr = [...(updated[field] as string[])];
      arr[index] = editText;
      (updated as any)[field] = arr;
    }
    setMem(updated);
    saveMemory(updated);
    cancelEdit();
    showTrainSuccess('تم حفظ التعديل بنجاح');
  }

  // ===== STUDIO HANDLERS =====
  async function handleStudioGenerate() {
    if (!studioPrompt.trim() || studioLoading) return;
    setStudioLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: studioPrompt,
          imageStyleRules: mem?.imageStyleRules || [],
          imageAvoidRules: mem?.imageAvoidRules || [],
          isStudio: true,
        }),
      });
      const data = await res.json();
      if (data.image) {
        setStudioResults(prev => [{ id: `studio-${Date.now()}`, image: data.image, prompt: studioPrompt }, ...prev]);
        setStudioPrompt('');
      } else if (data.error) {
        setErr(`خطأ: ${data.error}`);
      }
    } catch (e: any) {
      setErr(e.message || 'خطأ غير متوقع');
    }
    setStudioLoading(false);
  }

  async function handleStudioEdit() {
    if (!studioUploadedImage || !studioEditPrompt.trim() || studioLoading) return;
    setStudioLoading(true);
    setErr('');
    try {
      const base64Data = studioUploadedImage.replace(/^data:[^;]+;base64,/, '');
      const res = await fetch('/api/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: studioEditPrompt,
          imageStyleRules: mem?.imageStyleRules || [],
          imageAvoidRules: mem?.imageAvoidRules || [],
          isStudio: true,
          inputImage: base64Data,
          inputMimeType: studioUploadedMimeType,
        }),
      });
      const data = await res.json();
      if (data.image) {
        setStudioResults(prev => [{ id: `studio-${Date.now()}`, image: data.image, prompt: studioEditPrompt }, ...prev]);
        setStudioEditPrompt('');
      } else if (data.error) {
        setErr(`خطأ: ${data.error}`);
      }
    } catch (e: any) {
      setErr(e.message || 'خطأ غير متوقع');
    }
    setStudioLoading(false);
  }

  function handleImageUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setStudioUploadedImage(reader.result as string);
      setStudioUploadedMimeType(file.type || 'image/jpeg');
    };
    reader.readAsDataURL(file);
  }

  function handleStudioDownload(image: string) {
    const a = document.createElement('a');
    a.href = image;
    a.download = `basma-studio-${Date.now()}.png`;
    a.click();
  }

  // ===== POST EDIT HANDLER =====
  async function handlePostEdit() {
    if (!postEditInstruction.trim() || postEditLoading || !cur || !mem) return;
    setPostEditLoading(true);
    setErr('');
    try {
      const res = await fetch('/api/edit-post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          postContent: cur.content,
          instruction: postEditInstruction,
          goldenRules: mem.goldenRules,
          spec: mem.spec,
        }),
      });
      const data = await res.json();
      if (data.editedContent) {
        setPosts(prev => prev.map(p => p.id === cur.id ? { ...p, content: data.editedContent } : p));
        setPostEditInstruction('');
      } else if (data.error) {
        setErr(`خطأ في التعديل: ${data.error}`);
      }
    } catch (e: any) {
      setErr(e.message || 'خطأ غير متوقع');
    }
    setPostEditLoading(false);
  }

  // ===== SAVE POST HANDLERS =====
  function savePost(post: PostItem) {
    if (!mem) return;
    const already = (mem.savedPosts || []).some(s => s.id === post.id);
    if (already) return;
    const saved: SavedPost = {
      id: post.id,
      content: post.content,
      topic: post.topic,
      image: post.image || null,
      savedAt: Date.now(),
    };
    const updated = { ...mem, savedPosts: [...(mem.savedPosts || []), saved] };
    setMem(updated);
    saveMemory(updated);
  }

  function unsavePost(postId: string) {
    if (!mem) return;
    const updated = { ...mem, savedPosts: (mem.savedPosts || []).filter(s => s.id !== postId) };
    setMem(updated);
    saveMemory(updated);
  }

  function isPostSaved(postId: string): boolean {
    return (mem?.savedPosts || []).some(s => s.id === postId);
  }

  function downloadSavedImage(image: string) {
    const a = document.createElement('a');
    a.href = image;
    a.download = `basma-saved-${Date.now()}.png`;
    a.click();
  }

  // ===== COMPUTED =====
  const cur = posts[rIdx];
  const tL = mem?.totalLiked || 0;
  const tD = mem?.totalDisliked || 0;
  const temperature = Math.round(Math.max(30, 100 - (tL * 4)));
  const imgLiked = (mem?.imagePreferences || []).filter(p => p.liked).length;
  const imgDisliked = (mem?.imagePreferences || []).filter(p => !p.liked).length;
  const specOptions = ['ريادة الأعمال', 'التسويق الرقمي', 'التقنية', 'الموارد البشرية'];

  // ==================== RENDERS ====================

  // INIT
  if (phase === 'init') {
    return (
      <div className="center-screen">
        <div className="loader-ring">
          <span style={{ fontSize: 36, zIndex: 1 }}>🌊</span>
        </div>
      </div>
    );
  }

  // SPEC
  if (phase === 'spec') {
    return (
      <div className="center-screen">
        <div className="container fade-in" style={{ textAlign: 'center' }}>
          <div className="icon-3d icon-3d-lg accent" style={{ margin: '0 auto 28px' }}>🌊</div>
          <h1 style={{ fontSize: 32, fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
            بصمة
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 16, lineHeight: 1.7, marginBottom: 36, maxWidth: 400, margin: '0 auto 36px' }}>
            5 أسئلة سريعة عشان بصمة يفهم ذوقك<br />وبعدها يكتب بوستات جديدة + صور بالذكاء الاصطناعي
          </p>
          <div className="card" style={{ marginBottom: 24, textAlign: 'right' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <div className="icon-3d icon-3d-sm cyan">💼</div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>وش تخصصك؟</div>
            </div>
            <input
              className="input-field"
              value={spec}
              onChange={e => setSpec(e.target.value)}
              placeholder="مثل: ريادة الأعمال، التسويق الرقمي..."
            />
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 14 }}>
              {specOptions.map(s => (
                <button key={s} onClick={() => setSpec(s)} className={`spec-chip ${spec === s ? 'active' : ''}`}>{s}</button>
              ))}
            </div>
          </div>
          <button
            className="btn-primary"
            disabled={!spec.trim()}
            onClick={() => {
              const m = createDefaultMemory();
              m.spec = spec;
              setMem(m);
              setPhase('onboard');
            }}
          >
            التالي ←
          </button>
        </div>
      </div>
    );
  }

  // ===== NAVBAR =====
  const showNavbar = mem && mem.spec && (phase === 'ready' || phase === 'rate' || phase === 'profile' || phase === 'loading');
  const navbar = showNavbar ? (
    <nav className={`navbar ${scrolled ? 'scrolled' : ''}`}>
      <div className="navbar-inner">
        <div className="navbar-brand" onClick={() => { setMode('generate'); }}><span style={{ fontSize: 28 }}>🫆</span> بصمة</div>
        <div className="navbar-tabs">
          <button className={`nav-tab ${mode === 'generate' ? 'active' : ''}`} onClick={() => setMode('generate')}>
            التوليد
          </button>
          <button className={`nav-tab ${mode === 'train' ? 'active' : ''}`} onClick={() => setMode('train')}>
            التدريب
          </button>
          <button className={`nav-tab ${mode === 'studio' ? 'active' : ''}`} onClick={() => setMode('studio')}>
            الصور
          </button>
          <button className={`nav-tab ${mode === 'saved' ? 'active' : ''}`} onClick={() => setMode('saved')}>
            المحفوظات{(mem?.savedPosts || []).length > 0 ? ` (${mem!.savedPosts.length})` : ''}
          </button>
        </div>
        <button className="theme-toggle" onClick={toggleTheme} title={theme === 'light' ? 'الوضع الداكن' : 'الوضع الفاتح'}>
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
      </div>
    </nav>
  ) : null;

  // ===== TRAINING MODE =====
  if (mode === 'train' && mem && showNavbar) {
    return (
      <>
        {navbar}
        <div style={{ padding: '32px 16px', minHeight: 'calc(100vh - 64px)' }}>
          <div className="container">
            <div className="fade-in" style={{ textAlign: 'center', marginBottom: 32 }}>
              <div className="icon-3d icon-3d-lg purple" style={{ margin: '0 auto 20px' }}>🎓</div>
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
                تدريب الوكيل
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>أضف بوستات وقواعد يتعلم منها الوكيل ويحسّن مخرجاته</p>
            </div>

            {trainSuccess && <div className="success-flash" style={{ marginBottom: 20 }}>✓ {trainSuccess}</div>}

            {/* Section 1: Add Reference Post */}
            <div className="train-section">
              <div className="card" style={{ padding: 24 }}>
                <div className="train-header">
                  <div className="icon-3d icon-3d-sm cyan">📝</div>
                  <div>
                    <h3 style={{ color: 'var(--cyan)' }}>إضافة بوست مرجعي</h3>
                    <p>الوكيل بيقلّد أسلوبه — يُحقن كـ Few-Shot Example</p>
                  </div>
                </div>
                <input className="input-field" value={trainTopic} onChange={e => setTrainTopic(e.target.value)} placeholder="الموضوع (مثل: ريادة الأعمال)" style={{ marginBottom: 10 }} />
                <textarea className="textarea-field" value={trainPost} onChange={e => setTrainPost(e.target.value)} placeholder="الصق نص البوست هنا..." />
                <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end' }}>
                  <button className="train-add-btn" disabled={!trainPost.trim()} onClick={addTrainPost}>+ أضف كمرجع</button>
                </div>
                {mem.likedPosts.length > 0 && (
                  <div className="memory-items">
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 4 }}>البوستات المرجعية ({mem.likedPosts.length})</div>
                    {mem.likedPosts.slice(-5).map((p, i) => {
                      const realIdx = mem.likedPosts.length - 5 + i;
                      const idx = realIdx < 0 ? i : realIdx;
                      const isEditing = editingItem?.field === 'likedPosts' && editingItem?.index === idx;
                      return (
                        <div key={p.id} className={`memory-item ${isEditing ? 'editing' : ''}`}>
                          {isEditing ? (
                            <div className="memory-edit-form">
                              <input className="input-field memory-edit-input" value={editTopic} onChange={e => setEditTopic(e.target.value)} placeholder="الموضوع" />
                              <textarea className="textarea-field memory-edit-textarea" value={editText} onChange={e => setEditText(e.target.value)} />
                              <div className="memory-edit-actions">
                                <button className="memory-edit-save" onClick={saveEdit}>حفظ</button>
                                <button className="memory-edit-cancel" onClick={cancelEdit}>إلغاء</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="memory-item-text">
                                <span style={{ color: 'var(--accent)', fontSize: 12, fontWeight: 700 }}>{p.topic || 'بدون موضوع'}</span>
                                <br />{p.content.slice(0, 120)}{p.content.length > 120 ? '...' : ''}
                              </div>
                              <div className="memory-item-actions">
                                <button className="memory-item-edit" onClick={() => startEdit('likedPosts', idx)} title="تعديل">✎</button>
                                <button className="memory-item-delete" onClick={() => removeFromMemory('likedPosts', idx)} title="حذف">✕</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Section 2: Golden Rules */}
            <div className="train-section">
              <div className="card" style={{ padding: 24 }}>
                <div className="train-header">
                  <div className="icon-3d icon-3d-sm gold">⭐</div>
                  <div>
                    <h3 style={{ color: 'var(--gold)' }}>إضافة قاعدة ذهبية</h3>
                    <p>أعلى أولوية — تظهر أول الـ System Prompt</p>
                  </div>
                </div>
                <div className="train-input-row">
                  <input className="input-field" value={trainRule} onChange={e => setTrainRule(e.target.value)} placeholder="مثل: استخدم لهجة سعودية بيضاء" onKeyDown={e => e.key === 'Enter' && addTrainRule()} />
                  <button className="train-add-btn" disabled={!trainRule.trim()} onClick={addTrainRule}>+</button>
                </div>
                {mem.goldenRules.length > 0 && (
                  <div className="memory-items">
                    {mem.goldenRules.map((r, i) => {
                      const isEditing = editingItem?.field === 'goldenRules' && editingItem?.index === i;
                      return (
                        <div key={i} className={`memory-item ${isEditing ? 'editing' : ''}`}>
                          {isEditing ? (
                            <div className="memory-edit-form">
                              <input className="input-field memory-edit-input" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                              <div className="memory-edit-actions">
                                <button className="memory-edit-save" onClick={saveEdit}>حفظ</button>
                                <button className="memory-edit-cancel" onClick={cancelEdit}>إلغاء</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="memory-item-text"><span style={{ color: 'var(--gold)' }}>⭐</span> {r}</div>
                              <div className="memory-item-actions">
                                <button className="memory-item-edit" onClick={() => startEdit('goldenRules', i)} title="تعديل">✎</button>
                                <button className="memory-item-delete" onClick={() => removeFromMemory('goldenRules', i)} title="حذف">✕</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Section 3: Avoid Patterns */}
            <div className="train-section">
              <div className="card" style={{ padding: 24 }}>
                <div className="train-header">
                  <div className="icon-3d icon-3d-sm red">🚫</div>
                  <div>
                    <h3 style={{ color: 'var(--red)' }}>إضافة نمط مرفوض</h3>
                    <p>الوكيل بيتجنب هالنمط بالبوستات القادمة</p>
                  </div>
                </div>
                <div className="train-input-row">
                  <input className="input-field" value={trainAvoid} onChange={e => setTrainAvoid(e.target.value)} placeholder='مثل: نبرة وعظية، بوستات طويلة مملة' onKeyDown={e => e.key === 'Enter' && addTrainAvoid()} />
                  <button className="train-add-btn" disabled={!trainAvoid.trim()} onClick={addTrainAvoid}>+</button>
                </div>
                {mem.dislikeReasons.length > 0 && (
                  <div className="memory-items">
                    {mem.dislikeReasons.map((r, i) => {
                      const isEditing = editingItem?.field === 'dislikeReasons' && editingItem?.index === i;
                      return (
                        <div key={i} className={`memory-item ${isEditing ? 'editing' : ''}`}>
                          {isEditing ? (
                            <div className="memory-edit-form">
                              <input className="input-field memory-edit-input" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                              <div className="memory-edit-actions">
                                <button className="memory-edit-save" onClick={saveEdit}>حفظ</button>
                                <button className="memory-edit-cancel" onClick={cancelEdit}>إلغاء</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="memory-item-text"><span style={{ color: 'var(--red)' }}>✕</span> {r}</div>
                              <div className="memory-item-actions">
                                <button className="memory-item-edit" onClick={() => startEdit('dislikeReasons', i)} title="تعديل">✎</button>
                                <button className="memory-item-delete" onClick={() => removeFromMemory('dislikeReasons', i)} title="حذف">✕</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            {/* Section 4: Image AI Training */}
            <div className="train-section">
              <div className="card" style={{ padding: 24 }}>
                <div className="train-header">
                  <div className="icon-3d icon-3d-sm purple">🎨</div>
                  <div>
                    <h3 style={{ color: 'var(--purple)' }}>تدريب ذكاء الصور</h3>
                    <p>قواعد تُحقن مباشرة في برومبت توليد الصور</p>
                  </div>
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ fontSize: 13, color: 'var(--green)', fontWeight: 700, marginBottom: 8 }}>ستايل مفضل (MUST follow):</div>
                  <div className="train-input-row">
                    <input className="input-field" value={trainImgStyle} onChange={e => setTrainImgStyle(e.target.value)} placeholder='مثل: ألوان دافئة، شخصيات كرتونية بسيطة' onKeyDown={e => e.key === 'Enter' && addTrainImgStyle()} />
                    <button className="train-add-btn" disabled={!trainImgStyle.trim()} onClick={addTrainImgStyle}>+</button>
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 13, color: 'var(--red)', fontWeight: 700, marginBottom: 8 }}>ستايل مرفوض (AVOID):</div>
                  <div className="train-input-row">
                    <input className="input-field" value={trainImgAvoid} onChange={e => setTrainImgAvoid(e.target.value)} placeholder='مثل: صور واقعية، ألوان باهتة' onKeyDown={e => e.key === 'Enter' && addTrainImgAvoid()} />
                    <button className="train-add-btn" disabled={!trainImgAvoid.trim()} onClick={addTrainImgAvoid}>+</button>
                  </div>
                </div>
                {((mem.imageStyleRules || []).length > 0 || (mem.imageAvoidRules || []).length > 0) && (
                  <div className="memory-items">
                    {(mem.imageStyleRules || []).map((r, i) => {
                      const isEditing = editingItem?.field === 'imageStyleRules' && editingItem?.index === i;
                      return (
                        <div key={`s-${i}`} className={`memory-item ${isEditing ? 'editing' : ''}`}>
                          {isEditing ? (
                            <div className="memory-edit-form">
                              <input className="input-field memory-edit-input" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                              <div className="memory-edit-actions">
                                <button className="memory-edit-save" onClick={saveEdit}>حفظ</button>
                                <button className="memory-edit-cancel" onClick={cancelEdit}>إلغاء</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="memory-item-text"><span style={{ color: 'var(--green)' }}>✓</span> {r}</div>
                              <div className="memory-item-actions">
                                <button className="memory-item-edit" onClick={() => startEdit('imageStyleRules', i)} title="تعديل">✎</button>
                                <button className="memory-item-delete" onClick={() => removeFromMemory('imageStyleRules', i)} title="حذف">✕</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                    {(mem.imageAvoidRules || []).map((r, i) => {
                      const isEditing = editingItem?.field === 'imageAvoidRules' && editingItem?.index === i;
                      return (
                        <div key={`a-${i}`} className={`memory-item ${isEditing ? 'editing' : ''}`}>
                          {isEditing ? (
                            <div className="memory-edit-form">
                              <input className="input-field memory-edit-input" value={editText} onChange={e => setEditText(e.target.value)} onKeyDown={e => e.key === 'Enter' && saveEdit()} />
                              <div className="memory-edit-actions">
                                <button className="memory-edit-save" onClick={saveEdit}>حفظ</button>
                                <button className="memory-edit-cancel" onClick={cancelEdit}>إلغاء</button>
                              </div>
                            </div>
                          ) : (
                            <>
                              <div className="memory-item-text"><span style={{ color: 'var(--red)' }}>✕</span> يتجنب: {r}</div>
                              <div className="memory-item-actions">
                                <button className="memory-item-edit" onClick={() => startEdit('imageAvoidRules', i)} title="تعديل">✎</button>
                                <button className="memory-item-delete" onClick={() => removeFromMemory('imageAvoidRules', i)} title="حذف">✕</button>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

          </div>
        </div>
      </>
    );
  }

  // ===== STUDIO MODE =====
  if (mode === 'studio' && mem && showNavbar) {
    return (
      <>
        {navbar}
        <div style={{ padding: '32px 16px', minHeight: 'calc(100vh - 64px)' }}>
          <div className="container">
            <div className="fade-in" style={{ textAlign: 'center', marginBottom: 32 }}>
              <div className="icon-3d icon-3d-lg cyan" style={{ margin: '0 auto 20px' }}>🎨</div>
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
                استوديو الصور
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>ولّد صور بالذكاء الاصطناعي أو عدّل على صور موجودة</p>
            </div>

            {/* Sub-mode toggle */}
            <div className="studio-toggle">
              <button className={`studio-toggle-btn ${studioMode === 'create' ? 'active' : ''}`} onClick={() => setStudioMode('create')}>
                توليد جديد
              </button>
              <button className={`studio-toggle-btn ${studioMode === 'edit' ? 'active' : ''}`} onClick={() => setStudioMode('edit')}>
                تعديل صورة
              </button>
            </div>

            {/* Create Mode */}
            {studioMode === 'create' && (
              <div className="card fade-in" style={{ padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div className="icon-3d icon-3d-sm accent">✨</div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>توليد صورة جديدة</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>اوصف الصورة اللي تبيها وخل الذكاء الاصطناعي يرسمها</p>
                  </div>
                </div>
                <textarea
                  className="textarea-field"
                  value={studioPrompt}
                  onChange={e => setStudioPrompt(e.target.value)}
                  placeholder="مثل: قطة كرتونية تشرب قهوة في مقهى، رسم شخصية بطل خارق عربي، شعار لمشروع تقني..."
                  style={{ marginBottom: 14, minHeight: 80 }}
                />
                {(mem.imageStyleRules || []).length > 0 && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span className="tag purple" style={{ fontSize: 11, padding: '3px 10px' }}>ذكي</span>
                    يطبق {mem.imageStyleRules.length} قاعدة ستايل محفوظة
                  </div>
                )}
                <button
                  className="btn-primary"
                  disabled={!studioPrompt.trim() || studioLoading}
                  onClick={handleStudioGenerate}
                >
                  {studioLoading ? (
                    <><span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🎨</span> يولّد الصورة...</>
                  ) : (
                    <>🎨 ولّد الصورة</>
                  )}
                </button>
              </div>
            )}

            {/* Edit Mode */}
            {studioMode === 'edit' && (
              <div className="card fade-in" style={{ padding: 24, marginBottom: 20 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
                  <div className="icon-3d icon-3d-sm cyan">✏️</div>
                  <div>
                    <h3 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text-primary)' }}>تعديل صورة موجودة</h3>
                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>ارفع صورة وقل للذكاء الاصطناعي وش يعدل فيها</p>
                  </div>
                </div>

                {/* Upload area */}
                {!studioUploadedImage ? (
                  <div
                    className="studio-upload-area"
                    onClick={() => document.getElementById('studio-file-input')?.click()}
                  >
                    <div style={{ fontSize: 32, marginBottom: 8 }}>📁</div>
                    <div>اضغط هنا لرفع صورة</div>
                    <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>PNG, JPG, WEBP</div>
                  </div>
                ) : (
                  <div className="studio-preview">
                    <img src={studioUploadedImage} alt="الصورة المرفوعة" />
                    <button
                      className="studio-preview-remove"
                      onClick={() => setStudioUploadedImage(null)}
                      title="إزالة"
                    >✕</button>
                  </div>
                )}
                <input
                  id="studio-file-input"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={handleImageUpload}
                />

                <textarea
                  className="textarea-field"
                  value={studioEditPrompt}
                  onChange={e => setStudioEditPrompt(e.target.value)}
                  placeholder="وش تبي تعدل؟ مثل: غيّر الخلفية لأزرق، أضف نص عربي، حوّلها لستايل كرتوني..."
                  style={{ marginBottom: 14, minHeight: 80 }}
                />
                <button
                  className="btn-primary"
                  disabled={!studioUploadedImage || !studioEditPrompt.trim() || studioLoading}
                  onClick={handleStudioEdit}
                >
                  {studioLoading ? (
                    <><span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>✏️</span> يعدّل الصورة...</>
                  ) : (
                    <>✏️ عدّل الصورة</>
                  )}
                </button>
              </div>
            )}

            {/* Error */}
            {err && <div className="error-toast" style={{ marginBottom: 20 }}>⚠️ {err}</div>}

            {/* Results Gallery */}
            {studioResults.length > 0 && (
              <div className="fade-in-up">
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  📸 الصور المولّدة ({studioResults.length})
                </div>
                <div className="studio-gallery">
                  {studioResults.map(item => (
                    <div key={item.id} className="studio-gallery-item">
                      <img src={item.image} alt={item.prompt} />
                      <div className="studio-gallery-actions">
                        <button className="img-action-btn refresh" title="تحميل" onClick={() => handleStudioDownload(item.image)}>
                          ⬇️
                        </button>
                      </div>
                      <div className="studio-gallery-caption">{item.prompt}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // ===== SAVED POSTS MODE =====
  if (mode === 'saved' && mem && showNavbar) {
    const savedList = mem.savedPosts || [];
    return (
      <>
        {navbar}
        <div style={{ padding: '32px 16px', minHeight: 'calc(100vh - 64px)' }}>
          <div className="container">
            <div className="fade-in" style={{ textAlign: 'center', marginBottom: 32 }}>
              <div className="icon-3d icon-3d-lg gold" style={{ margin: '0 auto 20px' }}>📌</div>
              <h1 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
                البوستات المحفوظة
              </h1>
              <p style={{ color: 'var(--text-muted)', fontSize: 15 }}>
                {savedList.length > 0 ? `${savedList.length} بوست محفوظ` : 'ما فيه بوستات محفوظة بعد'}
              </p>
            </div>

            {savedList.length === 0 ? (
              <div className="card fade-in" style={{ padding: 48, textAlign: 'center' }}>
                <div style={{ fontSize: 48, marginBottom: 16 }}>📋</div>
                <p style={{ color: 'var(--text-muted)', fontSize: 15, lineHeight: 1.8 }}>
                  احفظ البوستات اللي تعجبك من شاشة التقييم<br />
                  عشان ترجع لها وتستخدمها بعدين
                </p>
                <button className="btn-secondary" style={{ marginTop: 20 }} onClick={() => setMode('generate')}>
                  روح ولّد بوستات
                </button>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                {savedList.slice().reverse().map((sp, i) => (
                  <div key={sp.id} className="saved-post-card fade-in" style={{ animationDelay: `${i * 0.06}s` }}>
                    {/* Topic */}
                    {sp.topic && (
                      <div className="topic-tag" style={{ marginBottom: 14 }}>📌 {sp.topic}</div>
                    )}

                    {/* Content */}
                    <div style={{ fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right', color: 'var(--text-primary)', marginBottom: sp.image ? 16 : 0 }}>
                      {sp.content}
                    </div>

                    {/* Image */}
                    {sp.image && (
                      <div className="saved-post-image">
                        <img src={sp.image} alt={sp.topic} />
                        <div className="saved-post-image-actions">
                          <button className="img-action-btn refresh" title="تحميل الصورة" onClick={() => downloadSavedImage(sp.image!)}>
                            ⬇️
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Actions bar */}
                    <div className="saved-post-actions">
                      <button className="saved-post-copy" onClick={() => { navigator.clipboard.writeText(sp.content); showTrainSuccess('تم نسخ البوست'); }}>
                        📋 نسخ النص
                      </button>
                      {sp.image && (
                        <button className="saved-post-copy" onClick={() => downloadSavedImage(sp.image!)}>
                          ⬇️ تحميل الصورة
                        </button>
                      )}
                      <button className="saved-post-remove" onClick={() => unsavePost(sp.id)}>
                        🗑️ حذف
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {trainSuccess && <div className="success-flash" style={{ marginTop: 16 }}>✓ {trainSuccess}</div>}
          </div>
        </div>
      </>
    );
  }

  // READY
  if (phase === 'ready' && mem) {
    return (
      <>
        {navbar}
        <div className="center-screen">
          <div className="container fade-in" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 80, margin: '0 auto 28px', lineHeight: 1 }}>👋</div>
            <h1 style={{ fontSize: 30, fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
              أهلاً! بصمة يتذكرك
            </h1>
            <p style={{ color: 'var(--text-secondary)', fontSize: 15, marginBottom: 24 }}>التخصص: {mem.spec}</p>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginBottom: 28, flexWrap: 'wrap' }}>
              <span className="tag green">👍 {mem.totalLiked} بوست</span>
              <span className="tag red">👎 {mem.totalDisliked} بوست</span>
              <span className="tag gold">⭐ {mem.goldenRules.length} قاعدة</span>
              {(mem.imagePreferences || []).length > 0 && (
                <span className="tag purple">🎨 {(mem.imagePreferences || []).length} تقييم صورة</span>
              )}
            </div>

            {mem.goldenRules.length > 0 && (
              <div className="section-panel gold-panel" style={{ marginBottom: 20, textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ⭐ القواعد الذهبية
                </div>
                {mem.goldenRules.slice(0, 5).map((r, i) => (
                  <div key={i} className="slide-in" style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, paddingRight: 12, animationDelay: `${i * 0.08}s` }}>✓ {r}</div>
                ))}
              </div>
            )}

            {(mem.imageStyleRules || []).length > 0 && (
              <div className="section-panel purple-panel" style={{ marginBottom: 20, textAlign: 'right' }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--purple)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🎨 ذكاء الصور
                </div>
                {mem.imageStyleRules.slice(-3).map((r, i) => (
                  <div key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, paddingRight: 12 }}>🎨 {r}</div>
                ))}
              </div>
            )}

            {/* Topic Input */}
            <div className="card" style={{ marginBottom: 20, textAlign: 'right', padding: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
                <div className="icon-3d icon-3d-sm purple">💡</div>
                <div>
                  <div style={{ fontSize: 16, fontWeight: 800 }}>موضوع البوست</div>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>اختياري — اتركه فاضي والذكاء الاصطناعي يختار مواضيع متنوعة</div>
                </div>
              </div>
              <input
                className="input-field"
                value={customTopic}
                onChange={e => setCustomTopic(e.target.value)}
                placeholder="مثل: أهمية التسويق بالمحتوى، كيف تبدأ مشروعك..."
                onKeyDown={e => e.key === 'Enter' && customTopic.trim() && generatePosts(mem, customTopic)}
              />
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button className="btn-primary" onClick={() => generatePosts(mem, customTopic || undefined)}>✨ ولّد بوستات جديدة</button>
              <button className="btn-secondary" onClick={() => { clearMemory(); setMem(null); setObIdx(0); setPosts([]); setRIdx(0); setPhase('spec'); }}>
                إعادة تعيين الذاكرة
              </button>
            </div>

            {err && <div className="error-toast" style={{ marginTop: 16 }}>⚠️ {err}</div>}
          </div>
        </div>
      </>
    );
  }

  // ONBOARD
  if (phase === 'onboard') {
    const q = ONBOARD_QUESTIONS[obIdx];
    return (
      <div style={{ padding: '32px 16px', minHeight: '100vh', display: 'flex', alignItems: 'center' }}>
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div className="icon-3d icon-3d-sm gold">❓</div>
              <span style={{ fontSize: 15, color: 'var(--text-muted)', fontWeight: 600 }}>سؤال {obIdx + 1}/{ONBOARD_QUESTIONS.length}</span>
            </div>
            <div className="progress-bar">
              {ONBOARD_QUESTIONS.map((_, i) => (
                <div key={i} className={`progress-dot ${i < obIdx ? 'done' : i === obIdx ? 'active' : 'pending'}`} />
              ))}
            </div>
          </div>

          <h2 style={{ fontSize: 28, fontWeight: 900, textAlign: 'center', marginBottom: 32, color: 'var(--text-primary)' }}>
            {q.q}
          </h2>

          <div key={obIdx} className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {(['a', 'b'] as const).map((ch, idx) => {
              const opt = ch === 'a' ? q.a : q.b;
              return (
                <button key={ch} onClick={() => handleOnboard(ch)} className="card card-interactive" style={{
                  textAlign: 'right', width: '100%', display: 'block', animationDelay: `${idx * 0.1}s`,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                    <div className={`icon-3d icon-3d-sm ${ch === 'a' ? 'cyan' : 'pink'}`}>
                      {ch === 'a' ? '🅰️' : '🅱️'}
                    </div>
                    <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--accent)' }}>{opt.label}</span>
                  </div>
                  <div style={{ fontSize: 14, lineHeight: 1.9, color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', paddingRight: 60 }}>{opt.text}</div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // LOADING
  if (phase === 'loading') {
    return (
      <>
        {navbar}
        <div className="center-screen">
          <div className="fade-in" style={{ textAlign: 'center', maxWidth: 420 }}>
            <div className="loader-ring" style={{ margin: '0 auto 28px' }}>
              <span style={{ fontSize: 36, zIndex: 1, animation: 'pulse 2s ease-in-out infinite' }}>🌊</span>
            </div>
            <h3 style={{ fontSize: 22, fontWeight: 800, marginBottom: 10, color: 'var(--text-primary)' }}>
              {(mem?.round || 0) > 0 ? 'يكتب بوستات أقرب لذوقك...' : 'يكتب بوستات جديدة...'}
            </h3>
            <p style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 24 }}>
              {mem ? `يستخدم ${mem.likedPosts.length} مثال ناجح + ${mem.dislikeReasons.length} ملاحظة` : ''}
            </p>
            <div style={{ width: 200, height: 4, borderRadius: 2, background: 'var(--bg-secondary)', margin: '0 auto', overflow: 'hidden', border: '1px solid var(--border)' }}>
              <div className="shimmer-bar" />
            </div>
            {err && (
              <div style={{ marginTop: 24 }}>
                <div className="error-toast" style={{ marginBottom: 14, justifyContent: 'center' }}>⚠️ {err}</div>
                <button className="btn-secondary" onClick={() => { setErr(''); if (mem) generatePosts(mem); }}>
                  حاول مرة ثانية
                </button>
              </div>
            )}
          </div>
        </div>
      </>
    );
  }

  // RATE
  if (phase === 'rate' && cur) {
    const isLoadingImg = imgLoading[cur.id];
    return (
      <>
        {navbar}
        <div style={{ padding: '32px 16px', minHeight: '100vh' }}>
          <div className="container">
            {/* Header */}
            <div className="fade-in" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div className="icon-3d icon-3d-sm accent">📝</div>
                <div>
                  <h2 style={{ fontSize: 22, fontWeight: 900, marginBottom: 2 }}>قيّم البوست</h2>
                  <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>الجولة {mem?.round || 1} · {rIdx + 1}/{posts.length}</div>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <span className="tag green" style={{ fontSize: 12 }}>👍 {tL}</span>
                <span className="tag red" style={{ fontSize: 12 }}>👎 {tD}</span>
              </div>
            </div>

            {/* Progress */}
            <div className="progress-bar" style={{ marginBottom: 24 }}>
              {posts.map((_, i) => (
                <div key={i} className={`progress-dot ${i < rIdx ? 'done' : i === rIdx ? 'active' : 'pending'}`} />
              ))}
            </div>

            {/* Topic */}
            {cur.topic && (
              <div className="topic-tag" style={{ marginBottom: 16 }}>
                📌 {cur.topic}
              </div>
            )}

            {/* Post Content */}
            <div key={cur.id} className="card fade-in" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, lineHeight: 1.9, whiteSpace: 'pre-wrap', direction: 'rtl', textAlign: 'right' }}>{cur.content}</div>
            </div>

            {/* Edit Instruction Box */}
            <div className="post-edit-box" style={{ marginBottom: 20 }}>
              <div className="post-edit-row">
                <input
                  className="input-field post-edit-input"
                  value={postEditInstruction}
                  onChange={e => setPostEditInstruction(e.target.value)}
                  placeholder="عدّل البوست... مثل: خله اقصر، غيّر النبرة، أضف أرقام..."
                  onKeyDown={e => e.key === 'Enter' && handlePostEdit()}
                  disabled={postEditLoading}
                />
                <button
                  className="post-edit-btn"
                  disabled={!postEditInstruction.trim() || postEditLoading}
                  onClick={handlePostEdit}
                >
                  {postEditLoading ? '⏳' : '✏️'}
                </button>
              </div>
            </div>

            {/* Image Section */}
            {cur.image ? (
              <div className="image-container fade-in" style={{ marginBottom: 20 }}>
                <img src={cur.image} alt={cur.topic} />
                <div className="image-actions">
                  <button className="img-action-btn like" title="عجبتني الصورة" onClick={() => handleImageRate(cur.id, true)}>
                    {cur.imageRating === 'liked' ? '💚' : '👍'}
                  </button>
                  <button className="img-action-btn dislike" title="ما عجبتني الصورة" onClick={() => handleImageRate(cur.id, false)}>
                    {cur.imageRating === 'disliked' ? '💔' : '👎'}
                  </button>
                  <button className="img-action-btn refresh" title="أعد توليد الصورة" onClick={() => generateImage(cur.id, cur.topic || cur.content.slice(0, 100))} disabled={isLoadingImg}>
                    {isLoadingImg ? '⏳' : '🔄'}
                  </button>
                </div>
                {cur.imageRating && (
                  <div style={{
                    position: 'absolute', top: 12, left: 12,
                    padding: '6px 12px', borderRadius: 20,
                    background: cur.imageRating === 'liked' ? 'rgba(0, 138, 5, 0.9)' : 'rgba(193, 53, 21, 0.9)',
                    color: 'white', fontSize: 12, fontWeight: 700,
                    animation: 'bounceIn 0.3s ease-out',
                  }}>
                    {cur.imageRating === 'liked' ? 'تم التعلم ✓' : 'يتحسن...'}
                  </div>
                )}
              </div>
            ) : (
              <button
                className="btn-generate-img"
                onClick={() => generateImage(cur.id, cur.topic || cur.content.slice(0, 100))}
                disabled={isLoadingImg}
                style={{ marginBottom: 20 }}
              >
                {isLoadingImg ? (
                  <>
                    <span style={{ animation: 'spin 1.5s linear infinite', display: 'inline-block' }}>🎨</span>
                    <span>يولّد الصورة...</span>
                    {(mem?.imageStyleRules || []).length > 0 && (
                      <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>(يطبق {mem!.imageStyleRules.length} قاعدة)</span>
                    )}
                  </>
                ) : (
                  <>
                    🎨 صمم صورة للبوست
                    {(mem?.imageStyleRules || []).length > 0 && (
                      <span className="tag purple" style={{ fontSize: 11, padding: '3px 10px' }}>ذكي</span>
                    )}
                  </>
                )}
              </button>
            )}

            {/* Error */}
            {err && <div className="error-toast" style={{ marginBottom: 20 }}>⚠️ {err}</div>}

            {/* Rating Buttons */}
            <div style={{ display: 'flex', gap: 14, marginBottom: 14 }}>
              <button className="btn-rate dislike" onClick={() => handleRate(false)}>
                👎 ما عجبني
              </button>
              <button className="btn-rate like" onClick={() => handleRate(true)}>
                👍 عجبني
              </button>
            </div>

            {/* Save Button */}
            <button
              className={`btn-save-post ${isPostSaved(cur.id) ? 'saved' : ''}`}
              onClick={() => isPostSaved(cur.id) ? unsavePost(cur.id) : savePost(cur)}
              style={{ marginBottom: 20 }}
            >
              {isPostSaved(cur.id) ? '🔖 محفوظ' : '📌 احفظ البوست'}
            </button>

            <div style={{ textAlign: 'center', fontSize: 13, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
              🌊 بصمة يحلل كل تقييم ويحسّن الجولة الجاية
            </div>
          </div>
        </div>
      </>
    );
  }

  // PROFILE
  if (phase === 'profile' && mem) {
    return (
      <>
        {navbar}
        <div style={{ padding: '40px 18px', minHeight: '100vh' }}>
          <div className="container">
            {/* Header */}
            <div className="fade-in" style={{ textAlign: 'center', marginBottom: 32 }}>
              <div className="icon-3d icon-3d-lg gold" style={{ margin: '0 auto 24px' }}>🎉</div>
              <h2 style={{ fontSize: 28, fontWeight: 900, marginBottom: 8, color: 'var(--text-primary)' }}>
                الجولة {mem.round} خلصت!
              </h2>
              <p style={{ color: 'var(--text-secondary)', fontSize: 15 }}>بصمة تعلّم أكثر عن ذوقك</p>
            </div>

            {/* Stats Grid */}
            <div className="fade-in-up" style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14, marginBottom: 24 }}>
              <div className="stat-box green-bg">
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--green)', marginBottom: 4 }}>{tL}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>إجمالي 👍</div>
              </div>
              <div className="stat-box red-bg">
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--red)', marginBottom: 4 }}>{tD}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>إجمالي 👎</div>
              </div>
              <div className="stat-box gold-bg">
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--gold)', marginBottom: 4 }}>{temperature}%</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>إبداعية</div>
              </div>
              <div className="stat-box cyan-bg">
                <div style={{ fontSize: 28, fontWeight: 900, color: 'var(--cyan)', marginBottom: 4 }}>{mem.round}</div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>جولات</div>
              </div>
            </div>

            {/* Golden Rules */}
            <div className="section-panel gold-panel fade-in-up" style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--gold)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                ⭐ القواعد الذهبية ({mem.goldenRules.length})
              </div>
              {mem.goldenRules.map((r, i) => (
                <div key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, paddingRight: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: 'var(--green)', fontSize: 8 }}>●</span> {r}
                </div>
              ))}
            </div>

            {/* Dislike Reasons */}
            {mem.dislikeReasons.length > 0 && (
              <div className="section-panel red-panel fade-in-up" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--red)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  ✕ أسباب الرفض المكتشفة
                </div>
                {mem.dislikeReasons.slice(-5).map((r, i) => (
                  <div key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, paddingRight: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--red)', fontSize: 8 }}>●</span> {r}
                  </div>
                ))}
              </div>
            )}

            {/* Image AI Agent */}
            {((mem.imageStyleRules || []).length > 0 || (mem.imageAvoidRules || []).length > 0) && (
              <div className="section-panel purple-panel fade-in-up" style={{ marginBottom: 16 }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: 'var(--purple)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
                  🎨 وكيل الصور الذكي
                </div>
                <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
                  <span className="tag green" style={{ fontSize: 12 }}>🎨 {imgLiked} صورة عجبتك</span>
                  <span className="tag red" style={{ fontSize: 12 }}>🎨 {imgDisliked} صورة ما عجبتك</span>
                </div>
                {(mem.imageStyleRules || []).slice(-3).map((r, i) => (
                  <div key={i} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, paddingRight: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--green)', fontSize: 8 }}>●</span> {r}
                  </div>
                ))}
                {(mem.imageAvoidRules || []).slice(-3).map((r, i) => (
                  <div key={`a-${i}`} style={{ fontSize: 14, color: 'var(--text-secondary)', marginBottom: 8, paddingRight: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ color: 'var(--red)', fontSize: 8 }}>●</span> يتجنب: {r}
                  </div>
                ))}
              </div>
            )}

            {/* Memory Stats */}
            <div className="section-panel cyan-panel fade-in-up" style={{ marginBottom: 28 }}>
              <div style={{ fontWeight: 800, color: 'var(--cyan)', marginBottom: 12, fontSize: 15, display: 'flex', alignItems: 'center', gap: 8 }}>
                🌊 ذاكرة بصمة
              </div>
              <div style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.9 }}>
                <div>📚 {mem.likedPosts.length} بوست محفوظ كمرجع ناجح</div>
                <div>🚫 {mem.dislikedPosts.length} بوست محفوظ كمرجع سلبي</div>
                <div>الإبداعية: {temperature}% — تنخفض كل ما زادت الإعجابات</div>
                <div>🎨 {(mem.imagePreferences || []).length} تقييم صورة محفوظ</div>
              </div>
            </div>

            <button className="btn-primary" onClick={() => generatePosts(mem)}>
              ✨ جولة جديدة — بوستات أقرب لذوقك
            </button>
          </div>
        </div>
      </>
    );
  }

  return null;
}
