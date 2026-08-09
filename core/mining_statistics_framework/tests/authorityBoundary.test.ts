import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const directory = fileURLToPath(new URL('../src/', import.meta.url));
const source = readdirSync(directory).filter((name) => name.endsWith('.ts')).map((name) => readFileSync(`${directory}/${name}`, 'utf8')).join('\n');

describe('IMSF authority boundary', () => {
  it('imports no forbidden authority implementation and instantiates no forbidden authority', () => {
    expect(source).not.toMatch(/from\s+['"][^'"]*(?:data_authority|storage_authority|hardware_authority|resource_authority|power_authority|thermal_authority|health_authority|security_authority|certification_authority|arbitration_authority|benchmark_authority|workload_authority|scheduling_authority|observability_authority|miner_process_manager)[^'"]*['"]/);
    expect(source).not.toMatch(/from\s+['"][^'"]*mining_adapter_framework\/src\/(?!types\.js)['"]/);
    expect(source).not.toMatch(/new\s+(?:DataAuthority|StorageAuthority|HardwareAuthority|ResourceAuthority|PowerAuthority|ThermalAuthority|HealthAuthority|SecurityAuthority|CertificationAuthority|ArbitrationAuthority|BenchmarkAuthority|WorkloadAuthority|SchedulingAuthority|ObservabilityAuthority|MiningAdapterFramework|MinerProcessManager)\b/);
  });
});
