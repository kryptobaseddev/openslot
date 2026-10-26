import prettier from 'eslint-config-prettier';
import path from 'node:path';
import js from '@eslint/js';
import svelte from 'eslint-plugin-svelte';
import { defineConfig, includeIgnoreFile } from 'eslint/config';
import globals from 'globals';
import ts from 'typescript-eslint';

const gitignorePath = path.resolve(import.meta.dirname, '.gitignore');

export default defineConfig(
  includeIgnoreFile(gitignorePath),
  js.configs.recommended,
  ts.configs.recommended,
  svelte.configs.recommended,
  prettier,
  svelte.configs.prettier,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    // typescript-eslint recommends no-undef off for TypeScript projects
    rules: { 'no-undef': 'off' }
  },
  {
    // The flagged Maps, Sets and Dates are temporaries built inside $derived or
    // a handler and never mutated afterwards, so Svelte's reactive versions add
    // nothing.
    rules: { 'svelte/prefer-svelte-reactivity': 'off' }
  },
  {
    files: ['**/*.svelte', '**/*.svelte.ts'],
    languageOptions: { parserOptions: { projectService: true, extraFileExtensions: ['.svelte'], parser: ts.parser } }
  }
);
