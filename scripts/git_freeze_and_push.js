import git from 'isomorphic-git';
import http from 'isomorphic-git/http/node';
import fs from 'fs';
import { execSync } from 'child_process';

async function freezeAndPush() {
  const dir = '.';
  console.log('--- STAGING & COMMITTING WORKING TREE VIA ISOMORPHIC-GIT ---');

  const matrix = await git.statusMatrix({ fs, dir });
  const modified = matrix.filter(row => row[1] !== row[2] || row[2] !== row[3]).map(row => row[0]);

  console.log(`Staging ${modified.length} changed files...`);
  for (const file of modified) {
    if (fs.existsSync(file)) {
      await git.add({ fs, dir, filepath: file });
    } else {
      await git.remove({ fs, dir, filepath: file });
    }
  }

  const sha = await git.commit({
    fs,
    dir,
    author: {
      name: 'RARA-star969',
      email: 'ritiksinghroth@gmail.com',
    },
    message: 'FEAT: Reworked Multi-Category Home, Full Dedicated Location Experience, Address Management & Data Isolation',
  });

  console.log('✔ COMMITTED FEATURE & MAIN HEAD SHA:', sha);

  // Get GitHub token from gh auth token
  const token = execSync('/Users/ritiksinghroth/.local/bin/gh auth token', { encoding: 'utf8' }).trim();

  console.log('Pushing main branch to origin via isomorphic-git...');
  const pushRes = await git.push({
    fs,
    http,
    dir,
    remote: 'origin',
    ref: 'main',
    onAuth: () => ({ username: token }),
  });

  console.log('✔ PUSH SUCCESSFUL! Main HEAD SHA:', sha);
}

freezeAndPush().catch((err) => {
  console.error('Git Freeze & Push Error:', err);
  process.exit(1);
});
