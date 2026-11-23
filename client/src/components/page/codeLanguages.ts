import { common, createLowlight } from 'lowlight';

export const lowlight = createLowlight(common);

/** 只列 common 注册表里真实存在的语言，避免选了却无法高亮。 */
export const CODE_LANGUAGES = [
  { value: 'plaintext', label: '纯文本' },
  { value: 'bash', label: 'Bash' },
  { value: 'c', label: 'C' },
  { value: 'cpp', label: 'C++' },
  { value: 'csharp', label: 'C#' },
  { value: 'css', label: 'CSS' },
  { value: 'go', label: 'Go' },
  { value: 'java', label: 'Java' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'json', label: 'JSON' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'php', label: 'PHP' },
  { value: 'python', label: 'Python' },
  { value: 'ruby', label: 'Ruby' },
  { value: 'rust', label: 'Rust' },
  { value: 'sql', label: 'SQL' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'xml', label: 'XML' },
  { value: 'yaml', label: 'YAML' },
].filter(({ value }) => value === 'plaintext' || lowlight.registered(value));

const LANGUAGE_LABELS = new Map(CODE_LANGUAGES.map(({ value, label }) => [value, label]));

export function languageLabel(value: string | null | undefined): string {
  if (!value) return '纯文本';
  return LANGUAGE_LABELS.get(value) ?? value;
}
