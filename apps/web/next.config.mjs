import path from 'node:path';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Docker 部署需要独立产物，减少运行镜像体积
  output: 'standalone',
  reactStrictMode: true,
  // monorepo 下让 Next 从仓库根目录追踪依赖
  outputFileTracingRoot: path.join(import.meta.dirname, '../../'),
  // 浏览器统一访问同源 /api 与 /uploads，由 src/lib/proxy.ts 在运行时转发到后端，
  // 因此后端地址不需要在构建期确定，也不涉及跨域。
};

export default nextConfig;
