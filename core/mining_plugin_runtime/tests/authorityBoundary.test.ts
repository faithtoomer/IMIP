import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
const directory=fileURLToPath(new URL('../src/',import.meta.url));
const source=readdirSync(directory).filter((name)=>name.endsWith('.ts')).map((name)=>readFileSync(`${directory}/${name}`,'utf8')).join('\n');
describe('IMPR authority boundary',()=>{
 it('imports or instantiates no authority/framework implementation, process spawner, or filesystem writer',()=>{
  expect(source).not.toMatch(/from\s+['"][^'"]*(?:hardware_authority|resource_authority|power_authority|thermal_authority|health_authority|security_authority|certification_authority|arbitration_authority|benchmark_authority|workload_authority|scheduling_authority|observability_authority|data_authority|storage_authority|miner_process_manager|mining_statistics_framework|mining_adapter_framework|cpu_mining_framework|gpu_mining_framework|asic_mining_framework)[^'"]*['"]/);
  expect(source).not.toMatch(/new\s+(?:HardwareAuthority|ResourceAuthority|PowerAuthority|ThermalAuthority|HealthAuthority|SecurityAuthority|CertificationAuthority|ArbitrationAuthority|BenchmarkAuthority|WorkloadAuthority|SchedulingAuthority|ObservabilityAuthority|DataAuthority|StorageAuthority|MiningAdapterFramework|CpuMiningFramework|GpuMiningFramework|AsicMiningFramework|MinerProcessManager|MiningStatisticsFramework)\b/);
  expect(source).not.toMatch(/(?:child_process|\.spawn\s*\(|writeFile(?:Sync)?\s*\(|appendFile(?:Sync)?\s*\()/);
 });
});
