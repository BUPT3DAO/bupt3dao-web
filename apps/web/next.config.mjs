import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 部署需要独立产物，减少运行镜像体积
  output: 'standalone',
  reactStrictMode: true,
  // monorepo 下让 Next 从仓库根目录追踪依赖
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
};

export default nextConfig;
