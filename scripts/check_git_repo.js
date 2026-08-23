import git from 'isomorphic-git';
import fs from 'node:fs';
import path from 'node:path';

async function main() {
  let dir = path.resolve('.');
  console.log('Current directory:', dir);

  while (dir && dir !== '/' && dir !== path.parse(dir).root) {
    if (fs.existsSync(path.join(dir, '.git'))) {
      console.log('Found .git in:', dir);
      const branches = await git.listBranches({ fs, dir });
      console.log('Branches:', branches);
      try {
        const sha = await git.resolveRef({ fs, dir, ref: 'HEAD' });
        console.log('Current HEAD SHA:', sha);
      } catch (e) {
        console.log('Error resolving HEAD:', e.message);
      }
      return;
    }
    dir = path.dirname(dir);
  }
  console.log('No .git folder found in parent hierarchy.');
}

main().catch(err => console.error(err));
