import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
	eslint.configs.recommended,
	...tseslint.configs.recommended,
	{
		rules: {
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_' },
			],
			'@typescript-eslint/explicit-function-return-type': 'off',
			'@typescript-eslint/no-explicit-any': 'error',
			'@typescript-eslint/consistent-type-imports': 'error',
			'prefer-const': 'error',
			'no-console': 'warn',
		},
	},
	{
		files: ['src/bin.ts', 'src/cli.ts'],
		rules: {
			'no-console': 'off',
		},
	},
	{
		ignores: ['dist/**', '**/*.test.ts', 'src/__tests__/node/**'],
	}
);
