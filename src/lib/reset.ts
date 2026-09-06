import 'server-only';
import { getDb } from '@/lib/db';
import { listAllImageFiles } from '@/lib/db/repo';
import { deleteImageFile } from '@/lib/images/storage';

/** يمسح كل البيانات والصور — لا رجعة فيه */
export function resetAll() {
  const files = listAllImageFiles();
  const db = getDb();
  db.transaction(() => {
    for (const t of ['saved_posts', 'images', 'image_style_stats', 'dislike_reasons', 'posts', 'rounds', 'rules', 'style_profiles', 'events', 'settings']) {
      db.exec(`DELETE FROM ${t}`);
    }
  })();
  for (const f of files) deleteImageFile(f.fileName);
}
