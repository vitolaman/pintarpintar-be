// Prints the MASTER_PASSWORD_HASH line for .env (development and testing only;
// remove it before production). The password is read without echo, asked
// twice, and never printed or stored. Usage: npm run master-password:hash
// Piped input (one line) is accepted for scripted use.
const { hash } = require('@node-rs/bcrypt');

// Length, not the bcrypt cost, protects it: while it is set, every failed
// sign-in also checks it, so it keeps the account passwords' cost of 10.
const MIN_LENGTH = 12;
const COST = 10;

function readHidden(prompt) {
  return new Promise((resolve, reject) => {
    const { stdin, stderr } = process;
    stderr.write(prompt);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding('utf8');
    let value = '';
    const onData = (chunk) => {
      for (const char of chunk) {
        if (char === '\r' || char === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', onData);
          stderr.write('\n');
          resolve(value);
          return;
        }
        if (char === '\u0003') {
          stdin.setRawMode(false);
          stderr.write('\n');
          reject(new Error('Cancelled'));
          return;
        }
        if (char === '\u007f' || char === '\b') {
          value = [...value].slice(0, -1).join('');
        } else {
          value += char;
        }
      }
    };
    stdin.on('data', onData);
  });
}

async function readPiped() {
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  return input.split(/\r?\n/)[0];
}

async function main() {
  let password;
  if (process.stdin.isTTY) {
    password = await readHidden('Master password: ');
    const repeated = await readHidden('Repeat it: ');
    if (password !== repeated) throw new Error('The passwords differ');
  } else {
    password = await readPiped();
  }
  if ([...password].length < MIN_LENGTH) {
    throw new Error(`Use at least ${MIN_LENGTH} characters`);
  }
  const passwordHash = await hash(password, COST);
  // base64url keeps $ out of .env: dotenv-expand (run on .env at startup),
  // Docker Compose and Portainer would read the hash's $ signs as variables.
  const encoded = Buffer.from(passwordHash, 'utf8').toString('base64url');
  process.stdout.write(`MASTER_PASSWORD_HASH=${encoded}\n`);
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exit(1);
});
