/**
 * Mock diff content for testing diff parsing logic
 */

// Standard diff with context lines
export const standardDiff = `@@ -10,7 +10,9 @@
 import { something } from 'somewhere';

 export function example() {
-  const old = 'value';
+  const new1 = 'value';
+  const new2 = 'another';
   return result;
 }

`;

// Diff with multiple hunks
export const multiHunkDiff = `@@ -1,5 +1,6 @@
 // Header comment
+// New header line
 import { a } from 'a';
 import { b } from 'b';

 export const x = 1;
@@ -20,4 +21,5 @@
 export function foo() {
   return 'foo';
 }
+
+export function bar() { return 'bar'; }
`;

// Diff with only additions (new file)
export const newFileDiff = `@@ -0,0 +1,10 @@
+import { Logger } from './logger';
+
+export class NewClass {
+  private logger = new Logger();
+
+  public doSomething(): void {
+    this.logger.info('Doing something');
+  }
+}
`;

// Diff with only deletions
export const deletionDiff = `@@ -1,5 +0,0 @@
-import { OldThing } from './old';
-
-export function deprecated() {
-  return 'deprecated';
-}
`;

// Complex diff with additions, deletions, and context
export const complexDiff = `@@ -15,12 +15,14 @@
 class MyClass {
   constructor() {
-    this.oldField = null;
+    this.newField = [];
+    this.initialized = false;
   }

   doSomething() {
-    return this.oldField;
+    if (!this.initialized) {
+      this.initialize();
+    }
+    return this.newField;
   }
 }
`;

// Diff for testing line number mapping
// Old line 10 -> deleted
// Old line 11 = New line 10 (context)
// New line 11 (added)
// Old line 12 = New line 12 (context)
export const lineNumberMappingDiff = `@@ -10,3 +10,4 @@
-const removed = 'gone';
 const kept1 = 'same';
+const added = 'new';
 const kept2 = 'also same';
`;

// Empty diff (for binary files or no actual changes)
export const emptyDiff = '';

// Diff with no hunk header (malformed)
export const malformedDiff = `
This is not a proper diff
- removed
+ added
`;

// Diff that exceeds size limits (for truncation testing)
export const largeDiff = `@@ -1,100 +1,200 @@
${Array(200).fill(' context line').join('\n')}
+${Array(100).fill('+new line with lots of content to make it large').join('\n')}
`;
