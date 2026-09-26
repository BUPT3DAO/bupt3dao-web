import type { Metadata } from 'next';
import { cache } from 'react';

import { PostDetailClient } from './post-client';

import { getServerApi } from '@/lib/server-api';
import type { CommentPage, Post } from '@/types';

type PostPageProps = { params: Promise<{ id: string }> };

const getPost = cache((id: number) => getServerApi<Post>(`/posts/${id}`));
const getComments = cache((id: number) =>
  getServerApi<CommentPage>(`/posts/${id}/comments`),
);

export const dynamic = 'force-dynamic';

function postDescription(content: string): string {
  return content
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/[#>*_`~|]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

export async function generateMetadata({ params }: PostPageProps): Promise<Metadata> {
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isInteger(id) || id <= 0) return { title: '帖子不存在' };

  const post = await getPost(id);
  if (!post) return { title: '社区论坛' };

  const description = postDescription(post.content);
  return {
    title: post.title,
    description,
    openGraph: { type: 'article', title: post.title, description },
  };
}

export default async function PostPage({ params }: PostPageProps) {
  const { id: rawId } = await params;
  const postId = Number(rawId);
  const validId = Number.isInteger(postId) && postId > 0;
  let initialPost: Post | null = null;
  let initialComments: CommentPage | null = null;
  if (validId) {
    [initialPost, initialComments] = await Promise.all([getPost(postId), getComments(postId)]);
  }

  return (
    <PostDetailClient
      postId={postId}
      initialPost={initialPost}
      initialComments={initialComments}
    />
  );
}
