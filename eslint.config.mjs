import { defineConfig } from 'eslint/config'
import tseslint from '@electron-toolkit/eslint-config-ts'
import eslintPluginReact from 'eslint-plugin-react'
import eslintPluginReactHooks from 'eslint-plugin-react-hooks'
import eslintPluginReactRefresh from 'eslint-plugin-react-refresh'
import eslintPluginPrettier from 'eslint-plugin-prettier'

export default defineConfig(
	{ ignores: ['**/node_modules', '**/dist', '**/out'] },
	tseslint.configs.recommended,
	eslintPluginReact.configs.flat.recommended,
	eslintPluginReact.configs.flat['jsx-runtime'],
	{
		settings: {
			react: {
				version: 'detect'
			}
		}
	},
	{
		files: ['**/*.{ts,tsx}'],
		plugins: {
			'react-hooks': eslintPluginReactHooks,
			'react-refresh': eslintPluginReactRefresh,
			prettier: eslintPluginPrettier
		},
		rules: {
			...eslintPluginReactHooks.configs.recommended.rules,
			...eslintPluginReactRefresh.configs.vite.rules,
			// avoid indent conflicts with Prettier
			indent: 'off',
			// optionally, you can disable prettier's indent rule to avoid conflicts
			'prettier/prettier': [
				'error',
				{
					useTabs: true,
					tabWidth: 3,
					singleQuote: true,
					semi: false,
					printWidth: 100,
					trailingComma: 'none',
					endOfLine: 'lf'
				}
			]
		}
	}
)
