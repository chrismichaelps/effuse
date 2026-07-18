import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		languageOptions: {
			parserOptions: {
				tsconfigRootDir: import.meta.dirname,
			},
		},
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'error',
				{ argsIgnorePattern: '^_' },
			],
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'warn',
			'@typescript-eslint/no-empty-object-type': 'warn',
			'@typescript-eslint/consistent-type-imports': 'warn',
			'prefer-const': 'error',
			'no-console': 'warn',
		},
	},
	{
		ignores: ['dist/**', 'src/**/*.test.ts', 'src/__tests__/**'],
	}
);
