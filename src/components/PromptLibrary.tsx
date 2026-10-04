import { useEffect, useState } from 'react';
import { Modal, Btn } from './ui';
import { IconPlus, IconTrash } from './icons';
import { loadList, saveList, uid, K_PROMPTS, type SavedPrompt } from '../lib/storage';
import { useApp } from '../store/app';
import { useI18n } from '../i18n';

export const PRESET_IDS = ['write', 'code', 'learn', 'debate', 'brainstorm', 'roleplay'] as const;
export const PRESET_ICONS: Record<string, string> = {
  write: '✍️', code: '💻', learn: '🎓', debate: '⚖️', brainstorm: '💡', roleplay: '🎭',
};

export function PromptLibrary({ open, onClose, onPick }: {
  open: boolean;
  onClose: () => void;
  onPick: (text: string) => void;
}) {
  const { t } = useI18n();
  const { dataVersion, bumpData, toast } = useApp();
  const [mine, setMine] = useState<SavedPrompt[]>([]);
  const [draft, setDraft] = useState('');

  useEffect(() => {
    if (!open) return;
    loadList<SavedPrompt>(K_PROMPTS).then((l) => setMine(l.sort((a, b) => b.ts - a.ts)));
  }, [open, dataVersion]);

  const add = () => {
    const v = draft.trim();
    if (!v) return;
    const item: SavedPrompt = { id: uid(), text: v, ts: Date.now() };
    const next = [item, ...mine];
    setMine(next);
    saveList(K_PROMPTS, next);
    setDraft('');
    bumpData();
    toast(t('settings.saved'), 'ok');
  };

  const remove = (id: string) => {
    const next = mine.filter((p) => p.id !== id);
    setMine(next);
    saveList(K_PROMPTS, next);
    bumpData();
  };

  return (
    <Modal open={open} onClose={onClose} title={t('prompts.title')} wide>
      <p className="mb-4 text-sm text-zinc-400">{t('prompts.desc')}</p>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
        {PRESET_IDS.map((id) => (
          <button
            key={id}
            onClick={() => { onPick(t(`p.${id}`)); onClose(); }}
            className="group rounded-xl border border-line bg-panel2 p-3 text-start hover:border-accent/50 transition-colors"
          >
            <div className="text-xl">{PRESET_ICONS[id]}</div>
            <div className="mt-1 text-sm font-bold text-zinc-200 group-hover:text-white">{t(`prompts.${id}`)}</div>
          </button>
        ))}
      </div>

      <div className="mt-6">
        <h3 className="mb-2 text-xs font-bold uppercase tracking-widest text-zinc-500">{t('prompts.custom')}</h3>
        <div className="flex gap-2">
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') add(); }}
            placeholder={t('prompts.addPh')}
            className="flex-1 rounded-xl border border-line bg-panel2 px-3 py-2 text-sm outline-none focus:border-accent/50"
            dir="auto"
          />
          <Btn variant="ghost" onClick={add} disabled={!draft.trim()}>
            <IconPlus className="w-4 h-4" />{t('c.add')}
          </Btn>
        </div>
        <div className="mt-3 space-y-2">
          {mine.length === 0 && <div className="py-3 text-center text-xs text-zinc-600">—</div>}
          {mine.map((p) => (
            <div key={p.id} className="flex items-start gap-2 rounded-xl border border-line bg-panel2/60 p-3">
              <button
                onClick={() => { onPick(p.text); onClose(); }}
                className="flex-1 text-start text-sm text-zinc-300 hover:text-white line-clamp-2"
                dir="auto"
              >
                {p.text}
              </button>
              <button onClick={() => remove(p.id)} className="shrink-0 rounded-lg p-1.5 text-zinc-600 hover:text-rose-400">
                <IconTrash className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}
