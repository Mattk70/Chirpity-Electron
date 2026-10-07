import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';

export interface MemSample {
  totalMB: number;
  availableMB?: number;   // approx. memory that can be given to apps without swapping
  compressedMB?: number;  // macOS compressor size - grows before swap does
  swapUsedMB?: number;
  swapTotalMB?: number;
  swapouts?: number;      // cumulative counter (pages on macOS / Linux); look at the delta
}

const MB = 1024 * 1024;
const run = (cmd: string, args: string[]) =>
  execFileSync(cmd, args, { encoding: 'utf8', timeout: 3000 });

function sampleMac(): MemSample {
  const vm = run('vm_stat', []);
  const pageSize = Number(/page size of (\d+) bytes/.exec(vm)?.[1] ?? 4096);
  const pages: Record<string, number> = {};
  for (const line of vm.split('\n')) {
    const m = /^"?(.+?)"?:\s+(\d+)\.?$/.exec(line.trim());
    if (m) pages[m[1]] = Number(m[2]);
  }
  const mb = (p = 0) => Math.round((p * pageSize) / MB);

  // "total = 2048.00M  used = 1032.25M  free = 1015.75M  (encrypted)"
  const swap = run('sysctl', ['-n', 'vm.swapusage']);
  const num = (key: string) => Number(new RegExp(`${key} = ([\\d.]+)M`).exec(swap)?.[1]);

  return {
    totalMB: Math.round(os.totalmem() / MB),
    availableMB: mb((pages['Pages free'] ?? 0) + (pages['Pages inactive'] ?? 0) + (pages['Pages speculative'] ?? 0)),
    compressedMB: mb(pages['Pages occupied by compressor']),
    swapUsedMB: Math.round(num('used')),
    swapTotalMB: Math.round(num('total')),
    swapouts: pages['Swapouts'],
  };
}

function sampleLinux(): MemSample {
  const info: Record<string, number> = {};
  for (const line of fs.readFileSync('/proc/meminfo', 'utf8').split('\n')) {
    const m = /^(\w+):\s+(\d+) kB/.exec(line);
    if (m) info[m[1]] = Number(m[2]) / 1024;
  }
  const pswpout = /^pswpout (\d+)/m.exec(fs.readFileSync('/proc/vmstat', 'utf8'))?.[1];
  return {
    totalMB: Math.round(info.MemTotal),
    availableMB: Math.round(info.MemAvailable),
    swapUsedMB: Math.round(info.SwapTotal - info.SwapFree),
    swapTotalMB: Math.round(info.SwapTotal),
    swapouts: pswpout ? Number(pswpout) : undefined,
  };
}

/** Never throws: monitoring must not break a test. */
export function sampleSystemMemory(): MemSample {
  try {
    if (process.platform === 'darwin') return sampleMac();
    if (process.platform === 'linux') return sampleLinux();
  } catch (e) {
    console.warn('[sysmem] sampling failed:', (e as Error).message);
  }
  return { totalMB: Math.round(os.totalmem() / MB), availableMB: Math.round(os.freemem() / MB) };
}

export function formatSample(s: MemSample, before?: MemSample): string {
  const parts = [`total=${s.totalMB}MB`];
  if (s.availableMB !== undefined) parts.push(`avail~${s.availableMB}MB`);
  if (s.compressedMB !== undefined) parts.push(`compressed=${s.compressedMB}MB`);
  if (s.swapUsedMB !== undefined) parts.push(`swap=${s.swapUsedMB}/${s.swapTotalMB}MB`);
  if (s.swapouts !== undefined) {
    const d = before?.swapouts !== undefined ? ` (+${s.swapouts - before.swapouts} during test)` : '';
    parts.push(`swapouts=${s.swapouts}${d}`);
  }
  return parts.join(' ');
}