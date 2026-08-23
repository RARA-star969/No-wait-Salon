import git from 'isomorphic-git';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  const dir = path.resolve('.');
  console.log('Initializing git repository at:', dir);
  await git.init({ fs, dir });

  const branchName = 'feature/approved-baseline-checkpoint';
  console.log('Creating branch:', branchName);

  // Add files to index
  const files = await fs.promises.readdir(dir);
  for (const file of files) {
    if (file === '.git' || file === 'node_modules' || file === '.DS_Store') continue;
    const stat = await fs.promises.stat(path.join(dir, file));
    if (stat.isDirectory()) {
      // add files recursively
      await addDirectory(dir, file);
    } else {
      await git.add({ fs, dir, filepath: file });
    }
  }

  const author = { name: 'Antigravity AI', email: 'antigravity@google.com' };
  const sha = await git.commit({
    fs,
    dir,
    author,
    message: 'checkpoint: preserve approved token chip silhouette and baseline changes'
  });

  console.log('Successfully committed approved baseline!');
  console.log('BRANCH:', branchName);
  console.log('COMMIT_SHA:', sha);

  // Checkout feature branch ref
  await git.branch({ fs, dir, ref: branchName, checkout: true });
}

async function addDirectory(dir, relPath) {
  const fullPath = path.join(dir, relPath);
  const items = await fs.promises.readdir(fullPath);
  for (const item of items) {
    if (item === '.DS_Store' || item === 'node_modules' || item === '.git') continue;
    const relItemPath = path.join(relPath, item);
    const stat = await fs.promises.stat(path.join(dir, relItemPath));
    if (stat.isDirectory()) {
      await addDirectory(dir, relItemPath);
    } else {
      await git.add({ fs, dir, filepath: relItemPath });
    }
  }
}

main().catch(err => console.error(err));
