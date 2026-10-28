'use client';

import { useEffect, useState } from 'react';

import { Icon } from '@/components/icon';

// 阅读进度和自查清单只存在本机浏览器里，读不到时按「什么都没做过」处理

const READ_KEY = 'bupt3dao.handbook.read';
const READ_EVENT = 'bupt3dao:handbook-read';

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function saveJson(key: string, value: unknown) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // 隐私模式或存储被禁用时静默放弃，页面照常可用
  }
}

function useReadChapters(): [string[], (slug: string, read: boolean) => void] {
  const [read, setRead] = useState<string[]>([]);

  useEffect(() => {
    const sync = () => setRead(loadJson<string[]>(READ_KEY, []));
    sync();
    window.addEventListener(READ_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(READ_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const update = (slug: string, done: boolean) => {
    const current = loadJson<string[]>(READ_KEY, []).filter((item) => item !== slug);
    saveJson(READ_KEY, done ? [...current, slug] : current);
    window.dispatchEvent(new Event(READ_EVENT));
  };

  return [read, update];
}

export function ReadMark({ slug }: { slug: string }) {
  const [read] = useReadChapters();
  if (!read.includes(slug)) return null;
  return (
    <span className="hb-read-mark">
      <Icon name="check" size={13} />
      已读
    </span>
  );
}

export function ReadProgress({ slugs }: { slugs: string[] }) {
  const [read] = useReadChapters();
  const done = slugs.filter((slug) => read.includes(slug)).length;
  return (
    <div className="hb-progress" aria-label={`已读 ${done} / ${slugs.length} 章`}>
      <div className="hb-progress-bar">
        <span style={{ width: `${slugs.length ? (done / slugs.length) * 100 : 0}%` }} />
      </div>
      <small>
        已读 {done} / {slugs.length} 章
      </small>
    </div>
  );
}

export function ReadToggle({ slug }: { slug: string }) {
  const [read, update] = useReadChapters();
  const done = read.includes(slug);
  return (
    <button
      className={`btn ${done ? 'btn-soft' : 'btn-primary'}`}
      aria-pressed={done}
      onClick={() => update(slug, !done)}
    >
      <Icon name="check" size={16} />
      {done ? '已读' : '标记为已读'}
    </button>
  );
}

export type QuizQuestion = {
  question: string;
  options: string[];
  answer: number;
  explain: string;
};

export function Quiz({ questions }: { questions: QuizQuestion[] }) {
  const [picked, setPicked] = useState<(number | null)[]>(() => questions.map(() => null));
  const answered = picked.filter((value) => value !== null).length;
  const correct = picked.filter((value, index) => value === questions[index].answer).length;

  return (
    <div className="hb-quiz">
      {questions.map((item, qIndex) => {
        const choice = picked[qIndex];
        return (
          <fieldset key={qIndex} className="card hb-quiz-item">
            <legend>
              <span>Q{qIndex + 1}</span>
              {item.question}
            </legend>
            <div className="hb-quiz-options">
              {item.options.map((option, oIndex) => {
                const state =
                  choice === null
                    ? ''
                    : oIndex === item.answer
                      ? 'is-correct'
                      : oIndex === choice
                        ? 'is-wrong'
                        : 'is-dim';
                return (
                  <button
                    key={oIndex}
                    className={state}
                    disabled={choice !== null}
                    onClick={() =>
                      setPicked((prev) => prev.map((value, i) => (i === qIndex ? oIndex : value)))
                    }
                  >
                    <span>{String.fromCharCode(65 + oIndex)}</span>
                    {option}
                  </button>
                );
              })}
            </div>
            {choice !== null && (
              <p className="hb-quiz-explain" role="status">
                <b>{choice === item.answer ? '正确。' : '不对。'}</b>
                {item.explain}
              </p>
            )}
          </fieldset>
        );
      })}
      <div className="hb-quiz-foot">
        <span>
          {answered < questions.length
            ? `已答 ${answered} / ${questions.length}`
            : `答对 ${correct} / ${questions.length}`}
        </span>
        {answered > 0 && (
          <button className="text-link" onClick={() => setPicked(questions.map(() => null))}>
            重新作答
          </button>
        )}
      </div>
    </div>
  );
}

export function Checklist({ id, items }: { id: string; items: string[] }) {
  const storageKey = `bupt3dao.handbook.checklist.${id}`;
  const [checked, setChecked] = useState<number[]>([]);

  useEffect(() => {
    setChecked(loadJson<number[]>(storageKey, []));
  }, [storageKey]);

  const toggle = (index: number) => {
    setChecked((prev) => {
      const next = prev.includes(index) ? prev.filter((i) => i !== index) : [...prev, index];
      saveJson(storageKey, next);
      return next;
    });
  };

  return (
    <div className="card hb-checklist">
      {items.map((item, index) => (
        <label key={index} className={checked.includes(index) ? 'is-checked' : ''}>
          <input
            type="checkbox"
            checked={checked.includes(index)}
            onChange={() => toggle(index)}
          />
          <span className="hb-checkbox" aria-hidden="true">
            <Icon name="check" size={13} />
          </span>
          {item}
        </label>
      ))}
      <small>
        {checked.length === items.length
          ? '全部完成'
          : `${checked.length} / ${items.length}`}
      </small>
    </div>
  );
}
