import { describe, it, expect } from 'vitest';
import * as ts from 'typescript';

function parseProvides(code: string): string | null {
	const sourceFile = ts.createSourceFile(
		'test.ts',
		code,
		ts.ScriptTarget.Latest,
		true,
		ts.ScriptKind.TS
	);

	let providesType: string | null = null;

	const visit = (node: ts.Node) => {
		if (
			ts.isCallExpression(node) &&
			ts.isIdentifier(node.expression) &&
			node.expression.text === 'defineLayer'
		) {
			const arg = node.arguments[0];
			if (arg && ts.isObjectLiteralExpression(arg)) {
				for (const prop of arg.properties) {
					if (!ts.isPropertyAssignment(prop)) continue;
					const propName = prop.name.getText(sourceFile);
					if (
						propName === 'provides' &&
						ts.isObjectLiteralExpression(prop.initializer)
					) {
						providesType = extractProvidesType(prop.initializer, sourceFile);
					}
				}
			}
		}
		ts.forEachChild(node, visit);
	};

	visit(sourceFile);
	return providesType;
}

function extractProvidesType(
	node: ts.ObjectLiteralExpression,
	sourceFile: ts.SourceFile
): string {
	const provides: string[] = [];

	for (const prop of node.properties) {
		if (
			ts.isPropertyAssignment(prop) ||
			ts.isShorthandPropertyAssignment(prop)
		) {
			const propName = prop.name.getText(sourceFile);

			if (ts.isPropertyAssignment(prop)) {
				const returnType = inferFactoryReturnType(prop.initializer, sourceFile);
				provides.push(`${propName}: ${returnType}`);
			} else {
				provides.push(`${propName}: unknown`);
			}
		}
	}

	return provides.length > 0 ? `{ ${provides.join('; ')} }` : '{}';
}

function inferFactoryReturnType(
	node: ts.Node,
	sourceFile: ts.SourceFile
): string {
	if (ts.isArrowFunction(node) || ts.isFunctionExpression(node)) {
		const body = node.body;

		if (ts.isBlock(body)) {
			const returnStatements = findReturnStatements(body);
			if (returnStatements.length === 1 && returnStatements[0]?.expression) {
				return inferExpressionType(returnStatements[0].expression, sourceFile);
			}
			return 'unknown';
		}

		return inferExpressionType(body, sourceFile);
	}

	return 'unknown';
}

function findReturnStatements(block: ts.Block): ts.ReturnStatement[] {
	const returns: ts.ReturnStatement[] = [];
	const visit = (node: ts.Node) => {
		if (ts.isReturnStatement(node)) {
			returns.push(node);
		}
		if (!ts.isFunctionDeclaration(node) && !ts.isArrowFunction(node)) {
			ts.forEachChild(node, visit);
		}
	};
	ts.forEachChild(block, visit);
	return returns;
}

function inferExpressionType(
	expr: ts.Expression,
	sourceFile: ts.SourceFile
): string {
	if (ts.isParenthesizedExpression(expr)) {
		return inferExpressionType(expr.expression, sourceFile);
	}

	if (ts.isCallExpression(expr)) {
		const funcText = expr.expression.getText(sourceFile);
		return `ReturnType<typeof ${funcText}>`;
	}

	if (ts.isNewExpression(expr)) {
		const className = expr.expression.getText(sourceFile);
		return className;
	}

	if (ts.isObjectLiteralExpression(expr)) {
		const props: string[] = [];
		for (const p of expr.properties) {
			if (ts.isPropertyAssignment(p)) {
				const key = p.name.getText(sourceFile);
				const valueType = inferTypeFromNode(p.initializer, sourceFile);
				props.push(`${key}: ${valueType}`);
			}
		}
		return props.length > 0 ? `{ ${props.join('; ')} }` : 'object';
	}

	return inferTypeFromNode(expr, sourceFile);
}

function inferTypeFromNode(node: ts.Node, _sourceFile: ts.SourceFile): string {
	if (ts.isStringLiteral(node)) return 'string';
	if (ts.isNumericLiteral(node)) return 'number';
	if (
		node.kind === ts.SyntaxKind.TrueKeyword ||
		node.kind === ts.SyntaxKind.FalseKeyword
	) {
		return 'boolean';
	}
	if (ts.isArrayLiteralExpression(node)) return 'unknown[]';
	if (ts.isObjectLiteralExpression(node)) return 'object';
	return 'unknown';
}

describe('gen-layers provides type inference', () => {
	it('should infer ReturnType for arrow function calling a function', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'test',
				provides: {
					themeService: () => createThemeService(),
				},
			});
		`);

		expect(result).toContain(
			'themeService: ReturnType<typeof createThemeService>'
		);
	});

	it('should infer class name for new expression', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'test',
				provides: {
					logger: () => new Logger(),
				},
			});
		`);

		expect(result).toContain('logger: Logger');
	});

	it('should infer string for string literal return', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'test',
				provides: {
					label: () => 'hello',
				},
			});
		`);

		expect(result).toContain('label: string');
	});

	it('should infer number for numeric literal return', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'test',
				provides: {
					count: () => 42,
				},
			});
		`);

		expect(result).toContain('count: number');
	});

	it('should infer inline object shape', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'test',
				provides: {
					config: () => ({ darkMode: true, fontSize: 14 }),
				},
			});
		`);

		expect(result).toContain('darkMode: boolean');
		expect(result).toContain('fontSize: number');
	});

	it('should handle multiple provides entries', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'multi',
				provides: {
					auth: () => createAuth(),
					db: () => new Database(),
				},
			});
		`);

		expect(result).toContain('auth: ReturnType<typeof createAuth>');
		expect(result).toContain('db: Database');
	});

	it('should handle block body with single return', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'test',
				provides: {
					svc: () => { return createService(); },
				},
			});
		`);

		expect(result).toContain('svc: ReturnType<typeof createService>');
	});

	it('should fall back to unknown for complex block bodies with multiple returns', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'test',
				provides: {
					svc: () => { if (true) { return a(); } return b(); },
				},
			});
		`);

		expect(result).toContain('svc: unknown');
	});

	it('should return empty object for empty provides', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'test',
				provides: {},
			});
		`);

		expect(result).toBe('{}');
	});

	it('should return null when no provides field exists', () => {
		const result = parseProvides(`
			const TestLayer = defineLayer({
				name: 'noProvides',
			});
		`);

		expect(result).toBeNull();
	});
});
