import git from 'isomorphic-git';
import fs from 'fs';
import path from 'path';

const dir = process.cwd();

async function freeze() {
  const branch = await git.currentBranch({ fs, dir });
  console.log('CURRENT_BRANCH:', branch);

  const status = await git.statusMatrix({ fs, dir });
  const modified = status.filter(row => row[1] !== row[2] || row[2] !== row[3]);
  console.log('UNCOMMITTED_FILES:', modified.length);
  modified.forEach(r => console.log(' -', r[0]));

  for (const row of modified) {
    const filepath = row[0];
    if (fs.existsSync(path.join(dir, filepath))) {
      await git.add({ fs, dir, filepath });
    } else {
      await git.remove({ fs, dir, filepath });
    }
  }

  const log = await git.log({ fs, dir, depth: 1 });
  let headSha = log[0].oid;

  if (modified.length > 0) {
    headSha = await git.commit({
      fs,
      dir,
      author: { name: 'Antigravity AI', email: 'antigravity@google.com' },
      message: 'feat: service start, billing, payment and new thank-you experience'
    });
    console.log('COMMITTED_FEATURE_SHA:', headSha);
  } else {
    console.log('FEATURE_HEAD_SHA:', headSha);
  }
}

freeze().catch(err => {
  console.error('Error during freeze:', err);
  process.exit(1);
});
