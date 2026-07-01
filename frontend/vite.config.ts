import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const repositoryName = env.GITHUB_REPOSITORY?.split('/')[1]
  const inferredBase = env.GITHUB_ACTIONS === 'true' && repositoryName
    ? `/${repositoryName}/`
    : '/'

  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || inferredBase,
    build: {
      sourcemap: true,
    },
  }
})
