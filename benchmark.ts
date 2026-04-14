import { performance } from 'perf_hooks';

// Simulate a network delay of 50ms per database query.
const mockDelay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const NUM_PROFILES = 100;
const profilesData = Array.from({ length: NUM_PROFILES }, (_, i) => ({
  id: `user${i}`,
  kiosque_id: `kiosk${i % 10}` // 10 unique kiosks shared among 100 users
}));

const testNPlusOne = async () => {
  let queryCount = 0;
  const supabase = {
    from: () => ({
      select: () => ({
        eq: (field: string, value: string) => ({
          single: async () => {
            queryCount++;
            await mockDelay(50);
            return { data: { id: value, nom: 'Kiosk ' + value } };
          }
        })
      })
    })
  };

  const start = performance.now();

  const profilesWithKiosks = await Promise.all(
    profilesData.map(async (profile) => {
      if (profile.kiosque_id) {
        try {
          const { data: kioskData } = await supabase
            .from('kiosques')
            .select('id, nom')
            .eq('id', profile.kiosque_id)
            .single();

          if (kioskData) {
            return { ...profile, kiosques: kioskData };
          }
        } catch (kioskError) {}
      }
      return profile;
    })
  );

  const end = performance.now();
  console.log(`N+1 approach took: ${(end - start).toFixed(2)}ms (Queries executed: ${queryCount})`);
  return end - start;
};

const testBatch = async () => {
  let queryCount = 0;
  const supabase = {
    from: () => ({
      select: () => ({
        in: async (field: string, values: string[]) => {
          queryCount++;
          await mockDelay(50);
          return { data: values.map(v => ({ id: v, nom: 'Kiosk ' + v })) };
        }
      })
    })
  };

  const start = performance.now();

  const kioskIds = [...new Set(profilesData.map(p => p.kiosque_id).filter(Boolean))] as string[];
  let kioskMap: Record<string, { id: string; nom: string }> = {};

  if (kioskIds.length > 0) {
    try {
      const { data: kiosksData } = await supabase
        .from('kiosques')
        .select('id, nom')
        .in('id', kioskIds);

      if (kiosksData) {
        kioskMap = Object.fromEntries(kiosksData.map(k => [k.id, k]));
      }
    } catch (kioskError) {}
  }

  const profilesWithKiosks = profilesData.map((profile) => {
    if (profile.kiosque_id && kioskMap[profile.kiosque_id]) {
      return { ...profile, kiosques: kioskMap[profile.kiosque_id] };
    }
    return profile;
  });

  const end = performance.now();
  console.log(`Batched approach took: ${(end - start).toFixed(2)}ms (Queries executed: ${queryCount})`);
  return end - start;
};

const run = async () => {
  console.log("Running benchmarks...");
  await testNPlusOne();
  await testBatch();
};

run();
import { supabase } from './src/lib/supabase'

// Mock the global behavior
async function mockFetchData() {
  const allSales = Array.from({ length: 500 }).map((_, i) => ({
    kiosque_id: \`kiosk-\${i % 20}\`,
    montant_total: Math.random() * 1000
  }))

  const revenueByKioskMap: Record<string, number> = {}
  allSales.forEach(sale => {
    revenueByKioskMap[sale.kiosque_id] = (revenueByKioskMap[sale.kiosque_id] || 0) + sale.montant_total
  })

  return revenueByKioskMap
}

async function runBenchmark1() {
  // Mocking supabase to simulate latency
  const originalFrom = supabase.from
  supabase.from = (table: string) => {
    return {
      select: () => ({
        eq: () => ({
          single: async () => {
            // Simulate 50ms latency for DB query
            await new Promise(resolve => setTimeout(resolve, 50))
            return { data: { nom: 'Test Kiosk' }, error: null }
          }
        }),
        in: (col: string, vals: any[]) => {
           return {
              data: vals.map(v => ({ id: v, nom: 'Test Kiosk' })),
              error: null
           }
        }
      })
    }
  }

  const revenueByKioskMap = await mockFetchData()

  const start = Date.now()
  const revenueByKiosk = await Promise.all(
    Object.entries(revenueByKioskMap).map(async ([kioskId, revenue]) => {
      try {
        const { data: kiosk, error: kioskError } = await supabase.from('kiosques').select('nom').eq('id', kioskId).single()
        return {
          id: kioskId,
          name: kiosk?.nom || 'Kiosque inconnu',
          value: revenue
        }
      } catch (error) {
        return { id: kioskId, name: \`Kiosque \${kioskId}\`, value: revenue }
      }
    })
  )
  const end = Date.now()
  console.log(\`Original (N+1 queries simulated via Promise.all): \${end - start}ms\`)
}

runBenchmark1()
