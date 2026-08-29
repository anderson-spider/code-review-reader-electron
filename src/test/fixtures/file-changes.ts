import type { FileChange } from '../../shared/types';

export const createMockFileChange = (overrides: Partial<FileChange> = {}): FileChange => ({
  old_path: 'src/example.ts',
  new_path: 'src/example.ts',
  diff: `@@ -1,5 +1,7 @@
 import { something } from 'somewhere';

+import { newImport } from 'new-package';
+
 export function example() {
-  return 'old';
+  return 'new';
 }`,
  new_file: false,
  renamed_file: false,
  deleted_file: false,
  ...overrides,
});

export const mockModifiedFile = createMockFileChange();

export const mockNewFile = createMockFileChange({
  old_path: '',
  new_path: 'src/newFile.ts',
  new_file: true,
  diff: `@@ -0,0 +1,5 @@
+export function newFunction() {
+  return 'hello';
+}
+
+export const constant = 42;`,
});

export const mockDeletedFile = createMockFileChange({
  new_path: 'src/deleted.ts',
  deleted_file: true,
  diff: `@@ -1,3 +0,0 @@
-export function oldFunction() {
-  return 'goodbye';
-}`,
});

export const mockRenamedFile = createMockFileChange({
  old_path: 'src/oldName.ts',
  new_path: 'src/newName.ts',
  renamed_file: true,
});

export const mockTestFile = createMockFileChange({
  old_path: 'src/example.test.ts',
  new_path: 'src/example.test.ts',
  diff: `@@ -1,5 +1,10 @@
 import { example } from './example';

 describe('example', () => {
+  it('should return new value', () => {
+    expect(example()).toBe('new');
+  });
+
   it('should work', () => {
     expect(example()).toBeDefined();
   });
 });`,
});

export const mockKotlinTestFile = createMockFileChange({
  old_path: 'src/ExampleTest.kt',
  new_path: 'src/ExampleTest.kt',
});

export const mockGeneratedFile = createMockFileChange({
  old_path: 'src/generated/schema.ts',
  new_path: 'src/generated/schema.ts',
});

export const mockBinaryFile = createMockFileChange({
  old_path: 'assets/logo.png',
  new_path: 'assets/logo.png',
  diff: 'Binary files differ',
});

export const mockLockFile = createMockFileChange({
  old_path: 'package-lock.json',
  new_path: 'package-lock.json',
  diff: `@@ -1,100 +1,105 @@
 {
   "name": "project",
   "lockfileVersion": 3,
   ...
 }`,
});

export const mockMigrationFile = createMockFileChange({
  old_path: 'db/migrations/001_create_users.sql',
  new_path: 'db/migrations/001_create_users.sql',
});

export const mockKotlinFile = createMockFileChange({
  old_path: 'src/main/kotlin/Example.kt',
  new_path: 'src/main/kotlin/Example.kt',
  diff: `@@ -1,10 +1,15 @@
 package com.example

 class Example {
+    private val logger = Logger.getLogger()
+
     fun doSomething(): String {
-        return "result"
+        logger.info("Doing something")
+        return "new result"
     }
 }`,
});

export const mockLargeDiff = createMockFileChange({
  diff: 'x'.repeat(150000), // Very large diff
});

export const mockMultipleChanges: FileChange[] = [
  mockKotlinFile,
  mockModifiedFile,
  mockNewFile,
  mockTestFile,
  mockGeneratedFile,
];

export const mockChangesWithIgnored: FileChange[] = [
  mockModifiedFile,
  mockTestFile,
  mockGeneratedFile,
  mockBinaryFile,
  mockLockFile,
  mockDeletedFile,
];
