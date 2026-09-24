import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import nextTypeScript from 'eslint-config-next/typescript'

const config = [
  {
    ignores: ['.next/**', 'node_modules/**', 'playwright-report/**', 'test-results/**', 'supabase/functions/**'],
  },
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    // eslint-config-next sets `react.version: 'detect'`, and eslint-plugin-react's
    // detection calls context.getFilename(), which ESLint 10 removed. Pinning the
    // version skips detection. Keep in sync with the installed React major.
    settings: { react: { version: '19.3' } },
  },
]

export default config
