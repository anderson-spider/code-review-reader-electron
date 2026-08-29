import type { CodeReview, ReviewComment } from '../../shared/types';

export const createMockComment = (overrides: Partial<ReviewComment> = {}): ReviewComment => ({
  id: 'comment-1',
  filePath: 'src/example.ts',
  lineNumber: 42,
  severity: 'warning',
  comment: 'Esta função poderia ser otimizada para melhor performance.',
  codeSnippet: undefined,
  ...overrides,
});

export const mockCriticalComment = createMockComment({
  id: 'critical-1',
  severity: 'critical',
  comment: 'Vulnerabilidade de SQL injection detectada. Use prepared statements.',
  lineNumber: 15,
  codeSnippet: 'const result = db.query("SELECT * FROM users WHERE id = " + userId); // <-- issue: SQL injection\n// fix: const result = await db.query("SELECT * FROM users WHERE id = $1", [userId]);',
});

export const mockWarningComment = createMockComment({
  id: 'warning-1',
  severity: 'warning',
  comment: 'Possível memory leak. O recurso não está sendo fechado corretamente.',
  lineNumber: 30,
  codeSnippet: 'const data = await fetch(url); // <-- issue: connection not closed\n// fix: try { ... } finally { connection.close(); }',
});

export const mockSuggestionComment = createMockComment({
  id: 'suggestion-1',
  severity: 'suggestion',
  comment: 'Considere extrair esta lógica para um método separado para melhor legibilidade.',
  lineNumber: 50,
});

export const mockInfoComment = createMockComment({
  id: 'info-1',
  severity: 'info',
  comment: 'Este padrão segue as boas práticas do projeto.',
  lineNumber: 10,
});

export const createMockReview = (overrides: Partial<CodeReview> = {}): CodeReview => ({
  summary: 'MR apresenta algumas melhorias importantes, mas possui pontos de atenção.',
  comments: [
    mockCriticalComment,
    mockWarningComment,
    mockSuggestionComment,
    mockInfoComment,
  ],
  overallAssessment: 'O código está bem estruturado, mas precisa de correções antes da aprovação.',
  ...overrides,
});

export const mockEmptyReview: CodeReview = {
  summary: 'No reviewable files found in this MR.',
  comments: [],
  overallAssessment: 'All files were filtered out (tests, generated, binaries, etc.).',
};

export const mockApprovableReview = createMockReview({
  comments: [mockSuggestionComment, mockInfoComment],
  overallAssessment: 'Código bem escrito. Aprovado com sugestões menores.',
});

export const mockBlockingReview = createMockReview({
  comments: [mockCriticalComment, mockWarningComment],
  overallAssessment: 'Issues críticos precisam ser resolvidos antes da aprovação.',
});

export const mockMarkdownReviewResponse = `Review concluído. Os principais pontos identificados foram:

**Warnings (2):**
- \`notifyDataSetChanged()\` - impacto de performance em listas grandes
- Side effects vazios sem documentação explicativa

**Suggestions (4):**
- \`context\` nullable no Fragment
- Possível duplicação de \`DividerItemDecoration\`
- Fragment transaction sem back stack
- Tema hardcoded no Manifest

**Info (2):**
- Ciclo de vida dos Consumers
- Filtros vazios na navegação

O código segue bem os padrões arquiteturais existentes e não apresenta vulnerabilidades de segurança.`;
