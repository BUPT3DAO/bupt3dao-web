'use client';

import { useRef, useState, type ChangeEvent } from 'react';

import { Icon } from '@/components/icon';
import { ApiError, api } from '@/lib/api';

const MAX_BYTES = 4 * 1024 * 1024;
const ALLOWED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

interface InsertImageButtonProps {
  /** 上传成功后把 markdown 片段交给编辑器插入 */
  onInserted: (markdown: string) => void;
  onError?: (message: string) => void;
  disabled?: boolean;
}

/** markdown 编辑器里通用的「插入图片」按钮，图片直接传到社区服务器。 */
export function InsertImageButton({ onInserted, onError, disabled }: InsertImageButtonProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file) return;
    if (file.size > MAX_BYTES || !ALLOWED.includes(file.type)) {
      onError?.('请选择不超过 4 MB 的 PNG、JPEG、WebP 或 GIF 图片。');
      input.value = '';
      return;
    }

    setUploading(true);
    try {
      const { url } = await api.uploadImage(file);
      onInserted(`![图片](${url})`);
    } catch (cause) {
      onError?.(cause instanceof ApiError ? cause.message : '图片上传失败，请稍后重试');
    } finally {
      setUploading(false);
      // 清空以便重新选择同一个文件
      input.value = '';
    }
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ghost btn-sm"
        disabled={disabled || uploading}
        onClick={() => inputRef.current?.click()}
      >
        <Icon name="image" size={15} />
        {uploading ? '上传中…' : '插入图片'}
      </button>
      <input
        ref={inputRef}
        className="visually-hidden"
        type="file"
        aria-hidden="true"
        tabIndex={-1}
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={handleChange}
      />
    </>
  );
}
