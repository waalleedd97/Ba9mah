'use client';

import { useId, useMemo, useState } from 'react';
import { dedupePosts, extractPosts, splitPosts } from '@/lib/text';
import { Button } from './ui';
import { Icon } from './icons';

interface Props {
  onParsed: (posts: string[]) => void;
  placeholder?: string;
  minHeight?: number;
}

/** مربع لصق واحد لعشرات أو مئات البوستات + رفع ملف (نص، JSON، أو Shares.csv من LinkedIn) */
export function BulkPaste({ onParsed, placeholder, minHeight = 220 }: Props) {
  const [text, setText] = useState('');
  const [fileInfo, setFileInfo] = useState<string>('');
  const posts = useMemo(() => dedupePosts(splitPosts(text)), [text]);
  const id = useId();

  function update(next: string) {
    setText(next);
    onParsed(dedupePosts(splitPosts(next)));
  }

  async function onFile(file?: File) {
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      setFileInfo('الملف أكبر من 20 ميغابايت');
      return;
    }
    const content = await file.text();
    const extracted = dedupePosts(extractPosts(file.name, content));
    if (extracted.length === 0) {
      setFileInfo(`لم أجد بوستات في ${file.name}`);
      return;
    }
    update((text.trim() ? `${text.trim()}\n\n---\n\n` : '') + extracted.join('\n\n---\n\n'));
    setFileInfo(`${file.name}: ${extracted.length} بوست`);
  }

  return (
    <div className="stack" style={{ gap: 10 }}>
      <textarea
        className="textarea"
        value={text}
        onChange={(e) => update(e.target.value)}
        placeholder={placeholder ?? 'الصق بوستاتك هنا. افصل بين كل بوست وآخر بسطر فيه --- أو بسطرين فارغين.'}
        style={{ minHeight }}
        dir="auto"
      />
      <div className="row between">
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="upload" onClick={() => document.getElementById(id)?.click()}>
            رفع ملف
          </Button>
          <input id={id} type="file" accept=".csv,.txt,.json,text/csv,text/plain,application/json" style={{ display: 'none' }} onChange={(e) => onFile(e.target.files?.[0])} />
          {fileInfo && <span className="subtle">{fileInfo}</span>}
        </div>
        <span className={`pill ${posts.length ? 'success' : ''}`}>
          <Icon name={posts.length ? 'check' : 'file-text'} size={13} /> تم التعرف على {posts.length} بوست
        </span>
      </div>
      <div className="subtle" style={{ lineHeight: 1.8 }}>
        أرشيفك كله بضغطة: في LinkedIn افتح Settings ← Data privacy ← Get a copy of your data ← اختر Posts، وارفع ملف <span className="kbd">Shares.csv</span> هنا.
      </div>
      {posts.length > 0 && (
        <div className="list" style={{ gap: 6 }}>
          {posts.slice(0, 3).map((p, i) => (
            <div key={i} className="list-item" style={{ padding: '8px 12px' }}>
              <span className="grow subtle" style={{ color: 'var(--text-2)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.split('\n')[0]}</span>
            </div>
          ))}
          {posts.length > 3 && <span className="subtle">و{posts.length - 3} بوست آخر…</span>}
        </div>
      )}
    </div>
  );
}
